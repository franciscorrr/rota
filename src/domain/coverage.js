// Minimum staff and coverage of a shift. Pure module: no DOM, no side effects.
//
// Two coverage modes share one engine. Each mode is a "coverage policy": a plain object that says
// which coverage classes exist, which class an employee fills and how many places of each class a
// shift needs. A coverage class is { id, name, rank }; a higher rank covers lower-rank places and
// every person occupies a single place (see coverageGap()).
//
//  - 'categories': the classes are the user's categories; the minimum is set per category.
//  - 'leaders': two synthetic classes, `leader` (rank 2) and `staff` (rank 1); the minimum is a
//    total headcount plus how many of those people must be shift leaders. Categories are ignored.
//
// Nothing outside `coveragePolicy()` branches on the mode: the generator, validate() and the sheet
// model only talk about coverage classes.

import { translate } from './i18n.js';
import { assignmentHours, shiftHours } from './time.js';

export const COVERAGE_MODES = ['categories', 'leaders'];
export const DEFAULT_COVERAGE_MODE = 'categories';

/** Ids of the synthetic coverage classes of the 'leaders' mode. */
export const LEADER_CLASS_ID = 'leader';
export const STAFF_CLASS_ID = 'staff';

/**
 * Keys of the 'leaders' minimums inside `overrides["<day>|<shift>"]`. The `$` prefix keeps them from
 * clashing with category ids, which share the same object.
 */
export const HEADCOUNT_OVERRIDE_KEY = '$headcount';
export const LEADERS_OVERRIDE_KEY = '$leaders';

/** Fields of a shift that hold the 'leaders' minimums, mapped to their override key. */
export const STAFFING_FIELDS = {
  headcount: HEADCOUNT_OVERRIDE_KEY,
  leaders: LEADERS_OVERRIDE_KEY,
};

const isCount = (value) => Number.isInteger(value) && value >= 0;

// ---------- Categories ----------

/**
 * Categories from settings, from the highest to the lowest rank (stable).
 * There are no default categories: the user has to create them.
 */
export function categoryList(settings) {
  const configured = settings?.categories;
  const categories = Array.isArray(configured) ? configured : [];
  return [...categories].sort((a, b) => b.rank - a.rank);
}

/** Lowest-rank category: the one that can cover anyone. Undefined if there is no category. */
export function lowestCategory(settings) {
  const categories = categoryList(settings);
  return categories[categories.length - 1];
}

/**
 * Category of an employee; if missing or no longer configured, the lowest rank one
 * (undefined if there is no category).
 */
export function categoryOf(employee, settings) {
  const ownCategory = categoryList(settings).find((category) => category.id === employee?.categoryId);
  return ownCategory ?? lowestCategory(settings);
}

// ---------- Minimum staff per category ----------

/**
 * Cleans a "minimum staff" value of unknown origin and returns it as { categoryId: n } (integer n >= 0).
 * - An object: keeps only existing categories and valid values.
 * - An integer >= 0: n people of the lowest category.
 * - Anything else: if `fallbackHeadcount` is an integer >= 0, it is used as in the previous case;
 *   otherwise returns {}.
 * @param {object} settings Settings (categories come from them).
 * @param {*} rawRequired Value to clean.
 * @param {*} [fallbackHeadcount] Alternative value used when `rawRequired` is not usable.
 * @returns {Object<string, number>}
 */
export function sanitizeRequired(settings, rawRequired, fallbackHeadcount) {
  const lowestId = lowestCategory(settings)?.id;

  if (rawRequired && typeof rawRequired === 'object') {
    const required = {};
    for (const category of categoryList(settings)) {
      if (isCount(rawRequired[category.id])) required[category.id] = rawRequired[category.id];
    }
    return required;
  }
  if (!lowestId) return {};
  if (isCount(rawRequired)) return { [lowestId]: rawRequired };
  if (isCount(fallbackHeadcount)) return { [lowestId]: fallbackHeadcount };
  return {};
}

/**
 * Minimum staff of a shift per category: { categoryId: n }. Starts from the shift minimum
 * and overrides it category by category with the day template (overrides). Defensive:
 * a bare number is interpreted as "n people of the lowest category".
 */
export function requiredByCategory(settings, overrides, day, shiftKey) {
  const shiftRequired = sanitizeRequired(settings, settings.shifts[shiftKey]?.required);
  const dayRequired = sanitizeRequired(settings, overrides?.[`${day}|${shiftKey}`]);
  const merged = { ...shiftRequired, ...dayRequired };

  const result = {};
  for (const category of categoryList(settings)) result[category.id] = merged[category.id] ?? 0;
  return result;
}

// ---------- Minimum staff in 'leaders' mode ----------

