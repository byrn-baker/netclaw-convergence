import net from 'node:net';
import { canonicalPrefix, cleanIosOutput, isIosCommandError } from './topology-routes.js';

const ipv4 = value => net.isIP(value) === 4;
const MAX_FACTS = 20000;
const failure = () => { throw new Error('Output unavailable, unsupported, denied, or not recognized; prior evidence is stale.'); };
function lines(text, header) {
  if (typeof text !== 'string' || isIosCommandError(text)) return failure();
  const clean = cleanIosOutput(text);
  if (!header.test(clean)) return failure();
  return clean.split('\n');
}
function checked(records) { if (records.length > MAX_FACTS) throw new Error('Observation limit exceeded.'); return records; }
export const normalizeMac = value => String(value || '').replace(/[.:-]/g, '').toLowerCase();
export const displayMac = value => normalizeMac(value).match(/.{2}/g)?.join(':') || value;

export function parseVersion(text) {
  const clean = lines(text, /Cisco IOS(?: XE)? Software|Cisco Internetwork Operating System Software/i).join('\n');
  const record = {};
  record.hostname = clean.match(/^([^\s]+) uptime is (.+)$/m)?.[1] || null;
  record.uptime = clean.match(/^[^\s]+ uptime is (.+)$/m)?.[1] || null;
  record.softwareVersion = clean.match(/Cisco IOS XE Software,? Version ([^\s,]+)/i)?.[1]
    || clean.match(/Cisco IOS Software[^\n]*?Version ([^\s,]+)/i)?.[1] || null;
  record.model = clean.match(/^cisco\s+(\S+)\s+\(/im)?.[1] || null;
  record.serialNumber = clean.match(/^Processor board ID\s+(\S+)/im)?.[1] || null;
  if (!record.hostname && !record.model && !record.serialNumber && !record.softwareVersion) return failure();
  return [record];
}

export function parseInventory(text) {
  const records = [];
  let record;
  for (const line of lines(text, /^NAME:\s*"|No inventory/im)) {
    const start = line.match(/^NAME:\s*"(.*?)",\s*DESCR:\s*"(.*?)"/);
    if (start) { record = { name: start[1].slice(0, 200), description: start[2].slice(0, 300) }; records.push(record); continue; }
    const fields = line.match(/^PID:\s*(.*?),\s*VID:\s*(.*?),\s*SN:\s*(.*)$/);
    if (record && fields) { record.productId = fields[1].trim(); record.hardwareRevision = fields[2].trim(); record.serialNumber = fields[3].trim(); }
  }
  if (records.some(row => row.productId === undefined)) return failure();
  return checked(records);
}

export function parseMacTable(text) {
  const records = [];
  for (const line of lines(text, /Vlan\s+Mac Address\s+Type\s+Ports/i)) {
    const row = line.trim().match(/^(\d+)\s+([\da-f.:-]+)\s+(\S+)\s+(.+)$/i);
    if (!row) continue;
    if (!/^[\da-f]{12}$/.test(normalizeMac(row[2]))) return failure();
    for (const port of row[4].split(/[,\s]+/).filter(Boolean)) records.push({ vlan: Number(row[1]), mac: displayMac(row[2]), type: row[3], interface: port });
  }
  return checked(records);
}

export function parseVlans(text) {
  const records = [];
  for (const line of lines(text, /VLAN\s+Name\s+Status\s+Ports/)) {
    const row = line.match(/^\s*(\d+)\s+(\S+)\s+(active|suspend|act\/unsup|act\/lshut)\b/i);
    if (row) records.push({ vlan: Number(row[1]), name: row[2], state: row[3] });
  }
  return checked(records);
}

export function normalizeInterface(value = '') {
  return value.replace(/\s/g, '').toLowerCase()
    .replace(/^gigabitethernet/, 'gi').replace(/^tengigabitethernet/, 'te')
    .replace(/^twentyfivegige/, 'twe').replace(/^fortygigabitethernet/, 'fo')
    .replace(/^hundredgige/, 'hu').replace(/^fastethernet/, 'fa')
    .replace(/^ethernet/, 'et').replace(/^port-channel/, 'po')
    .replace(/^loopback/, 'lo').replace(/^tunnel/, 'tu');
}

export function parseInterfaceBrief(text) {
  const records = [];
  for (const line of lines(text, /Interface\s+IP-Address\s+OK\?\s+Method\s+Status\s+Protocol/i)) {
    const match = line.trim().match(/^(\S+)\s+(\S+)\s+(YES|NO)\s+\S+\s+(.+?)\s+(up|down)\s*$/i);
    if (!match) continue;
    if (match[2] !== 'unassigned' && !ipv4(match[2])) return failure();
    records.push({ interface: match[1], address: match[2] === 'unassigned' ? null : match[2], state: match[4], protocol: match[5], vrf: null });
  }
  return checked(records);
}

export function parseInterfaces(text) {
  const records = [];
  let record;
  for (const line of lines(text, /^\S+ is .+, line protocol is /m)) {
    const start = line.match(/^(\S+) is (.+?), line protocol is (\S+)/);
    if (start) { record = { interface: start[1], state: start[2], protocol: start[3], vrf: null }; records.push(record); continue; }
    if (!record) continue;
    const description = line.match(/^\s*Description:\s*(.*)/);
    if (description) record.description = description[1].slice(0, 300);
    const address = line.match(/Internet address is (\S+)/);
    if (address && canonicalPrefix(address[1])) record.address = address[1];
    const mtu = line.match(/MTU (\d+) bytes, BW (\d+) Kbit/);
    if (mtu) { record.mtu = Number(mtu[1]); record.bandwidthKbps = Number(mtu[2]); }
    const rate = line.match(/(\d+) (?:minute|second) (input|output) rate (\d+) bits\/sec/);
    if (rate) { record[`${rate[2]}BitsPerSecond`] = Number(rate[3]); record.rateWindow = rate[0].split(` ${rate[2]} rate`)[0]; }
    const input = line.match(/(\d+) input errors, (\d+) CRC/);
    if (input) { record.inputErrors = Number(input[1]); record.crcErrors = Number(input[2]); }
    const output = line.match(/(\d+) output errors/);
    if (output) record.outputErrors = Number(output[1]);
    const reset = line.match(/(\d+) interface resets/);
    if (reset) record.resets = Number(reset[1]);
  }
  return checked(records);
}

export function parseArp(text) {
  const records = [];
  for (const line of lines(text, /Protocol\s+Address\s+Age.*Hardware Addr.*Type/i)) {
    if (!/^Internet\s/.test(line)) continue;
    const row = line.trim().split(/\s+/);
    if (row.length < 5 || !ipv4(row[1])) return failure();
    const complete = /^[\da-f]{4}\.[\da-f]{4}\.[\da-f]{4}$/i.test(row[3]) || /^(?:[\da-f]{2}:){5}[\da-f]{2}$/i.test(row[3]);
    if (!complete && row[3].toLowerCase() !== 'incomplete') return failure();
    records.push({ address: row[1], ageMinutes: /^\d+$/.test(row[2]) ? Number(row[2]) : null,
      mac: complete ? row[3].toLowerCase() : null, complete, interface: row[5] || null, vrf: 'default' });
  }
  return checked(records);
}

export function parseCdp(text) {
  const records = [];
  let record;
  for (const line of lines(text, /Device ID:|Total cdp entries displayed\s*:\s*0/i)) {
    const start = line.match(/^Device ID:\s*(.+)/);
    if (start) { record = { protocol: 'CDP', neighbor: start[1].trim().slice(0, 200) }; records.push(record); continue; }
    if (!record) continue;
    const ports = line.match(/^Interface:\s*(.+?),\s*Port ID \(outgoing port\):\s*(.+)/);
    if (ports) { record.interface = ports[1].trim(); record.remotePort = ports[2].trim(); }
    const ip = line.match(/(?:IP|IPv4) address:\s*(\S+)/i);
    if (ip && ipv4(ip[1])) record.managementAddress = ip[1];
    const platform = line.match(/^Platform:\s*(.+?),\s*Capabilities:\s*(.*)/);
    if (platform) { record.platform = platform[1].trim(); record.capabilities = platform[2].trim(); }
  }
  if (records.some(row => !row.interface || !row.remotePort)) return failure();
  return checked(records);
}

export function parseLldp(text) {
  const records = [];
  let record;
  for (const line of lines(text, /Local (?:Intf|Interface):|Total entries displayed\s*:\s*0/i)) {
    const start = line.match(/^Local (?:Intf|Interface):\s*(.+)/i);
    if (start) { record = { protocol: 'LLDP', interface: start[1].trim() }; records.push(record); continue; }
    if (!record) continue;
    const field = line.match(/^(Chassis id|Port id|System Name|System Capabilities):\s*(.*)/i);
    if (field) record[({ 'chassis id': 'chassisId', 'port id': 'remotePort', 'system name': 'neighbor', 'system capabilities': 'capabilities' })[field[1].toLowerCase()]] = field[2].trim().slice(0, 200);
    const ip = line.match(/^\s*(?:IP|IP address|IPv4):\s*(\S+)/i);
    if (ip && ipv4(ip[1])) record.managementAddress = ip[1];
  }
  if (records.some(row => !row.remotePort || (!row.neighbor && !row.chassisId))) return failure();
  return checked(records);
}

export function parseOspf(text) {
  const records = [];
  for (const line of lines(text, /Neighbor ID\s+Pri\s+State\s+Dead Time\s+Address\s+Interface/)) {
    if (!/^\s*\d+\./.test(line)) continue;
    const row = line.trim().split(/\s+/);
    if (row.length < 6 || !ipv4(row[0]) || !ipv4(row[4])) return failure();
    records.push({ protocol: 'OSPF', routerId: row[0], state: row[2], address: row[4], interface: row[5], vrf: 'default' });
  }
  return checked(records);
}

export function parseBgp(text) {
  const records = [];
  for (const line of lines(text, /Neighbor\s+V\s+AS\s+MsgRcvd.*State\/PfxRcd/)) {
    if (!/^\s*\d+\./.test(line)) continue;
    const row = line.trim().split(/\s+/);
    if (row.length < 10 || !ipv4(row[0])) return failure();
    const established = /^\d+$/.test(row[9]);
    records.push({ protocol: 'BGP', address: row[0], remoteAs: row[2], uptime: row[8], state: established ? 'Established' : row.slice(9).join(' '),
      receivedPrefixes: established ? Number(row[9]) : null, vrf: 'default' });
  }
  return checked(records);
}

export const FACT_SOURCES = Object.freeze([
  { id: 'version', scope: 'identity', command: 'show version', label: 'Device identity', parse: parseVersion },
  { id: 'inventory', scope: 'identity', command: 'show inventory', label: 'Hardware inventory', parse: parseInventory },
  { id: 'interfaceBrief', scope: 'interfaces', command: 'show ip interface brief', label: 'Interface addresses/state', parse: parseInterfaceBrief },
  { id: 'interfaces', scope: 'interfaces', command: 'show interfaces', label: 'Interface health', parse: parseInterfaces },
  { id: 'arp', scope: 'arp', command: 'show ip arp', label: 'ARP (default VRF)', parse: parseArp },
  { id: 'cdp', scope: 'neighbors', command: 'show cdp neighbors detail', label: 'CDP neighbors', parse: parseCdp },
  { id: 'lldp', scope: 'neighbors', command: 'show lldp neighbors detail', label: 'LLDP neighbors', parse: parseLldp },
  { id: 'macTable', scope: 'switching', command: 'show mac address-table', label: 'MAC forwarding', parse: parseMacTable },
  { id: 'vlans', scope: 'switching', command: 'show vlan brief', label: 'VLAN identifiers', parse: parseVlans },
  { id: 'ospf', scope: 'routingPeers', command: 'show ip ospf neighbor', label: 'OSPF peers (default VRF)', parse: parseOspf },
  { id: 'bgp', scope: 'routingPeers', command: 'show ip bgp summary', label: 'BGP peers (default VRF)', parse: parseBgp },
]);

export function updateFacts(previous = {}, outputs = {}, scopes, now, collectedAt = {}) {
  const facts = {};
  for (const source of FACT_SOURCES.filter(source => scopes.includes(source.scope))) {
    try { facts[source.id] = { records: source.parse(outputs[source.command]), observedAt: collectedAt[source.command] || now, failed: false }; }
    catch (error) { facts[source.id] = { ...previous[source.id], records: previous[source.id]?.records || [], failed: true, error: error.message, lastAttempt: now }; }
  }
  return facts;
}

export function correlateFacts(snapshots, query, observations, now, staleAfterMs) {
  const prefix = canonicalPrefix(query.type === 'ip' ? `${query.value}/32` : query.value);
  const within = ip => {
    const candidate = ipv4(ip || '') ? canonicalPrefix(`${ip}/32`) : null;
    return candidate && prefix && ((candidate.network & prefix.mask) >>> 0) === prefix.network;
  };
  const result = { identities: [], interfaces: [], arp: [], neighbors: [], routingPeers: [], switching: [], sources: [] };
  let truncated = false;
  for (const snapshot of snapshots) {
    const localRoutes = observations.filter(row => row.deviceId === snapshot.deviceId);
    const defaultRoutes = localRoutes.filter(row => row.vrf === 'default');
    const relatedPorts = new Set(localRoutes.filter(row => row.interface).map(row => normalizeInterface(row.interface)));
    const nextHops = new Set(defaultRoutes.map(row => row.nextHop).filter(Boolean));
    const defaultPorts = new Set(defaultRoutes.filter(row => row.interface).map(row => normalizeInterface(row.interface)));
    const defaultContext = !query.vrf || query.vrf === 'default';
    const exactAddress = prefix?.length === 32 ? prefix.prefix.split('/')[0] : null;
    const owningRoutes = exactAddress ? snapshot.routes.filter(route => route.local && route.prefix === `${exactAddress}/32` && (!query.vrf || route.vrf === query.vrf)) : [];
    const addressOwned = owningRoutes.length > 0;
    const interfaceAddressMatch = exactAddress && snapshot.facts?.interfaceBrief?.records.some(row => row.address === exactAddress);
    const routesStale = routes => routes.length > 0 && routes.every(route => snapshot.failed || route.stale || now - (route.observedAt || snapshot.observedAt) > staleAfterMs);
    for (const source of FACT_SOURCES) {
      const dataset = snapshot.facts?.[source.id];
      if (!dataset) continue;
      const stale = Boolean(snapshot.collectionFailed || dataset.failed || !dataset.observedAt || now - dataset.observedAt > staleAfterMs);
      result.sources.push({ device: snapshot.device, source: source.label, command: source.command, stale,
        observedAt: dataset.observedAt || null, error: dataset.error || null, count: dataset.records.length });
      for (const row of dataset.records) {
        let target;
        let related = false;
        let match;
        let associationStale = false;
        if (source.scope === 'identity') {
          target = 'identities'; related = Boolean(addressOwned || interfaceAddressMatch || localRoutes.length);
          match = addressOwned ? 'Address reported local by this router (RIB evidence)'
            : interfaceAddressMatch ? 'Exact interface-address match; interface VRF not reported'
              : 'Router reporting this route; not proof it owns addresses in the destination network';
          associationStale = addressOwned ? routesStale(owningRoutes) : interfaceAddressMatch
            ? Boolean(snapshot.facts.interfaceBrief.failed || now - snapshot.facts.interfaceBrief.observedAt > staleAfterMs)
            : routesStale(localRoutes);
        }
        if (source.scope === 'interfaces') { target = 'interfaces'; related = relatedPorts.has(normalizeInterface(row.interface)) || Boolean(exactAddress && row.address?.split('/')[0] === exactAddress);
          match = relatedPorts.has(normalizeInterface(row.interface)) ? 'Interface referenced by matching route' : 'Exact address match; interface VRF not reported';
          associationStale = routesStale(localRoutes.filter(route => normalizeInterface(route.interface) === normalizeInterface(row.interface))); }
        if (source.scope === 'arp') { target = 'arp'; related = defaultContext && (nextHops.has(row.address) || (prefix?.length > 0 && within(row.address))); }
        if (source.scope === 'neighbors') { target = 'neighbors'; related = relatedPorts.has(normalizeInterface(row.interface)) || Boolean(exactAddress && row.managementAddress === exactAddress);
          match = row.managementAddress === exactAddress ? 'Exact advertised management-address match' : 'Neighbor reported on a route-associated interface';
          associationStale = row.managementAddress !== exactAddress && routesStale(localRoutes.filter(route => normalizeInterface(route.interface) === normalizeInterface(row.interface))); }
        if (source.scope === 'routingPeers') { target = 'routingPeers'; related = defaultContext && (nextHops.has(row.address) || (query.type === 'ip' && row.address === query.value)
          || (row.interface && defaultPorts.has(normalizeInterface(row.interface)))
          || (row.protocol === 'BGP' && defaultRoutes.some(route => /^B/.test(route.protocol)))); }
        if (!related) continue;
        if (result[target].length >= 100) { truncated = true; continue; }
        result[target].push({ ...row, deviceId: snapshot.deviceId, device: snapshot.device, source: source.label,
          command: source.command, observedAt: dataset.observedAt, stale, match, associationStale });
      }
    }
  }
  // Join IP -> ARP MAC -> forwarding-table port, retaining both sources.
  // MAC reuse across fabrics/VLANs means these are candidate associations,
  // not a verified host identity or end-to-end path.
  const arpByMac = new Map();
  for (const arp of result.arp.filter(row => row.mac)) {
    const key = normalizeMac(arp.mac); arpByMac.set(key, [...(arpByMac.get(key) || []), arp]);
  }
  for (const snapshot of snapshots) {
    const dataset = snapshot.facts?.macTable;
    if (!dataset) continue;
    for (const row of dataset.records) {
      const matches = arpByMac.get(normalizeMac(row.mac)) || [];
      for (const arp of matches) {
        if (result.switching.length >= 100) { truncated = true; break; }
        const vlans = snapshot.facts?.vlans;
        const vlan = vlans?.records.find(v => v.vlan === row.vlan);
        const stale = Boolean(snapshot.collectionFailed || dataset.failed || arp.stale || now - dataset.observedAt > staleAfterMs);
        result.switching.push({ ...row, address: arp.address, arpDevice: arp.device, arpObservedAt: arp.observedAt,
          device: snapshot.device, deviceId: snapshot.deviceId, source: 'ARP → MAC forwarding correlation', command: 'show mac address-table',
          observedAt: dataset.observedAt, stale, vlanName: vlan?.name || null, vlanObservedAt: vlan ? vlans.observedAt : null,
          vlanStale: Boolean(vlan && (snapshot.collectionFailed || vlans.failed || now - vlans.observedAt > staleAfterMs)),
          match: 'MAC matches ARP evidence. VLAN/site continuity and endpoint identity are unverified.' });
      }
    }
  }
  return { ...result, truncated };
}
