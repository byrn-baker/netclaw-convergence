// xterm 6.0 measures cells in untransformed CSS pixels, but MouseService
// subtracts a transformed DOMRect from viewport mouse coordinates. Canvas zoom
// therefore needs a small coordinate adapter. Keep xterm's own selection model
// (word/line/column selection, wide cells, scrollback, mouse reporting) intact.
export function terminalMouseCoordinates(event, rect, canvas) {
  if (![rect?.width, rect?.height, canvas?.width, canvas?.height].every(value => Number.isFinite(value) && value > 0)) return event;
  return {
    clientX: rect.left + (event.clientX - rect.left) * canvas.width / rect.width,
    clientY: rect.top + (event.clientY - rect.top) * canvas.height / rect.height,
  };
}

export function installTerminalMouseCoordinates(terminal) {
  // Deliberately isolated private API boundary. Recheck this adapter and the
  // browser fixture when upgrading the pinned xterm version. Public APIs do not
  // expose pointer-coordinate conversion or drag-scroll hit testing.
  const core = terminal._core;
  const mouse = core?._mouseService;
  const selection = core?._selectionService;
  const screen = core?.screenElement;
  if (!screen || !core?._renderService || typeof mouse?.getCoords !== 'function'
      || typeof mouse?.getMouseReportCoords !== 'function' || typeof selection?._getMouseEventScrollAmount !== 'function') {
    console.warn('Terminal zoom coordinate adapter unavailable; check xterm compatibility.');
    return { dispose() {} };
  }
  // Read current geometry for EVERY event. Canvas zoom/pan do not trigger a
  // terminal ResizeObserver, and CSS/browser zoom may use fractional pixels.
  const convert = event => terminalMouseCoordinates(event, screen.getBoundingClientRect(), core._renderService.dimensions.css.canvas);
  const restores = [];
  const wrap = (owner, key) => {
    const original = owner[key];
    const adapted = function (event, ...args) { return original.call(this, convert(event), ...args); };
    owner[key] = adapted;
    restores.push(() => { if (owner[key] === adapted) owner[key] = original; });
  };
  wrap(mouse, 'getCoords');
  wrap(mouse, 'getMouseReportCoords');
  // SelectionService otherwise thinks a zoomed-in pointer is below the terminal
  // while it is still over visible text, causing unwanted autoscroll.
  wrap(selection, '_getMouseEventScrollAmount');
  return { dispose() { restores.forEach(restore => restore()); } };
}
