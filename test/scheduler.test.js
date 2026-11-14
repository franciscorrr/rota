import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignmentHours,
  breakMinutesOf,
  coverageGap,
  defaultSettings,
  describeMissing,
  generate,
  generateShift,
  isShiftBlocked,
  netAssignmentHours,
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
  assert.ok(assignments.every((a) => a.start === settings.shifts[a.shift].start && a.end === settings.shifts[a.shift].end));
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
  const base = { employeeId: 'e1' };
  // Monday afternoon (until 21:00) and Tuesday morning moved up to 08:00 => 11 h
  const early = [
    { ...base, id: 'a1', day: MON, shift: 'afternoon', start: '15:00', end: '21:00' },
    { ...base, id: 'a2', day: TUE, shift: 'morning', start: '08:00', end: '15:00' },
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

test('the generator only creates full shifts: leftover hours remain as a warning', () => {
  const settings = settingsWith({
    shifts: {
      morning: { start: '09:00', end: '15:00', required: { mozo: 1 } },
      afternoon: { start: '15:00', end: '21:00', required: { mozo: 1 } },
    },
  });
  const employees = makeEmployees(1, 10); // 6 h full shift; the remaining 4 h are not distributed on their own
  const { assignments, warnings, stats } = generate(settings, employees);
  assert.ok(assignments.every((a) => a.start === settings.shifts[a.shift].start && a.end === settings.shifts[a.shift].end));
  assert.equal(hoursOf(assignments, 'e1'), 6);
  assert.equal(stats.employees[0].assigned, 6);
  assert.ok(warnings.some((w) => w.type === 'under'));
  // A shorter shift added by hand is accepted and makes up the hours.
  const manual = [...assignments, { id: 'm1', employeeId: 'e1', day: TUE, shift: 'afternoon', start: '15:00', end: '19:00' }];
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
  const manual = [{ id: 'm1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '15:00' }];
  const r = validate(settings, employees, {}, manual);
  assert.ok(types(r.warnings).includes('rest'));
});

test('validate warns about assigned absentees, closed days and too many work days', () => {
  const settings = settingsWith();
  const employees = makeEmployees(1);
  employees[0] = { ...employees[0], absences: [TUE] };
  const mk = (id, day, shift, start, end) => ({ id, employeeId: 'e1', day, shift, start, end });
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
    { id: 'a1', employeeId: 'e1', day: '2026-11-21', shift: 'afternoon', start: '15:00', end: '21:00' },
    { id: 'a2', employeeId: 'e1', day: '2026-11-21', shift: 'morning', start: '09:00', end: '15:00' },
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
  assert.equal(assignments.filter((a) => a.shift === 'morning').length, 0);
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
    { id: 'a1', employeeId: 'm1', day: '2026-11-16', shift: 'morning', start: '09:00', end: '15:00' },
    { id: 'a2', employeeId: 'm1', day: '2026-11-17', shift: 'morning', start: '09:00', end: '15:00' },
    { id: 'a3', employeeId: 'e1', day: '2026-11-17', shift: 'morning', start: '09:00', end: '15:00' },
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
  assert.ok(r.added.every((a) => a.start === settings.shifts[a.shift].start && a.end === settings.shifts[a.shift].end));
  assert.equal(r.assignments.length, rest.length + r.added.length);
  assert.deepEqual(r.assignments.slice(0, rest.length), rest, 'conserva el resto, en su orden e intactas');
  assert.equal(r.missingText, '');
  assert.ok(!types(r.warnings).some((t) => ['rest', 'overlap', 'absent', 'blocked', 'daysoff'].includes(t)));
});

test('generateShift: keeps what is already in the shift and only completes what is missing', () => {
  const settings = settingsWith({ weeklyCap: 400 });
  const employees = makeEmployees(4);
  const mine = { id: 'm1', employeeId: 'e1', day: MON, shift: 'morning', start: '09:00', end: '12:00' };
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
  const existing = [{ id: 'x', employeeId: 'e3', day: MON, shift: 'afternoon', start: '15:00', end: '21:00' }];
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

// ---------- Breaks within the shift ----------

const breakRules = (...rules) => ({ enabled: true, rules: rules.map(([afterHours, minutes]) => ({ afterHours, minutes })) });
const withBreaks = (patch = {}) => settingsWith({ breaks: breakRules([6, 15]), ...patch });
const at = (start, end) => ({ id: 'x', employeeId: 'e1', day: MON, shift: 'morning', start, end });

test('breaks: disabled by default, net hours equal gross hours', () => {
  const settings = testSettings();
  assert.equal(settings.breaks.enabled, false);
  assert.equal(breakMinutesOf(settings, at('09:00', '17:00')), 0);
  assert.equal(netAssignmentHours(settings, at('09:00', '17:00')), 8);
});

test('breaks: only an assignment longer than the threshold has a break, which is not counted', () => {
  const settings = withBreaks();
  assert.equal(breakMinutesOf(settings, at('09:00', '15:00')), 0, 'exactly X h: no break');
  assert.equal(breakMinutesOf(settings, at('09:00', '15:01')), 15);
  assert.equal(netAssignmentHours(settings, at('09:00', '17:00')), 7.75);
  assert.equal(netAssignmentHours(withBreaks({ breaks: breakRules([1, 120]) }), at('09:00', '11:00')), 0);
});

test('breaks: with several rules the highest threshold exceeded applies, they are not added up', () => {
  const settings = withBreaks({ breaks: breakRules([8, 30], [6, 15]) }); // unsorted on purpose
  assert.equal(breakMinutesOf(settings, at('09:00', '14:00')), 0, 'below every threshold');
  assert.equal(breakMinutesOf(settings, at('09:00', '15:00')), 0, 'exactly the lowest threshold: no break');
  assert.equal(breakMinutesOf(settings, at('09:00', '16:00')), 15, '7 h: only the 6 h rule');
  assert.equal(breakMinutesOf(settings, at('09:00', '17:00')), 15, 'exactly 8 h: still the 6 h rule');
  assert.equal(breakMinutesOf(settings, at('09:00', '17:30')), 30, '8.5 h: the 8 h rule replaces the other');
  assert.equal(netAssignmentHours(settings, at('09:00', '17:30')), 8);
  assert.equal(breakMinutesOf(withBreaks({ breaks: breakRules() }), at('09:00', '20:00')), 0, 'no rules: no break');
  const tied = withBreaks({ breaks: breakRules([6, 15], [6, 20]) });
  assert.equal(breakMinutesOf(tied, at('09:00', '16:00')), 20, 'same threshold: the longer break');
});

test('breaks: validate() counts net hours per employee and in the global total; coverage and rest stay gross', () => {
  const settings = withBreaks({ shifts: {
    morning: { start: '08:00', end: '16:00', required: { mozo: 1 } },
    afternoon: { start: '16:00', end: '22:00', required: {} },
  } });
  const employees = makeEmployees(1, 30);
  const assignments = [{ id: 'a1', employeeId: 'e1', day: MON, shift: 'morning', start: '08:00', end: '16:00' }];
  const { stats, warnings } = validate(settings, employees, {}, assignments);
  assert.equal(stats.employees[0].assigned, 7.75);
  assert.equal(stats.totalAssigned, 7.75);
  const mondayMorning = warnings.filter((w) => w.type === 'unfilled' && w.day === MON && w.shift === 'morning');
  assert.deepEqual(mondayMorning, [], 'a full shift with a break still covers the place');
  const off = validate({ ...settings, breaks: { ...settings.breaks, enabled: false } }, employees, {}, assignments);
  assert.equal(off.stats.employees[0].assigned, 8);
});

test('breaks: generate() books net hours, consistent with validate()', () => {
  const settings = withBreaks({ weeklyCap: 400 });
  const employees = makeEmployees(6);
  const { assignments, stats } = generate(settings, employees);
  const validated = validate(settings, employees, {}, assignments).stats;
  assert.equal(stats.totalAssigned, validated.totalAssigned);
  assert.ok(assignments.length > 0);
  // 6 h shifts are not longer than 6 h: same schedule as with the option off.
  assert.equal(assignments.length, generate(settingsWith({ weeklyCap: 400 }), employees).assignments.length);
});

// ---------- 'leaders' coverage mode ----------

/** Settings in 'leaders' mode: 3 people per morning (1 leader) and 2 per afternoon (1 leader). No categories needed. */
function leadersModeSettings(patch = {}) {
  const settings = defaultSettings(WEEK, 'en');
  settings.coverageMode = 'leaders';
  settings.shifts.morning.headcount = 3;
  settings.shifts.morning.leaders = 1;
  settings.shifts.afternoon.headcount = 2;
  settings.shifts.afternoon.leaders = 1;
  return { ...settings, weeklyCap: 400, ...patch };
}

function makeStaff(total, leaderCount, contractHours = 30) {
  return makeEmployees(total, contractHours).map((employee, index) => ({
    ...employee,
    canLeadShift: index < leaderCount,
  }));
}

const assignmentsOf = (assignments, day, shift) => assignments.filter((a) => a.day === day && a.shift === shift);

test("leaders mode: every shift gets its headcount, with a leader in each one (categories are not needed)", () => {
  const settings = leadersModeSettings();
  const employees = makeStaff(8, 4);
  const leaderIds = new Set(employees.filter((e) => e.canLeadShift).map((e) => e.id));
  const { assignments, warnings } = generate(settings, employees);

  assert.deepEqual(types(warnings).filter((type) => ['unfilled', 'staff', 'config'].includes(type)), []);
  for (const day of ['2026-11-16', '2026-11-17', '2026-11-20']) {
    const morning = assignmentsOf(assignments, day, 'morning');
    const afternoon = assignmentsOf(assignments, day, 'afternoon');
    assert.equal(morning.length, 3);
    assert.equal(afternoon.length, 2);
    assert.ok(morning.some((a) => leaderIds.has(a.employeeId)), 'a leader in the morning');
    assert.ok(afternoon.some((a) => leaderIds.has(a.employeeId)), 'a leader in the afternoon');
  }
});

test('leaders mode: employees who cannot lead never take the leader place, and categories do not matter', () => {
  const settings = leadersModeSettings();
  settings.shifts.afternoon.headcount = 0;
  settings.shifts.afternoon.leaders = 0;
  settings.categories = [{ id: 'boss', name: 'Boss', rank: 9 }, { id: 'newbie', name: 'Newbie', rank: 1 }];
  // Only the "newbie" can lead; the "boss" category must not make anyone a leader.
  const employees = makeStaff(5, 0).map((employee, index) => ({
    ...employee,
    categoryId: index === 0 ? 'newbie' : 'boss',
    canLeadShift: index === 0,
  }));
  const { assignments, warnings } = generate(settings, employees);

  for (const day of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']) {
    assert.ok(assignmentsOf(assignments, day, 'morning').some((a) => a.employeeId === 'e1'), `e1 leads ${day}`);
  }
  // e1 cannot work a sixth day (one day off), and nobody else can lead.
  const saturday = warnings.filter((w) => w.type === 'unfilled' && w.day === '2026-11-21');
  assert.equal(saturday.length, 1);
  assert.match(saturday[0].message, /1 shift leader/);
});

test('leaders mode: with nobody flagged as leader, leader places stay uncovered and validate() says so', () => {
  const settings = leadersModeSettings();
  const employees = makeStaff(6, 0);
  const { assignments, warnings } = generate(settings, employees);

  assert.ok(types(warnings).includes('unfilled'));
  assert.ok(warnings.some((w) => w.type === 'unfilled' && w.message.includes('shift leader')));
  const staffWarning = warnings.find((w) => w.type === 'staff');
  assert.ok(staffWarning, 'not enough shift leaders in the staff');
  assert.match(staffWarning.message, /shift leader/);
  assert.equal(assignmentsOf(assignments, '2026-11-16', 'morning').length, 2, 'the staff places are still filled');
});

test('leaders mode: no "no categories" warning, and categories mode still asks for them', () => {
  const leaders = validate(leadersModeSettings(), makeStaff(2, 1), {}, []).warnings;
  assert.ok(!leaders.some((w) => w.type === 'config'));

  const categories = validate({ ...leadersModeSettings(), coverageMode: 'categories' }, makeStaff(2, 1), {}, []).warnings;
  assert.ok(categories.some((w) => w.type === 'config'));
});

test('leaders mode: more leaders needed than flagged employees exist is a staffing error', () => {
  const settings = leadersModeSettings();
  settings.shifts.morning.leaders = 3;
  const { warnings } = validate(settings, makeStaff(8, 2), {}, []);
  const staffWarning = warnings.find((w) => w.type === 'staff');
  assert.ok(staffWarning);
  assert.match(staffWarning.message, /3 shift leader/);
  assert.match(staffWarning.message, /only 2/);
});

test('leaders mode: day overrides change the needs of that shift only', () => {
  const settings = leadersModeSettings();
  const employees = makeStaff(8, 4);
  const overrides = { '2026-11-16|morning': { $headcount: 5, $leaders: 2 } };
  const { assignments } = generate(settings, employees, overrides);

  assert.equal(assignmentsOf(assignments, '2026-11-16', 'morning').length, 5);
  assert.equal(assignmentsOf(assignments, '2026-11-17', 'morning').length, 3);
});

test('leaders mode: generateShift only adds what the shift is missing and reports it', () => {
  const settings = leadersModeSettings();
  const employees = makeStaff(6, 2);
  const kept = [{ id: 'k1', employeeId: 'e4', day: MON, shift: 'morning', start: '09:00', end: '15:00' }];
  const result = generateShift(settings, employees, {}, kept, MON, 'morning');

  assert.equal(result.added.length, 2, '3 people needed, 1 already there');
  const flagged = new Set(['e1', 'e2']);
  assert.ok(result.added.some((a) => flagged.has(a.employeeId)), 'the missing leader comes from the flagged employees');
  assert.equal(result.missingText, '');
});

test('leaders mode: generateShift names the missing shift leader when nobody can lead', () => {
  const settings = leadersModeSettings();
  const result = generateShift(settings, makeStaff(4, 0), {}, [], MON, 'morning');
  assert.equal(result.added.length, 2);
  assert.equal(result.missingText, '1 shift leader');
});
