import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampIndex, movedPosition } from '../src/domain/navigation.js';

const limits = { lastRow: 3, lastColumn: 5 };

test('clampIndex clamps to the range', () => {
  assert.equal(clampIndex(-1, 4), 0);
  assert.equal(clampIndex(9, 4), 4);
  assert.equal(clampIndex(2, 4), 2);
});

test('movedPosition: arrows, Home and End, with limits', () => {
  assert.deepEqual(movedPosition('ArrowRight', { r: 1, c: 1 }, limits), { r: 1, c: 2 });
  assert.deepEqual(movedPosition('ArrowLeft', { r: 1, c: 0 }, limits), { r: 1, c: 0 });
  assert.deepEqual(movedPosition('ArrowDown', { r: 3, c: 2 }, limits), { r: 3, c: 2 });
  assert.deepEqual(movedPosition('ArrowUp', { r: 0, c: 2 }, limits), { r: 0, c: 2 });
  assert.deepEqual(movedPosition('Home', { r: 2, c: 4 }, limits), { r: 2, c: 0 });
  assert.deepEqual(movedPosition('End', { r: 2, c: 1 }, limits), { r: 2, c: 5 });
});

test('movedPosition returns null for keys that do not navigate', () => {
  assert.equal(movedPosition('a', { r: 0, c: 0 }, limits), null);
  assert.equal(movedPosition('Enter', { r: 0, c: 0 }, limits), null);
});
