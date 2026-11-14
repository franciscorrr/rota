// Actions that modify the schedule state. Pure module: no DOM, no localStorage.
//
// Each action receives the `state` (or part of it), mutates it in place and, when needed, returns
// the result so the interface can show it. The interface only captures the event and calls here:
// the rules (which minimum is stored, what happens when a category
// is deleted...) live in this file and are tested in test/actions.test.js.

import {
  DEFAULT_LOCALE,
  createTranslator,
  dayName,
  isLocale,
  shiftLabelLower,
  translate,
} from './i18n.js';
import {
  COVERAGE_MODES,
  STAFFING_FIELDS,
  categoryList,
  lowestCategory,
  requiredByCategory,
  requiresCategories,
  shiftStaffing,
} from './coverage.js';
import { daysBetween, mondayOf } from './time.js';
import {
  SHIFT_KEYS,
  blockKey,
  generate,
  generateShift,
  uid,
} from './scheduler.js';

/** Error message for an invalid time range (in the default language). */
export const END_BEFORE_START_ERROR = translate(DEFAULT_LOCALE, 'actions.endBeforeStart');

// ---------- Form numbers ----------

/**
 * Parses the value of a number field. If it is not valid, returns `fallback`.
 * @param {*} value
 * @param {number} fallback
 * @param {{min?: number, integer?: boolean}} [options]
 * @returns {number}
 */
export function parseNumber(value, fallback, { min = 0, integer = false } = {}) {
  const parsed = Number(value);
  if (value === '' || !Number.isFinite(parsed) || parsed < min) return fallback;
  return integer ? Math.floor(parsed) : parsed;
}

// ---------- Language ----------

/**
 * Changes the interface language. Category names are user data and are kept as they are.
 * @returns {boolean} false if the language is not supported.
 */
export function changeLocale(state, localeId) {
  if (!isLocale(localeId)) return false;
  state.settings.locale = localeId;
  return true;
}

// ---------- Assignments ----------

/** @returns {boolean} true if both times exist and the end is later than the start. */
export function isValidRange(start, end) {
  return Boolean(start) && Boolean(end) && end > start;
}

/**
 * Adds an assignment. It does not check absences or blocks (validate() warns about those), only the time range.
 * @param {object} state
 * @param {{employeeId: string, day: string, shift: string, start: string, end: string}} input
 * @returns {{ok: boolean, error?: string}}
 */
export function addAssignment(state, { employeeId, day, shift, start, end }) {
  if (!isValidRange(start, end)) {
    return { ok: false, error: translate(state.settings.locale, 'actions.endBeforeStart') };
  }

  state.assignments.push({ id: uid(), employeeId, day, shift, start, end });
  return { ok: true };
}

/**
 * Changes the times of several assignments at once; if any of them is invalid, none changes.
 * @param {object} state
 * @param {Array<{id: string, start: string, end: string}>} edits
 * @returns {{ok: boolean, error?: string}}
 */
export function updateAssignmentTimes(state, edits) {
  if (edits.some(({ start, end }) => !isValidRange(start, end))) {
    return { ok: false, error: translate(state.settings.locale, 'actions.endBeforeStart') };
  }

  for (const { id, start, end } of edits) {
    const assignment = state.assignments.find((candidate) => candidate.id === id);
    if (!assignment) continue;
    assignment.start = start;
    assignment.end = end;
  }
  return { ok: true };
}

/** Removes an assignment. */
export function removeAssignment(state, assignmentId) {
  state.assignments = state.assignments.filter((assignment) => assignment.id !== assignmentId);
}

/** Removes every assignment. */
export function clearAssignments(state) {
  state.assignments = [];
}

// ---------- Generate ----------

/** Is there something missing for the active coverage mode to work (a category, in 'categories' mode)? */
function lacksCategories(settings) {
  return requiresCategories(settings) && categoryList(settings).length === 0;
}

