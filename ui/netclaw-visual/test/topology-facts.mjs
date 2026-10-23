import assert from 'node:assert/strict';
import { FACT_FIXTURES } from './topology-fixtures.mjs';
import { TOPOLOGY_SCOPES, commandsForTopologyScopes, normalizeTopologyScopes } from '../topology-scope.js';
import { FACT_SOURCES, updateFacts, correlateFacts, parseInterfaceBrief, parseInventory, parseCdp, parseLldp, normalizeMac } from '../topology-facts.js';
import { TopologyService } from '../topology-service.js';
const scopes = TOPOLOGY_SCOPES.map(s => s.id);
for (const source of FACT_SOURCES) {
  assert.ok(source.parse(FACT_FIXTURES[source.command]).length > 0, source.command);
  assert.throws(() => source.parse('% Invalid input detected'), /unavailable/);
  assert.throws(() => source.parse('unrecognized output'), /unavailable/);
}
assert.deepEqual(normalizeTopologyScopes(), ['routes']);
assert.throws(() => normalizeTopologyScopes(['routes', 'running-config']), /Unknown/);
assert.deepEqual(commandsForTopologyScopes(), ['terminal length 0', 'show ip route', 'show ip route vrf *']);
assert.ok(!commandsForTopologyScopes(['routes', 'identity']).includes('show ip arp'));
assert.equal(parseInterfaceBrief(FACT_FIXTURES['show ip interface brief'])[1].state, 'administratively down');
assert.equal(parseInventory(FACT_FIXTURES['show inventory'])[0].serialNumber, 'DEMO-SERIAL-001');
assert.equal(parseCdp(FACT_FIXTURES['show cdp neighbors detail'])[0].managementAddress, '198.51.100.25');
assert.equal(parseLldp(FACT_FIXTURES['show lldp neighbors detail'])[0].chassisId, '0011.2233.4455');
assert.deepEqual(parseCdp('Total cdp entries displayed : 0'), []);
assert.deepEqual(parseLldp('Total entries displayed: 0'), []);
assert.equal(normalizeMac('00:11:22:33:44:55'), normalizeMac('0011.2233.4455'));
const now = 100000;
let facts = updateFacts({}, FACT_FIXTURES, scopes, now);
assert.equal(facts.interfaces.records[0].crcErrors, 2);
assert.equal(facts.bgp.records[0].state, 'Established');
assert.equal(facts.bgp.records[1].state, 'Active');
const snapshots = [{ deviceId: 'A', device: 'Router A', observedAt: now, facts, routes: [{ local: true, prefix: '198.51.100.1/32', vrf: 'default' }] },
  { deviceId: 'SW', device: 'Switch B', observedAt: now, facts: { macTable: facts.macTable, vlans: facts.vlans }, routes: [] }];
const observations = [{ deviceId: 'A', prefix: '198.51.100.0/24', interface: 'Gi0/1', vrf: 'default', protocol: 'C', observedAt: now, stale: false }];
let context = correlateFacts(snapshots, { type: 'prefix', value: '198.51.100.0/24', vrf: 'default' }, observations, now + 1, 75000);
assert.equal(context.interfaces.length, 2, 'abbreviated and full interface names match');
assert.equal(context.neighbors.length, 2);
assert.equal(context.arp.length, 2);
assert.equal(context.switching.find(row => row.deviceId === 'SW').vlanName, 'DEMO-USERS');
assert.equal(context.switching.find(row => row.deviceId === 'SW').address, '198.51.100.25');
assert.ok(context.identities.every(row => /not proof/.test(row.match)));
context = correlateFacts(snapshots, { type: 'ip', value: '198.51.100.1', vrf: 'default' }, [], now + 1, 75000);
assert.equal(context.identities[0].hostname, 'MOCK');
assert.match(context.identities[0].match, /reported local/);
assert.equal(context.identities[0].associationStale, false, 'fresh local-address evidence does not require a separate route observation');
context = correlateFacts(snapshots, { type: 'ip', value: '198.51.100.25', vrf: 'default' }, [], now + 1, 75000);
assert.equal(context.neighbors[0].neighbor, 'DEMO-SWITCH', 'exact management IP works without a matching route');
assert.equal(context.arp.length, 1);
assert.equal(context.switching.length, 2);
context = correlateFacts(snapshots, { type: 'ip', value: '198.51.100.25', vrf: 'default' }, observations.map(row => ({ ...row, stale: true })), now + 1, 75000);
assert.equal(context.neighbors[0].associationStale, false, 'direct advertised management address does not rely on stale route evidence');
context = correlateFacts(snapshots, { type: 'ip', value: '198.51.100.25', vrf: 'CORP' }, [], now + 1, 75000);
assert.equal(context.arp.length, 0, 'default ARP never assumed to be named VRF');
assert.equal(context.routingPeers.length, 0);
assert.equal(context.switching.length, 0);
facts = updateFacts(facts, { ...FACT_FIXTURES, 'show ip arp': '% Invalid input detected' }, scopes, now + 1000);
assert.equal(facts.arp.failed, true);
assert.equal(facts.arp.observedAt, now);
assert.equal(facts.interfaces.failed, false);
assert.equal(facts.interfaces.observedAt, now + 1000);
facts = updateFacts(facts, { ...FACT_FIXTURES, 'show cdp neighbors detail': 'Total cdp entries displayed : 0' }, scopes, now + 2000);
assert.equal(facts.cdp.records.length, 0, 'withdrawn neighbors are removed');
assert.equal(Object.keys(updateFacts(facts, FACT_FIXTURES, ['routes'], now)).length, 0, 'unselected data is not retained');

// A denied route source must not discard a successful identity/interface source.
let observedScopes;
const service = new TopologyService({ file: null, autoStart: false, now: () => now,
  getProfile: id => ({ id, alias: id, os: 'iosxe', protocol: 'ssh', host: '192.0.2.1', port: 22 }), knownFingerprint: () => 'test',
  collect: async input => { observedScopes = input.scopes; return { global: '% Invalid input detected', vrfs: '', outputs: FACT_FIXTURES }; },
});
service.authorize({ authorized: true, intervalSeconds: 30, devices: [{ id: 'A' }], scopes });
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(observedScopes, scopes);
assert.equal(service.status().devices[0].phase, 'partial');
assert.equal(service.snapshots.get('A').facts.version.records[0].hostname, 'MOCK');
assert.equal(service.lookup({ type: 'ip', value: '198.51.100.1' }).context.identities.length, 2);
assert.ok(service.status().audit[0].scopes.includes('identity'));
service.revoke(); service.stop();
console.log('Identifier parsers, independent freshness, scope control and IP/MAC/VLAN correlation checks passed.');