/**
 * Keeps only the valid 'leaders' minimums of an override entry, as { $headcount?, $leaders? }
 * (integers >= 0). Anything else in the entry (category ids, junk) is dropped.
 */
export function sanitizeStaffing(rawOverride) {
  const staffing = {};
  if (!rawOverride || typeof rawOverride !== 'object') return staffing;
  for (const overrideKey of Object.values(STAFFING_FIELDS)) {
    if (isCount(rawOverride[overrideKey])) staffing[overrideKey] = rawOverride[overrideKey];
  }
  return staffing;
}

/**
 * Configured minimum of a shift in 'leaders' mode: { headcount, leaders }. Starts from the shift
 * and overrides it field by field with the day template. This is what the user typed: it is not
 * adjusted (see `requiredByLeaders()` for the effective places).
 */
export function shiftStaffing(settings, overrides, day, shiftKey) {
  const shift = settings.shifts[shiftKey] ?? {};
  const dayStaffing = sanitizeStaffing(overrides?.[`${day}|${shiftKey}`]);
  const result = {};
  for (const [field, overrideKey] of Object.entries(STAFFING_FIELDS)) {
    result[field] = dayStaffing[overrideKey] ?? (isCount(shift[field]) ? shift[field] : 0);
  }
  return result;
}

/**
 * Places a shift needs in 'leaders' mode: { leader: L, staff: N - L }. Leaders count inside the
 * headcount, so asking for more leaders than people raises the headcount to the number of leaders.
 */
function requiredByLeaders(settings, overrides, day, shiftKey) {
  const { headcount, leaders } = shiftStaffing(settings, overrides, day, shiftKey);
  return {
    [LEADER_CLASS_ID]: leaders,
    [STAFF_CLASS_ID]: Math.max(headcount, leaders) - leaders,
  };
}

// ---------- Coverage policies ----------

/**
 * @typedef {object} CoverageClass
 * @property {string} id
 * @property {string} name Shown to the user.
 * @property {number} rank A higher rank covers lower-rank places.
 */

/**
 * @typedef {object} CoveragePolicy
 * @property {(settings: object) => CoverageClass[]} classes Coverage classes, highest rank first.
 * @property {(employee: object, settings: object) => (CoverageClass|undefined)} classOf Class an employee fills.
 * @property {(settings: object, overrides: object, day: string, shiftKey: string) => Object<string, number>} required
 *   Minimum places of a shift per class id (every class is present, 0 when none is needed).
 * @property {boolean} requiresCategories Whether employees must have a category to be scheduled.
 * @property {boolean} tracksLeaders Whether employees carry a "can lead a shift" flag that matters.
 * @property {(classId: string) => string} staffWarningKey Catalog key of the warning shown when there are not
 *   enough employees to fill a class (parameters: needed, category, available).
 * @property {(classId: string) => string[]} overrideKeys Keys of a day override that change the places
 *   of a class (to tell the user a day differs from the standard minimum).
 */

/** The two synthetic coverage classes of 'leaders' mode, highest rank first. */
function leadersClasses(settings) {
  return [
    { id: LEADER_CLASS_ID, name: translate(settings.locale, 'coverage.leader'), rank: 2 },
    { id: STAFF_CLASS_ID, name: translate(settings.locale, 'coverage.staff'), rank: 1 },
  ];
}

/** @type {CoveragePolicy} */
const categoriesPolicy = {
  classes: categoryList,
  classOf: categoryOf,
  required: requiredByCategory,
  requiresCategories: true,
  tracksLeaders: false,
  staffWarningKey: () => 'warning.staff',
  overrideKeys: (classId) => [classId],
};

/** @type {CoveragePolicy} */
const leadersPolicy = {
  classes: leadersClasses,
  classOf(employee, settings) {
    const classId = employee?.canLeadShift ? LEADER_CLASS_ID : STAFF_CLASS_ID;
    return leadersClasses(settings).find((coverageClass) => coverageClass.id === classId);
  },
  required: requiredByLeaders,
  requiresCategories: false,
  tracksLeaders: true,
  staffWarningKey: (classId) => (classId === LEADER_CLASS_ID ? 'warning.staffLeaders' : 'warning.staffHeadcount'),
  // Leaders come from `$leaders`; staff places are what is left of the headcount, so both change them.
  overrideKeys: (classId) => (
    classId === LEADER_CLASS_ID ? [LEADERS_OVERRIDE_KEY] : [HEADCOUNT_OVERRIDE_KEY, LEADERS_OVERRIDE_KEY]
  ),
};

const POLICIES = { categories: categoriesPolicy, leaders: leadersPolicy };

