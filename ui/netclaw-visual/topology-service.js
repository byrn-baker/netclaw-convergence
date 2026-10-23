import fs from 'node:fs';
import path from 'node:path';
import { parseIosRoutes, isIosCommandError, correlateRoutes } from './topology-routes.js';
import { normalizeTopologyScopes, TOPOLOGY_SCOPES } from './topology-scope.js';
import { updateFacts, correlateFacts, FACT_SOURCES } from './topology-facts.js';
import { closestReportingDevices } from './topology-closest.js';

export const supportsTopology = profile => profile.protocol === 'ssh' && /^(ios|iosxe|ios-xe|iosv|unknown)$/i.test(profile.os);

export class TopologyService {
  constructor({ file, getProfile, listProfiles, knownFingerprint, collect, now = Date.now, autoStart = true }) {
    Object.assign(this, { file, getProfile, listProfiles, knownFingerprint, collect, now });
    this.grants = [];
    this.intervalSeconds = 30;
    this.states = new Map();
    this.snapshots = new Map();
    this.active = new Map();
    this.generation = 0;
    this.revision = 0;
    this.audit = [];
    this.storageError = null;
    if (file) {
      try {
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (saved.version === 1 && Array.isArray(saved.grants) && saved.grants.length <= 32) {
          this.grants = saved.grants.filter(g => typeof g.id === 'string' && typeof g.host === 'string'
            && Number.isInteger(g.port) && typeof g.fingerprint === 'string' && supportsTopology(g));
          // Old grants remain routes-only. Never silently broaden consent.
          this.grants = this.grants.map(g => ({ ...g, scopes: normalizeTopologyScopes(g.scopes),
            ...(g.sessionCredentials ? { blocked: true, pauseReason: 'Log in again in collector setup; session credentials are not saved across API restarts.' } : {}) }));
          this.intervalSeconds = Math.max(15, Math.min(300, Number(saved.intervalSeconds) || 30));
          this.audit = Array.isArray(saved.audit) ? saved.audit.slice(-100) : [];
        }
      } catch (error) {
        this.grants = [];
        if (error.code !== 'ENOENT') this.storageError = 'Saved authorization could not be read. Collection is disabled until reauthorized.';
      }
    }
    if (autoStart) this.start();
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 1000);
    this.timer.unref?.();
  }

  save(grants, intervalSeconds, action) {
    const audit = [...this.audit, { at: this.now(), action, devices: grants.map(g => g.id),
      scopes: [...new Set(grants.flatMap(g => g.scopes || ['routes']))], intervalSeconds }].slice(-100);
    if (this.file) {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const temporary = `${this.file}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify({ version: 1, grants, intervalSeconds, audit }, null, 2), { mode: 0o600 });
      fs.renameSync(temporary, this.file);
    }
    this.audit = audit;
  }

  authorize(input) {
    if (input?.authorized !== true) throw new Error('Explicit authorization is required.');
    const scopes = normalizeTopologyScopes(input.scopes);
    if (!Array.isArray(input.devices) || !input.devices.length || input.devices.length > 32) throw new Error('Select 1–32 testbed devices.');
    const interval = Number(input.intervalSeconds);
    if (!Number.isInteger(interval) || interval < 15 || interval > 300) throw new Error('Choose an interval between 15 and 300 seconds.');
    const ids = new Set();
    const grants = input.devices.map(selection => {
      if (typeof selection.id !== 'string' || ids.has(selection.id)) throw new Error('Device IDs must be unique testbed entries.');
      ids.add(selection.id);
      const profile = this.getProfile(selection.id);
      if (!supportsTopology(profile)) throw new Error(`${selection.id}: automatic collection currently supports IOS/IOS-XE SSH profiles (or unknown OS with read-only IOS detection) only.`);
      const fingerprint = this.knownFingerprint(profile);
      if (!fingerprint) throw new Error(`${selection.id}: use Log in in this panel to enter credentials and verify the SSH host key.`);
      return { id: profile.id, alias: profile.alias, host: profile.host, port: profile.port,
        protocol: profile.protocol, os: profile.os, fingerprint, sessionCredentials: profile.sessionCredentials === true,
        legacy: selection.legacy === true, scopes, authorizedAt: this.now() };
    });
    // Persist first: a disk failure cannot silently create a non-durable grant.
    this.save(grants, interval, 'authorize');
    this.cancel();
    this.grants = grants;
    this.intervalSeconds = interval;
    this.states.clear();
    this.snapshots.clear();
    this.storageError = null;
    this.revision += 1;
    this.tick();
    return this.status();
  }

  revoke() {
    // Stop current work even if writing the revoked grant to disk fails.
    this.cancel();
    this.grants = [];
    this.states.clear();
    this.snapshots.clear();
    this.revision += 1;
    try { this.save([], this.intervalSeconds, 'revoke'); this.storageError = null; }
    catch { this.storageError = 'Collection stopped, but revocation could not be saved. Repair authorization storage before restarting NetClaw.'; throw new Error(this.storageError); }
    return this.status();
  }

  revokeDevice(id) {
    const remaining = this.grants.filter(grant => grant.id !== id);
    // Persist before changing inventory; a write failure must not leave an old
    // grant that could resume against a replaced profile after restart.
    if (remaining.length !== this.grants.length) this.save(remaining, this.intervalSeconds, `device-revoked:${id}`);
    this.grants = remaining;
    this.active.get(id)?.abort();
    this.active.delete(id);
    this.states.delete(id);
    this.snapshots.delete(id);
    this.revision++;
  }

  cancel() {
    this.generation += 1;
    for (const controller of this.active.values()) controller.abort();
    this.active.clear();
  }

  stop() { clearInterval(this.timer); this.timer = null; this.cancel(); }

  tick() {
    const now = this.now();
    for (const grant of this.grants) {
      if (this.active.size >= 2) break;
      const state = this.states.get(grant.id);
      if (this.active.has(grant.id) || grant.blocked || state?.blocked || (state?.nextAt || 0) > now) continue;
      void this.run(grant);
    }
  }

  async run(grant) {
    const generation = this.generation;
    const controller = new AbortController();
    this.active.set(grant.id, controller);
    const previous = this.states.get(grant.id) || { failures: 0 };
    const lastAttempt = this.now();
    this.states.set(grant.id, { ...previous, phase: 'collecting', lastAttempt });
    try {
      let profile;
      try { profile = this.getProfile(grant.id); }
      catch { throw Object.assign(new Error('Saved device credentials/profile are unavailable. Fix the testbed and authorize again.'), { code: 'BLOCKED' }); }
      if (profile.host !== grant.host || profile.port !== grant.port || profile.os !== grant.os
        || this.knownFingerprint(profile) !== grant.fingerprint || !supportsTopology(profile)) {
        throw Object.assign(new Error('Device endpoint, platform or trusted key changed. Verify and authorize again.'), { code: 'BLOCKED' });
      }
      const scopes = normalizeTopologyScopes(grant.scopes);
      const output = await this.collect({ profile, fingerprint: grant.fingerprint, legacy: grant.legacy, scopes, signal: controller.signal });
      if (generation !== this.generation || controller.signal.aborted) return;
      const previousSnapshot = this.snapshots.get(grant.id);
      const observedAt = this.now();
      let routes = previousSnapshot?.routes || [];
      let routeFailed = false;
      let routeObservedAt = output.collectedAt?.['show ip route'] || observedAt;
      let coverage = 'IPv4 default and named VRFs';
      const warnings = [];
      try {
        routes = parseIosRoutes(output.global).routes;
        try {
          if (isIosCommandError(output.vrfs) || !/Routing Table:|Codes:|Gateway of last resort/.test(output.vrfs || '')) throw new Error('Named VRFs unavailable');
          const namedAt = output.collectedAt?.['show ip route vrf *'] || observedAt;
          routes.push(...parseIosRoutes(output.vrfs).routes.filter(route => route.vrf !== 'default').map(route => ({ ...route, observedAt: namedAt })));
        } catch {
          coverage = 'IPv4 default VRF only';
          warnings.push('Named-VRF coverage unverified; no tables, unsupported, denied or unreadable output. Prior named-VRF evidence is stale.');
          routes.push(...(previousSnapshot?.routes || []).filter(route => route.vrf !== 'default').map(route => ({ ...route, stale: true, observedAt: route.observedAt || previousSnapshot.observedAt })));
        }
      } catch (error) {
        routeFailed = true;
        routeObservedAt = previousSnapshot?.observedAt || null;
        coverage = 'Routing table unavailable';
        warnings.push(error.message);
      }
      const facts = updateFacts(previousSnapshot?.facts, output.outputs, scopes, observedAt, output.collectedAt);
      const datasets = FACT_SOURCES.filter(source => scopes.includes(source.scope)).map(source => {
        const fact = facts[source.id];
        if (fact.failed) warnings.push(`${source.label}: ${fact.error}`);
        return { id: source.id, label: source.label, command: source.command, failed: fact.failed, count: fact.records.length, observedAt: fact.observedAt || null, error: fact.error || null };
      });
      // Successful sources replace prior records; only failed sources retain
      // stale evidence. One unsupported protocol does not suppress other data.
      this.snapshots.set(grant.id, { deviceId: grant.id, device: profile.alias || grant.id, routes, observedAt: routeObservedAt,
        coverage, failed: routeFailed, collectionFailed: false, facts });
      const anyCurrent = !routeFailed || datasets.some(source => !source.failed);
      this.states.set(grant.id, { phase: warnings.length ? 'partial' : 'current', lastAttempt, partial: warnings.length > 0,
        lastSuccess: anyCurrent ? observedAt : previous.lastSuccess, nextAt: observedAt + this.intervalSeconds * 1000,
        failures: anyCurrent ? 0 : previous.failures + 1, coverage, datasets, warning: warnings.join(' ') || null });
      this.revision += 1;
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return;
      const failures = previous.failures + 1;
      const blocked = error.code === 'BLOCKED';
      const snapshot = this.snapshots.get(grant.id);
      if (snapshot) { snapshot.failed = true; snapshot.collectionFailed = true; }
      this.states.set(grant.id, { ...previous, lastAttempt, phase: blocked ? 'authorization-needed' : 'unavailable', blocked,
        failures, error: error.message, nextAt: this.now() + Math.min(300000, this.intervalSeconds * 1000 * (2 ** Math.min(failures - 1, 4))) });
      if (blocked) {
        grant.blocked = true;
        grant.pauseReason = error.message;
        try { this.save(this.grants, this.intervalSeconds, `device-paused:${grant.id}`); }
        catch { this.storageError = 'Device paused in memory, but the pause could not be saved. Repair authorization storage before restarting NetClaw.'; }
      }
      this.revision += 1;
    } finally {
      if (this.active.get(grant.id) === controller) this.active.delete(grant.id);
    }
  }

  status() {
    const now = this.now();
    const staleAfterMs = this.intervalSeconds * 2500;
    return { enabled: this.grants.length > 0, intervalSeconds: this.intervalSeconds, revision: this.revision,
      mode: 'Read-only SSH polling · IOS/IOS-XE IPv4', storageError: this.storageError,
      scopes: [...new Set(this.grants.flatMap(grant => grant.scopes || ['routes']))], availableScopes: TOPOLOGY_SCOPES,
      devices: this.grants.map(grant => {
        const state = this.states.get(grant.id) || (grant.blocked
          ? { phase: 'authorization-needed', blocked: true, error: grant.pauseReason } : { phase: 'queued' });
        return { id: grant.id, alias: grant.alias, legacy: grant.legacy, scopes: grant.scopes || ['routes'], authorizedAt: grant.authorizedAt,
          ...state, stale: !state.lastSuccess || now - state.lastSuccess > staleAfterMs || state.failures > 0,
          partial: Boolean(state.partial) };
      }), audit: this.audit.slice(-10) };
  }

  lookup(query) {
    const snapshots = [...this.snapshots.values()];
    const routes = correlateRoutes(snapshots, query, this.now(), this.intervalSeconds * 2500);
    return { ...routes, context: correlateFacts(snapshots, query, routes.observations, this.now(), this.intervalSeconds * 2500),
      closest: closestReportingDevices(snapshots, query, this.now(), this.intervalSeconds * 2500),
      collection: this.status(), vrf: query.vrf || null, generatedAt: this.now() };
  }
}
