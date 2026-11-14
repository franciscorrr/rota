import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coverageClassOf,
  coverageClasses,
  coverageGap,
  coverageMode,
  coveragePolicy,
  isClassOverridden,
  requiredByClass,
  requiresCategories,
  shiftStaffing,
  shiftSupply,
  staffWarningKey,
  tracksLeaders,
} from '../src/domain/coverage.js';
import { defaultSettings } from '../src/domain/scheduler.js';

const WEEK = '2026-11-16'; // Monday
const MON = '2026-11-16';

function categoriesSettings(locale = 'en') {
  const settings = defaultSettings(WEEK, locale);
  settings.categories = [
    { id: 'manager', name: 'Manager', rank: 3 },
    { id: 'clerk', name: 'Clerk', rank: 1 },
  ];
  settings.shifts.morning.required = { clerk: 2 };
  return settings;
}

function leadersSettings(locale = 'en') {
  const settings = categoriesSettings(locale);
  settings.coverageMode = 'leaders';
  settings.shifts.morning.headcount = 4;
  settings.shifts.morning.leaders = 1;
  return settings;
}

const employee = (id, canLeadShift = false, categoryId = 'clerk') => ({ id, name: id, categoryId, canLeadShift });
const worked = (employeeId, shift = 'morning', day = MON) => ({
  id: `a-${employeeId}`, employeeId, day, shift, start: '09:00', end: '15:00',
});

test('coveragePolicy: categories by default; an unknown or missing mode falls back to it', () => {
  assert.equal(coverageMode(defaultSettings(WEEK)), 'categories');
  assert.equal(coverageMode({ coverageMode: 'nonsense' }), 'categories');
  assert.equal(coverageMode(undefined), 'categories');
  assert.equal(coveragePolicy({ coverageMode: 'nonsense' }), coveragePolicy(defaultSettings(WEEK)));
  assert.equal(coverageMode(leadersSettings()), 'leaders');
});

test('categories policy: classes are the categories, the employee category and the per-category minimum', () => {
  const settings = categoriesSettings();
  assert.deepEqual(coverageClasses(settings).map((c) => c.id), ['manager', 'clerk']);
  assert.equal(coverageClassOf(employee('e1', false, 'manager'), settings).id, 'manager');
  assert.equal(coverageClassOf(employee('e2', false, 'gone'), settings).id, 'clerk', 'unknown category = the lowest');
  assert.deepEqual(requiredByClass(settings, {}, MON, 'morning'), { manager: 0, clerk: 2 });
  assert.deepEqual(requiredByClass(settings, { [`${MON}|morning`]: { manager: 1 } }, MON, 'morning'), { manager: 1, clerk: 2 });
  assert.equal(requiresCategories(settings), true);
  assert.equal(tracksLeaders(settings), false);
  assert.equal(staffWarningKey(settings, 'manager'), 'warning.staff');
});

test('leaders policy: two classes (shift leader above staff), named in the interface language', () => {
  assert.deepEqual(coverageClasses(leadersSettings('en')).map((c) => [c.id, c.name, c.rank]), [
    ['leader', 'shift leader', 2],
    ['staff', 'staff', 1],
  ]);
  assert.deepEqual(coverageClasses(leadersSettings('es')).map((c) => c.name), ['responsable de turno', 'personal']);
  assert.equal(requiresCategories(leadersSettings()), false);
  assert.equal(tracksLeaders(leadersSettings()), true);
  assert.equal(staffWarningKey(leadersSettings(), 'leader'), 'warning.staffLeaders');
  assert.equal(staffWarningKey(leadersSettings(), 'staff'), 'warning.staffHeadcount');
});

test('leaders policy: the class of an employee depends only on the flag, never on their category', () => {
  const settings = leadersSettings();
  assert.equal(coverageClassOf(employee('e1', true, 'clerk'), settings).id, 'leader');
  assert.equal(coverageClassOf(employee('e2', false, 'manager'), settings).id, 'staff');
  assert.equal(coverageClassOf({ id: 'e3' }, settings).id, 'staff');
  const withoutCategories = { ...settings, categories: [] };
  assert.equal(coverageClassOf(employee('e4', true, ''), withoutCategories).id, 'leader');
});