/**
 * Generates the schedule for the whole week, replacing the current assignments.
 * @returns {boolean} false if there are no employees, or no categories when the mode needs them (it does nothing).
 */
export function generateWeek(state) {
  if (state.employees.length === 0 || lacksCategories(state.settings)) return false;
  state.assignments = generate(state.settings, state.employees, state.overrides).assignments;
  return true;
}

/**
 * Message with the result of generating a shift.
 * @param {string} where Shift it refers to ("Monday morning").
 * @param {{added: Array, missingText: string}} result Result of generateShift().
 * @param {string[]} addedNames Names of the people added.
 * @param {string} [locale] Language of the message.
 * @returns {{message: string, isError: boolean}} `isError` if the shift is still uncovered.
 */
export function describeShiftResult(where, result, addedNames, locale = DEFAULT_LOCALE) {
  const t = createTranslator(locale);
  const nothingAdded = result.added.length === 0;
  const stillMissing = Boolean(result.missingText);

  if (nothingAdded && !stillMissing) {
    return { message: t('actions.alreadyCovered', { where }), isError: false };
  }
  if (nothingAdded) {
    return {
      message: t('actions.nothingAdded', {
        where,
        missing: result.missingText,
        hint: t('actions.nobodyEligible'),
      }),
      isError: true,
    };
  }
  if (stillMissing) {
    return {
      message: t('actions.addedButMissing', {
        where,
        names: addedNames.join(', '),
        missing: result.missingText,
        hint: t('actions.nobodyEligible'),
      }),
      isError: true,
    };
  }
  return { message: t('actions.added', { where, names: addedNames.join(', ') }), isError: false };
}

/**
 * Generates only the given shift: keeps everything already assigned, adds what is missing to meet
 * the minimum staff and leaves the other shifts alone.
 * @returns {{message: string, isError: boolean, added: number}}
 */
export function generateForShift(state, day, shiftKey) {
  const { locale } = state.settings;
  if (state.employees.length === 0) {
    return { message: translate(locale, 'actions.noEmployeesShift'), isError: true, added: 0 };
  }
  if (lacksCategories(state.settings)) {
    return { message: translate(locale, 'warning.noCategories'), isError: true, added: 0 };
  }

  const where = translate(locale, 'actions.where', {
    day: dayName(locale, daysBetween(state.settings.weekStart, day)),
    shift: shiftLabelLower(locale, shiftKey),
  });
  const result = generateShift(state.settings, state.employees, state.overrides, state.assignments, day, shiftKey);
  const addedNames = result.added.map((assignment) => (
    state.employees.find((employee) => employee.id === assignment.employeeId)?.name ?? '?'
  ));

  state.assignments.push(...result.added);
  return { ...describeShiftResult(where, result, addedNames, locale), added: result.added.length };
}

// ---------- Minimum staff ----------

/**
 * Chooses how the minimum staff of a shift is defined: 'categories' or 'leaders'. Both
 * configurations are kept, so switching back and forth loses nothing.
 * @returns {boolean} false if the mode is not supported.
 */
export function setCoverageMode(settings, mode) {
  if (!COVERAGE_MODES.includes(mode)) return false;
  settings.coverageMode = mode;
  return true;
}

/**
 * Changes the minimum staff of a category only for one day and shift (day template).
 * If the value matches the shift value, the override is removed.
 */
export function setDayMinimum(state, day, shiftKey, categoryId, count) {
  const { settings, overrides } = state;
  const standardCount = requiredByCategory(settings, {}, day, shiftKey)[categoryId];
  const key = `${day}|${shiftKey}`;
  const current = { ...(typeof overrides[key] === 'object' ? overrides[key] : {}) };

  if (count === standardCount) delete current[categoryId];
  else current[categoryId] = count;

  if (Object.keys(current).length === 0) delete overrides[key];
  else overrides[key] = current;
}

