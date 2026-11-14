import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, generate, validate } from '../src/domain/scheduler.js';
import { buildSheet, cellDetail, describeCell, formatDiff, shiftDetail } from '../src/domain/sheet.js';

const WEEK = '2026-11-16'; // Monday
const MON = '2026-11-16';
const TUE = '2026-11-17';

/** Settings with categories and minimums (the app starts without categories). */
function sheetSettings() {
  const settings = defaultSettings(WEEK);
  settings.categories = [
    { id: 'encargado', name: 'Encargado', rank: 3 },
    { id: 'vendedor', name: 'Vendedor', rank: 2 },
    { id: 'mozo', name: 'Mozo', rank: 1 },
  ];
  settings.shifts.morning.required = { mozo: 2 };
  settings.shifts.afternoon.required = { mozo: 2 };
  return settings;
}

function setup({ employees, overrides = {}, assignments, settings = sheetSettings() }) {
  const generated = assignments ? null : generate(settings, employees, overrides);
  const list = assignments ?? generated.assignments;
  const { warnings, stats } = validate(settings, employees, overrides, list);
  const badIds = new Set(warnings.filter((w) => w.assignmentId).map((w) => w.assignmentId));
  return { model: buildSheet({ settings, employees, overrides, assignments: list, stats, badIds }), list, warnings };
}

const emp = (id, name, contractHours = 30, absences = []) => ({ id, name, contractHours, absences });

test('structure: one row per employee and two columns (morning/afternoon) per open day', () => {
  const employees = [emp('e1', 'Ana'), emp('e2', 'Luis'), emp('e3', 'Eva')];
  const { model } = setup({ employees });
  assert.equal(model.rows.length, 3);
  assert.equal(model.dayGroups.length, 6); // Monday to Saturday
  assert.equal(model.columns.length, 12);
  assert.ok(model.rows.every((r) => r.cells.length === 12));
  assert.equal(model.coverage.length, 12);
  assert.deepEqual(model.columns[0], {
    day: MON,
    shift: 'morning',
    dayName: 'Lunes',
    shiftLabel: 'Mañana',
    shiftLabelLower: 'mañana',
    time: '09:00–15:00',
  });
});

test('without categories the sheet still renders the rows and empty coverage', () => {
  const employees = [emp('e1', 'Ana')];
  const { model, warnings } = setup({ employees, assignments: [], settings: defaultSettings(WEEK) });
  assert.equal(model.rows[0].category, '');
  assert.equal(model.coverage[0].required, 0);
  assert.ok(warnings.some((warning) => warning.type === 'config'));
});

