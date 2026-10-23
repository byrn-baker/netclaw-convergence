import assert from 'node:assert/strict';
import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
const previous = new Map();
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
  navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
  previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
const root = createRoot(document.getElementById('root'));
const errorLog = console.error;
try {
  const { createLazyLane } = await vite.ssrLoadModule('/src/canvas-chat/LazyLane.jsx');
  let complete, loads = 0, mounts = 0, disposals = 0, closed = 0;
  function Session({ node }) {
    useEffect(() => { mounts++; return () => { disposals++; }; }, []);
    return React.createElement('div', { 'data-live-session': node.id }, 'Synthetic session');
  }
  const Lane = createLazyLane(() => { loads++; return new Promise(resolve => { complete = resolve; }); }, 'SSH terminal');
  assert.equal(loads, 0, 'declaring a feature does not download it');
  const props = { node: { id: 'one', kind: 'terminal', x: 40, y: 50, w: 720, h: 500, z: 10 },
    onDelete: () => { closed++; } };
  await act(async () => root.render(React.createElement(Lane, props)));
  assert.equal(loads, 1);
  assert.match(document.body.textContent, /Loading SSH terminal/);
  assert.equal(document.querySelector('[data-node-id]').style.left, '40px');
  await act(async () => document.querySelector('button').click());
  assert.equal(closed, 1, 'pending windows remain closable');
  await act(async () => complete({ default: Session }));
  assert.equal(mounts, 1);
  assert.ok(document.querySelector('[data-live-session="one"]'));
  let attempts = 0;
  const Broken = createLazyLane(() => ++attempts === 1
    ? Promise.reject(new Error('synthetic chunk failure')) : Promise.resolve({ default: Session }), 'Result');
  const render = () => root.render(React.createElement(React.Fragment, null,
    React.createElement(Lane, { ...props, key: 'stable', node: { ...props.node, x: 80 } }),
    React.createElement(Broken, { ...props, key: 'result', node: { ...props.node, id: 'two', kind: 'result' } })));
  // Establish the stable sibling before simulating another window's failure.
  await act(async () => root.render(React.createElement(React.Fragment, null,
    React.createElement(Lane, { ...props, key: 'stable' }))));
  const before = { mounts, disposals };
  console.error = (...args) => {
    if (args.map(String).join(' ').includes('synthetic chunk failure') || args.map(String).join(' ').includes('LazyLane')) return;
    errorLog(...args);
  };
  await act(async () => render());
  assert.match(document.body.textContent, /Result could not load/);
  assert.equal(mounts, before.mounts);
  assert.equal(disposals, before.disposals, 'a sibling failure must not dispose a running session');
  const retry = [...document.querySelectorAll('button')].find(button => button.textContent === 'Retry');
  await act(async () => retry.click());
  assert.equal(attempts, 2);
  assert.equal(document.querySelectorAll('[data-live-session]').length, 2);
  await act(async () => render());
  assert.equal(disposals, before.disposals, 'ordinary rerenders must not remount a loaded feature');
  assert.equal(loads, 1);
  console.log('Lazy windows: on-demand loading, spatial fallback, close, failure/retry and sibling lifecycle isolation passed (synthetic sessions).');
} finally {
  console.error = errorLog;
  await act(async () => root.unmount());
  await vite.close();
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}
