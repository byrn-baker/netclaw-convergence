import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function panel(overlay) {
  const nodes = new Map();
  const context = {
    window: { NetClawOverlay: overlay }, console,
    document: { getElementById(id) { if (!nodes.has(id)) nodes.set(id, { textContent: '', className: '', addEventListener(type, handler) { this[type] = handler; } }); return nodes.get(id); } },
  };
  vm.createContext(context);
  const source = fs.readFileSync(new URL('../../../netclaw-zoom-app/panel.js', import.meta.url), 'utf8').replace(/\ninitZoomSdk\(\);\s*$/, '');
  vm.runInContext(source, context);
  return { nodes, enabled: () => vm.runInContext('overlayEnabled', context) };
}

test('missing overlay cannot report enabled', async () => {
  const p = panel(); await p.nodes.get('overlay-toggle').click();
  assert.equal(p.enabled(), false);
  assert.match(p.nodes.get('status').textContent, /unavailable/i);
});
test('failed overlay cannot report enabled', async () => {
  const p = panel({ enable: async () => false }); await p.nodes.get('overlay-toggle').click();
  assert.equal(p.enabled(), false);
});

test('failed camera startup cleans up controller and returns false', async () => {
  const calls = [];
  const context = { window: {}, console: { warn() {}, error() {} }, zoomSdk: { async callZoomApi(method, args) {
    calls.push([method, args.mode]);
    if (method === 'startLayer' && args.mode === 'camera') throw Error('fixture entitlement absent');
  } } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../../../netclaw-zoom-app/overlay.js', import.meta.url), 'utf8'), context);
  assert.equal(await context.window.NetClawOverlay.enable(), false);
  assert.deepEqual(calls, [['startLayer','controller'], ['startLayer','camera'], ['stopLayer','controller']]);
});
