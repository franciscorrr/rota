import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  END_BEFORE_START_ERROR,
  addAssignment,
  addCategory,
  addEmployee,
  blockShift,
  blockableShifts,
  changeLocale,
  changeWeek,
  describeShiftResult,
  generateForShift,
  generateWeek,
  isAbsentAllWeek,
  isValidRange,
  parseNumber,
  removeAssignment,
  removeCategory,
  removeEmployee,
  rename,
  setAbsence,
  setShiftTime,
  setAbsentAllWeek,
  setDayMinimum,
  setShiftMinimum,
  unblockShift,
  updateAssignmentTimes,
} from '../src/domain/actions.js';
import {
  badAssignmentIds,
  defaultSettings,
  isErrorWarning,
  lowestCategory,
  unavailabilityReason,
} from '../src/domain/scheduler.js';

const WEEK = '2026-11-16'; // lunes
const MON = '2026-11-16';
const TUE = '2026-11-17';

const CATEGORIES = [
  { id: 'encargado', name: 'Encargado', rank: 3 },
  { id: 'vendedor', name: 'Vendedor', rank: 2 },
  { id: 'mozo', name: 'Mozo', rank: 1 },
];

function makeState(employeeCount = 0) {
  const settings = defaultSettings(WEEK);
  settings.categories = CATEGORIES.map((category) => ({ ...category }));
  settings.shifts.morning.required = { mozo: 2 };
  settings.shifts.afternoon.required = { mozo: 2 };
  const state = { settings, employees: [], overrides: {}, assignments: [] };
  for (let index = 0; index < employeeCount; index += 1) addEmployee(state);
  return state;
}

test('parseNumber: accepts valid values and returns the fallback for invalid ones', () => {
  assert.equal(parseNumber('12', 5), 12);
  assert.equal(parseNumber('', 5), 5);
  assert.equal(parseNumber('abc', 5), 5);
  assert.equal(parseNumber('-1', 5), 5);
  assert.equal(parseNumber('0', 5), 0);
  assert.equal(parseNumber('2.7', 5, { integer: true }), 2);
  assert.equal(parseNumber('0', 5, { min: 1 }), 5);
});

test('ranges: the end must be later than the start', () => {
  assert.equal(isValidRange('09:00', '15:00'), true);
  assert.equal(isValidRange('15:00', '15:00'), false);
  assert.equal(isValidRange('', '15:00'), false);
});

test('addAssignment: accepts the full shift or custom hours; an invalid range adds nothing', () => {
  const state = makeState(1);
  const [employee] = state.employees;
  const full = { employeeId: employee.id, day: MON, shift: 'morning', start: '09:00', end: '15:00' };

  assert.deepEqual(addAssignment(state, full), { ok: true });
  assert.equal(state.assignments[0].start, '09:00');

  addAssignment(state, { ...full, day: TUE, start: '10:00' });
  assert.equal(state.assignments[1].start, '10:00');
  assert.ok(state.assignments.every((assignment) => !('partial' in assignment)));

  const invalid = addAssignment(state, { ...full, start: '15:00', end: '09:00' });
  assert.deepEqual(invalid, { ok: false, error: END_BEFORE_START_ERROR });
  assert.equal(state.assignments.length, 2);
});

test('updateAssignmentTimes: changes the times and changes nothing if any row is invalid', () => {
  const state = makeState(1);
  const [employee] = state.employees;
  addAssignment(state, { employeeId: employee.id, day: MON, shift: 'morning', start: '09:00', end: '15:00' });
  const [assignment] = state.assignments;

  assert.equal(updateAssignmentTimes(state, [{ id: assignment.id, start: '10:00', end: '15:00' }]).ok, true);
  assert.equal(assignment.start, '10:00');

  assert.equal(updateAssignmentTimes(state, [{ id: assignment.id, start: '09:00', end: '15:00' }]).ok, true);

  assert.equal(updateAssignmentTimes(state, [{ id: assignment.id, start: '16:00', end: '15:00' }]).ok, false);
  assert.equal(assignment.start, '09:00');
});

test('removeAssignment removes only the given assignment', () => {
  const state = makeState(1);
  const [employee] = state.employees;
  const base = { employeeId: employee.id, shift: 'morning', start: '09:00', end: '15:00' };
  addAssignment(state, { ...base, day: MON });
  addAssignment(state, { ...base, day: TUE });
  removeAssignment(state, state.assignments[0].id);
  assert.deepEqual(state.assignments.map((assignment) => assignment.day), [TUE]);
});

