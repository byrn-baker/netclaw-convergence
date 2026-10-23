import assert from 'node:assert/strict';
import { terminalMouseCoordinates, installTerminalMouseCoordinates } from '../src/canvas-chat/terminal-mouse-coordinates.js';

const canvas = { width: 803.125, height: 411.75 };
for (const scaleX of [0.35, 0.5, 0.762, 1, 1.25, 1.5, 2]) {
  for (const scaleY of [scaleX, 0.8, 1.2]) {
    const rect = { left: -112.75, top: 283.125, width: canvas.width * scaleX, height: canvas.height * scaleY };
    for (const [x, y] of [[0, 0], [165.3, 111.6], [799, 410], [-35, -15], [850, 490]]) {
      const mapped = terminalMouseCoordinates({ clientX: rect.left + x * scaleX, clientY: rect.top + y * scaleY }, rect, canvas);
      assert.ok(Math.abs(mapped.clientX - rect.left - x) < 1e-9);
      assert.ok(Math.abs(mapped.clientY - rect.top - y) < 1e-9);
    }
  }
}
const event = { clientX: 1, clientY: 2 };
assert.equal(terminalMouseCoordinates(event, { width: 0, height: 0 }, canvas), event, 'hidden terminals fall back safely');

let rect = { left: 50, top: 100, width: 400, height: 200 };
const mouse = {
  getCoords(e, element, cols, rows, selecting) {
    assert.equal(this, mouse);
    assert.equal(element, 'screen');
    const x = Math.ceil(((e.clientX - rect.left) + (selecting ? 5 : 0)) / 10);
    const y = Math.ceil((e.clientY - rect.top) / 20);
    return [Math.min(Math.max(x, 1), cols + (selecting ? 1 : 0)), Math.min(Math.max(y, 1), rows)];
  },
  getMouseReportCoords(e) { return { x: e.clientX - rect.left, y: e.clientY - rect.top }; },
};
const selection = { _getMouseEventScrollAmount(e) { const y = e.clientY - rect.top; return y < 0 ? -1 : y > 400 ? 1 : 0; } };
const terminal = { _core: { _mouseService: mouse, _selectionService: selection,
  screenElement: { getBoundingClientRect: () => rect }, _renderService: { dimensions: { css: { canvas: { width: 800, height: 400 } } } } } };
const original = mouse.getCoords;
const adapter = installTerminalMouseCoordinates(terminal);
for (const zoom of [0.5, 0.76, 1, 1.25, 2]) {
  rect = { left: 135.5 - zoom * 20, top: 180 - zoom * 30, width: 800 * zoom, height: 400 * zoom };
  const point = (x, y) => ({ clientX: rect.left + x * zoom, clientY: rect.top + y * zoom });
  assert.deepEqual(mouse.getCoords(point(252, 170), 'screen', 80, 20, true), [26, 9]);
  assert.deepEqual(mouse.getCoords(point(252, 170), 'screen', 80, 20, false), [26, 9]);
  assert.equal(selection._getMouseEventScrollAmount(point(100, 399)), 0, 'no premature drag scroll');
  assert.equal(selection._getMouseEventScrollAmount(point(100, 401)), 1);
  assert.equal(selection._getMouseEventScrollAmount(point(100, -1)), -1);
  assert.deepEqual(mouse.getMouseReportCoords(point(200, 300)), { x: 200, y: 300 });
  assert.deepEqual(mouse.getCoords(point(900, 600), 'screen', 80, 20, true), [81, 20]);
}
adapter.dispose();
assert.equal(mouse.getCoords, original, 'unmount restores original methods');
console.log('Terminal pointer geometry passed: zoom, pan, fractional cells, bounds, reports, drag-scroll and cleanup.');