/**
 * Changes the start or end time of a shift. An empty time is discarded.
 * @returns {boolean} false if the time was empty.
 */
export function setShiftTime(shift, property, time) {
  if (!time) return false;
  shift[property] = time;
  return true;
}

/** Changes the minimum staff of a category in a shift (for every day). */
export function setShiftMinimum(settings, shiftKey, categoryId, count) {
  const shift = settings.shifts[shiftKey];
  shift.required = { ...(shift.required ?? {}), [categoryId]: count };
}

/**
 * 'leaders' mode: changes how many people (`headcount`) or shift leaders (`leaders`) a shift needs,
 * for every day.
 * @param {'headcount'|'leaders'} field
 * @returns {boolean} false if the field is not one of those.
 */
export function setShiftStaffing(settings, shiftKey, field, count) {
  if (!Object.hasOwn(STAFFING_FIELDS, field)) return false;
  settings.shifts[shiftKey][field] = count;
  return true;
}

/**
 * 'leaders' mode: changes the headcount or the shift leaders only for one day and shift (day
 * template). If the value matches the shift value, the override is removed.
 * @param {'headcount'|'leaders'} field
 * @returns {boolean} false if the field is not one of those.
 */
export function setDayStaffing(state, day, shiftKey, field, count) {
  if (!Object.hasOwn(STAFFING_FIELDS, field)) return false;
  const { settings, overrides } = state;
  const overrideKey = STAFFING_FIELDS[field];
  const standardCount = shiftStaffing(settings, {}, day, shiftKey)[field];
  const key = `${day}|${shiftKey}`;
  const current = { ...(typeof overrides[key] === 'object' ? overrides[key] : {}) };

  if (count === standardCount) delete current[overrideKey];
  else current[overrideKey] = count;

  if (Object.keys(current).length === 0) delete overrides[key];
  else overrides[key] = current;
  return true;
}

// ---------- Breaks ----------

/**
 * Adds a break rule after the highest existing one (2 h more, 15 min more) so it is a sensible
 * starting point; the first rule is 6 h / 15 min.
 */
export function addBreakRule(settings) {
  const { rules } = settings.breaks;
  const highest = (key) => Math.max(0, ...rules.map((rule) => rule[key]));
  rules.push(rules.length === 0
    ? { afterHours: 6, minutes: 15 }
    : { afterHours: highest('afterHours') + 2, minutes: highest('minutes') + 15 });
}

/** Removes the break rule at `index` (no-op if it does not exist). */
export function removeBreakRule(settings, index) {
  settings.breaks.rules.splice(index, 1);
}

// ---------- Categories ----------

/** Adds a new category, with a lower rank than every existing one (rank 1 if there are none). */
export function addCategory(settings) {
  const { categories } = settings;
  const lowestRank = categories.length > 0 ? Math.min(...categories.map((category) => category.rank)) : 1;
  categories.push({
    id: uid(),
    name: translate(settings.locale, 'actions.categoryName', { n: categories.length + 1 }),
    rank: Math.max(1, lowestRank - 1),
  });
}

/**
 * Removes a category: its employees move to the remaining lowest-rank category, and minimums
 * that mentioned it are discarded. The last category cannot be removed when the coverage mode
 * needs categories; in 'leaders' mode they are optional and the employees are left without one.
 * @returns {boolean} true if it was removed.
 */
export function removeCategory(state, categoryId) {
  const { settings, employees, overrides } = state;
  if (requiresCategories(settings) && settings.categories.length <= 1) return false;

  settings.categories = settings.categories.filter((category) => category.id !== categoryId);
  const fallbackId = lowestCategory(settings)?.id ?? '';
  for (const employee of employees) {
    if (employee.categoryId === categoryId) employee.categoryId = fallbackId;
  }
  for (const shift of Object.values(settings.shifts)) delete shift.required?.[categoryId];
  for (const [key, dayRequired] of Object.entries(overrides)) {
    delete dayRequired[categoryId];
    if (Object.keys(dayRequired).length === 0) delete overrides[key];
  }
  return true;
}