test('setDayMinimum: stores the change and removes it when back to the shift value', () => {
  const state = makeState();
  const categoryId = lowestCategory(state.settings).id;
  const standard = state.settings.shifts.morning.required[categoryId];

  setDayMinimum(state, MON, 'morning', categoryId, standard + 2);
  assert.equal(state.overrides[`${MON}|morning`][categoryId], standard + 2);

  setDayMinimum(state, MON, 'morning', categoryId, standard);
  assert.deepEqual(state.overrides, {});
});

test('changeLocale changes the language and keeps the category names of the user', () => {
  const state = makeState();
  state.settings.categories.find((category) => category.id === 'encargado').name = 'Jefa';

  assert.equal(changeLocale(state, 'en'), true);
  assert.equal(state.settings.locale, 'en');
  assert.equal(state.settings.categories.find((category) => category.id === 'vendedor').name, 'Vendedor');
  assert.equal(state.settings.categories.find((category) => category.id === 'encargado').name, 'Jefa');
  assert.equal(state.settings.categories.find((category) => category.id === 'mozo').name, 'Mozo');

  assert.equal(changeLocale(state, 'fr'), false);
  assert.equal(state.settings.locale, 'en');
});

test('setShiftMinimum changes the shift minimum for every day', () => {
  const { settings } = makeState();
  const categoryId = lowestCategory(settings).id;
  setShiftMinimum(settings, 'afternoon', categoryId, 4);
  assert.equal(settings.shifts.afternoon.required[categoryId], 4);
});

test('categories: adding gives a lower rank; removing reassigns employees and clears minimums', () => {
  const state = makeState(2);
  addCategory(state.settings);
  const created = state.settings.categories.at(-1);
  assert.ok(created.rank >= 1);

  state.employees[0].categoryId = created.id;
  state.overrides[`${MON}|morning`] = { [created.id]: 3 };
  state.settings.shifts.morning.required[created.id] = 2;

  assert.equal(removeCategory(state, created.id), true);
  assert.equal(state.employees[0].categoryId, lowestCategory(state.settings).id);
  assert.deepEqual(state.overrides, {});
  assert.equal(created.id in state.settings.shifts.morning.required, false);
});

test('categories: without any category the first one gets rank 1 and no employee can be added', () => {
  const state = { settings: defaultSettings(WEEK), employees: [], overrides: {}, assignments: [] };
  assert.equal(addEmployee(state), null);
  assert.deepEqual(state.employees, []);

  addCategory(state.settings);
  assert.equal(state.settings.categories.length, 1);
  assert.equal(state.settings.categories[0].rank, 1);
  assert.ok(addEmployee(state));
  assert.equal(state.employees[0].categoryId, state.settings.categories[0].id);
});

test('removeCategory does not remove the last category', () => {
  const state = makeState();
  state.settings.categories = [state.settings.categories[0]];
  assert.equal(removeCategory(state, state.settings.categories[0].id), false);
  assert.equal(state.settings.categories.length, 1);
});

test('changeWeek: snaps to Monday and clears assignments and templates; same week or empty does nothing', () => {
  const state = makeState(1);
  addAssignment(state, { employeeId: state.employees[0].id, day: MON, shift: 'morning', start: '09:00', end: '15:00' });
  state.overrides[`${MON}|morning`] = { x: 1 };

  assert.equal(changeWeek(state, ''), null);
  assert.equal(changeWeek(state, '2026-11-18'), null); // Wednesday of the same week
  assert.equal(state.assignments.length, 1);

  assert.equal(changeWeek(state, '2026-11-25'), '2026-11-23');
  assert.equal(state.settings.weekStart, '2026-11-23');
  assert.deepEqual(state.assignments, []);
  assert.deepEqual(state.overrides, {});
});

test('employees: creation with defaults, cascading deletion and renaming without emptying the name', () => {
  const state = makeState(2);
  const [first, second] = state.employees;
  assert.equal(first.name, 'Empleado 1');
  assert.equal(first.contractHours, 30);
  assert.equal(first.categoryId, lowestCategory(state.settings).id);

  addAssignment(state, { employeeId: first.id, day: MON, shift: 'morning', start: '09:00', end: '15:00' });
  addAssignment(state, { employeeId: second.id, day: MON, shift: 'morning', start: '09:00', end: '15:00' });
  removeEmployee(state, first.id);
  assert.deepEqual(state.employees.map((employee) => employee.id), [second.id]);
  assert.deepEqual(state.assignments.map((assignment) => assignment.employeeId), [second.id]);

  assert.equal(rename(second, '  Ana  '), 'Ana');
  assert.equal(rename(second, '   '), 'Ana');
});

