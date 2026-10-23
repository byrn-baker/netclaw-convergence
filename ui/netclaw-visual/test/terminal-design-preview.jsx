import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TerminalLane } from '../src/canvas-chat/App.jsx';

// Reuses the actual terminal and context components. ALL data is synthetic.
// No server requests, SSH, provider access or saved Canvas state are permitted.
const now = Date.now();
const demoExecutions = new Map();
const devices = [{ id: 'DEMO-EDGE-01', name: 'DEMO-EDGE-01', alias: 'Example edge', protocol: 'ssh', host: '192.0.2.10', port: 22, supported: true, os: 'iosxe' },
  { id: 'DEMO-CORE-02', name: 'DEMO-CORE-02', alias: 'Example core', protocol: 'ssh', host: '192.0.2.2', port: 22, supported: true, os: 'iosxe' }];
let demoPolicy = { version: 1, revision: 'demo-initial', enabled: false, devices: [] };
window.fetch = async (url, options) => {
  const path = String(url); let result;
  if (path === '/api/terminal/devices') result = { devices };
  else if (path === '/api/terminal/intent/change-policy') {
    if (options?.method === 'POST') {
      const input = JSON.parse(options.body);
      demoPolicy = { version: 1, revision: `demo-${Date.now()}`, enabled: input.enabled, devices: input.enabled ? devices.filter(d => input.deviceIds.includes(d.id)).map(d => ({ ...d, valid: true })) : [] };
    }
    result = demoPolicy;
  }
  else if (path === '/api/terminal/intent/runs') {
    const input = JSON.parse(options.body);
    result = { id: input.id, status: 'running', startedAt: new Date().toISOString(), segment: 1, steps: [], report: null, activityStatus: 'connected', activity: [], changeControl: input.changeMode === 'local-lab' ? { mode: 'local-lab', phase: 'prepare', devices: demoPolicy.devices.filter(d => input.targetDeviceIds.includes(d.id)) } : { mode: 'production' } };
    demoExecutions.set(input.id, result);
  }
  else if (path.startsWith('/api/terminal/intent/runs/')) {
    const job = demoExecutions.get(path.split('/').pop());
    if (!job) return new Response(JSON.stringify({ error: 'Synthetic execution record not found.' }), { status: 404 });
    const elapsed = Date.now() - Date.parse(job.startedAt);
    const activity = [
      { delay: 0, kind: 'lifecycle', title: 'DEMO ONLY: request accepted', detail: 'Synthetic activity; no Gateway, model or devices are contacted.', source: 'netclaw' },
      { delay: 1500, kind: 'tool-start', title: 'DEMO ONLY: pyats_run_command requested', detail: 'device: DEMO-EDGE-01\ncommand: show ip interface brief', source: 'gateway-transcript' },
      { delay: 3000, kind: 'tool-result', title: 'DEMO ONLY: tool returned output', detail: 'GigabitEthernet0/1 192.0.2.1 up up\nTunnel10 unassigned down down', source: 'gateway-transcript' },
      { delay: 4500, kind: 'tool-start', title: 'DEMO ONLY: peer check requested', detail: 'device: DEMO-CORE-02\ncommand: show ip route', source: 'gateway-transcript' },
      { delay: 6000, kind: 'tool-result', title: 'DEMO ONLY: peer returned output', detail: 'C 192.0.2.0/30 is directly connected, GigabitEthernet0/1', source: 'gateway-transcript' },
      { delay: 7500, kind: 'report', title: 'DEMO ONLY: policy decision required', detail: 'Prechecks finished; configuration has NOT started. Which approved VPN policy should be used?', source: 'netclaw' },
    ].filter(e => elapsed >= e.delay).map((event, index) => ({ ...event, id: `demo-${index}`, at: new Date(Date.parse(job.startedAt) + event.delay).toISOString() }));
    result = elapsed < 7500 ? { ...job, activity } : { ...job, activity, status: 'needs_input', report: {
      status: 'needs_input', summary: 'DEMO ONLY: prechecks examined both named endpoints. A VPN policy decision is needed before configuration.',
      question: 'Which approved VPN policy should be used? (Synthetic example; no devices were contacted.)', actions: [{ device: 'DEMO-EDGE-01', kind: 'read-only', summary: 'Simulated interface inventory checked.' }], verification: [],
    } };
  }
  else if (path === '/api/terminal/terra/status') result = { configured: false };
  else if (path === '/api/chat') {
    // Deterministic delayed proposal for UI status testing; never calls a model/device.
    await new Promise(resolve => setTimeout(resolve, 4000));
    const explainOnly = JSON.parse(options.body).message.includes('"task":"explain-output"');
    result = { response: JSON.stringify({ intent: 'DEMO ONLY: terminal intent response.', explanation: explainOnly ? 'Synthetic output explanation. No commands proposed.' : 'Synthetic configuration proposal. Nothing was sent to a device.',
      commands: explainOnly ? [] : ['configure terminal', 'interface Loopback10', 'description DEMO_ONLY'], risk: explainOnly ? 'read-only' : 'configuration', assumptions: ['FAKE DATA — no SSH connection exists in this preview.'] }) };
  }
  else if (path === '/api/terminal/enrich') result = { results: JSON.parse(options.body).objects.map(o => ({ ...o, resolved: true, providers: { 'local-alias': { status: 'resolved', alias: 'Example branch network — FAKE DATA' } } })) };
  else if (path === '/api/topology/lookup') {
    const query = JSON.parse(options.body);
    result = {
    collection: { enabled: true, intervalSeconds: 60, devices: [{ id: 'DEMO-EDGE-01', stale: false }, { id: 'DEMO-CORE-02', stale: false }], scopes: ['routes', 'interfaces', 'arp'] },
    context: { identities: devices.map(d => ({ deviceId: d.id, device: d.id, hostname: d.id, model: 'Synthetic IOS-XE device', command: 'show version', observedAt: now, match: 'Router reporting this route; not proof it owns addresses in the destination network' })),
      interfaces: [{ deviceId: 'DEMO-CORE-02', device: 'DEMO-CORE-02', interface: 'GigabitEthernet0/1', address: '198.51.100.1', state: 'up', protocol: 'up', description: 'Example user access — FAKE DATA', command: 'show interfaces', observedAt: now }],
      arp: [{ deviceId: 'DEMO-CORE-02', device: 'DEMO-CORE-02', address: '198.51.100.25', mac: '00:11:22:33:44:55', interface: 'GigabitEthernet0/1', vrf: 'CORP', complete: true, command: 'show ip arp', observedAt: now }], sources: [] },
    observations: [{ deviceId: 'DEMO-EDGE-01', device: 'DEMO-EDGE-01', prefix: '198.51.100.0/24', vrf: 'CORP', protocol: 'OSPF', nextHop: '192.0.2.2', interface: 'Gi0/1', distance: 110, metric: 20, observedAt: now },
      { deviceId: 'DEMO-CORE-02', device: 'DEMO-CORE-02', prefix: '198.51.100.0/24', vrf: 'CORP', protocol: 'C', connected: true, interface: 'GigabitEthernet0/1', observedAt: now }], relationships: [],
    closest: { status: 'matched', candidates: [{ deviceId: 'DEMO-CORE-02', device: 'DEMO-CORE-02', vrf: 'CORP', kind: 'connected-network', prefix: '198.51.100.0/24', interface: 'GigabitEthernet0/1', observedAt: now,
      reason: 'This device is directly connected to the destination network; it does not necessarily own the host IP.' }],
      reason: 'Synthetic example: closest known among collected devices, not a complete physical path.', unresolvedVrfs: [] },
    };
    if (query.value.startsWith('192.0.2.')) {
      const local = query.value === '192.0.2.1/32' || query.value === '192.0.2.1';
      result.observations = [{ deviceId: 'DEMO-EDGE-01', device: 'DEMO-EDGE-01', vrf: 'CORP',
        prefix: local ? '192.0.2.1/32' : '192.0.2.0/30', protocol: local ? 'L' : 'C', local, connected: !local, observedAt: Date.now() }];
      result.closest = { status: 'matched', candidates: [{ deviceId: 'DEMO-EDGE-01', device: 'DEMO-EDGE-01', vrf: 'CORP',
        kind: local ? 'local-address' : 'connected-network', prefix: result.observations[0].prefix,
        observedAt: Date.now(), reason: 'SYNTHETIC: local/connected on the current terminal router.' }], reason: 'FAKE DATA — green only for this local/connected example.' };
    } else if (query.value.startsWith('203.0.113.')) {
      result.observations = [];
      result.closest = { status: 'undetermined', candidates: [], reason: 'FAKE DATA — no reporting evidence for this example.' };
    }
  }
  else if (path === '/api/observability/lookup') result = { sources: [{ id: 'infoblox', name: 'Infoblox NIOS', status: 'ready' }], total: 1, matches: [{ provider: 'infoblox', title: 'Example branch LAN — FAKE DATA', address: '198.51.100.0/24', kind: 'IPAM allocation — not a live device', match: 'Exact prefix', scope: 'DEMO', context: 'Example branch / CORP', collectedAt: now, fields: { 'Network view': 'DEMO', Owner: 'Example network team' } }] };
  else return new Response(JSON.stringify({ error: 'Synthetic design preview: this action is not connected to an API.' }), { status: 400 });
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
};
window.WebSocket = class { static OPEN = 1; constructor() { throw new Error('SSH is disabled in this synthetic preview.'); } };
const transcript = [
  '\x1b[1;36mSYNTHETIC TERMINAL — DEMONSTRATION ONLY\x1b[0m',
  'No live devices, commands or integration data.', '',
  'DEMO-EDGE-01# show ip route vrf CORP',
  'Routing Table: CORP',
  'Codes: L - local, C - connected, S - static, O - OSPF', '',
  'O    198.51.100.0/24 [110/20] via 192.0.2.2, GigabitEthernet0/1',
  'C    192.0.2.0/30 is directly connected, GigabitEthernet0/1',
  'L    192.0.2.1/32 is directly connected, GigabitEthernet0/1',
  'S    203.0.113.0/24 [1/0] via 192.0.2.2', '',
  'DEMO-EDGE-01#',
].join('\r\n');
const noop = () => {};
function Preview() {
  const [dark, setDark] = useState(true), [mode, setMode] = useState('wide');
  const [node, setNode] = useState({ id: 'design-preview', terminalPreviewOnly: true, x: 0, y: 0, w: 1360, h: 820, z: 1, terminalDevice: devices[0].id, terminalTranscript: transcript });
  const host = useRef(null), lane = useRef(null);
  const patch = useCallback(change => setNode(previous => ({ ...previous, ...change })), []);
  useEffect(() => {
    const resize = new ResizeObserver(() => patch({ w: host.current.clientWidth })); resize.observe(host.current); return () => resize.disconnect();
  }, [patch]);
  return <main style={{ padding: '22px 28px', minHeight: '100vh', boxSizing: 'border-box', background: dark ? '#080f18' : '#edf1f5', color: dark ? '#dbe5ef' : '#273649', font: '13px Segoe UI,system-ui' }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
      <div style={{ flex: 1 }}><h1 style={{ margin: 0, fontSize: 20 }}>Terminal workspace</h1><p style={{ margin: '5px 0 0', color: dark ? '#a8bbce' : '#526478' }}>SYNTHETIC PREVIEW · All device and provider data is fake. No connections are made.</p></div>
      <label>Appearance <select aria-label="Appearance" value={dark ? 'dark' : 'light'} onChange={e => setDark(e.target.value === 'dark')}><option value="dark">Dark</option><option value="light">Light</option></select></label>
      <label>Window <select aria-label="Window size" value={mode} onChange={e => setMode(e.target.value)}><option value="wide">Wide</option><option value="compact">Compact</option><option value="zoom">Canvas zoom</option></select></label>
    </header>
    <div ref={host} style={{ position: 'relative', width: mode === 'compact' ? 'min(660px,100%)' : '100%', maxWidth: 1440, height: 850, transform: mode === 'zoom' ? 'scale(.8)' : undefined, transformOrigin: 'top left', '--ink': dark ? '#dbe5ef' : '#273649', '--muted': dark ? '#9cacc0' : '#5b6b7e', '--card': dark ? '#182432' : '#fff', '--hairline': dark ? '#2a3a4a' : '#dce3eb', '--ring': '#599e9e22', '--shadow': '#0002' }}>
      <TerminalLane node={node} color={dark ? '#58bdb3' : '#0e7c7b'} dark={dark} isActive laneRef={lane} onPatch={patch} onFocus={noop} onDragStart={noop} onResizeStart={noop} onToggleMin={() => patch({ min: !node.min })} onDelete={noop} highlights={[]} onSelect={noop} onAutoFit={noop} onOpenConfigReview={noop} onCreateResult={() => null} />
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
