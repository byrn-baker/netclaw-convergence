import net from 'node:net';

export function canonicalPrefix(value) {
  const [ip, bits, extra] = String(value).split('/');
  if (extra !== undefined || net.isIP(ip) !== 4 || !/^\d{1,2}$/.test(bits || '')) return null;
  const length = Number(bits);
  if (length > 32) return null;
  const address = ip.split('.').reduce((n, octet) => (n * 256 + Number(octet)) >>> 0, 0);
  const mask = length === 0 ? 0 : (0xffffffff << (32 - length)) >>> 0;
  const network = (address & mask) >>> 0;
  return { prefix: `${[24, 16, 8, 0].map(shift => (network >>> shift) & 255).join('.')}/${length}`, network, length, mask };
}

export function cleanIosOutput(text) {
  return String(text).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '').replace(/.\x08/g, '');
}

export function isIosCommandError(text) {
  return /(?:^|\n)\s*%\s*(?:Invalid|Error|Incomplete|Ambiguous|Authorization|Unrecognized)|authorization failed|permission denied/i.test(cleanIosOutput(text));
}

/** Parse IPv4 IOS/IOS-XE RIB observations, not an inferred physical topology. */
export function parseIosRoutes(text, initialVrf = 'default') {
  const clean = cleanIosOutput(text);
  if (isIosCommandError(clean) || !/Codes:|Gateway of last resort|Routing Table:/.test(clean)) {
    throw new Error('Route output was rejected or not recognized as an IOS IPv4 routing table.');
  }
  let vrf = initialVrf;
  let inheritedMask = null;
  let pending = null;
  let pendingAccepted = false;
  const routes = [];
  const vrfs = new Set([initialVrf]);
  let skipped = 0;
  const add = (tail) => {
    if (!pending) return false;
    const via = tail.match(/\bvia\s+(\d+\.\d+\.\d+\.\d+)/);
    const connected = /is directly connected/.test(tail);
    if (!via && !connected) return false;
    if (via && net.isIP(via[1]) !== 4) return false;
    const metric = tail.match(/\[(\d+)\/(\d+)\]/);
    const iface = tail.split(',').map(value => value.trim()).find(value => /^(?:[A-Za-z][\w.-]*\d[\w./:-]*|Null0)$/.test(value));
    routes.push({ ...pending, nextHop: via?.[1] || null, interface: iface || null,
      distance: metric ? Number(metric[1]) : null, metric: metric ? Number(metric[2]) : null,
      connected: pending.protocol === 'C', local: pending.protocol === 'L' });
    pendingAccepted = true;
    return true;
  };
  for (const line of clean.split('\n')) {
    const table = line.match(/^Routing Table:\s*(.+?)\s*$/);
    if (table) { if (pending && !pendingAccepted) skipped += 1; vrf = table[1]; vrfs.add(vrf); inheritedMask = null; pending = null; continue; }
    const subnet = line.match(/^\s+\d+\.\d+\.\d+\.\d+\/(\d+) is (variably )?subnetted/);
    if (subnet) { if (pending && !pendingAccepted) skipped += 1; inheritedMask = subnet[2] ? null : Number(subnet[1]); pending = null; continue; }
    const row = line.match(/^([A-Zia][*+%]?(?:\s*(?:IA|E1|E2|N1|N2|EX|L1|L2|su|ia))?[*+%]?)\s+(\d+\.\d+\.\d+\.\d+)(?:\/(\d+))?(?:\s+(.*))?$/);
    if (row) {
      if (pending && !pendingAccepted) skipped += 1;
      const bits = row[3] !== undefined ? Number(row[3]) : inheritedMask;
      const prefix = bits == null ? null : canonicalPrefix(`${row[2]}/${bits}`);
      pending = prefix ? { vrf, prefix: prefix.prefix, protocol: row[1].trim().replace(/[*+%]/g, '').trim() } : null;
      pendingAccepted = false;
      if (!pending) { skipped += 1; continue; }
      if (row[4] && !add(row[4])) skipped += 1;
    } else if (pending && /^\s+(?:\[\d+\/\d+\]\s+)?via\s+/.test(line)) {
      if (!add(line)) skipped += 1;
    } else if (/^[A-Za-z*+%][A-Za-z0-9*+% ]{0,8}\s+\d+\.\d+\.\d+\.\d+\//.test(line)) {
      skipped += 1;
    }
    if (routes.length > 100000) throw new Error('Route table exceeds the collection limit.');
  }
  if (pending && !pendingAccepted) skipped += 1;
  if (skipped) throw new Error('Some routing rows could not be parsed; previous observations retained as stale.');
  return { routes, vrfs: [...vrfs] };
}

export function correlateRoutes(snapshots, query, now, staleAfterMs) {
  const prefix = query.type === 'prefix' ? canonicalPrefix(query.value) : null;
  const host = query.type === 'ip' && net.isIP(query.value) === 4 ? canonicalPrefix(`${query.value}/32`) : null;
  if (!prefix && !host) return { observations: [], relationships: [], unsupported: true };
  const observations = [];
  const ownership = new Map();
  for (const snapshot of snapshots) {
    const stale = Boolean(snapshot.failed) || now - snapshot.observedAt > staleAfterMs;
    for (const route of snapshot.routes) {
      if (route.local && route.prefix.endsWith('/32')) {
        const key = `${route.vrf}:${route.prefix.slice(0, -3)}`;
        const owners = ownership.get(key) || [];
        const observedAt = route.observedAt || snapshot.observedAt;
        owners.push({ deviceId: snapshot.deviceId, device: snapshot.device, observedAt,
          stale: stale || Boolean(route.stale) || now - observedAt > staleAfterMs });
        ownership.set(key, owners);
      }
    }
    const matching = snapshot.routes.filter(route => {
      if (query.vrf && route.vrf !== query.vrf) return false;
      if (prefix) return route.prefix === prefix.prefix;
      const candidate = canonicalPrefix(route.prefix);
      return candidate && ((host.network & candidate.mask) >>> 0) === candidate.network;
    });
    // For host lookups use longest prefix per VRF, not every default route.
    const longest = new Map();
    if (host) for (const route of matching) longest.set(route.vrf, Math.max(longest.get(route.vrf) ?? -1, Number(route.prefix.split('/')[1])));
    for (const route of matching) {
      if (host && Number(route.prefix.split('/')[1]) !== longest.get(route.vrf)) continue;
      observations.push({ ...route, deviceId: snapshot.deviceId, device: snapshot.device,
        observedAt: route.observedAt || snapshot.observedAt,
        stale: stale || Boolean(route.stale) || now - (route.observedAt || snapshot.observedAt) > staleAfterMs });
    }
  }
  const relationships = observations.filter(row => row.nextHop).flatMap(row =>
    (ownership.get(`${row.vrf}:${row.nextHop}`) || []).filter(owner => owner.deviceId !== row.deviceId)
      .map(owner => ({ from: row.device, to: owner.device, nextHop: row.nextHop, vrf: row.vrf,
        stale: row.stale || owner.stale, observedAt: Math.min(row.observedAt, owner.observedAt),
        evidence: 'Next-hop address matches a local /32 reported by the other device; not proof of a physical link.' })));
  return { observations: observations.slice(0, 200), relationships: relationships.slice(0, 200),
    truncated: observations.length > 200 || relationships.length > 200, unsupported: false };
}
