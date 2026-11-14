// Persistence in localStorage and JSON import/export.
//
// Everything that comes from outside (localStorage, imported JSON) goes through normalizeState(),
// which discards invalid data and fills in missing data with defaults. It never trusts the format.

import {
  COVERAGE_MODES,
  categoryList,
  lowestCategory,
  sanitizeRequired,
  sanitizeStaffing,
} from './coverage.js';
import { DEFAULT_LOCALE, isLocale, translate } from './i18n.js';
import { defaultSettings, SHIFT_KEYS } from './scheduler.js';
import { nextMonday } from './time.js';

const STORAGE_KEY = 'timetables.v1';
const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const BLOCKED_SHIFT_PATTERN = /^[0-6]\|(morning|afternoon)$/;

// ---------- Sanitising helpers ----------

/**
 * Converts a value to a number if it is finite and greater than or equal to `min`.
 * @param {*} value
 * @param {number} fallback Value returned when it is not valid.
 * @param {number} [min=0]
 * @returns {number}
 */
function numberOr(value, fallback, min = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min ? number : fallback;
}

/**
 * Returns the value if it is a string; otherwise, `fallback`.
 * @param {*} value
 * @param {string} [fallback='']
 * @returns {string}
 */
function stringOr(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Like stringOr(), but an empty string also counts as invalid.
 * @param {*} value
 * @param {string} fallback
 * @returns {string}
 */
function nonEmptyStringOr(value, fallback) {
  return stringOr(value, fallback) || fallback;
}

/** @returns {boolean} true if it is a non-null object (arrays are too). */
function isObject(value) {
  return Boolean(value) && typeof value === 'object';
}

/** @returns {Array} The value if it is an array; otherwise, an empty array. */
function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

/** @returns {boolean} true if it is a string in YYYY-MM-DD format. */
function isIsoDay(value) {
  return ISO_DAY_PATTERN.test(stringOr(value));
}

/** @returns {boolean} true if it is a string in HH:MM format. */
function isTime(value) {
  return TIME_PATTERN.test(stringOr(value));
}

/** @returns {Array} The array items without duplicates (keeps the order of appearance). */
function unique(values) {
  return [...new Set(values)];
}

// ---------- Settings ----------

/**
 * Valid categories (unique id, name, integer rank >= 1).
 * If none is valid, returns an empty list: the user has to create them.
 * @param {*} rawCategories
 * @returns {Array<{id: string, name: string, rank: number}>}
 */
function normalizeCategories(rawCategories, locale) {
  const categories = [];
  const usedIds = new Set();

  arrayOrEmpty(rawCategories).forEach((rawCategory, index) => {
    const position = index + 1;
    const id = nonEmptyStringOr(rawCategory?.id, `c${position}`);
    const rank = Math.floor(numberOr(rawCategory?.rank, NaN, 1));
    if (usedIds.has(id) || !Number.isFinite(rank)) return;

    usedIds.add(id);
    const name = stringOr(rawCategory?.name).trim()
      || translate(locale, 'actions.categoryName', { n: position });
    categories.push({ id, name, rank });
  });

  return categories;
}

/**
 * Minimum staff per category of a shift.
 * A numeric minimum, in `required` or `standardHeadcount`, means people of the lowest category.
 * If the file says nothing, the total number of people of the default shift is used
 * (none by default, because there are no categories).
 * @param {object} rawShift Shift as it comes from the file.
 * @param {object} defaultShift Default shift.
 * @param {object} settings Settings already with normalised categories.
 * @returns {Object<string, number>}
 */
function normalizeRequired(rawShift, defaultShift, settings) {
  const hasNoRequirements = rawShift.required === undefined && rawShift.standardHeadcount === undefined;
  if (hasNoRequirements) {
    const lowest = lowestCategory(settings);
    const defaultTotal = Object.values(defaultShift.required ?? {}).reduce((sum, count) => sum + count, 0);
    return lowest && defaultTotal > 0 ? { [lowest.id]: defaultTotal } : {};
  }
  return sanitizeRequired(settings, rawShift.required, rawShift.standardHeadcount);
}

/**
 * @param {*} rawShift
 * @param {object} defaultShift
 * @param {object} settings Settings already with normalised categories.
 * @returns {{start: string, end: string, required: Object<string, number>, headcount: number, leaders: number}}
 */
function normalizeShift(rawShift, defaultShift, settings) {
  const shift = rawShift ?? {};
  return {
    start: isTime(shift.start) ? shift.start : defaultShift.start,
    end: isTime(shift.end) ? shift.end : defaultShift.end,
    required: normalizeRequired(shift, defaultShift, settings),
    // 'leaders' mode minimums: people in total and how many of them are shift leaders.
    headcount: Math.floor(numberOr(shift.headcount, defaultShift.headcount ?? 0)),
    leaders: Math.floor(numberOr(shift.leaders, defaultShift.leaders ?? 0)),
  };
}

/** A break rule is valid if its threshold is positive and the break fits inside it. */
function normalizeBreakRule(rawRule) {
  if (!isObject(rawRule)) return null;
  const afterHours = numberOr(rawRule.afterHours, NaN);
  const minutes = numberOr(rawRule.minutes, NaN);
  const isValid = afterHours > 0 && minutes >= 0 && minutes < afterHours * 60;
  return isValid ? { afterHours, minutes } : null;
}

/**
 * Break settings: `enabled` must be a real boolean and `rules` a list of valid `{ afterHours, minutes }`
 * (invalid ones are dropped, the rest is sorted by threshold). Files from before multiple rules
 * (`{ enabled, afterHours, minutes }`) become a single rule. If nothing usable comes, the defaults are used.
 */
function normalizeBreaks(rawBreaks, defaults) {
  const raw = isObject(rawBreaks) ? rawBreaks : {};
  const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : defaults.enabled;
  const rawRules = Array.isArray(raw.rules) ? raw.rules : [raw];
  const rules = rawRules.map(normalizeBreakRule).filter(Boolean);
  const hasRules = Array.isArray(raw.rules) || rules.length > 0;
  const sorted = rules.sort((a, b) => a.afterHours - b.afterHours || a.minutes - b.minutes);
  return { enabled, rules: hasRules ? sorted : defaults.rules.map((rule) => ({ ...rule })) };
}

/**
 * @param {*} rawSettings
 * @param {object} defaults Default settings (the base for whatever is missing).
 * @param {string} fallbackLocale Language used if the file does not bring a valid one.
 * @returns {object} Complete, valid settings.
 */
function normalizeSettings(rawSettings, defaults, fallbackLocale) {
  const raw = isObject(rawSettings) ? rawSettings : {};
  const openDays = Array.isArray(raw.openDays)
    ? unique(raw.openDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))
    : defaults.openDays;
  const locale = isLocale(raw.locale) ? raw.locale : fallbackLocale;

  const settings = {
    weekStart: isIsoDay(raw.weekStart) ? raw.weekStart : defaults.weekStart,
    locale,
    coverageMode: COVERAGE_MODES.includes(raw.coverageMode) ? raw.coverageMode : defaults.coverageMode,
    weeklyCap: numberOr(raw.weeklyCap, defaults.weeklyCap),
    openDays,
    daysOffPerEmployee: Math.floor(numberOr(raw.daysOffPerEmployee, defaults.daysOffPerEmployee)),
    contractDaysPerWeek: Math.max(1, Math.floor(numberOr(raw.contractDaysPerWeek, defaults.contractDaysPerWeek, 1))),
    minRestHours: numberOr(raw.minRestHours, defaults.minRestHours),
    breaks: normalizeBreaks(raw.breaks, defaults.breaks),
    categories: normalizeCategories(raw.categories, locale),
    shifts: {},
  };

  for (const shiftKey of SHIFT_KEYS) {
    const rawShift = raw.shifts?.[shiftKey];
    settings.shifts[shiftKey] = normalizeShift(rawShift, defaults.shifts[shiftKey], settings);
  }
  return settings;
}

