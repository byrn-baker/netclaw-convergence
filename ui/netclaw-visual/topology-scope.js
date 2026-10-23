// Shared by the authorization GUI and collector: fixed commands, never user CLI.
export const TOPOLOGY_SCOPES = Object.freeze([
  { id: 'routes', label: 'Routing tables', description: 'IPv4 routes and next hops; default and available named VRFs.', commands: ['show ip route', 'show ip route vrf *'] },
  { id: 'identity', label: 'Device identity and hardware', description: 'Hostname, model, serial numbers, software version and inventory identifiers.', commands: ['show version', 'show inventory'] },
  { id: 'interfaces', label: 'Interfaces and health', description: 'Addresses, descriptions, link/protocol state, rates and error counters.', commands: ['show ip interface brief', 'show interfaces'] },
  { id: 'arp', label: 'ARP / IP-to-MAC observations', description: 'IPv4 neighbors, MAC addresses and interfaces in the default VRF.', commands: ['show ip arp'] },
  { id: 'neighbors', label: 'CDP / LLDP neighbors', description: 'Reported adjacent devices, local/remote ports and management addresses.', commands: ['show cdp neighbors detail', 'show lldp neighbors detail'] },
  { id: 'switching', label: 'MAC forwarding and VLANs', description: 'MAC-to-VLAN/port observations and VLAN names; correlated with ARP evidence.', commands: ['show mac address-table', 'show vlan brief'] },
  { id: 'routingPeers', label: 'OSPF / BGP peers', description: 'Default-VRF IPv4 adjacency/session state and BGP received-prefix counts.', commands: ['show ip ospf neighbor', 'show ip bgp summary'] },
]);

export function normalizeTopologyScopes(scopes = ['routes']) {
  if (!Array.isArray(scopes) || scopes.some(id => !TOPOLOGY_SCOPES.some(scope => scope.id === id))) throw new Error('Unknown topology collection scope.');
  if (!scopes.includes('routes')) throw new Error('Routing tables are required for route context.');
  return TOPOLOGY_SCOPES.filter(scope => scopes.includes(scope.id)).map(scope => scope.id);
}

export function commandsForTopologyScopes(scopes = ['routes']) {
  const normalized = normalizeTopologyScopes(scopes);
  return ['terminal length 0', ...TOPOLOGY_SCOPES.filter(scope => normalized.includes(scope.id)).flatMap(scope => scope.commands)];
}
