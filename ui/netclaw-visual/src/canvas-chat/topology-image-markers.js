export const topologyContextKey = (deviceId, token) => JSON.stringify([deviceId, token.type, token.value, token.vrf || null]);

export function validDevicePoints(points = []) {
  const seen = new Set();
  return (Array.isArray(points) ? points : []).filter(p => {
    if (!p || typeof p.deviceId !== 'string' || !p.deviceId || seen.has(p.deviceId)
      || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return false;
    seen.add(p.deviceId); return true;
  }).map(({ deviceId, x, y }) => ({ deviceId, x, y }));
}

function prefix(value) {
  const [ip, bits = '32'] = String(value).split('/');
  const parts = ip.split('.').map(Number), length = Number(bits);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)
    || !Number.isInteger(length) || length < 0 || length > 32) return null;
  const mask = length ? (0xffffffff << (32 - length)) >>> 0 : 0;
  return { length, mask, network: (parts.reduce((n, byte) => (n << 8) | byte, 0) & mask) >>> 0 };
}

// Rendering roles, not health indicators. Never infer image positions from names.
export function topologyMarkers({ activeDeviceId, devices = [], token, context, points = [] }) {
  const known = new Map(devices.map(d => [d.id, d]));
  const label = id => known.get(id)?.alias || known.get(id)?.name || id;
  const roles = activeDeviceId && known.has(activeDeviceId)
    ? [{ deviceId: activeDeviceId, role: 'current', label: `Current terminal: ${label(activeDeviceId)}` }] : [];
  let note = 'Waiting for fresh route correlation.';
  const result = context?.key === topologyContextKey(activeDeviceId, token) && !context.unavailable ? context.result : null;
  if (result?.collection?.enabled) {
    const freshIds = new Set((result.collection.devices || []).filter(d => !d.stale && !d.error).map(d => d.id));
    const target = prefix(token.value);
    const rows = (result.observations || []).filter(r => r.deviceId === activeDeviceId && !r.stale && freshIds.has(r.deviceId)
      && r.vrf && (!token.vrf || r.vrf === token.vrf)).filter(r => {
      const p = prefix(r.prefix);
      return target && p && p.length <= target.length && ((target.network & p.mask) >>> 0) === p.network;
    });
    // With no known VRF, do not let one VRF's connected route suppress another's learned route.
    const scopes = new Set([...rows.map(r => r.vrf), ...(result.closest?.candidates || []).map(c => c.vrf)]);
    const scoped = token.vrf || (scopes.size === 1 && !scopes.has(null));
    const longest = Math.max(-1, ...rows.map(r => prefix(r.prefix).length));
    const selected = rows.filter(r => prefix(r.prefix).length === longest);
    const direct = scoped && selected.length && selected.every(r => r.local || r.connected || r.protocol === 'L' || r.protocol === 'C');
    const candidates = (result.closest?.candidates || []).filter(c => c.deviceId !== activeDeviceId && known.has(c.deviceId)
      && freshIds.has(c.deviceId) && !c.stale && c.kind !== 'interface-address' && c.vrf && (!token.vrf || c.vrf === token.vrf));
    // A connected subnet is not ownership of every host on it. Prefer exact,
    // fresh remote /32 ownership when hovering that host (IP or /32 token).
    const remoteOwner = target?.length === 32 && candidates.some(c => {
      const p = prefix(c.prefix);
      return c.kind === 'local-address' && p?.length === 32 && p.network === target.network;
    });
    const currentOwnsHost = selected.some(r => (r.local || r.protocol === 'L') && prefix(r.prefix)?.length === 32);
    if (direct && (!remoteOwner || currentOwnsHost)) note = 'Local or directly connected on the current terminal router — green only.';
    else if (!scoped) note = 'Reporting light withheld: VRF is unknown or ambiguous.';
    else {
      for (const c of candidates) if (!roles.some(r => r.deviceId === c.deviceId)) roles.push({ deviceId: c.deviceId, role: 'reporting',
        label: `Closest reporting device${c.kind === 'known-frontier' ? ' (inferred)' : candidates.length > 1 ? ' (candidate)' : ''}: ${label(c.deviceId)} · VRF ${c.vrf}` });
      note = candidates.length ? remoteOwner && direct
        ? 'The current router is on this subnet, but this exact IP belongs to the remote reporting device — both routers are marked.'
        : 'Red identifies the closest known reporter, not necessarily the IP owner.'
        : !result.closest ? 'Reporting light unavailable: restart the NetClaw API to enable closest-device correlation.'
          : 'No fresh remote reporting device identified. Image mappings set positions; they do not authorize device collection.';
    }
  } else if (context?.unavailable) note = 'Reporting light unavailable — collection service could not be reached.';
  else if (result?.collection && !result.collection.enabled) note = 'Reporting light unavailable — automatic collection is off. Authorize devices in Manage authorization.';
  const mapped = new Map(validDevicePoints(points).map(p => [p.deviceId, p]));
  return { markers: roles.filter(r => mapped.has(r.deviceId)).map(r => ({ ...r, ...mapped.get(r.deviceId) })),
    missing: roles.filter(r => !mapped.has(r.deviceId)).map(r => label(r.deviceId)), note };
}

// Same fitted rectangle for image, overlay and pointer hit-testing (letterbox safe).
export function fittedImageRect(width, height, imageWidth, imageHeight) {
  const scale = Math.min(width / imageWidth, height / imageHeight);
  return { width: imageWidth * scale, height: imageHeight * scale,
    left: (width - imageWidth * scale) / 2, top: (height - imageHeight * scale) / 2 };
}
