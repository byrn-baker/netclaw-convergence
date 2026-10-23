// A route alone never proves address ownership. Existing VRF and freshness
// qualifiers remain visible below the label, including for interface matches.
export function identitySourceLabel(row) {
  if (row.currentDeviceRelation) return currentDeviceLabel(row.currentDeviceRelation);
  return row.match === 'Address reported local by this router (RIB evidence)'
    || row.match === 'Exact interface-address match; interface VRF not reported'
    ? 'Device with this IP'
    : 'Reporting router';
}

export function closestSourceLabel(row, closest, unavailable = false) {
  if (row.currentDeviceRelation) return currentDeviceLabel(row.currentDeviceRelation);
  if (unavailable || row.stale || row.associationStale) return 'Reporting device';
  const candidates = closest?.candidates || [];
  const matches = candidates.filter(c => c.deviceId === row.deviceId && (!row.vrf || c.vrf === row.vrf));
  if (!matches.length) return 'Reporting device';
  return matches.some(c => c.kind === 'known-frontier') ? 'Closest known reporting device (inferred)'
    : candidates.length > 1 ? 'Closest reporting device (candidate)' : 'Closest reporting device';
}

const routeKind = row => row.local || row.protocol === 'L' ? 'local'
  : row.connected || row.protocol === 'C' ? 'connected' : 'learned';
function currentDeviceLabel(kind) {
  return kind === 'local' ? 'Current router — IP is local'
    : kind === 'connected' ? 'Current router — directly connected network'
      : kind === 'unscoped-interface' ? 'Current router — interface IP (VRF unverified)'
        : kind === 'multiple-contexts' ? 'Current router — local/connected evidence (see VRF)'
          : 'Observed on current router';
}
export function routeLearningLabel(row) {
  const kind = routeKind(row);
  if (kind === 'local') return 'Local address — on this device';
  if (kind === 'connected') return 'Directly connected network';
  const protocol = String(row.protocol || '').trim();
  if (/^(O(?:\s|$)|OSPF)/i.test(protocol)) return `Learned via OSPF${/^O\s+/.test(protocol) ? ` (${protocol})` : ''}`;
  if (/^(S|static)$/i.test(protocol)) return 'Static route';
  if (/^(B|BGP)$/i.test(protocol)) return 'Learned via BGP';
  return protocol ? `Route source: ${protocol}` : 'Route source unknown';
}

// Presentation only: retain the complete backend evidence for correlation.
// Match immutable profile IDs, never aliases/hostnames which may be duplicated.
export function destinationContext(result, activeDeviceId) {
  if (!result || !activeDeviceId) return result;
  const observations = result.observations || [];
  const direct = observations.filter(row => row.deviceId === activeDeviceId && routeKind(row) !== 'learned');
  const currentRows = observations.filter(row => row.deviceId === activeDeviceId);
  const relationFor = row => {
    const scoped = direct.filter(route => !row.vrf || route.vrf === row.vrf);
    if (new Set(scoped.map(route => route.vrf)).size > 1) return 'multiple-contexts';
    if (scoped.some(route => routeKind(route) === 'local')) return 'local';
    if (scoped.length) return 'connected';
    if (row.match === 'Address reported local by this router (RIB evidence)') return 'local';
    if (row.match === 'Exact interface-address match; interface VRF not reported') return 'unscoped-interface';
    return null;
  };
  const context = { ...result.context };
  for (const group of ['identities', 'interfaces', 'arp', 'switching', 'neighbors', 'routingPeers']) {
    context[group] = (context[group] || []).flatMap(row => {
      if (row.deviceId !== activeDeviceId) return [row];
      const relation = relationFor(row);
      if (group === 'identities' && !relation) return [];
      const scoped = direct.filter(route => !row.vrf || route.vrf === row.vrf);
      return [{ ...row, currentDeviceRelation: group === 'identities' ? relation : 'observer',
        ...(group === 'identities' && scoped.length ? {
          match: scoped.map(route => `${route.prefix} · VRF ${route.vrf} · ${routeLearningLabel(route)}`).join('; '),
          associationStale: row.associationStale || scoped.every(route => route.stale),
        } : {}),
      }];
    });
  }
  let closest = result.closest;
  if (closest?.candidates) {
    const candidates = closest.candidates.filter(row => row.deviceId !== activeDeviceId || ['local-address', 'connected-network', 'interface-address'].includes(row.kind));
    closest = { ...closest, candidates, ...(candidates.length !== closest.candidates.length ? {
      reason: 'The current router’s learned-route report is omitted. No local or connected relationship is implied; other candidates retain their evidence labels.',
    } : {}) };
  }
  return { ...result, context, closest,
    omittedCurrentLearned: currentRows.some(row => routeKind(row) === 'learned'),
    observations: observations.filter(row => row.deviceId !== activeDeviceId || routeKind(row) !== 'learned')
      .map(row => row.deviceId === activeDeviceId ? { ...row, currentDeviceRelation: routeKind(row) } : row),
  };
}