test('cells tell shifts, absences and empty slots apart; shorter shifts keep their hours', () => {
  const employees = [emp('e1', 'Ana', 10, [TUE])];
  const assignments = [
    { id: 'a1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '15:00' },
    { id: 'a2', employeeId: 'e1', day: '2026-11-18', shift: 'afternoon', start: '15:00', end: '19:00' },
  ];
  const { model } = setup({ employees, assignments });
  const cells = model.rows[0].cells;
  assert.equal(cells[0].kind, 'work');
  assert.deepEqual(cells[0].lines, ['09:00–15:00']);
  assert.equal(cells[1].kind, 'empty'); // lunes tarde
  assert.equal(cells[2].kind, 'absent'); // Tuesday morning
  assert.equal(cells[3].kind, 'absent'); // martes tarde
  const wedAfternoon = cells[5];
  assert.equal(wedAfternoon.kind, 'work');
  assert.equal(wedAfternoon.hours, 4);
});

test('totals per employee and difference from the target', () => {
  const employees = [emp('e1', 'Ana', 40, [MON, TUE])]; // objetivo 40 - 16 = 24
  const assignments = [
    { id: 'a1', employeeId: 'e1', day: '2026-11-18', shift: 'morning', start: '09:00', end: '15:00' },
  ];
  const { model } = setup({ employees, assignments });
  const row = model.rows[0];
  assert.equal(row.contract, 40);
  assert.equal(row.target, 24);
  assert.equal(row.assigned, 6);
  assert.equal(row.diff, -18);
  assert.equal(row.status, 'under');
  assert.equal(formatDiff(row), '−18 h');
  assert.equal(formatDiff({ status: 'ok', diff: 0 }), 'OK');
  assert.equal(formatDiff({ status: 'over', diff: 2 }), '+2 h');
  assert.deepEqual(model.totals, { contract: 40, target: 24, assigned: 6 });
});

test('the coverage row compares covered places with the staffing (with overrides)', () => {
  const employees = [emp('e1', 'Ana')];
  const overrides = { [`${MON}|morning`]: { mozo: 1 } };
  const assignments = [
    { id: 'a1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '15:00' },
  ];
  const { model } = setup({ employees, overrides, assignments });
  assert.deepEqual(
    { ...model.coverage[0], categories: undefined },
    { required: 1, covered: 1, status: 'ok', missingText: '', categories: undefined },
  );
  assert.equal(model.coverage[1].required, 2); // Monday afternoon, default minimum 2
  assert.equal(model.coverage[1].covered, 0);
  assert.equal(model.coverage[1].status, 'under');
  assert.equal(model.coverage[1].missingText, '2 Mozo');
});

test('assignments that break rules are marked as bad', () => {
  const employees = [emp('e1', 'Ana')];
  const assignments = [
    { id: 'a1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '15:00' },
    { id: 'a2', employeeId: 'e1', day: MON, shift: 'afternoon', start: '15:00', end: '21:00' },
  ];
  const { model } = setup({ employees, assignments });
  const [morning, afternoon] = model.rows[0].cells;
  assert.ok(morning.bad || afternoon.bad, 'morning and afternoon on the same day break the rest rule');
});

test('describeCell describes a shift, an absence, an empty slot and coverage', () => {
  const employees = [emp('e1', 'Ana', 10, [TUE])];
  const assignments = [
    { id: 'a1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '15:00' },
  ];
  const { model } = setup({ employees, assignments });
  assert.equal(describeCell(model, 0, 0), 'Ana · Lunes mañana: 09:00–15:00 (6 h)');
  assert.equal(describeCell(model, 0, 1), 'Ana · Lunes tarde: sin turno');
  assert.equal(describeCell(model, 0, 2), 'Ana · Martes: ausente');
  assert.equal(describeCell(model, 1, 0), 'Lunes mañana: cubiertas 1 de 2 plazas (Mozo 1/2)'); // coverage row
  assert.equal(describeCell(model, 0, 99), '');
});

test('with no assignments, every cell is empty except absences', () => {
  const employees = [emp('e1', 'Ana', 30, [MON])];
  const { model } = setup({ employees, assignments: [] });
  const kinds = new Set(model.rows[0].cells.map((c) => c.kind));
  assert.deepEqual([...kinds].sort(), ['absent', 'empty']);
});

test('blocked shifts show up as "blocked" cells in the sheet', () => {
  const employees = [{ ...emp('e1', 'Ana'), blockedShifts: ['0|afternoon'] }];
  const { model } = setup({ employees, assignments: [] });
  assert.equal(model.rows[0].cells[1].kind, 'blocked'); // lunes tarde
  assert.deepEqual(model.rows[0].cells[1].lines, ['Bloqueado']);
  assert.equal(model.rows[0].cells[0].kind, 'empty'); // Monday morning
  assert.equal(describeCell(model, 0, 1), 'Ana · Lunes tarde: turno bloqueado');
});


test('sheet coverage tells categories apart and rows show the employee category', () => {
  const settings = sheetSettings();
  settings.shifts.morning.required = { encargado: 1, mozo: 1 };
  const employees = [
    { ...emp('e1', 'Ana'), categoryId: 'mozo' },
    { ...emp('e2', 'Luis'), categoryId: 'encargado' },
  ];
  const assignments = [
    { id: 'a1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '15:00' },
    { id: 'a2', employeeId: 'e1', day: TUE, shift: 'morning', start: '09:00', end: '15:00' },
    { id: 'a3', employeeId: 'e2', day: TUE, shift: 'morning', start: '09:00', end: '15:00' },
  ];
  const { model } = setup({ employees, assignments, settings });
  assert.deepEqual(model.rows.map((r) => r.category), ['Mozo', 'Encargado']);
  // Monday: only a stock assistant -> the manager is missing even though there is "one person".
  assert.equal(model.coverage[0].status, 'under');
  assert.equal(model.coverage[0].missingText, '1 Encargado');
  assert.match(describeCell(model, 2, 0), /Encargado 0\/1, Mozo 1\/1/);
  // Tuesday: manager + stock assistant = covered.
  assert.equal(model.coverage[2].status, 'ok');
});

test('shiftDetail summarises a shift: coverage, minimum per category and people', () => {
  const settings = sheetSettings();
  settings.shifts.morning.required = { encargado: 1, mozo: 1 };
  const employees = [
    { ...emp('e1', 'Ana'), categoryId: 'mozo' },
    { ...emp('e2', 'Luis'), categoryId: 'encargado' },
  ];
  const overrides = { [`${MON}|morning`]: { mozo: 2 } };
  const assignments = [
    { id: 'a2', employeeId: 'e1', day: MON, shift: 'morning', start: '12:00', end: '15:00' },
    { id: 'a1', employeeId: 'e2', day: MON, shift: 'morning', start: '09:00', end: '15:00' },
    { id: 'a3', employeeId: 'e1', day: TUE, shift: 'morning', start: '09:00', end: '15:00' },
  ];
  const d = shiftDetail({ settings, employees, overrides, assignments, badIds: new Set(['a2']) }, MON, 'morning');
  assert.equal(d.title, 'Lunes 16/11 · Mañana');
  assert.equal(d.time, '09:00–15:00');
  assert.equal(d.required, 3);
  assert.equal(d.covered, 1.5);
  assert.equal(d.status, 'under');
  assert.deepEqual(d.categories.map((c) => [c.name, c.required, c.overridden]), [['Encargado', 1, false], ['Mozo', 2, true]]);
  assert.deepEqual(d.assignments.map((a) => [a.id, a.name, a.category, a.hours, a.bad]), [
    ['a1', 'Luis', 'Encargado', 6, false],
    ['a2', 'Ana', 'Mozo', 3, true],
  ]);
});

test('cellDetail: cell assignments and whether one can be added', () => {
  const settings = sheetSettings();
  const employees = [
    { ...emp('e1', 'Ana'), categoryId: 'mozo', absences: [TUE], blockedShifts: ['0|afternoon'] },
  ];
  const assignments = [
    { id: 'a1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '12:00' },
    { id: 'a2', employeeId: 'e1', day: TUE, shift: 'morning', start: '09:00', end: '15:00' },
  ];
  const input = { settings, employees, assignments, badIds: new Set(['a2']) };
  const work = cellDetail(input, 'e1', MON, 'morning');
  assert.equal(work.title, 'Ana · Lunes 16/11 · Mañana');
  assert.equal(work.category, 'Mozo');
  assert.deepEqual([work.shiftStart, work.shiftEnd, work.canAdd], ['09:00', '15:00', true]);
  assert.deepEqual(work.assignments, [{ id: 'a1', start: '09:00', end: '12:00', breakMinutes: 0, bad: false }]);
  assert.equal(cellDetail(input, 'e1', MON, 'afternoon').blocked, true);
  assert.equal(cellDetail(input, 'e1', MON, 'afternoon').canAdd, false);
  const absent = cellDetail(input, 'e1', TUE, 'afternoon');
  assert.deepEqual([absent.absent, absent.canAdd, absent.assignments.length], [true, false, 0]);
  // An existing assignment on an absence day can still be edited/removed.
  assert.deepEqual(cellDetail(input, 'e1', TUE, 'morning').assignments.map((a) => [a.id, a.bad]), [['a2', true]]);
  assert.equal(cellDetail(input, 'zz', MON, 'morning'), null);
});

test('breaks: cells and details show the break, with net hours', () => {
  const settings = sheetSettings();
  settings.breaks = { enabled: true, afterHours: 6, minutes: 15 };
  const employees = [emp('e1', 'Ana'), emp('e2', 'Luis')];
  const assignments = [
    { id: 'a1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '15:00' }, // exactly 6 h: no break
    { id: 'a2', employeeId: 'e1', day: TUE, shift: 'morning', start: '08:00', end: '15:00' }, // 7 h: break
  ];
  const { model } = setup({ employees, assignments, settings });
  const [monday, tuesday] = [model.rows[0].cells[0], model.rows[0].cells[2]];
  assert.deepEqual([monday.hours, monday.breakMinutes], [6, 0]);
  assert.deepEqual([tuesday.hours, tuesday.breakMinutes], [6.75, 15]);
  assert.match(describeCell(model, 0, 2), /15 min/);
  assert.doesNotMatch(describeCell(model, 0, 0), /descanso/);
  assert.equal(model.rows[0].assigned, 12.75);
  assert.equal(model.totals.assigned, 12.75);
  // Footer: net hours of all employees per column (Monday morning 6, Tuesday morning 6.75).
  assert.deepEqual(model.shiftHours.slice(0, 4), [6, 0, 6.75, 0]);

  const input = { settings, employees, assignments, overrides: {} };
  assert.deepEqual(shiftDetail(input, TUE, 'morning').assignments.map((a) => [a.hours, a.breakMinutes]), [[6.75, 15]]);
  assert.equal(cellDetail(input, 'e1', TUE, 'morning').assignments[0].breakMinutes, 15);
  assert.equal(cellDetail(input, 'e1', TUE, 'morning').hours, 6.75);
  assert.equal(cellDetail(input, 'e1', MON, 'afternoon').hours, 0);
});

test('shiftHours adds up the net hours of every employee in each shift', () => {
  const employees = [emp('e1', 'Ana'), emp('e2', 'Luis')];
  const assignments = [
    { id: 'a1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '15:00' },
    { id: 'a2', employeeId: 'e2', day: MON, shift: 'morning', start: '10:00', end: '13:30' },
    { id: 'a3', employeeId: 'e2', day: MON, shift: 'afternoon', start: '15:00', end: '18:00' },
  ];
  const { model } = setup({ employees, assignments });
  assert.equal(model.shiftHours.length, model.columns.length);
  assert.deepEqual(model.shiftHours.slice(0, 3), [9.5, 3, 0]);
});

// ---------- 'leaders' coverage mode ----------

function leadersSheetSettings() {
  const settings = defaultSettings(WEEK, 'en');
  settings.coverageMode = 'leaders';
  settings.shifts.morning.headcount = 3;
  settings.shifts.morning.leaders = 1;
  settings.shifts.afternoon.headcount = 2;
  settings.shifts.afternoon.leaders = 1;
  return settings;
}

const leaderEmp = (id, name, canLeadShift) => ({ ...emp(id, name), canLeadShift });

test('leaders mode: the coverage row counts people and tells which class is missing', () => {
  const employees = [leaderEmp('e1', 'Ana', false), leaderEmp('e2', 'Luis', false), leaderEmp('e3', 'Eva', true)];
  const assignments = [
    { id: 'a1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '15:00' },
    { id: 'a2', employeeId: 'e2', day: MON, shift: 'morning', start: '09:00', end: '15:00' },
  ];
  const { model } = setup({ employees, assignments, settings: leadersSheetSettings() });
  const monday = model.coverage[0];

  assert.equal(monday.required, 3);
  assert.equal(monday.covered, 2);
  assert.equal(monday.status, 'under');
  assert.equal(monday.missingText, '1 shift leader');
  assert.deepEqual(monday.categories.map((c) => [c.name, c.required, c.missing]), [
    ['shift leader', 1, 1],
    ['staff', 2, 0],
  ]);
});

test('leaders mode: rows and shift detail flag who can lead; categories mode never does', () => {
  const employees = [leaderEmp('e1', 'Ana', true), leaderEmp('e2', 'Luis', false)];
  const assignments = [
    { id: 'a1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '15:00' },
    { id: 'a2', employeeId: 'e2', day: MON, shift: 'morning', start: '09:00', end: '15:00' },
  ];
  const settings = leadersSheetSettings();
  const { model } = setup({ employees, assignments, settings });
  assert.deepEqual(model.rows.map((row) => row.canLead), [true, false]);

  const input = { settings, employees, overrides: {}, assignments };
  const detail = shiftDetail(input, MON, 'morning');
  assert.deepEqual(detail.assignments.map((a) => a.canLead), [true, false]);
  assert.deepEqual(detail.categories.map((c) => [c.name, c.required, c.missing, c.isShort]), [
    ['shift leader', 1, 0, false],
    ['staff', 2, 1, true],
  ]);
  assert.equal(cellDetail(input, 'e1', MON, 'morning').canLead, true);

  const categories = setup({ employees, assignments }).model;
  assert.deepEqual(categories.rows.map((row) => row.canLead), [false, false]);
});

test('leaders mode: shift detail marks the classes changed by a day template', () => {
  const settings = leadersSheetSettings();
  const input = { settings, employees: [], overrides: { [`${MON}|morning`]: { $headcount: 6 } }, assignments: [] };
  const detail = shiftDetail(input, MON, 'morning');
  assert.equal(detail.required, 6);
  assert.deepEqual(detail.categories.map((c) => [c.name, c.overridden]), [['shift leader', false], ['staff', true]]);
  assert.equal(shiftDetail(input, TUE, 'morning').categories.every((c) => !c.overridden), true);
});

test('leaders mode: describeCell on the coverage row names the classes', () => {
  const employees = [leaderEmp('e1', 'Ana', true)];
  const { model } = setup({ employees, assignments: [], settings: leadersSheetSettings() });
  const text = describeCell(model, model.rows.length, 0);
  assert.match(text, /0 of 3 places covered/);
  assert.match(text, /shift leader 0\/1, staff 0\/2/);
});
