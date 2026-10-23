import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canonicalPrefix, parseIosRoutes, correlateRoutes } from '../topology-routes.js';
import { TopologyService } from '../topology-service.js';
import { collectIosTopology, TOPOLOGY_COMMANDS } from '../topology-collector.js';

const globalA = `A#show ip route
Codes: L - local, C - connected, S - static, O - OSPF
Gateway of last resort is 192.0.2.2 to network 0.0.0.0
S* 0.0.0.0/0 [1/0] via 192.0.2.2
     10.0.0.0/8 is variably subnetted, 2 subnets, 2 masks
O IA 10.10.0.0/24 [110/20] via 192.0.2.2, 00:00:10, GigabitEthernet0/0
                  [110/20] via 192.0.2.3, 00:00:10, GigabitEthernet0/1
C 192.0.2.0/24 is directly connected, GigabitEthernet0/0
L 192.0.2.1/32 is directly connected, GigabitEthernet0/0
A#`;
const globalB = `B#show ip route
Codes: L - local, C - connected
Gateway of last resort is not set
C 10.10.0.0/24 is directly connected, GigabitEthernet0/1
C 192.0.2.0/24 is directly connected, GigabitEthernet0/0
L 192.0.2.2/32 is directly connected, GigabitEthernet0/0
B#`;
const named = `Routing Table: CORP
Codes: L - local, C - connected
Gateway of last resort is not set
C 10.10.0.0/24 is directly connected, GigabitEthernet0/2
Routing Table: GUEST
Codes: S - static
S 10.10.0.0/24 [1/0] via 198.51.100.1
`;
assert.equal(canonicalPrefix('10.10.0.25/24').prefix, '10.10.0.0/24');
assert.equal(canonicalPrefix('10.10.0.0/33'), null);
assert.equal(canonicalPrefix('10.10.0.0/24/0'), null);
assert.equal(parseIosRoutes(globalA).routes.length, 5);
assert.equal(parseIosRoutes(globalA).routes[1].protocol, 'O IA');
assert.equal(parseIosRoutes(globalA).routes[1].interface, 'GigabitEthernet0/0');
assert.equal(parseIosRoutes(named).routes[1].vrf, 'GUEST');
assert.throws(() => parseIosRoutes('% Invalid input detected'), /rejected/);
assert.throws(() => parseIosRoutes('random output'), /not recognized/);
assert.throws(() => parseIosRoutes('Codes: O - OSPF\nO 10.0.0.0/24\nA#'), /could not be parsed/);
assert.throws(() => parseIosRoutes('Codes: C - connected\nC 10.0.0.0 is directly connected, Gi0/0'), /could not be parsed/);
const subnetted = parseIosRoutes('Codes: O - OSPF\n     10.0.0.0/24 is subnetted, 1 subnets\nO 10.1.0.0 [110/20] via 192.0.2.1');
assert.equal(subnetted.routes[0].prefix, '10.1.0.0/24');
const wrapped = parseIosRoutes('Codes: O - OSPF\nO E2 10.20.0.0/16\n     [110/20] via 192.0.2.1, GigabitEthernet0/0');
assert.equal(wrapped.routes[0].nextHop, '192.0.2.1');

const snapshots = [
  { deviceId: 'A', device: 'A', observedAt: 1000, routes: parseIosRoutes(globalA).routes },
  { deviceId: 'B', device: 'B', observedAt: 1000, routes: [...parseIosRoutes(globalB).routes, ...parseIosRoutes(named).routes] },
];
let correlation = correlateRoutes(snapshots, { type: 'prefix', value: '10.10.0.0/24', vrf: 'default' }, 2000, 75000);
assert.equal(correlation.observations.length, 3);
assert.equal(correlation.relationships.length, 1);
assert.equal(correlation.relationships[0].to, 'B');
assert.equal(correlation.relationships[0].stale, false);
assert.equal(correlateRoutes(snapshots, { type: 'prefix', value: '10.10.0.0/24', vrf: 'GUEST' }, 2000, 75000).observations.length, 1);
assert.ok(correlateRoutes(snapshots, { type: 'prefix', value: '10.10.0.0/24' }, 90000, 75000).observations.every(row => row.stale));
assert.ok(correlateRoutes(snapshots, { type: 'ip', value: '10.10.0.7', vrf: 'default' }, 2000, 75000).observations.every(row => row.prefix === '10.10.0.0/24'));
assert.equal(correlateRoutes(snapshots, { type: 'prefix', value: '2001:db8::/32' }, 2000, 75000).unsupported, true);

