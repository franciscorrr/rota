import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignmentHours,
  coverageGap,
  defaultSettings,
  describeMissing,
  generate,
  generateShift,
  isShiftBlocked,
  requiredByCategory,
  sanitizeRequired,
  targetHours,
  validate,
} from '../src/domain/scheduler.js';

const WEEK = '2026-11-16'; // Monday
const MON = '2026-11-16';
const TUE = '2026-11-17';
const SUN = '2026-11-22';

function makeEmployees(n, contractHours = 30) {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i + 1}`,
    name: `Empleado ${i + 1}`,
    contractHours,
    absences: [],
  }));
}

const CATEGORIES = {
  es: [
    { id: 'encargado', name: 'Encargado', rank: 3 },
    { id: 'vendedor', name: 'Vendedor', rank: 2 },
    { id: 'mozo', name: 'Mozo', rank: 1 },
  ],
  en: [
    { id: 'encargado', name: 'Manager', rank: 3 },
    { id: 'vendedor', name: 'Sales assistant', rank: 2 },
    { id: 'mozo', name: 'Stock assistant', rank: 1 },
  ],
};

/** Settings with the categories used by the planner tests (the app has none by default). */
function testSettings(weekStart = WEEK, locale = 'es') {
  const settings = defaultSettings(weekStart, locale);
  settings.categories = CATEGORIES[locale].map((category) => ({ ...category }));
  settings.shifts.morning.required = { mozo: 2 };
  settings.shifts.afternoon.required = { mozo: 2 };
  return settings;
}

function settingsWith(patch = {}) {
  return { ...testSettings(), ...patch };
}

const types = (warnings) => warnings.map((w) => w.type);
const hoursOf = (assignments, employeeId) =>
  assignments.filter((a) => a.employeeId === employeeId).reduce((s, a) => s + assignmentHours(a), 0);

test('base case: covers every slot without breaking rest or days off', () => {
  const settings = settingsWith({ weeklyCap: 400 });
  const { assignments, warnings } = generate(settings, makeEmployees(6));
  const hard = ['unfilled', 'rest', 'overlap', 'absent', 'closed', 'daysoff', 'cap', 'cap-contracts'];
  assert.deepEqual(types(warnings).filter((t) => hard.includes(t)), []);
  // 6 days x 2 shifts x 2 people = 24 full shifts at least
  assert.ok(assignments.length >= 24);
  assert.ok(assignments.every((a) => !a.partial));
});

test('absences reduce the employee target and count in the global totals', () => {
  const settings = settingsWith({ weeklyCap: 400 });
  const employees = makeEmployees(6);
  employees[0] = { ...employees[0], contractHours: 40, absences: [MON, TUE] };
  // 40 h / 5 days = 8 h per absence day => 16 h of absence, target 24 h
  assert.equal(targetHours(employees[0], settings), 24);
  const { assignments, stats } = generate(settings, employees);
  assert.equal(stats.absenceHours, 16);
  assert.equal(stats.budget, 400 - 16);
  assert.ok(!assignments.some((a) => a.employeeId === 'e1' && (a.day === MON || a.day === TUE)));
  assert.ok(hoursOf(assignments, 'e1') <= 24 + 1e-9);
});

test('a cap below the contracts warns but does not cut hours', () => {
  const settings = settingsWith({ weeklyCap: 100 });
  const employees = makeEmployees(6); // 180 h contratadas
  const { assignments, warnings, stats } = generate(settings, employees);
  assert.ok(types(warnings).includes('cap-contracts'));
  assert.ok(stats.totalAssigned > 100);
  for (const e of employees) assert.ok(hoursOf(assignments, e.id) > 0);
});

test('validate detects insufficient rest between shifts and overlaps on the same day', () => {
  const settings = settingsWith();
  const employees = makeEmployees(1);
  const base = { employeeId: 'e1', partial: false };
  // Monday afternoon (until 21:00) and Tuesday morning moved up to 08:00 => 11 h
  const early = [
    { ...base, id: 'a1', day: MON, shift: 'afternoon', start: '15:00', end: '21:00' },
    { ...base, id: 'a2', day: TUE, shift: 'morning', start: '08:00', end: '15:00', partial: true },
  ];
  const r1 = validate(settings, employees, {}, early);
  assert.ok(types(r1.warnings).includes('rest'));
  // Morning and afternoon of the same day: 0 h of rest
  const sameDay = [
    { ...base, id: 'a3', day: MON, shift: 'morning', start: '09:00', end: '15:00' },
    { ...base, id: 'a4', day: MON, shift: 'afternoon', start: '15:00', end: '21:00' },
  ];
  const r2 = validate(settings, employees, {}, sameDay);
  assert.ok(types(r2.warnings).includes('rest'));
  // Monday afternoon and Tuesday morning at 09:00 => exactly 12 h: valid
  const ok = [
    { ...base, id: 'a5', day: MON, shift: 'afternoon', start: '15:00', end: '21:00' },
    { ...base, id: 'a6', day: TUE, shift: 'morning', start: '09:00', end: '15:00' },
  ];
  assert.ok(!types(validate(settings, employees, {}, ok).warnings).includes('rest'));
});

test('insufficient staff: leaves slots with a warning', () => {
  const settings = settingsWith();
  const { warnings } = generate(settings, makeEmployees(1)); // 1 person, standard 2 per shift
  assert.ok(types(warnings).includes('unfilled'));
});

test('the generator never creates extra shifts: leftover hours remain as a warning', () => {
  const settings = settingsWith({
    shifts: {
      morning: { start: '09:00', end: '15:00', required: { mozo: 1 } },
      afternoon: { start: '15:00', end: '21:00', required: { mozo: 1 } },
    },
  });
  const employees = makeEmployees(1, 10); // 6 h full shift; the remaining 4 h are not distributed on their own
  const { assignments, warnings, stats } = generate(settings, employees);
  assert.equal(assignments.filter((a) => a.partial).length, 0);
  assert.ok(assignments.every((a) => a.start === settings.shifts[a.shift].start && a.end === settings.shifts[a.shift].end));
  assert.equal(hoursOf(assignments, 'e1'), 6);
  assert.equal(stats.employees[0].assigned, 6);
  assert.ok(warnings.some((w) => w.type === 'under'));
  // An extra shift added by hand is accepted and makes up the hours.
  const manual = [...assignments, { id: 'm1', employeeId: 'e1', day: TUE, shift: 'afternoon', start: '15:00', end: '19:00', partial: true }];
  const checked = validate(settings, employees, {}, manual);
  assert.equal(checked.stats.employees[0].assigned, 10);
  assert.ok(!checked.warnings.some((w) => w.type === 'under'));
});

test('week boundary: respects rest with the last shift of the previous week', () => {
  const settings = settingsWith({
    shifts: {
      morning: { start: '09:00', end: '15:00', required: { mozo: 1 } },
      afternoon: { start: '15:00', end: '21:00', required: { mozo: 0 } },
    },
  });
  const employees = makeEmployees(2);
  employees[0] = { ...employees[0], prevWeekLastShiftEnd: '2026-11-15T23:00' };
  const { assignments } = generate(settings, employees);
  // e1 finished at 23:00 on Sunday: cannot start on Monday at 09:00 (10 h)
  assert.ok(!assignments.some((a) => a.employeeId === 'e1' && a.day === MON && a.start === '09:00'));
  // validate flags it if forced by hand
  const manual = [{ id: 'm1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '15:00', partial: false }];
  const r = validate(settings, employees, {}, manual);
  assert.ok(types(r.warnings).includes('rest'));
});

test('validate warns about assigned absentees, closed days and too many work days', () => {
  const settings = settingsWith();
  const employees = makeEmployees(1);
  employees[0] = { ...employees[0], absences: [TUE] };
  const mk = (id, day, shift, start, end) => ({ id, employeeId: 'e1', day, shift, start, end, partial: false });
  const assignments = [
    mk('x1', TUE, 'morning', '09:00', '15:00'),
    mk('x2', SUN, 'morning', '09:00', '15:00'),
  ];
  const r = validate(settings, employees, {}, assignments);
  assert.ok(types(r.warnings).includes('absent'));
  assert.ok(types(r.warnings).includes('closed'));

  // 6 days worked with 1 required day off over 6 open days => maximum 5
  const six = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'].map((d, i) =>
    mk(`d${i}`, d, 'morning', '09:00', '15:00'),
  );
  const r2 = validate(settings, makeEmployees(1), {}, six);
  assert.ok(types(r2.warnings).includes('daysoff'));
});

test('the staffing number of a shift can be changed per day', () => {
  const settings = settingsWith({ weeklyCap: 400 });
  const overrides = { [`${MON}|morning`]: { mozo: 4 } };
  const { assignments } = generate(settings, makeEmployees(8), overrides);
  const monMorning = assignments.filter((a) => a.day === MON && a.shift === 'morning');
  assert.equal(monMorning.length, 4);
});

test('blocked shifts: the generator does not assign that shift to the employee', () => {
  const settings = testSettings();
  const employees = [
    { id: 'e1', name: 'Ana', contractHours: 30, absences: [], blockedShifts: ['5|afternoon', '0|morning'] },
    { id: 'e2', name: 'Luis', contractHours: 30, absences: [] },
    { id: 'e3', name: 'Eva', contractHours: 30, absences: [] },
    { id: 'e4', name: 'Pau', contractHours: 30, absences: [] },
  ];
  const { assignments, warnings } = generate(settings, employees, {});
  const ana = assignments.filter((a) => a.employeeId === 'e1');
  assert.ok(ana.length > 0, 'Ana still works in unblocked shifts');
  assert.ok(!ana.some((a) => a.day === '2026-11-21' && a.shift === 'afternoon'), 'Saturday afternoon blocked');
  assert.ok(!ana.some((a) => a.day === '2026-11-16' && a.shift === 'morning'), 'Monday morning blocked');
  assert.ok(!warnings.some((w) => w.type === 'blocked'));
});

test('blocked shifts: a manual assignment to a blocked shift is an error', () => {
  const settings = testSettings();
  const employees = [{ id: 'e1', name: 'Ana', contractHours: 30, absences: [], blockedShifts: ['5|afternoon'] }];
  const assignments = [
    { id: 'a1', employeeId: 'e1', day: '2026-11-21', shift: 'afternoon', start: '15:00', end: '21:00', partial: false },
    { id: 'a2', employeeId: 'e1', day: '2026-11-21', shift: 'morning', start: '09:00', end: '15:00', partial: false },
  ];
  const { warnings } = validate(settings, employees, {}, assignments);
  const blocked = warnings.filter((w) => w.type === 'blocked');
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].assignmentId, 'a1');
  assert.ok(isShiftBlocked(employees[0], settings, '2026-11-21', 'afternoon'));
  assert.ok(!isShiftBlocked(employees[0], settings, '2026-11-21', 'morning'));
  assert.ok(!isShiftBlocked({ id: 'x' }, settings, '2026-11-21', 'afternoon'), 'no blocks defined');
});

test('blocked shifts: blocks repeat every week (by weekday)', () => {
  const next = testSettings('2026-11-23');
  const ana = { id: 'e1', name: 'Ana', contractHours: 30, absences: [], blockedShifts: ['5|afternoon'] };
  assert.ok(isShiftBlocked(ana, next, '2026-11-28', 'afternoon')); // Saturday of the next week
});


// ---------- Categories (Manager 3 / Sales assistant 2 / Stock assistant 1) ----------

test('categories: the initial settings have none and validate asks the user to create one', () => {
  const settings = defaultSettings(WEEK);
  assert.deepEqual(settings.categories, []);
  assert.deepEqual(settings.shifts.morning.required, {});
  assert.deepEqual(sanitizeRequired(settings, 3), {}, 'a numeric minimum needs a category to point at');

  const { warnings } = validate(settings, [], {}, []);
  assert.ok(warnings.some((warning) => warning.type === 'config' && /categor/i.test(warning.message)));
});

const withNeed = (settings, morning, afternoon = {}) => {
  settings.shifts.morning.required = morning;
  settings.shifts.afternoon.required = afternoon;
  return settings;
};
const person = (id, categoryId, extra = {}) => ({ id, name: id, contractHours: 30, absences: [], categoryId, ...extra });

test('categories: coverageGap distributes from the top down and high ranks cover lower ones', () => {
  const settings = testSettings();
  const need = { encargado: 1, vendedor: 2, mozo: 1 };
  // One manager and three sales assistants cover 1+2+1 (one sales assistant acts as stock assistant).
  assert.equal(coverageGap(settings, need, { encargado: 1, vendedor: 3 }).missing, 0);
  // Two managers and two stock assistants: one manager covers a sales assistant place, the other covers the second; is 1 stock assistant missing? no: 2+2 = 4 places.
  assert.equal(coverageGap(settings, need, { encargado: 2, mozo: 2 }).missing, 0 + 1, 'stock assistants do not cover sales assistant places');
  // The high rank does not count twice.
  const g = coverageGap(settings, need, { encargado: 1 });
  assert.equal(g.required, 4);
  assert.equal(g.missing, 3);
  assert.equal(g.byCategory.encargado.missing, 0);
  assert.equal(g.byCategory.vendedor.missing, 2);
  assert.equal(g.byCategory.mozo.missing, 1);
  // Extra shifts count as a fraction.
  assert.ok(Math.abs(coverageGap(settings, { encargado: 1 }, { encargado: 0.5 }).missing - 0.5) < 1e-9);
});

test('categories: the generator respects the minimum per category in every shift', () => {
  const settings = withNeed(testSettings(), { encargado: 1, vendedor: 1, mozo: 1 }, { encargado: 1, mozo: 1 });
  const employees = [
    person('e1', 'encargado'),
    person('e2', 'encargado'),
    person('e3', 'encargado'),
    person('v1', 'vendedor'),
    person('v2', 'vendedor'),
    person('m1', 'mozo'),
    person('m2', 'mozo'),
    person('m3', 'mozo'),
  ];
  const { assignments, warnings } = generate(settings, employees, {});
  assert.ok(!warnings.some((w) => w.type === 'unfilled' || w.type === 'staff'), warnings.map((w) => w.message).join(' | '));
  for (const day of ['2026-11-16', '2026-11-17', '2026-11-20', '2026-11-21']) {
    const high = assignments.filter(
      (a) => a.day === day && a.shift === 'morning' && employees.find((e) => e.id === a.employeeId).categoryId === 'encargado',
    );
    assert.ok(high.length >= 1, `${day} morning needs a manager`);
  }
});

test('categories: a stock assistant never covers a manager place', () => {
  const settings = withNeed(testSettings(), { encargado: 1 });
  const employees = [person('m1', 'mozo'), person('m2', 'mozo')];
  const { assignments, warnings } = generate(settings, employees, {});
  assert.equal(assignments.filter((a) => a.shift === 'morning' && !a.partial).length, 0);
  assert.ok(warnings.some((w) => w.type === 'unfilled' && /Encargado/.test(w.message)));
  assert.ok(warnings.some((w) => w.type === 'staff' && /Encargado/.test(w.message)), 'there is no manager');
});

test('categories: a manager can cover stock assistant places', () => {
  const settings = withNeed(testSettings(), { mozo: 2 });
  const employees = [person('e1', 'encargado'), person('v1', 'vendedor')];
  const { assignments } = generate(settings, employees, {});
  const monday = assignments.filter((a) => a.day === '2026-11-16' && a.shift === 'morning');
  assert.equal(monday.length, 2);
  assert.deepEqual(validate(settings, employees, {}, assignments).warnings.filter((w) => w.type === 'unfilled' && /lunes mañana/i.test(w.message)), []);
});

test('categories: validate warns about what is missing in the shift, with the category name', () => {
  const settings = withNeed(testSettings(), { encargado: 1, mozo: 1 });
  const employees = [person('e1', 'encargado'), person('m1', 'mozo')];
  const assignments = [
    { id: 'a1', employeeId: 'm1', day: '2026-11-16', shift: 'morning', start: '09:00', end: '15:00', partial: false },
    { id: 'a2', employeeId: 'm1', day: '2026-11-17', shift: 'morning', start: '09:00', end: '15:00', partial: false },
    { id: 'a3', employeeId: 'e1', day: '2026-11-17', shift: 'morning', start: '09:00', end: '15:00', partial: false },
  ];
  const un = validate(settings, employees, {}, assignments).warnings.filter((w) => w.type === 'unfilled');
  const monday = un.find((w) => /Lunes mañana/.test(w.message));
  assert.ok(monday && /1 Encargado/.test(monday.message), monday?.message);
  assert.ok(!un.some((w) => /Martes mañana/.test(w.message)), 'Tuesday morning is covered');
});

test('categories: the day template overrides only the listed categories', () => {
  const settings = withNeed(testSettings(), { encargado: 1, mozo: 2 });
  const overrides = { '2026-11-21|morning': { mozo: 4 } };
  assert.deepEqual(requiredByCategory(settings, overrides, '2026-11-21', 'morning'), { encargado: 1, vendedor: 0, mozo: 4 });
  assert.deepEqual(requiredByCategory(settings, overrides, '2026-11-16', 'morning'), { encargado: 1, vendedor: 0, mozo: 2 });
  // A bare number is interpreted as "n of the lowest category".
  assert.deepEqual(requiredByCategory(settings, { '2026-11-21|morning': 3 }, '2026-11-21', 'morning'), { encargado: 1, vendedor: 0, mozo: 3 });
});

test('categories: employees without a category count as the lowest one', () => {
  const settings = withNeed(testSettings(), { mozo: 1 });
  const employees = [{ id: 'x', name: 'X', contractHours: 12, absences: [] }];
  const { assignments } = generate(settings, employees, {});
  assert.ok(assignments.length > 0);
});

test('generateShift: completes only that shift and does not touch any other assignment', () => {
  const settings = settingsWith({ weeklyCap: 400 });
  const employees = makeEmployees(6);
  const full = generate(settings, employees).assignments;
  const inTarget = (a) => a.day === TUE && a.shift === 'morning';
  const rest = full.filter((a) => !inTarget(a));
  const removed = full.filter(inTarget);
  assert.ok(removed.length >= 2);
  const r = generateShift(settings, employees, {}, rest, TUE, 'morning');
  assert.ok(r.added.length > 0);
  assert.ok(r.added.every(inTarget), 'it only adds to the requested shift');
  assert.ok(r.added.every((a) => !a.partial));
  assert.equal(r.assignments.length, rest.length + r.added.length);
  assert.deepEqual(r.assignments.slice(0, rest.length), rest, 'conserva el resto, en su orden e intactas');
  assert.equal(r.missingText, '');
  assert.ok(!types(r.warnings).some((t) => ['rest', 'overlap', 'absent', 'blocked', 'daysoff'].includes(t)));
});

test('generateShift: keeps what is already in the shift and only completes what is missing', () => {
  const settings = settingsWith({ weeklyCap: 400 });
  const employees = makeEmployees(4);
  const mine = { id: 'm1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '12:00', partial: true };
  const r = generateShift(settings, employees, {}, [mine], MON, 'morning');
  assert.ok(r.assignments.includes(mine));
  assert.ok(r.added.length >= 1 && r.added.every((a) => a.shift === 'morning' && a.day === MON));
  assert.ok(!r.added.some((a) => a.employeeId === 'e1'), 'someone already in the shift is not repeated');
  // Already covered: adds nothing.
  const again = generateShift(settings, employees, {}, r.assignments, MON, 'morning');
  assert.equal(again.added.length, 0);
  assert.equal(again.missingText, '');
});

test('generateShift: respects absences, blocks and rest with what is already assigned', () => {
  const settings = settingsWith({
    weeklyCap: 400,
    shifts: {
      morning: { start: '09:00', end: '15:00', required: { mozo: 1 } },
      afternoon: { start: '15:00', end: '21:00', required: { mozo: 0 } },
    },
  });
  const employees = makeEmployees(4);
  employees[0] = { ...employees[0], absences: [MON] };
  employees[1] = { ...employees[1], blockedShifts: ['0|morning'] };
  // e3 already works on Monday afternoon: cannot also work the morning (no rest).
  const existing = [{ id: 'x', employeeId: 'e3', day: MON, shift: 'afternoon', start: '15:00', end: '21:00', partial: false }];
  const r = generateShift(settings, employees, {}, existing, MON, 'morning');
  assert.equal(r.added.length, 1);
  assert.equal(r.added[0].employeeId, 'e4');
  assert.equal(r.missingText, '');
});

test('generateShift: if nobody is eligible, adds nothing and says what is missing', () => {
  const settings = settingsWith({
    shifts: {
      morning: { start: '09:00', end: '15:00', required: { mozo: 2 } },
      afternoon: { start: '15:00', end: '21:00', required: { mozo: 0 } },
    },
  });
  const employees = makeEmployees(2).map((e) => ({ ...e, absences: [MON] }));
  const r = generateShift(settings, employees, {}, [], MON, 'morning');
  assert.equal(r.added.length, 0);
  assert.equal(r.missingText, '2 Mozo');
});

test('sanitizeRequired: object, number, fallback value and garbage', () => {
  const settings = settingsWith();
  // Object: only existing categories with integers >= 0.
  assert.deepEqual(
    sanitizeRequired(settings, { encargado: 1, vendedor: -1, mozo: 1.5, fantasma: 4 }),
    { encargado: 1 },
  );
  // Integer: people of the lowest category.
  assert.deepEqual(sanitizeRequired(settings, 3), { mozo: 3 });
  // Fallback value (standardHeadcount) only if the main one is not usable.
  assert.deepEqual(sanitizeRequired(settings, undefined, 2), { mozo: 2 });
  assert.deepEqual(sanitizeRequired(settings, {}, 2), {}, 'an empty object ignores the alternative value');
  // Garbage.
  assert.deepEqual(sanitizeRequired(settings, 'x', -1), {});
  assert.deepEqual(sanitizeRequired(settings, null), {});
});

test('describeMissing: joins with commas and the language conjunction, and says nothing when full', () => {
  const settings = settingsWith();
  const gap = coverageGap(settings, { encargado: 1, vendedor: 1, mozo: 1 }, {});
  assert.equal(describeMissing(settings, gap), '1 Encargado, 1 Vendedor y 1 Mozo');
  const oneMissing = coverageGap(settings, { mozo: 1 }, {});
  assert.equal(describeMissing(settings, oneMissing), '1 Mozo');
  const covered = coverageGap(settings, { mozo: 1 }, { encargado: 1 });
  assert.equal(describeMissing(settings, covered), '');

  const english = testSettings(WEEK, 'en');
  const englishGap = coverageGap(english, { encargado: 1, mozo: 1 }, {});
  assert.equal(describeMissing(english, englishGap), '1 Manager and 1 Stock assistant');
});
