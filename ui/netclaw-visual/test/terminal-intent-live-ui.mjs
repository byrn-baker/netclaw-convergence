import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// Render the actual JSX without contacting the Gateway or opening a listener.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { TerminalIntentLiveActivity } = await vite.ssrLoadModule('/src/canvas-chat/TerminalIntentExecution.jsx');
  const { default: TerminalChangeControl } = await vite.ssrLoadModule('/src/canvas-chat/TerminalChangeControl.jsx');
  const controls = renderToStaticMarkup(React.createElement(TerminalChangeControl, { devices: [], value: { mode: 'production', targetDeviceIds: [] }, onChange: () => {}, busy: false }));
  assert.match(controls, /Production · ServiceNow approval/);
  assert.match(controls, /Manage lab authorization/);
  assert.match(controls, /Save lab authorization/);
  assert.match(controls, /No|Production approval requirements remain in effect/);
  const run = { id: 'synthetic-only', status: 'running', activityStatus: 'connected', activity: [
    { id: 'one', at: new Date().toISOString(), kind: 'tool-start', title: 'Tool requested: pyats_run_command', detail: 'device: DEMO-R1\ncommand: show ip route', source: 'gateway-transcript' },
    { id: 'two', at: new Date().toISOString(), kind: 'tool-result', title: 'Tool returned output', detail: '<script>not executable</script>\n' + 'Synthetic route output. '.repeat(100), source: 'gateway-transcript' },
    { id: 'three', at: new Date().toISOString(), kind: 'report', title: 'Agent-reported verification', detail: 'Synthetic check only.', source: 'netclaw' },
  ] };
  const html = renderToStaticMarkup(React.createElement(TerminalIntentLiveActivity, { run }));
  assert.match(html, /Live execution activity/);
  assert.match(html, /Follow latest/);
  assert.match(html, /Observed Gateway tool activity/);
  assert.match(html, /Agent-reported evidence/);
  assert.match(html, /show ip route/);
  assert.match(html, /<details\b/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  const unavailable = renderToStaticMarkup(React.createElement(TerminalIntentLiveActivity, { run: { ...run, activityStatus: 'unavailable', activity: [] } }));
  assert.match(unavailable, /Detailed tool activity is unavailable/);
  assert.match(unavailable, /No execution events received yet/);
  console.log('Intent live UI render tests passed: real JSX, inline commands, evidence labels, escaped output, expandable output and unavailable state. Not a visual browser test.');
} finally { await vite.close(); }
