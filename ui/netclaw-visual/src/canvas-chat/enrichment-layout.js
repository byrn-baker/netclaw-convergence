// All measurements are viewport CSS pixels, including any canvas zoom.
export function calculateEnrichmentPopoverPlacement(anchor, size, viewport, region) {
  const margin = 8;
  const gap = 10;
  const leftEdge = Math.max(12, (region?.left ?? 0) + margin);
  const rightEdge = Math.min(viewport.width - 12, (region?.right ?? viewport.width) - margin);
  const topEdge = Math.max(12, (region?.top ?? 0) + margin);
  const bottomEdge = Math.min(viewport.height - 12, (region?.bottom ?? viewport.height) - margin);
  const width = Math.max(0, Math.min(720, rightEdge - leftEdge));
  let maxHeight = Math.max(0, Math.min(500, bottomEdge - topEdge));
  const height = Math.min(size.height || 500, maxHeight);
  const below = Math.max(0, bottomEdge - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - gap - topEdge);
  let left = anchor.left;
  let top = anchor.top;
  let placement;
  if (rightEdge - anchor.right - gap >= width) {
    placement = 'right';
    left = anchor.right + gap;
  } else if (below >= Math.min(height, 220)) {
    placement = 'below';
    top = anchor.bottom + gap;
    maxHeight = Math.min(maxHeight, below);
  } else if (above >= Math.min(height, 220)) {
    placement = 'above';
    maxHeight = Math.min(maxHeight, above);
    top = anchor.top - gap - Math.min(height, maxHeight);
  } else {
    // A small terminal still gets a usable scrollable card, never a card
    // outside its window just to make room above or below the route.
    placement = 'overlay';
    top = topEdge;
  }
  left = Math.max(leftEdge, Math.min(left, rightEdge - width));
  top = Math.max(topEdge, Math.min(top, bottomEdge - maxHeight));
  return { left, top, width, maxHeight, placement };
}

// Return null when a readable details pane would cover terminal text.
export function calculateEnrichmentDock(region, contentRight, viewport) {
  if (!region || !Number.isFinite(contentRight)) return null;
  const top = Math.max(12, region.top + 8);
  const bottom = Math.min(viewport.height - 12, region.bottom - 8);
  // Dock flush to this terminal's black content area, not the browser edge.
  // The viewport is only a clipping boundary; keep spacing on the CLI side.
  const right = Math.min(viewport.width, region.right);
  const available = right - Math.max(region.left, contentRight) - 24;
  if (available < 420 || bottom - top < 240) return null;
  const width = available;
  return { left: right - width, top, width, height: bottom - top,
    maxHeight: bottom - top, placement: "docked" };
}

// Inspect the visible buffer only. Cell positions (not string length) account
// for wide glyphs. Protect the input cursor as well as every visible text row.
export function terminalContentColumns(terminal) {
  const buffer = terminal?.buffer?.active;
  if (!buffer) return null;
  const cursorRow = buffer.baseY + buffer.cursorY;
  let columns = cursorRow >= buffer.viewportY && cursorRow < buffer.viewportY + terminal.rows
    ? Math.min(terminal.cols, buffer.cursorX + 1) : 0;
  for (let row = buffer.viewportY; row < buffer.viewportY + terminal.rows; row += 1) {
    const line = buffer.getLine(row);
    if (!line) continue;
    for (let col = line.length - 1; col >= columns; col -= 1) {
      const cell = line.getCell(col);
      if (cell?.getChars().trim()) {
        columns = Math.max(columns, col + Math.max(1, cell.getWidth()));
        break;
      }
    }
  }
  return columns;
}
