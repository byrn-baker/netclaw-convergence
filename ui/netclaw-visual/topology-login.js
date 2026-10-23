import { randomUUID } from 'node:crypto';
import { terminalCredentialOverride } from './terminal-credentials.js';
import { applySshAlgorithmPolicy } from './terminal-ssh-policy.js';

// Authentication-only preflight. Never opens a shell or executes a command.
export class TopologyLogin {
  constructor({ Client, getProfile, knownFingerprint, trustHost, fingerprintOf, keyTypeOf, now = Date.now }) {
    Object.assign(this, { Client, getProfile, knownFingerprint, trustHost, fingerprintOf, keyTypeOf, now });
    this.credentials = new Map();
    this.challenges = new Map();
    this.pending = new Map();
    this.generation = 0;
  }
  clear() {
    this.generation++;
    for (const abort of this.pending.values()) abort();
    this.credentials.clear(); this.challenges.clear();
  }
  forget(id) {
    this.pending.get(id)?.();
    this.credentials.delete(id);
    for (const [token, challenge] of this.challenges) if (challenge.id === id) this.challenges.delete(token);
  }
  profile(id) {
    const cached = this.credentials.get(id);
    const profile = this.getProfile(id, { credentialOverride: cached?.credentials || null });
    if (cached && (profile.host !== cached.host || profile.port !== cached.port || profile.os !== cached.os
      || this.knownFingerprint(profile) !== cached.fingerprint)) {
      this.credentials.delete(id);
      throw new Error('Device identity changed. Use Log in in collector setup to verify it again.');
    }
    return { ...profile, sessionCredentials: Boolean(cached?.credentials) };
  }
  ready(id) { try { return this.credentials.has(id) && Boolean(this.profile(id)); } catch { return false; } }
  async login(input, signal) {
    const id = String(input?.device || '');
    if (!id || id.length > 256) throw new Error('Choose a testbed device.');
    if (this.pending.has(id) || this.pending.size >= 2) throw new Error('Another login check is in progress. Try again when it finishes.');
    const credentials = terminalCredentialOverride(input);
    let profile;
    try { profile = credentials ? this.getProfile(id, { credentialOverride: credentials }) : this.profile(id); }
    catch { throw new Error('Enter a username and password below to log in to this device.'); }
    if (profile.protocol !== 'ssh' || !/^(ios|iosxe|ios-xe|iosv|unknown)$/i.test(profile.os)) throw new Error('This collector supports IOS/IOS-XE SSH profiles only.');
    const legacy = input.legacy === true;
    for (const [token, challenge] of this.challenges) if (challenge.expires < this.now()) this.challenges.delete(token);
    let approved;
    if (input.challenge) {
      approved = this.challenges.get(input.challenge);
      this.challenges.delete(input.challenge);
      if (!approved || approved.id !== id || approved.host !== profile.host || approved.port !== profile.port
        || approved.legacy !== legacy || approved.expires < this.now()) throw new Error('Host-key approval expired or the device changed. Test login again.');
    }
    const previousFingerprint = this.knownFingerprint(profile) || null;
    if (approved && approved.previousFingerprint !== previousFingerprint) throw new Error('Saved host key changed. Test login again before approving.');
    const generation = this.generation;
    return new Promise((resolve, reject) => {
      const client = new this.Client();
      let finished = false;
      let observedFingerprint;
      let observedKeyType;
      let hostChallenge;
      const finish = (error, result) => {
        if (finished) return;
        finished = true; clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        this.pending.delete(id);
        client.destroy();
        if (error) reject(error); else resolve(result);
      };
      const abort = () => finish(new Error('Login check cancelled.'));
      const timer = setTimeout(() => finish(new Error('SSH login timed out. Check device reachability.')), 20000);
      this.pending.set(id, abort);
      signal?.addEventListener('abort', abort, { once: true });
      client.on('error', error => hostChallenge ? finish(null, hostChallenge) : finish(new Error(error.level === 'client-authentication'
        ? 'Login failed. Check the username and password and try again.'
        : error.code === 'ECONNREFUSED' ? 'Connection refused. The selected device is not accepting SSH on its configured port.'
          : error.code === 'EACCES' || error.code === 'EPERM' ? 'This computer blocked the SSH connection. Check local firewall or process permissions.'
            : error.code === 'ETIMEDOUT' || error.level === 'client-timeout' ? 'SSH connection timed out before login. Check that the device is running and reachable.'
        : /no matching key exchange/i.test(error.message) ? 'No compatible key exchange. Enable legacy KEX only for a trusted legacy device.'
          : 'SSH login failed. Check the endpoint, SSH service and selected compatibility mode.')));
      client.on('close', () => { if (!finished) hostChallenge ? finish(null, hostChallenge) : finish(new Error('SSH closed before login completed.')); });
      client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, answer) => answer(prompts.map(() => profile.password || '')));
      client.on('ready', () => {
        try {
          if (generation !== this.generation || signal?.aborted) return abort();
          const current = this.getProfile(id, { credentialOverride: credentials || this.credentials.get(id)?.credentials || null });
          if (current.host !== profile.host || current.port !== profile.port || current.os !== profile.os
            || (this.knownFingerprint(current) || null) !== previousFingerprint) throw new Error('Device profile or saved key changed during login. Test again.');
          if (approved) this.trustHost(profile, observedFingerprint, observedKeyType);
          this.credentials.set(id, { host: profile.host, port: profile.port, os: profile.os, fingerprint: observedFingerprint,
            credentials: credentials || this.credentials.get(id)?.credentials || null });
          finish(null, { status: 'ready', device: id, sessionCredentials: Boolean(this.credentials.get(id).credentials) });
        } catch { finish(new Error('Unable to complete verified login. Check the profile and local host-key storage, then retry.')); }
      });
      const config = { host: profile.host, port: profile.port, username: profile.username, readyTimeout: 15000,
        tryKeyboard: Boolean(profile.password), hostVerifier: key => {
          observedFingerprint = this.fingerprintOf(key); observedKeyType = this.keyTypeOf(key);
          if (approved ? observedFingerprint === approved.fingerprint : observedFingerprint === previousFingerprint) return true;
          const challenge = randomUUID();
          if (this.challenges.size >= 64) this.challenges.delete(this.challenges.keys().next().value);
          this.challenges.set(challenge, { id, host: profile.host, port: profile.port, legacy, fingerprint: observedFingerprint,
            previousFingerprint, expires: this.now() + 120000 });
          // Defer teardown until ssh2 has processed rejection. No credentials
          // are sent to an unapproved key, including a key changed between tries.
          hostChallenge = { status: 'host-key', device: id, host: profile.host, port: profile.port,
            challenge, fingerprint: observedFingerprint, keyType: observedKeyType, previousFingerprint, changed: Boolean(previousFingerprint) };
          queueMicrotask(() => finish(null, hostChallenge));
          return false;
        } };
      for (const key of ['password', 'privateKey', 'passphrase', 'agent']) if (profile[key]) config[key] = profile[key];
      applySshAlgorithmPolicy(config, { legacySshCompatibility: legacy });
      if (signal?.aborted) return abort();
      try { client.connect(config); } catch { finish(new Error('Unable to start SSH login.')); }
    });
  }
}
