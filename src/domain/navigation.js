// Keyboard navigation across a grid (the sheet). Pure module: no DOM.

/** Clamps an index to the [0, max] range. */
export function clampIndex(value, max) {
  return Math.max(0, Math.min(max, value));
}

/**
 * Position a navigation key moves to (already clamped to the grid), or null if the key does not navigate.
 * @param {string} key `event.key` value.
 * @param {{r: number, c: number}} position Current row and column.
 * @param {{lastRow: number, lastColumn: number}} limits Last row and column indexes.
 * @returns {{r: number, c: number}|null}
 */
export function movedPosition(key, { r, c }, { lastRow, lastColumn }) {
  const target = targetOf(key, r, c, lastColumn);
  if (!target) return null;
  return { r: clampIndex(target.r, lastRow), c: clampIndex(target.c, lastColumn) };
}

function targetOf(key, r, c, lastColumn) {
  switch (key) {
    case 'ArrowUp': return { r: r - 1, c };
    case 'ArrowDown': return { r: r + 1, c };
    case 'ArrowLeft': return { r, c: c - 1 };
    case 'ArrowRight': return { r, c: c + 1 };
    case 'Home': return { r, c: 0 };
    case 'End': return { r, c: lastColumn };
    default: return null;
  }
}