/** Coverage mode of the settings; anything unknown falls back to 'categories'. */
export function coverageMode(settings) {
  return COVERAGE_MODES.includes(settings?.coverageMode) ? settings.coverageMode : DEFAULT_COVERAGE_MODE;
}

/** The only place that picks a policy from the mode. */
export function coveragePolicy(settings) {
  return POLICIES[coverageMode(settings)];
}

/** Do employees need a category in the active mode? ('leaders' mode only displays categories.) */
export function requiresCategories(settings) {
  return coveragePolicy(settings).requiresCategories;
}

/** Does the active mode use the "can lead a shift" flag of employees? */
export function tracksLeaders(settings) {
  return coveragePolicy(settings).tracksLeaders;
}

/** Catalog key of the "not enough employees" warning for a coverage class of the active mode. */
export function staffWarningKey(settings, classId) {
  return coveragePolicy(settings).staffWarningKey(classId);
}

/** Does a day override change the places of this coverage class in the active mode? */
export function isClassOverridden(settings, overrides, day, shiftKey, classId) {
  const dayOverrides = overrides?.[`${day}|${shiftKey}`];
  if (!dayOverrides || typeof dayOverrides !== 'object') return false;
  return coveragePolicy(settings).overrideKeys(classId).some((overrideKey) => overrideKey in dayOverrides);
}

/** Coverage classes of the active mode, highest rank first. */
export function coverageClasses(settings) {
  return coveragePolicy(settings).classes(settings);
}

/** Coverage class an employee fills in the active mode (undefined if there is none). */
export function coverageClassOf(employee, settings) {
  return coveragePolicy(settings).classOf(employee, settings);
}

/** Minimum places of a shift per coverage class of the active mode: { classId: n }. */
export function requiredByClass(settings, overrides, day, shiftKey) {
  return coveragePolicy(settings).required(settings, overrides, day, shiftKey);
}

// ---------- Coverage ----------

/** Groups coverage classes by rank, highest first: Map(rank -> classes of that rank). */
function groupClassesByRank(settings) {
  const groups = new Map();
  for (const coverageClass of coverageClasses(settings)) {
    if (!groups.has(coverageClass.rank)) groups.set(coverageClass.rank, []);
    groups.get(coverageClass.rank).push(coverageClass);
  }
  return groups;
}

/**
 * Coverage of a shift. `need` and `supply` are { classId: places } (a person working a full shift = 1;
 * extra shifts count as a fraction). Each person occupies a single place: it is distributed from
 * the top down and any surplus high rank covers lower-rank places.
 * Returns { required, missing, byCategory: { id: { required, missing } } } (in places); `byCategory`
 * is keyed by coverage class id (the user's categories, or `leader` and `staff`).
 */
export function coverageGap(settings, need, supply) {
  const byCategory = {};
  let required = 0;
  let missing = 0;
  let surplus = 0; // surplus places of higher ranks, which can cover those of this rank

  for (const classes of groupClassesByRank(settings).values()) {
    const needed = classes.reduce((sum, coverageClass) => sum + (need[coverageClass.id] ?? 0), 0);
    const supplied = classes.reduce((sum, coverageClass) => sum + (supply[coverageClass.id] ?? 0), 0);
    const available = supplied + surplus;
    let rankMissing = Math.max(0, needed - available);
    surplus = Math.max(0, available - needed);
    required += needed;
    missing += rankMissing;

    // What is missing in the rank is distributed among its classes in order.
    for (const coverageClass of classes) {
      const classNeed = need[coverageClass.id] ?? 0;
      const classMissing = Math.min(classNeed, rankMissing);
      rankMissing -= classMissing;
      byCategory[coverageClass.id] = { required: classNeed, missing: classMissing };
    }
  }
  return { required, missing, byCategory };
}

/** Places covered per coverage class in a shift (each employee counts at most 1). */
export function shiftSupply(settings, employees, assignments, day, shiftKey) {
  const supply = {};
  const shiftLength = shiftHours(settings.shifts[shiftKey]);
  if (shiftLength <= 0) return supply;

  const hoursByEmployee = new Map();
  for (const assignment of assignments) {
    if (assignment.day !== day || assignment.shift !== shiftKey) continue;
    const previousHours = hoursByEmployee.get(assignment.employeeId) ?? 0;
    hoursByEmployee.set(assignment.employeeId, previousHours + Math.max(0, assignmentHours(assignment)));
  }

  for (const employee of employees) {
    if (!hoursByEmployee.has(employee.id)) continue;
    const classId = coverageClassOf(employee, settings)?.id;
    if (!classId) continue;
    const places = Math.min(1, hoursByEmployee.get(employee.id) / shiftLength);
    supply[classId] = (supply[classId] ?? 0) + places;
  }
  return supply;
}
