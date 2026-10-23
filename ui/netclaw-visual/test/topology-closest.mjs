import assert from 'node:assert/strict';
import { closestReportingDevices } from '../topology-closest.js';
import { TopologyService } from '../topology-service.js';
import { closestSourceLabel } from '../src/canvas-chat/topology-evidence-labels.js';
const now = 100000;
const route = (prefix, extra = {}) => ({ prefix, vrf: 'CORP', protocol: 'O', ...extra });
const snap = (id, routes, extra = {}) => ({ deviceId: id, device: id, routes, observedAt: now, ...extra });
const query = { type: 'ip', value: '198.51.100.25', vrf: 'CORP' };
const lookup = (data, q = query) => closestReportingDevices(data, q, now + 1, 75000);
const direct = snap('CORE', [route('198.51.100.0/24', { connected: true, protocol: 'C' })]);
const owner = snap('HOST', [route('198.51.100.25/32', { local: true, protocol: 'L' })]);
const upstream = snap('EDGE', [route('198.51.100.0/24', { nextHop: '192.0.2.2', metric: 1 })]);
assert.equal(lookup([upstream, direct, owner]).candidates[0].deviceId, 'HOST');
assert.equal(lookup([upstream, direct]).candidates[0].deviceId, 'CORE');
assert.equal(lookup([owner, direct], { type: 'prefix', value: '198.51.100.0/24', vrf: 'CORP' }).candidates[0].kind, 'connected-network');
assert.equal(lookup([owner, direct], { type: 'prefix', value: '198.51.100.25/32', vrf: 'CORP' }).candidates[0].deviceId, 'HOST');
// Never select stale or withdrawn ownership. Successful sources are independent.
assert.equal(lookup([{ ...owner, failed: true }, direct]).candidates[0].deviceId, 'CORE');
assert.equal(lookup([{ ...owner, observedAt: 1 }]).status, 'undetermined');
assert.equal(lookup([{ ...owner, routes: [] }]).status, 'undetermined');
assert.equal(lookup([{ ...direct, collectionFailed: true }]).status, 'undetermined');
assert.equal(lookup([snap('OLD', [route('198.51.100.25/32', { local: true, stale: true })])]).status, 'undetermined');
const tied = lookup([direct, { ...direct, deviceId: 'CORE2', device: 'CORE2' }]);
assert.equal(tied.status, 'multiple');
assert.equal(tied.candidates.length, 2);
// Scope stays explicit and no metrics are compared across routers/protocols.
assert.equal(lookup([direct], { ...query, vrf: 'GUEST' }).status, 'undetermined');
const scoped = lookup([direct, snap('GUEST', [route('198.51.100.25/32', { local: true, vrf: 'GUEST' })])], { ...query, vrf: null });
assert.equal(scoped.candidates.length, 2);
const frontier = snap('MID', [route('192.0.2.2/32', { local: true }), route('198.51.100.0/24', { nextHop: '192.0.2.99', metric: 9999 })]);
assert.equal(lookup([upstream, frontier]).candidates[0].deviceId, 'MID');
assert.equal(lookup([upstream, frontier]).status, 'inferred');
assert.equal(lookup([upstream]).status, 'undetermined');
assert.equal(lookup([upstream, { ...frontier, failed: true }]).status, 'undetermined');
// An unresolved ECMP branch, independent paths, duplicate next-hop identity,
// recursive self-route or loop must not produce a single closest device.
const branch = snap('EDGE', [...upstream.routes, route('198.51.100.0/24', { nextHop: '192.0.2.100' })]);
assert.equal(lookup([branch, frontier]).status, 'undetermined');
assert.equal(lookup([upstream, frontier, snap('ISOLATED', [route('198.51.100.0/24', { nextHop: '192.0.2.200' })])]).status, 'undetermined');
assert.equal(lookup([upstream, frontier, snap('DUPLICATE', [route('192.0.2.2/32', { local: true })])]).status, 'undetermined');
const cycleA = snap('A', [route('192.0.2.1/32', { local: true }), route('198.51.100.0/24', { nextHop: '192.0.2.2' })]);
const cycleB = snap('B', [route('192.0.2.2/32', { local: true }), route('198.51.100.0/24', { nextHop: '192.0.2.1' })]);
assert.equal(lookup([cycleA, cycleB]).status, 'undetermined');
assert.equal(lookup([snap('DEFAULT', [route('0.0.0.0/0', { nextHop: '192.0.2.2' })])]).status, 'undetermined');
// ARP/MAC/CDP show an observer, not proof that an IP lives on that hardware.
const iface = snap('IFACE', [], { failed: true, facts: { interfaceBrief: { records: [{ address: query.value, interface: 'Gi0/1' }], observedAt: now } } });
assert.equal(lookup([iface]).status, 'undetermined', 'unscoped interface cannot prove a CORP address');
assert.equal(lookup([iface], { ...query, vrf: null }).candidates[0].kind, 'interface-address');
assert.equal(lookup([{ ...iface, collectionFailed: true }], { ...query, vrf: null }).status, 'undetermined');
assert.equal(lookup([snap('ARP', [], { facts: { arp: { records: [{ address: query.value }], observedAt: now } } })]).status, 'undetermined');
assert.equal(lookup([], { type: 'ip', value: '2001:db8::1' }).status, 'undetermined');
// API service returns the derived result; front-end only relabels valid sources.
const service = new TopologyService({ file: null, autoStart: false, now: () => now + 1 });
service.snapshots.set('CORE', direct);
const result = service.lookup(query);
assert.equal(result.closest.candidates[0].deviceId, 'CORE');
assert.equal(closestSourceLabel({ deviceId: 'CORE' }, result.closest), 'Closest reporting device');
assert.equal(closestSourceLabel({ deviceId: 'CORE', stale: true }, result.closest), 'Reporting device');
assert.equal(closestSourceLabel({ deviceId: 'CORE', vrf: 'GUEST' }, result.closest), 'Reporting device');
assert.equal(closestSourceLabel({ deviceId: 'CORE' }, result.closest, true), 'Reporting device');
assert.equal(closestSourceLabel({ deviceId: 'EDGE' }, result.closest), 'Reporting device');
assert.equal(closestSourceLabel({ deviceId: 'MID' }, lookup([upstream, frontier])), 'Closest known reporting device (inferred)');
service.stop();
console.log('Closest reporting device: local IP, connected prefix, VRF, stale data, ties, ECMP and downstream inference passed.');
