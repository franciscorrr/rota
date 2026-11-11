import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, normalizeState } from '../src/domain/storage.js';

const CATEGORIES = [
  { id: 'encargado', name: 'Encargado', rank: 3 },
  { id: 'vendedor', name: 'Vendedor', rank: 2 },
  { id: 'mozo', name: 'Mozo', rank: 1 },
];

test('minimum staff: a numeric standardHeadcount becomes the lowest category', () => {
  const raw = {
    settings: {
      weekStart: '2026-11-16',
      categories: CATEGORIES,
      shifts: {
        morning: { start: '09:00', end: '15:00', standardHeadcount: 3 },
        afternoon: { start: '15:00', end: '21:00', standardHeadcount: 2 },
      },
    },
    employees: [{ id: 'e1', name: 'Ana', contractHours: 30, absences: [] }],
    overrides: { '2026-11-21|morning': 4, '2026-11-17|afternoon': 0 },
    assignments: [],
  };
  const state = normalizeState(raw);
  assert.deepEqual(state.settings.categories.map((c) => [c.name, c.rank]), [['Encargado', 3], ['Vendedor', 2], ['Mozo', 1]]);
  assert.deepEqual(state.settings.shifts.morning.required, { mozo: 3 });
  assert.deepEqual(state.settings.shifts.afternoon.required, { mozo: 2 });
  assert.deepEqual(state.overrides, { '2026-11-21|morning': { mozo: 4 }, '2026-11-17|afternoon': { mozo: 0 } });
  assert.equal(state.employees[0].categoryId, 'mozo', 'no category = the lowest one');
});

test('categories: ids, ranks and employees with a missing category are normalised', () => {
  const state = normalizeState({
    settings: {
      categories: [
        { id: 'jefe', name: ' Jefe ', rank: 5 },
        { id: 'jefe', name: 'Duplicado', rank: 4 },
        { id: 'peon', name: 'Worker', rank: 1 },
        { id: 'raro', name: 'Invalid rank', rank: 'x' },
      ],
      shifts: { morning: { required: { jefe: 1, peon: 2, fantasma: 9 } } },
    },
    employees: [
      { id: 'a', name: 'A', contractHours: 10, categoryId: 'jefe' },
      { id: 'b', name: 'B', contractHours: 10, categoryId: 'ya-no-existe' },
    ],
    overrides: { '2026-11-16|morning': { jefe: 2, fantasma: 1 }, '2026-11-17|morning': { fantasma: 1 } },
  });
  assert.deepEqual(state.settings.categories.map((c) => c.id), ['jefe', 'peon']);
  assert.equal(state.settings.categories[0].name, 'Jefe');
  assert.deepEqual(state.settings.shifts.morning.required, { jefe: 1, peon: 2 });
  assert.deepEqual(state.employees.map((e) => e.categoryId), ['jefe', 'peon']);
  assert.deepEqual(state.overrides, { '2026-11-16|morning': { jefe: 2 } });
});

test('no default categories: an empty or invalid list stays empty and nothing is invented', () => {
  const state = normalizeState({ settings: { categories: [] }, employees: [{ id: 'a', name: 'A', contractHours: 1 }] });
  assert.deepEqual(state.settings.categories, []);
  assert.equal(state.employees[0].categoryId, '');
  assert.deepEqual(state.settings.shifts.morning.required, {});
  assert.equal(defaultState().settings.categories.length, 0);
});

test('no default categories: numeric minimums are discarded without a category', () => {
  const state = normalizeState({
    settings: { shifts: { morning: { standardHeadcount: 3 } } },
    overrides: { '2026-11-16|morning': 2 },
  });
  assert.deepEqual(state.settings.shifts.morning.required, {});
  assert.deepEqual(state.overrides, {});
});

test('categories: custom names are kept as they are', () => {
  const state = normalizeState({
    settings: {
      locale: 'en',
      categories: [
        { id: 'encargado', name: 'Encargado', rank: 3 },
        { id: 'vendedor', name: 'Sales', rank: 2 },
      ],
    },
  });
  assert.deepEqual(state.settings.categories.map((category) => category.name), ['Encargado', 'Sales']);
});
