import React, { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ObservabilityContext, ObservabilitySettings } from '../src/canvas-chat/ObservabilityContext.jsx';
import '../src/canvas-chat/TerminalEnrichmentPopover.css';

// Development fixture only. All requests are mocked; no credentials or provider APIs are used.
const providers = [
  { id: 'infoblox', name: 'Infoblox NIOS', available: true, status: 'ready', count: 1, updatedAt: Date.now(), description: 'SYNTHETIC EXAMPLE: network allocation from NIOS.', config: { endpoint: 'https://ipam.example/wapi/v2.13', scope: 'demo', intervalSeconds: 300 } },
  { id: 'thousandeyes', name: 'ThousandEyes', available: true, status: 'ready', count: 1, description: 'SYNTHETIC EXAMPLE: latest network-test results.' },
  { id: 'kubernetes', name: 'Kubernetes', available: true, status: 'disabled', count: 0, description: 'SYNTHETIC EXAMPLE: namespace-scoped pod identity.' },
  { id: 'otel', name: 'OpenTelemetry export', available: true, status: 'disabled', count: 0, description: 'SYNTHETIC EXAMPLE: outbound health counts only.' },
  { id: 'vmware', name: 'VMware vCenter', available: false, status: 'planned', description: 'Planned adapter, not implemented.' },
  { id: 'extrahop', name: 'ExtraHop', available: false, status: 'planned', description: 'Planned adapter, not implemented.' },
];
window.fetch = async (url, options) => {
  const path = String(url);
  let data;
  if (path.endsWith('/lookup')) data = { sources: providers.filter(p => p.available && p.id !== 'otel'), total: 2, truncated: false, matches: [
    { provider: 'infoblox', address: '198.51.100.0/24', title: 'FAKE DATA — Example branch LAN', kind: 'IPAM allocation — not a live device', match: 'Exact address / prefix', context: 'DEMO / CORP (manual label)', scope: 'demo', collectedAt: Date.now(), fields: { 'Network view': 'DEMO', Network: '198.51.100.0/24' } },
    { provider: 'thousandeyes', address: '198.51.100.20', title: 'FAKE DATA — Example WAN test', kind: 'Measured test target — not device ownership', match: 'Address or subnet inside selected network', context: 'DEMO', scope: '123', collectedAt: Date.now(), stale: true, fields: { 'Reporting agent': 'DEMO-AGENT', 'Average RTT (ms)': 18, 'Packet loss (%)': 0, 'Measurement time': 'Synthetic observation — not measured' } },
  ] };
  else if (path.endsWith('/status')) data = { providers, sessionOnly: true };
  else if (path.startsWith('/api/observability/')) {
    const provider = providers.find(p => path.endsWith(`/${p.id}`)); const body = JSON.parse(options.body);
    Object.assign(provider, { status: body.enabled === false ? 'disabled' : 'ready', config: { ...body, secret: undefined }, error: null });
    data = { providers, sessionOnly: true };
  } else throw new Error('Fixture blocked an unexpected request.');
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};
function Preview() {
  const [open, setOpen] = useState(false); const close = useCallback(() => setOpen(false), []);
  return <main style={{ padding: 24, font: '14px system-ui', color: '#d8e6f3', background: '#090e14', minHeight: '100vh' }}>
    <h1>SYNTHETIC DATA — demonstration only</h1><p>No live integrations, real devices, or API connections. Forms do not save credentials.</p>
    <button onClick={() => setOpen(true)}>Open integration settings</button>
    <div style={{ maxWidth: 900, marginTop: 24, containerType: 'inline-size' }}><ObservabilityContext token={{ type: 'prefix', value: '198.51.100.0/24' }} onOpenSettings={() => setOpen(true)} /></div>
    {open && <ObservabilitySettings onClose={close} />}
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