// ---------- Employees, day templates and assignments ----------

/**
 * @param {*} rawEmployee
 * @param {number} index Position in the file (used for the default id and name).
 * @param {object} settings Normalised settings.
 * @returns {object}
 */
function normalizeEmployee(rawEmployee, index, settings) {
  const position = index + 1;
  const knownCategoryIds = new Set(categoryList(settings).map((category) => category.id));
  const hasKnownCategory = knownCategoryIds.has(rawEmployee?.categoryId);
  const blockedShifts = arrayOrEmpty(rawEmployee?.blockedShifts)
    .filter((key) => BLOCKED_SHIFT_PATTERN.test(stringOr(key)));

  return {
    id: nonEmptyStringOr(rawEmployee?.id, `e${position}`),
    name: stringOr(rawEmployee?.name, translate(settings.locale, 'actions.employeeName', { n: position })),
    contractHours: numberOr(rawEmployee?.contractHours, 0),
    absences: arrayOrEmpty(rawEmployee?.absences).filter(isIsoDay),
    categoryId: hasKnownCategory ? rawEmployee.categoryId : (lowestCategory(settings)?.id ?? ''),
    canLeadShift: rawEmployee?.canLeadShift === true,
    blockedShifts: unique(blockedShifts),
    prevWeekLastShiftEnd: stringOr(rawEmployee?.prevWeekLastShiftEnd),
  };
}