// ---------- Week ----------

/**
 * Changes the week to the Monday of the chosen date. Assignments and day templates belong to a
 * specific week, so they are cleared.
 * @returns {string|null} The chosen Monday, or null if the date is invalid or the week does not change.
 */
export function changeWeek(state, isoDay) {
  if (!isoDay) return null;
  const monday = mondayOf(isoDay);
  if (monday === state.settings.weekStart) return null;

  state.settings.weekStart = monday;
  state.assignments = [];
  state.overrides = {};
  return monday;
}

// ---------- Employees ----------

/**
 * New employee with the default values (30 h, lowest category, not a shift leader).
 * @returns {object|null} The new employee, or null if the coverage mode needs a category and there is none.
 *   Without categories in 'leaders' mode the employee has no category.
 */
export function addEmployee(state) {
  const category = lowestCategory(state.settings);
  if (!category && requiresCategories(state.settings)) return null;

  const employee = {
    id: uid(),
    name: translate(state.settings.locale, 'actions.employeeName', { n: state.employees.length + 1 }),
    contractHours: 30,
    categoryId: category?.id ?? '',
    canLeadShift: false,
    absences: [],
    blockedShifts: [],
    prevWeekLastShiftEnd: '',
  };
  state.employees.push(employee);
  return employee;
}

/** Deletes the employee and all their assignments. */
export function removeEmployee(state, employeeId) {
  state.employees = state.employees.filter((employee) => employee.id !== employeeId);
  state.assignments = state.assignments.filter((assignment) => assignment.employeeId !== employeeId);
}

/**
 * Changes the name of an employee or a category; an empty name is discarded.
 * @returns {string} The name that remains.
 */
export function rename(entity, name) {
  entity.name = name.trim() || entity.name;
  return entity.name;
}

/** Marks or unmarks an employee as able to lead a shift (used by the 'leaders' coverage mode). */
export function setCanLeadShift(employee, canLead) {
  employee.canLeadShift = Boolean(canLead);
}

/** Marks or unmarks an absence on a day (without duplicates). */
export function setAbsence(employee, day, absent) {
  const others = employee.absences.filter((absentDay) => absentDay !== day);
  employee.absences = absent ? [...others, day] : others;
}

/**
 * Marks (or unmarks) every open day of the week as an absence.
 * Absences on closed days are left untouched.
 */
export function setAbsentAllWeek(employee, openWeekDays, absent) {
  const otherAbsences = employee.absences.filter((day) => !openWeekDays.includes(day));
  employee.absences = absent ? [...otherAbsences, ...openWeekDays] : otherAbsences;
}

/** @returns {boolean} true if the employee is absent on every open day (and there is at least one). */
export function isAbsentAllWeek(employee, openWeekDays) {
  return openWeekDays.length > 0 && openWeekDays.every((day) => employee.absences.includes(day));
}

/** Shifts that can be blocked: one for each open day and shift, with its label. */
export function blockableShifts(settings) {
  const options = [];
  for (const dayIndex of [...settings.openDays].sort((a, b) => a - b)) {
    for (const shiftKey of SHIFT_KEYS) {
      options.push({
        id: blockKey(dayIndex, shiftKey),
        label: `${dayName(settings.locale, dayIndex)} ${shiftLabelLower(settings.locale, shiftKey)}`,
      });
    }
  }
  return options;
}

/** Blocks a recurring shift of the employee (without duplicates). */
export function blockShift(employee, blockId) {
  const blocked = employee.blockedShifts ?? [];
  if (!blocked.includes(blockId)) employee.blockedShifts = [...blocked, blockId];
}

/** Removes a block from the employee. */
export function unblockShift(employee, blockId) {
  employee.blockedShifts = (employee.blockedShifts ?? []).filter((id) => id !== blockId);
}
