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

test('assignments: the legacy "partial" flag in imported or stored data is dropped', () => {
  const state = normalizeState({
    settings: { categories: CATEGORIES },
    employees: [{ id: 'e1', name: 'Ana', contractHours: 30, absences: [] }],
    assignments: [
      { id: 'a1', employeeId: 'e1', day: '2026-11-16', shift: 'morning', start: '10:00', end: '15:00', partial: true },
    ],
  });
  assert.deepEqual(state.assignments, [
    { id: 'a1', employeeId: 'e1', day: '2026-11-16', shift: 'morning', start: '10:00', end: '15:00' },
  ]);
});

test('breaks: default off; invalid values fall back to the defaults', () => {
  assert.deepEqual(defaultState().settings.breaks, { enabled: false, afterHours: 6, minutes: 15 });
  assert.deepEqual(normalizeState({ settings: { weekStart: '2026-11-16' } }).settings.breaks,
    { enabled: false, afterHours: 6, minutes: 15 });
  const valid = normalizeState({ settings: { breaks: { enabled: true, afterHours: 5, minutes: 20 } } });
  assert.deepEqual(valid.settings.breaks, { enabled: true, afterHours: 5, minutes: 20 });
  const invalid = normalizeState({ settings: { breaks: { enabled: 'yes', afterHours: -1, minutes: 'x' } } });
  assert.deepEqual(invalid.settings.breaks, { enabled: false, afterHours: 6, minutes: 15 });
  const tooLong = normalizeState({ settings: { breaks: { enabled: true, afterHours: 1, minutes: 90 } } });
  assert.deepEqual(tooLong.settings.breaks, { enabled: true, afterHours: 6, minutes: 15 });
});

// ---------- 'leaders' coverage mode ----------

test('coverage mode: files without it, or with an unknown one, load in categories mode', () => {
  assert.equal(defaultState().settings.coverageMode, 'categories');
  assert.equal(normalizeState({ settings: {} }).settings.coverageMode, 'categories');
  assert.equal(normalizeState({ settings: { coverageMode: 'nonsense' } }).settings.coverageMode, 'categories');
  assert.equal(normalizeState({ settings: { coverageMode: 'leaders' } }).settings.coverageMode, 'leaders');
});

test('leaders mode: headcount and leaders of each shift are kept as integers >= 0', () => {
  const state = normalizeState({
    settings: {
      coverageMode: 'leaders',
      shifts: {
        morning: { start: '09:00', end: '15:00', headcount: 4, leaders: 1 },
        afternoon: { start: '15:00', end: '21:00', headcount: -2, leaders: 'many' },
      },
    },
  });
  assert.deepEqual([state.settings.shifts.morning.headcount, state.settings.shifts.morning.leaders], [4, 1]);
  assert.deepEqual([state.settings.shifts.afternoon.headcount, state.settings.shifts.afternoon.leaders], [0, 0]);
  assert.equal(defaultState().settings.shifts.morning.headcount, 0);
  assert.equal(defaultState().settings.shifts.morning.leaders, 0);
});

test('a shift keeps its category minimums and its leaders minimums side by side', () => {
  const state = normalizeState({
    settings: {
      categories: CATEGORIES,
      shifts: { morning: { required: { mozo: 2 }, headcount: 5, leaders: 2 } },
    },
  });
  assert.deepEqual(state.settings.shifts.morning.required, { mozo: 2 });
  assert.equal(state.settings.shifts.morning.headcount, 5);
  assert.equal(state.settings.shifts.morning.leaders, 2);
});

test('employees: canLeadShift is a real boolean, false by default (and without categories)', () => {
  const state = normalizeState({
    settings: { coverageMode: 'leaders' },
    employees: [
      { id: 'a', name: 'Ana', canLeadShift: true },
      { id: 'b', name: 'Beto' },
      { id: 'c', name: 'Cris', canLeadShift: 'yes' },
    ],
  });
  assert.deepEqual(state.employees.map((employee) => employee.canLeadShift), [true, false, false]);
  assert.deepEqual(state.employees.map((employee) => employee.categoryId), ['', '', ''], 'no categories, no category');
});

test('overrides: $headcount and $leaders are kept next to the categories; invalid values and empty entries are dropped', () => {
  const state = normalizeState({
    settings: { categories: CATEGORIES },
    overrides: {
      '2026-11-16|morning': { $headcount: 6, $leaders: 2, mozo: 1, ghost: 3 },
      '2026-11-17|morning': { $headcount: -1, $leaders: 1.5 },
      '2026-11-18|morning': { $leaders: 0 },
    },
  });
  assert.deepEqual(state.overrides, {
    '2026-11-16|morning': { mozo: 1, $headcount: 6, $leaders: 2 },
    '2026-11-18|morning': { $leaders: 0 },
  });
});

test('leaders data survives a normalize round trip unchanged', () => {
  const first = normalizeState({
    settings: {
      coverageMode: 'leaders',
      shifts: { morning: { start: '09:00', end: '15:00', headcount: 3, leaders: 1 } },
    },
    employees: [{ id: 'a', name: 'Ana', canLeadShift: true, contractHours: 20 }],
    overrides: { '2026-11-16|morning': { $headcount: 5 } },
  });
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(first))), first);
});