test('setAbsence does not repeat days; setShiftTime discards empty times', () => {
  const employee = { absences: [] };
  setAbsence(employee, MON, true);
  setAbsence(employee, MON, true);
  assert.deepEqual(employee.absences, [MON]);
  setAbsence(employee, MON, false);
  assert.deepEqual(employee.absences, []);

  const shift = { start: '09:00', end: '15:00' };
  assert.equal(setShiftTime(shift, 'start', ''), false);
  assert.equal(shift.start, '09:00');
  assert.equal(setShiftTime(shift, 'start', '10:00'), true);
  assert.equal(shift.start, '10:00');
});

test('whole-week absences: they only touch open days', () => {
  const state = makeState(1);
  const [employee] = state.employees;
  const openWeekDays = ['2026-11-16', '2026-11-17', '2026-11-18'];
  employee.absences = ['2026-11-22']; // domingo cerrado

  assert.equal(isAbsentAllWeek(employee, openWeekDays), false);
  setAbsentAllWeek(employee, openWeekDays, true);
  assert.equal(isAbsentAllWeek(employee, openWeekDays), true);
  assert.deepEqual(employee.absences, ['2026-11-22', ...openWeekDays]);

  setAbsentAllWeek(employee, openWeekDays, false);
  assert.deepEqual(employee.absences, ['2026-11-22']);
  assert.equal(isAbsentAllWeek(employee, []), false);
});

test('blocks: open days only, no duplicates, and unavailabilityReason tells them from absences', () => {
  const state = makeState(1);
  const [employee] = state.employees;
  const options = blockableShifts(state.settings);
  assert.equal(options.length, state.settings.openDays.length * 2);
  assert.equal(options[0].label, 'Lunes mañana');

  blockShift(employee, options[0].id);
  blockShift(employee, options[0].id);
  assert.deepEqual(employee.blockedShifts, [options[0].id]);

  assert.equal(unavailabilityReason(employee, state.settings, MON, 'morning'), 'blocked');
  assert.equal(unavailabilityReason(employee, state.settings, MON, 'afternoon'), null);
  employee.absences = [MON];
  assert.equal(unavailabilityReason(employee, state.settings, MON, 'afternoon'), 'absent');

  unblockShift(employee, options[0].id);
  assert.deepEqual(employee.blockedShifts, []);
});

test('generateWeek: with no employees or categories it does nothing; with employees it replaces assignments', () => {
  const empty = makeState();
  assert.equal(generateWeek(empty), false);

  const noCategories = makeState(6);
  noCategories.settings.categories = [];
  assert.equal(generateWeek(noCategories), false);
  assert.deepEqual(noCategories.assignments, []);

  const state = makeState(6);
  assert.equal(generateWeek(state), true);
  assert.ok(state.assignments.length > 0);
});

test('generateForShift: adds to the shift without touching the rest and describes the result', () => {
  const state = makeState(6);
  const none = generateForShift(makeState(), MON, 'morning');
  assert.equal(none.isError, true);

  const noCategories = makeState(6);
  noCategories.settings.categories = [];
  const withoutCategories = generateForShift(noCategories, MON, 'morning');
  assert.equal(withoutCategories.isError, true);
  assert.match(withoutCategories.message, /categorías/);
  assert.deepEqual(noCategories.assignments, []);

  const result = generateForShift(state, MON, 'morning');
  assert.ok(result.added > 0);
  assert.ok(state.assignments.every((assignment) => assignment.day === MON && assignment.shift === 'morning'));

  const again = generateForShift(state, MON, 'morning');
  assert.equal(again.added, 0);
  assert.match(again.message, /ya cubre el personal mínimo/);
});

test('describeShiftResult covers the four cases', () => {
  const where = 'Lunes mañana';
  assert.equal(describeShiftResult(where, { added: [], missingText: '' }, []).isError, false);
  assert.equal(describeShiftResult(where, { added: [], missingText: '1 Mozo' }, []).isError, true);
  assert.equal(describeShiftResult(where, { added: [{}], missingText: '1 Mozo' }, ['Ana']).isError, true);
  const done = describeShiftResult(where, { added: [{}], missingText: '' }, ['Ana']);
  assert.deepEqual(done, { message: 'Lunes mañana: añadidos Ana.', isError: false });
});

test('warnings: classifies errors and returns the ids of assignments that break rules', () => {
  const warnings = [
    { type: 'rest', assignmentId: 'a1', message: '' },
    { type: 'under-target', assignmentId: 'a2', message: '' },
    { type: 'blocked', message: '' },
  ];
  assert.equal(isErrorWarning(warnings[0]), true);
  assert.equal(isErrorWarning(warnings[1]), false);
  assert.deepEqual([...badAssignmentIds(warnings)], ['a1']);
});
