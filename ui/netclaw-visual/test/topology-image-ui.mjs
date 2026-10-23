import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  assert.ok(await vite.transformRequest('/test/terminal-design-preview.jsx'));
  const { TopologyDiagram } = await vite.ssrLoadModule('/src/canvas-chat/TopologyImage.jsx');
  const props = { url: 'data:image/png;base64,synthetic', record: { width: 800, height: 400, name: 'Demo only' }, address: '198.51.100.0/24', markers: [
    { deviceId: 'edge', role: 'current', x: .2, y: .5, label: 'Current terminal: Example edge' },
    { deviceId: 'core', role: 'reporting', x: .8, y: .5, label: 'Closest reporting device: Example core <test>' },
  ] };
  const html = renderToStaticMarkup(React.createElement(TopologyDiagram, props));
  assert.match(html, /topology-device-light--current/);
  assert.match(html, /topology-device-light--reporting/);
  assert.match(html, /Current terminal: Example edge/);
  assert.match(html, /&lt;test&gt;/);
  const local = renderToStaticMarkup(React.createElement(TopologyDiagram, { ...props, markers: props.markers.slice(0, 1) }));
  assert.doesNotMatch(local, /topology-device-light--reporting/);
  const edit = renderToStaticMarkup(React.createElement(TopologyDiagram, { ...props, editing: true, selected: 'edge', points: [{ deviceId: 'edge', x: .2, y: .5 }] }));
  assert.match(edit, /topology-device-light--selected/);
  assert.doesNotMatch(edit, /topology-device-light--reporting/);
  console.log('Topology image JSX tests passed: role markers, escaped labels, local-only rendering and mapping mode. Not visual browser QA.');
} finally { await vite.close(); }