/**
 * Minimum staff per day and shift (`"<ISO day>|<shift>"`): per category, and the `$headcount` /
 * `$leaders` minimums of the 'leaders' mode. Discards entries that leave nothing valid.
 * @param {*} rawOverrides
 * @param {object} settings Normalised settings.
 * @returns {Object<string, Object<string, number>>}
 */
function normalizeOverrides(rawOverrides, settings) {
  const overrides = {};
  const entries = isObject(rawOverrides) ? Object.entries(rawOverrides) : [];

  for (const [key, rawRequired] of entries) {
    const required = { ...sanitizeRequired(settings, rawRequired), ...sanitizeStaffing(rawRequired) };
    if (Object.keys(required).length > 0) overrides[key] = required;
  }
  return overrides;
}

/** @returns {boolean} true if the raw assignment has a valid day, shift and times. */
function isValidAssignment(rawAssignment) {
  return Boolean(rawAssignment)
    && isIsoDay(rawAssignment.day)
    && SHIFT_KEYS.includes(rawAssignment.shift)
    && isTime(rawAssignment.start)
    && isTime(rawAssignment.end);
}

/**
 * @param {object} rawAssignment Assignment already checked with isValidAssignment().
 * @param {number} index Position among the valid assignments (used for the default id).
 * @returns {object}
 */
function normalizeAssignment(rawAssignment, index) {
  return {
    id: nonEmptyStringOr(rawAssignment.id, `a${index}`),
    employeeId: stringOr(rawAssignment.employeeId),
    day: rawAssignment.day,
    shift: rawAssignment.shift,
    start: rawAssignment.start,
    end: rawAssignment.end,
  };
}

// ---------- Public API ----------

/** Initial state: default settings for the next Monday, with no employees or assignments. */
export function defaultState(locale = DEFAULT_LOCALE) {
  return {
    settings: defaultSettings(nextMonday(), locale),
    employees: [],
    overrides: {},
    assignments: [],
  };
}

/**
 * Validates and completes a state read from outside.
 * @param {*} raw localStorage content or an imported JSON.
 * @param {string} [locale] Language of the error messages and default names, and the one kept
 *   when the state does not bring a valid language (so importing does not change the interface language).
 * @returns {{settings: object, employees: Array, overrides: object, assignments: Array}}
 * @throws {Error} If `raw` is not an object.
 */
export function normalizeState(raw, locale = DEFAULT_LOCALE) {
  if (!isObject(raw)) throw new Error(translate(locale, 'import.notObject'));

  const settings = normalizeSettings(raw.settings, defaultState().settings, locale);
  const employees = arrayOrEmpty(raw.employees)
    .map((rawEmployee, index) => normalizeEmployee(rawEmployee, index, settings));
  const overrides = normalizeOverrides(raw.overrides, settings);
  const assignments = arrayOrEmpty(raw.assignments)
    .filter(isValidAssignment)
    .map(normalizeAssignment);

  return { settings, employees, overrides, assignments };
}

/** Reads the state saved in localStorage; if there is nothing or it is corrupt, returns the initial one. */
export function loadState() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text) return normalizeState(JSON.parse(text));
  } catch {
    // storage unavailable or corrupt data: start from scratch
  }
  return defaultState();
}

/**
 * Saves the state in localStorage.
 * @returns {boolean} true if it could be saved.
 */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Serialises the state as readable JSON to export it to a file. */
export function exportJSON(state) {
  return JSON.stringify(state, null, 2);
}

/**
 * Reads an exported JSON and normalises it.
 * @param {string} text File content.
 * @param {string} [locale] Language of the error messages.
 * @throws {Error} If it is not JSON or does not contain a usable schedule.
 */
export function parseImport(text, locale = DEFAULT_LOCALE) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(translate(locale, 'import.invalidJson'));
  }
  return normalizeState(raw, locale);
}