let now = 100000;
let calls = 0;
let mode = 'success';
let endpoint = '192.0.2.10';
const profile = id => ({ id, alias: id, host: endpoint, port: 22, protocol: 'ssh', os: 'iosxe', username: 'test', password: 'never-save-this' });
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'netclaw-topology-test-'));
const file = path.join(directory, 'authorization.json');
const deps = { file, getProfile: profile, listProfiles: () => [], knownFingerprint: () => 'SHA256:test', now: () => now, autoStart: false,
  collect: async () => { calls++; if (mode === 'fail') throw new Error('offline'); if (mode === 'auth') throw Object.assign(new Error('auth failed'), { code: 'BLOCKED' });
    return { global: mode === 'withdraw' ? 'Codes: C - connected\nGateway of last resort is not set\nA#' : globalA, vrfs: '% Invalid input' }; } };
const service = new TopologyService(deps);
const flush = () => new Promise(resolve => setImmediate(resolve));
try {
  service.tick(); await flush(); assert.equal(calls, 0, 'disabled without consent');
  assert.throws(() => service.authorize({ devices: [{ id: 'A' }], intervalSeconds: 30 }), /authorization/);
  service.authorize({ authorized: true, devices: [{ id: 'A' }], intervalSeconds: 30 });
  await flush();
  assert.equal(calls, 1);
  assert.equal(service.status().devices[0].phase, 'partial', 'unsupported named-VRF command is disclosed without losing default routes');
  assert.equal(service.lookup({ type: 'prefix', value: '10.10.0.0/24' }).observations.length, 2);
  assert.ok(!fs.readFileSync(file, 'utf8').includes('never-save-this'));
  service.tick(); await flush(); assert.equal(calls, 1, 'rate limited');
  mode = 'fail'; now += 31000; service.tick(); await flush();
  assert.equal(service.lookup({ type: 'prefix', value: '10.10.0.0/24' }).observations[0].stale, true);
  assert.equal(service.status().devices[0].failures, 1);
  mode = 'withdraw'; now += 31000; service.tick(); await flush();
  assert.equal(service.lookup({ type: 'prefix', value: '10.10.0.0/24' }).observations.length, 0, 'withdrawals replace prior data');
  mode = 'auth'; now += 31000; service.tick(); await flush();
  assert.equal(service.status().devices[0].blocked, true);
  const blockedCalls = calls; now += 1000000; service.tick(); await flush(); assert.equal(calls, blockedCalls);
  service.authorize({ authorized: true, devices: [{ id: 'A' }], intervalSeconds: 30 }); await flush();
  const resumed = new TopologyService(deps);
  assert.equal(resumed.status().enabled, true, 'authorization survives restart');
  assert.equal(resumed.status().devices[0].blocked, true, 'authentication pause survives restart');
  mode = 'success';
  resumed.authorize({ authorized: true, devices: [{ id: 'A' }], intervalSeconds: 30 }); await flush();
  endpoint = '192.0.2.11'; resumed.tick(); await flush();
  now += 31000; resumed.tick(); await flush();
  assert.equal(resumed.status().devices[0].blocked, true, 'changed endpoint is not followed');
  resumed.stop();
  service.revoke(); assert.equal(service.status().enabled, false);
  assert.equal(new TopologyService(deps).status().enabled, false);
} finally { service.stop(); fs.unlinkSync(file); fs.rmdirSync(directory); }

