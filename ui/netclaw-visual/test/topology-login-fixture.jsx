import React from 'react';
import { createRoot } from 'react-dom/client';
import { TopologySettings } from '../src/canvas-chat/TopologyContext.jsx';
import { TOPOLOGY_SCOPES } from '../topology-scope.js';

// Development-only visual fixture. Every fetch is answered in memory, never
// forwarded to a server. Enter invented values only; no storage is used.
let enabled = false;
const status = () => ({ enabled, intervalSeconds: 30, availableScopes: TOPOLOGY_SCOPES,
  devices: enabled ? [{ id: 'DEMO-R1', phase: 'current', scopes: ['routes'], lastSuccess: Date.now() }] : [],
  availableDevices: [{ id: 'DEMO-R1', alias: 'FAKE DEVICE — enter invented credentials only', eligible: true, os: 'iosxe' }], audit: [] });
window.fetch = async (url, options = {}) => {
  const body = JSON.parse(options.body || '{}');
  if (url === '/api/topology/status') return Response.json(status());
  if (url === '/api/topology/login') {
    if (!body.credentials?.username || !body.credentials?.password) return Response.json({ error: 'Enter invented credentials for this synthetic demo.' }, { status: 400 });
    return Response.json(body.challenge ? { status: 'ready', sessionCredentials: true } : { status: 'host-key', host: '192.0.2.1', port: 22,
      fingerprint: 'SHA256:FAKE-DEMO-FINGERPRINT-NOT-A-REAL-KEY', keyType: 'ssh-ed25519', challenge: 'demo-only', changed: false });
  }
  if (url === '/api/topology/authorize' || url === '/api/topology/revoke') { enabled = url.endsWith('/authorize'); return Response.json(status()); }
  throw new Error('No network access is available in this synthetic fixture.');
};
createRoot(document.getElementById('root')).render(<TopologySettings onClose={() => { document.getElementById('root').textContent = 'Synthetic fixture closed.'; }} />);
