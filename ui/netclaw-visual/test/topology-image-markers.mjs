import assert from 'node:assert/strict';
import { topologyMarkers, topologyContextKey, validDevicePoints, fittedImageRect } from '../src/canvas-chat/topology-image-markers.js';
import { topologyDiagramKey } from '../src/canvas-chat/topology-image-store.js';

const token = { type: 'prefix', value: '198.51.100.0/24', vrf: 'CORP' };
const points = [{ deviceId: 'edge', x: .2, y: .5 }, { deviceId: 'core', x: .8, y: .5 }];
const result = { collection: { enabled: true, devices: [{ id: 'edge', stale: false }, { id: 'core', stale: false }] },
  observations: [{ deviceId: 'edge', prefix: token.value, vrf: 'CORP', protocol: 'O', stale: false }],
  closest: { candidates: [{ deviceId: 'core', device: 'Core', kind: 'connected-network', vrf: 'CORP' }] } };
const base = { activeDeviceId: 'edge', token, devices: [{ id: 'edge', alias: 'Edge' }, { id: 'core', alias: 'Core' }], points,
  context: { key: topologyContextKey('edge', token), result } };
const run = (r = result, extra = {}) => topologyMarkers({ ...base, context: { ...base.context, result: r }, ...extra });
assert.deepEqual(run().markers.map(m => [m.deviceId, m.role]), [['edge', 'current'], ['core', 'reporting']]);
for (const protocol of ['L', 'C']) {
  const output = run({ ...result, observations: [{ ...result.observations[0], protocol }] });
  assert.deepEqual(output.markers.map(m => m.role), ['current']);
  assert.match(output.note, /green only/);
}
// A lower-specificity connected route must not hide a more-specific learned route.
assert.equal(run({ ...result, observations: [...result.observations, { ...result.observations[0], prefix: '198.51.0.0/16', protocol: 'C' }] }).markers.length, 2);
assert.equal(run({ ...result, observations: [{ ...result.observations[0], protocol: 'C', stale: true }] }).markers.length, 2);
assert.equal(run({ ...result, closest: { candidates: [{ ...result.closest.candidates[0], deviceId: 'edge' }] } }).markers.length, 1);
assert.equal(run(result, { context: { ...base.context, unavailable: true } }).markers.length, 1);
assert.equal(run(result, { token: { ...token, value: '203.0.113.0/24' } }).markers.length, 1);
assert.equal(run({ ...result, collection: { ...result.collection, devices: [{ id: 'edge' }, { id: 'core', stale: true }] } }).markers.length, 1);
assert.equal(run({ ...result, collection: { ...result.collection, enabled: false } }).markers.length, 1);
assert.equal(run({ ...result, closest: { candidates: [{ ...result.closest.candidates[0], kind: 'interface-address', vrf: null }] } }).markers.length, 1);
assert.match(run({ ...result, closest: { candidates: [{ ...result.closest.candidates[0], kind: 'known-frontier' }] } }).markers[1].label, /inferred/);
const tied = { ...result, collection: { ...result.collection, devices: [...result.collection.devices, { id: 'peer', stale: false }] },
  closest: { candidates: [...result.closest.candidates, { ...result.closest.candidates[0], deviceId: 'peer' }] } };
const tiedOutput = run(tied, { devices: [...base.devices, { id: 'peer' }], points: [...points, { deviceId: 'peer', x: .5, y: .5 }] });
assert.equal(tiedOutput.markers.length, 3);
assert.ok(tiedOutput.markers.filter(m => m.role === 'reporting').every(m => m.label.includes('(candidate)')));
assert.deepEqual(run(result, { points: [] }).missing, ['Edge', 'Core']);
assert.equal(run(result, { devices: [{ id: 'edge' }] }).markers.length, 1);
// Example Edge/Example Core regression: connected /24 does not own a peer's /32.
for (const [type, value] of [['ip', '203.0.113.242'], ['prefix', '203.0.113.242/32']]) {
  const peerToken = { type, value, vrf: 'default' };
  const peerResult = { ...result,
    observations: [{ deviceId: 'edge', prefix: '203.0.113.0/24', vrf: 'default', protocol: 'C', connected: true }],
    closest: { candidates: [{ deviceId: 'core', vrf: 'default', kind: 'local-address', prefix: '203.0.113.242/32' }] } };
  const peerRun = r => run(r, { token: peerToken, context: { key: topologyContextKey('edge', peerToken), result: r } });
  assert.deepEqual(peerRun(peerResult).markers.map(m => [m.deviceId, m.role]), [['edge', 'current'], ['core', 'reporting']]);
  assert.match(peerRun(peerResult).note, /exact IP belongs to the remote/);
  assert.equal(peerRun({ ...peerResult, collection: { ...result.collection, devices: [{ id: 'edge' }, { id: 'core', stale: true }] } }).markers.length, 1);
  assert.equal(peerRun({ ...peerResult, closest: { candidates: [{ ...peerResult.closest.candidates[0], vrf: 'OTHER' }] } }).markers.length, 1);
  assert.equal(peerRun({ ...peerResult, observations: [{ ...peerResult.observations[0], prefix: '203.0.113.242/32', protocol: 'L', local: true }] }).markers.length, 1);
}
const unknownToken = { ...token, vrf: null };
assert.match(run(result, { token: unknownToken, context: { key: topologyContextKey('edge', unknownToken), result: { ...result, closest: { candidates: [...result.closest.candidates, { ...result.closest.candidates[0], vrf: 'OTHER' }] } } } }).note, /ambiguous/);
assert.deepEqual(validDevicePoints([...points, points[0], { deviceId: 'bad', x: NaN, y: .1 }, { deviceId: 'outside', x: 2, y: 0 }]), points);
assert.deepEqual(fittedImageRect(800, 240, 800, 400), { width: 480, height: 240, left: 160, top: 0 });
assert.deepEqual(fittedImageRect(400, 800, 800, 400), { width: 400, height: 200, left: 0, top: 300 });
assert.equal(topologyDiagramKey({ deviceId: 'edge', vrf: 'CORP', value: 'one' }), topologyDiagramKey({ deviceId: 'edge', vrf: 'CORP', value: 'two' }));
assert.equal(topologyDiagramKey({ deviceId: 'edge', vrf: 'CORP' }), topologyDiagramKey({ deviceId: 'edge', vrf: 'OTHER' }));
assert.notEqual(topologyDiagramKey({ deviceId: 'edge' }), topologyDiagramKey({ deviceId: 'core' }));
console.log('Topology marker tests passed: role mapping, direct suppression, LPM, stale/error isolation, VRF, inference, coordinates and shared diagram scope.');