// Revocation cancels in-flight work and ignores a late successful response.
let release;
let activeSignal;
const pending = new TopologyService({ ...deps, file: null, collect: ({ signal }) => { activeSignal = signal; return new Promise(resolve => { release = resolve; }); } });
pending.authorize({ authorized: true, devices: [{ id: 'A' }, { id: 'B' }, { id: 'C' }], intervalSeconds: 30 });
assert.equal(pending.active.size, 2, 'concurrency is bounded');
pending.revoke(); assert.equal(activeSignal.aborted, true);
release({ global: globalA, vrfs: named }); await flush(); assert.equal(pending.snapshots.size, 0);
pending.stop();

// Editing/removing one profile cannot stop other authorized devices, and late
// results from the revoked device must not repopulate its observations.
const releases = new Map();
const signals = new Map();
const perDevice = new TopologyService({ ...deps, file: null, collect: ({ profile, signal }) => {
  signals.set(profile.id, signal);
  return new Promise(resolve => releases.set(profile.id, resolve));
} });
perDevice.authorize({ authorized: true, devices: [{ id: 'A' }, { id: 'B' }], intervalSeconds: 30 });
perDevice.revokeDevice('A');
assert.equal(signals.get('A').aborted, true);
assert.equal(signals.get('B').aborted, false);
assert.deepEqual(perDevice.status().devices.map(d => d.id), ['B']);
releases.get('A')({ global: globalA, vrfs: named });
releases.get('B')({ global: globalA, vrfs: named });
await flush();
assert.equal(perDevice.snapshots.has('A'), false);
assert.equal(perDevice.snapshots.has('B'), true);
perDevice.stop();

// Exercise the actual transport using an in-memory SSH client: no network I/O.
const written = [];
let capturedConfig;
let platformOutput = 'Cisco IOS Software, IOSv Software';
class FakeClient extends EventEmitter {
  connect(config) { capturedConfig = config; queueMicrotask(() => this.emit('ready')); }
  shell(_options, callback) {
    const channel = new EventEmitter(); channel.close = () => {};
    channel.write = value => {
      written.push(value.trim());
      const response = value.startsWith('terminal') ? `A#${value}\r\nA#` : value.startsWith('show version') ? `${platformOutput}\nA#` : value.includes('vrf') ? `${named}\nA#` : globalA;
      queueMicrotask(() => channel.emit('data', Buffer.from(response)));
    };
    callback(null, channel); queueMicrotask(() => channel.emit('data', Buffer.from('Welcome\r\nA#')));
  }
  destroy() {}
}
const collected = await collectIosTopology({ Client: FakeClient, profile: profile('A'), fingerprint: 'trusted', fingerprintOf: key => key });
assert.deepEqual(written, [...TOPOLOGY_COMMANDS]);
assert.equal(collected.global, globalA);
assert.equal(capturedConfig.hostVerifier('trusted'), true);
assert.equal(capturedConfig.hostVerifier('changed'), false);
written.length = 0;
await collectIosTopology({ Client: FakeClient, profile: { ...profile('A'), os: 'unknown' }, fingerprint: 'trusted', fingerprintOf: key => key });
assert.deepEqual(written, ['show version', ...TOPOLOGY_COMMANDS]);
written.length = 0; platformOutput = 'Not Cisco IOS';
await assert.rejects(collectIosTopology({ Client: FakeClient, profile: { ...profile('A'), os: 'unknown' }, fingerprint: 'trusted', fingerprintOf: key => key }), /did not identify/);
assert.deepEqual(written, ['show version'], 'unsupported platform never receives collection commands');
const cancelled = new AbortController(); cancelled.abort();
await assert.rejects(collectIosTopology({ Client: FakeClient, profile: profile('A'), signal: cancelled.signal }), /stopped/);
console.log('Topology parser, correlation, consent, lifecycle, persistence and SSH transport checks passed. No network devices contacted.');
