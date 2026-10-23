import { canonicalPrefix } from './topology-routes.js';

// Destination proximity, not latency, physical distance or ownership inferred
// from ARP. Compare within a VRF only; never compare metrics across protocols.
export function closestReportingDevices(snapshots, query, now, staleAfterMs) {
  const target = canonicalPrefix(query.type === 'ip' ? `${query.value}/32` : query.value);
  const unknown = reason => ({ status: 'undetermined', candidates: [], reason });
  if (!target) return unknown('Closest-device correlation currently supports IPv4 only.');
  const fresh = at => Number.isFinite(at) && at > 0 && now - at <= staleAfterMs;
  const contains = (outer, inner) => outer && outer.length <= inner.length
    && ((inner.network & outer.mask) >>> 0) === outer.network;
  const owners = new Map(), groups = new Map(), interfaceMatches = [];
  for (const snapshot of snapshots) {
    const eligible = [];
    for (const route of snapshot.routes || []) {
      const at = route.observedAt || snapshot.observedAt;
      if (snapshot.failed || snapshot.collectionFailed || route.stale || !fresh(at)) continue;
      const prefix = canonicalPrefix(route.prefix);
      const vrf = route.vrf;
      if (!prefix || !vrf || (query.vrf && vrf !== query.vrf)) continue;
      if (route.local && prefix.length === 32) {
        const key = `${vrf}:${prefix.prefix.split('/')[0]}`;
        owners.set(key, [...(owners.get(key) || []), { deviceId: snapshot.deviceId, observedAt: at }]);
      }
      if (contains(prefix, target)) eligible.push({ ...route, observedAt: at, bits: prefix.length });
    }
    // Preserve ECMP and use the selected longest match for each reporter/VRF.
    for (const vrf of new Set(eligible.map(row => row.vrf))) {
      const rows = eligible.filter(row => row.vrf === vrf);
      const length = Math.max(...rows.map(row => row.bits));
      const selected = rows.filter(row => row.bits === length);
      const group = groups.get(vrf) || [];
      group.push({ deviceId: snapshot.deviceId, device: snapshot.device, vrf, rows: selected });
      groups.set(vrf, group);
    }
    // Current IOS interface sources do not supply VRF. Keep these as explicit
    // unscoped evidence, never assert they belong to a requested named context.
    if (target.length === 32 && !query.vrf && !snapshot.collectionFailed) {
      for (const id of ['interfaceBrief', 'interfaces']) {
        const source = snapshot.facts?.[id];
        if (!source || source.failed || !fresh(source.observedAt)) continue;
        const row = source.records?.find(row => row.address?.split('/')[0] === target.prefix.split('/')[0]);
        if (row) {
          interfaceMatches.push({ deviceId: snapshot.deviceId, device: snapshot.device, vrf: null,
            kind: 'interface-address', reason: 'Exact interface IP; VRF not reported (scope unverified).',
            interface: row.interface, observedAt: source.observedAt });
          break;
        }
      }
    }
  }
  const candidates = [], unresolvedVrfs = [];
  const candidate = (device, kind, reason) => ({ deviceId: device.deviceId, device: device.device,
    vrf: device.vrf, kind, reason, prefix: device.rows[0].prefix,
    interface: device.rows[0].interface, observedAt: Math.min(...device.rows.map(row => row.observedAt)) });
  for (const [vrf, devices] of groups) {
    const local = target.length === 32 ? devices.filter(d => d.rows.some(r => r.local && r.bits === 32)) : [];
    const connected = devices.filter(d => d.rows.some(r => r.connected));
    if (local.length || connected.length) {
      for (const d of local.length ? local : connected) candidates.push(candidate(d,
        local.length ? 'local-address' : 'connected-network', local.length
          ? 'This IP is reported local on this device.'
          : 'This device is directly connected to the destination network; it does not necessarily own the host IP.'));
      continue;
    }
    // Fall back only when all known reporters converge on one downstream
    // reporter. Unknown branches, duplicate next-hop owners and cycles make
    // that inference unsafe. A lone route (especially default) is insufficient.
    const ids = new Set(devices.map(d => d.deviceId));
    const edges = new Map();
    const ambiguous = new Set();
    const linkTimes = [];
    for (const d of devices) {
      const next = new Set();
      for (const r of d.rows) {
        const evidence = owners.get(`${vrf}:${r.nextHop}`) || [];
        const matches = [...new Set(evidence.map(owner => owner.deviceId))];
        if (!r.nextHop || matches.length !== 1 || !ids.has(matches[0]) || matches[0] === d.deviceId) ambiguous.add(d.deviceId);
        else { next.add(matches[0]); linkTimes.push(...evidence.map(owner => owner.observedAt)); }
      }
      edges.set(d.deviceId, [...next]);
    }
    const sinks = devices.filter(d => !edges.get(d.deviceId).length && d.rows.every(r => r.nextHop && r.bits > 0 && !/^Null/i.test(r.interface || '')));
    if (devices.length > 1 && sinks.length === 1) {
      const sink = sinks[0];
      const memo = new Map();
      const reaches = (id, visiting = new Set()) => {
        if (id === sink.deviceId) return true;
        if (visiting.has(id) || ambiguous.has(id) || !edges.get(id)?.length) return false;
        if (memo.has(id)) return memo.get(id);
        const result = edges.get(id).every(next => reaches(next, new Set([...visiting, id])));
        memo.set(id, result);
        return result;
      };
      if (devices.every(d => reaches(d.deviceId))) {
        const result = candidate(sink, 'known-frontier', 'Furthest known downstream reporter toward the destination. Remaining hops and IP ownership are unknown.');
        // The inference depends on every route in the chain, not just the sink.
        result.observedAt = Math.min(...linkTimes, ...devices.flatMap(d => d.rows.map(r => r.observedAt)));
        candidates.push(result);
        continue;
      }
    }
    unresolvedVrfs.push(vrf);
  }
  // An unscoped interface match is useful but cannot be merged into a VRF.
  for (const match of interfaceMatches) if (!candidates.some(c => c.deviceId === match.deviceId && c.kind === 'local-address')) candidates.push(match);
  candidates.sort((a, b) => (a.vrf || '').localeCompare(b.vrf || '') || a.deviceId.localeCompare(b.deviceId));
  if (!candidates.length) return unknown('No fresh local/connected evidence or unambiguous downstream path. A route, ARP entry or neighbor advertisement alone cannot identify the closest device.');
  return { status: candidates.length > 1 ? 'multiple' : candidates[0].kind === 'known-frontier' ? 'inferred' : 'matched',
    candidates, unresolvedVrfs,
    reason: 'Closest known among collected, authorized devices—not a complete physical path. Separate VRFs and equal candidates are not ranked against each other.' };
}