test('leaders policy: leaders count inside the headcount (staff = headcount - leaders)', () => {
  const settings = leadersSettings();
  assert.deepEqual(requiredByClass(settings, {}, MON, 'morning'), { leader: 1, staff: 3 });
  assert.deepEqual(requiredByClass(settings, {}, MON, 'afternoon'), { leader: 0, staff: 0 });

  settings.shifts.morning.leaders = 6; // more leaders than people: the headcount grows to match
  assert.deepEqual(requiredByClass(settings, {}, MON, 'morning'), { leader: 6, staff: 0 });
});

test('leaders policy: day overrides replace the shift values field by field', () => {
  const settings = leadersSettings();
  const overrides = { [`${MON}|morning`]: { $headcount: 6 } };
  assert.deepEqual(shiftStaffing(settings, overrides, MON, 'morning'), { headcount: 6, leaders: 1 });
  assert.deepEqual(requiredByClass(settings, overrides, MON, 'morning'), { leader: 1, staff: 5 });

  const both = { [`${MON}|morning`]: { $headcount: 2, $leaders: 2 } };
  assert.deepEqual(requiredByClass(settings, both, MON, 'morning'), { leader: 2, staff: 0 });
});

test('leaders policy: invalid or foreign override values are ignored', () => {
  const settings = leadersSettings();
  const overrides = { [`${MON}|morning`]: { $headcount: -1, $leaders: 1.5, clerk: 9, other: 'x' } };
  assert.deepEqual(shiftStaffing(settings, overrides, MON, 'morning'), { headcount: 4, leaders: 1 });
  assert.deepEqual(requiredByClass(settings, overrides, MON, 'morning'), { leader: 1, staff: 3 });
});

test('categories mode ignores the leaders minimums stored in the same override entry', () => {
  const settings = categoriesSettings();
  const overrides = { [`${MON}|morning`]: { $headcount: 9, $leaders: 3, manager: 1 } };
  assert.deepEqual(requiredByClass(settings, overrides, MON, 'morning'), { manager: 1, clerk: 2 });
});

test('isClassOverridden: categories look at their own id, leaders at the $ keys', () => {
  const categories = categoriesSettings();
  const catOverrides = { [`${MON}|morning`]: { manager: 1 } };
  assert.equal(isClassOverridden(categories, catOverrides, MON, 'morning', 'manager'), true);
  assert.equal(isClassOverridden(categories, catOverrides, MON, 'morning', 'clerk'), false);
  assert.equal(isClassOverridden(categories, {}, MON, 'morning', 'manager'), false);

  const leaders = leadersSettings();
  const headcountOnly = { [`${MON}|morning`]: { $headcount: 5 } };
  assert.equal(isClassOverridden(leaders, headcountOnly, MON, 'morning', 'leader'), false);
  assert.equal(isClassOverridden(leaders, headcountOnly, MON, 'morning', 'staff'), true);
  const leadersOnly = { [`${MON}|morning`]: { $leaders: 2 } };
  assert.equal(isClassOverridden(leaders, leadersOnly, MON, 'morning', 'leader'), true);
  assert.equal(isClassOverridden(leaders, leadersOnly, MON, 'morning', 'staff'), true);
});

test('a category called "leader" does not clash with the leaders mode classes', () => {
  const settings = categoriesSettings();
  settings.categories.push({ id: 'leader', name: 'Leader', rank: 2 });
  assert.equal(isClassOverridden(settings, { [`${MON}|morning`]: { $leaders: 1 } }, MON, 'morning', 'leader'), false);
  assert.equal(requiredByClass(settings, { [`${MON}|morning`]: { leader: 1 } }, MON, 'morning').leader, 1);
});

test('coverageGap in leaders mode: a spare leader covers a staff place, a staff member never covers a leader', () => {
  const settings = leadersSettings();
  const need = { leader: 1, staff: 3 };

  const spareLeader = coverageGap(settings, need, { leader: 2, staff: 2 });
  assert.equal(spareLeader.missing, 0);
  assert.equal(spareLeader.required, 4);

  const noLeader = coverageGap(settings, need, { staff: 4 });
  assert.equal(noLeader.missing, 1);
  assert.deepEqual(noLeader.byCategory.leader, { required: 1, missing: 1 });
  assert.deepEqual(noLeader.byCategory.staff, { required: 3, missing: 0 });
});

test('shiftSupply in leaders mode: flagged employees supply leader places, the rest supply staff', () => {
  const settings = leadersSettings();
  const employees = [employee('lead', true), employee('a'), employee('b')];
  const assignments = [worked('lead'), worked('a'), worked('b'), worked('a', 'afternoon')];
  assert.deepEqual(shiftSupply(settings, employees, assignments, MON, 'morning'), { leader: 1, staff: 2 });
});
