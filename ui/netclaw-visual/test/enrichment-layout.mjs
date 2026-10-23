import assert from "node:assert/strict";
import { calculateEnrichmentDock, calculateEnrichmentPopoverPlacement, terminalContentColumns } from "../src/canvas-chat/enrichment-layout.js";

const viewport = { width: 1800, height: 1000 };
const region = { left: 20, right: 1780, top: 200, bottom: 980 };
const dock = calculateEnrichmentDock(region, 870, viewport);
assert.equal(dock.placement, "docked");
assert.equal(dock.width, 886, 'fill all available blank space, without a 720px cap');
assert.ok(dock.left > 870);
assert.equal(dock.left + dock.width, region.right);
assert.equal(dock.height, 764);
// Narrow windows, long output and short terminal windows must hide the pane.
assert.equal(calculateEnrichmentDock({ ...region, right: 1100 }, 870, viewport), null);
assert.equal(calculateEnrichmentDock(region, 1600, viewport), null);
assert.equal(calculateEnrichmentDock({ ...region, bottom: 400 }, 870, viewport), null);
assert.equal(calculateEnrichmentDock(region, null, viewport), null);
assert.equal(calculateEnrichmentDock(null, 800, viewport), null);
// Offscreen portions cannot be counted as usable space.
assert.equal(calculateEnrichmentDock({ ...region, right: 2600 }, 1400, viewport), null);
const clipped = calculateEnrichmentDock({ ...region, top: -20, bottom: 1200 }, 870, viewport);
assert.equal(clipped.top, 12);
assert.equal(clipped.top + clipped.height, 988);
// A canvas-scaled terminal works with the same viewport-coordinate geometry.
assert.equal(calculateEnrichmentDock({ left: 10, right: 1000, top: 100, bottom: 700 }, 530, viewport).width, 446);
// Moving/resizing a terminal must move its pane edge, independently of the screen.
for (const right of [1100, 1300, 1700]) {
  const moved = calculateEnrichmentDock({ left: 100, right, top: 100, bottom: 800 }, 600, viewport);
  assert.equal(moved.left + moved.width, right);
  assert.ok(moved.left >= 624, "keep the gap between output and details");
  assert.ok(moved.left + moved.width < viewport.width);
}

function line(lastColumn, width = 1) {
  return { length: 200, getCell: col => ({ getChars: () => col === lastColumn ? "X" : " ", getWidth: () => width }) };
}
const terminal = { cols: 200, rows: 2, buffer: { active: { viewportY: 3,
  getLine: row => ({ 0: line(199), 3: line(95), 4: line(101, 2) })[row] } } };
assert.equal(terminalContentColumns(terminal), 103);
terminal.buffer.active.viewportY = 5;
assert.equal(terminalContentColumns(terminal), 0);
Object.assign(terminal.buffer.active, { baseY: 5, cursorY: 0, cursorX: 110 });
assert.equal(terminalContentColumns(terminal), 111, 'never cover the input cursor');
terminal.buffer.active.cursorX = 2;
assert.equal(terminalContentColumns(terminal), 3, 'do not reserve an arbitrary 80 columns');
assert.equal(terminalContentColumns(null), null);

// Every rendered dock is strictly beyond all text, across zoom and window sizes.
for (const scale of [.5, .76, 1, 1.5]) for (const width of [600, 1200, 2000]) {
  const bounds = { left: 20, right: 20 + width * scale, top: 80, bottom: 800 };
  for (const textWidth of [200, 700, 1500, 2200]) {
    const textRight = 28 + textWidth * scale;
    const pane = calculateEnrichmentDock(bounds, textRight, { width: 4000, height: 1000 });
    if (pane) {
      assert.equal(pane.left, textRight + 24);
      assert.equal(pane.left + pane.width, bounds.right);
    }
  }
}

// Both dock and hover fallback stay inside the terminal, not just the browser.
for (const bounds of [
  region,
  { left: 260, right: 810, top: 420, bottom: 650 }, // small canvas window
  { left: 0, right: 1600, top: 70, bottom: 980 }, // beneath menu bar
  { left: -200, right: 700, top: -100, bottom: 650 }, // partly offscreen
  { left: 300, right: 900, top: 150, bottom: 800 }, // clipped by parent
]) {
  for (const y of [bounds.top + 10, (bounds.top + bounds.bottom) / 2, bounds.bottom - 20]) {
    const anchor = { left: bounds.left + 20, right: bounds.left + 150, top: y, bottom: y + 15 };
    for (const height of [70, 500, 2000]) {
      const hover = calculateEnrichmentPopoverPlacement(anchor, { height }, viewport, bounds);
      assert.ok(hover.left >= Math.max(12, bounds.left + 8));
      assert.ok(hover.top >= Math.max(12, bounds.top + 8));
      assert.ok(hover.left + hover.width <= Math.min(viewport.width - 12, bounds.right - 8));
      assert.ok(hover.top + hover.maxHeight <= Math.min(viewport.height - 12, bounds.bottom - 8));
    }
  }
}
console.log("Responsive enrichment layout checks passed.");
