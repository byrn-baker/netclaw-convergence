import assert from 'node:assert/strict';
import { identitySourceLabel, closestSourceLabel, destinationContext, routeLearningLabel } from '../src/canvas-chat/topology-evidence-labels.js';
import { parseIosRoutes, correlateRoutes } from '../topology-routes.js';
assert.equal(identitySourceLabel({ match: 'Router reporting this route; not proof it owns addresses in the destination network' }), 'Reporting router');
assert.equal(identitySourceLabel({ match: 'Address reported local by this router (RIB evidence)' }), 'Device with this IP');
assert.equal(identitySourceLabel({ match: 'Exact interface-address match; interface VRF not reported' }), 'Device with this IP');
assert.equal(identitySourceLabel({}), 'Reporting router');
assert.equal(identitySourceLabel({ match: 'Unknown future evidence' }), 'Reporting router');
console.log('Topology identity labels distinguish route sources from address matches.');

const identity = (deviceId, extra = {}) => ({ deviceId, device: deviceId, match: 'Router reporting this route; not proof it owns addresses in the destination network', ...extra });
const makeResult = observations => ({ observations, context: { identities: [identity('Lab'), identity('Other')], arp: [identity('Lab', { address: '192.0.2.5' })] }, relationships: [] });
let raw = makeResult([{ deviceId: 'Lab', device: 'Example Edge', protocol: 'O', prefix: '198.51.100.0/24', vrf: 'default' },
  { deviceId: 'Other', device: 'Other', protocol: 'C', connected: true, prefix: '198.51.100.0/24', vrf: 'default' }]);
raw.closest = { candidates: [{ deviceId: 'Lab', kind: 'known-frontier' }, { deviceId: 'Other', kind: 'connected-network' }] };
const before = JSON.stringify(raw);
let visible = destinationContext(raw, 'Lab');
assert.equal(visible.omittedCurrentLearned, true);
assert.deepEqual(visible.observations.map(r => r.deviceId), ['Other']);
assert.deepEqual(visible.context.identities.map(r => r.deviceId), ['Other']);
assert.deepEqual(visible.closest.candidates.map(r => r.deviceId), ['Other']);
assert.equal(closestSourceLabel(visible.context.arp[0], visible.closest), 'Observed on current router');
assert.equal(JSON.stringify(raw), before, 'never change backend route truth or shared snapshots');
assert.equal(destinationContext(raw, null), raw, 'no arbitrary active device inferred');
assert.equal(destinationContext(raw, 'Example Edge').observations.length, 2, 'match profile ID, not alias');

// The hovered next hop must be looked up independently from its OSPF line.
const routes = parseIosRoutes(`Codes: L - local, C - connected, O - OSPF
O 198.51.100.0/24 [110/3] via 192.0.2.5, GigabitEthernet0/0
C 192.0.2.4/30 is directly connected, GigabitEthernet0/0
L 192.0.2.6/32 is directly connected, GigabitEthernet0/0`).routes;
const snapshots = [{ deviceId: 'Lab', device: 'Example Edge', observedAt: 1000, routes }];
const lookup = value => correlateRoutes(snapshots, { type: 'ip', value, vrf: 'default' }, 1001, 75000).observations;
visible = destinationContext(makeResult(lookup('192.0.2.5')), 'Lab');
assert.equal(identitySourceLabel(visible.context.identities[0]), 'Current router — directly connected network');
assert.match(visible.context.identities[0].match, /192\.0\.2\.4\/30.*Directly connected network/);
assert.doesNotMatch(visible.context.identities[0].match, /OSPF/);
assert.equal(routeLearningLabel(visible.observations[0]), 'Directly connected network');
visible = destinationContext(makeResult(lookup('192.0.2.6')), 'Lab');
assert.equal(identitySourceLabel(visible.context.identities[0]), 'Current router — IP is local');
assert.equal(routeLearningLabel(visible.observations[0]), 'Local address — on this device');
assert.equal(routeLearningLabel({ protocol: 'O IA' }), 'Learned via OSPF (O IA)');
assert.equal(routeLearningLabel({ protocol: 'S' }), 'Static route');
assert.equal(routeLearningLabel({ protocol: 'B' }), 'Learned via BGP');

// A connected route in one VRF cannot justify an identity scoped to another.
raw = makeResult([{ deviceId: 'Lab', protocol: 'C', prefix: '192.0.2.0/24', vrf: 'CORP', stale: true }]);
raw.context.identities = [identity('Lab', { vrf: 'GUEST' }), identity('Lab', { vrf: 'CORP' })];
visible = destinationContext(raw, 'Lab');
assert.equal(visible.context.identities.length, 1);
assert.equal(visible.context.identities[0].vrf, 'CORP');
assert.equal(visible.context.identities[0].associationStale, true);
assert.equal(visible.observations[0].stale, true);
console.log('Active-router reports exclude learned routes; local/connected and independent next-hop evidence remain accurate.');
