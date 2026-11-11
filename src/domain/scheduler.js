// Weekly schedule planner. Pure module: no DOM, no side effects.
//
// Conventions:
//  - Days are ISO dates (YYYY-MM-DD); shifts are 'morning' | 'afternoon'.
//  - An assignment is { id, employeeId, day, shift, start, end, partial }.
//  - The weekly cap is NOT a hard constraint: it only produces warnings (a decision by the manager).
//  - "Days off": an employee works at most (open days - daysOffPerEmployee) days.

import { DEFAULT_LOCALE, createTranslator, translate } from './i18n.js';
import { absMinutes, daysBetween, parseHM, weekDays } from './time.js';

export const SHIFT_KEYS = ['morning', 'afternoon'];

/** Margin for comparing hours or fractional places so rounding does not produce warnings. */
export const DIFF_TOLERANCE = 0.01;

/** Margin for comparing floating-point numbers in the generator decisions. */
export const EPSILON = 1e-6;

let uidCounter = 0;

/** Unique identifier for new employees, categories and assignments. */
export function uid() {
  uidCounter += 1;
  const timePart = Date.now().toString(36);
  const counterPart = uidCounter.toString(36);
  const randomPart = Math.random().toString(36).slice(2, 6);
  return `${timePart}${counterPart}${randomPart}`;
}

/** Rounds to two decimals. */
export const round2 = (value) => Math.round(value * 100) / 100;

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

// ---------- Default settings ----------

export function defaultSettings(weekStart, locale = DEFAULT_LOCALE) {
  return {
    weekStart,
    locale,
    weeklyCap: 200,
    openDays: [0, 1, 2, 3, 4, 5], // indexes 0 = Monday ... 6 = Sunday
    daysOffPerEmployee: 1,
    contractDaysPerWeek: 5,
    minRestHours: 12,
    // The user creates the categories on startup; until then there is no minimum staff.
    categories: [],
    // Minimum staff per shift and category. A higher rank covers lower-rank places,
    // so "2 of the lowest category" is equivalent to "2 people of any category".
    shifts: {
      morning: { start: '09:00', end: '15:00', required: {} },
      afternoon: { start: '15:00', end: '21:00', required: {} },
    },
  };
}

// ---------- Hours and days ----------

/** Hours a configured shift lasts ({ start, end }). */
export function shiftHours(shift) {
  return (parseHM(shift.end) - parseHM(shift.start)) / 60;
}

/** Hours an assignment lasts (negative if the end is before the start). */
export function assignmentHours(assignment) {
  return (parseHM(assignment.end) - parseHM(assignment.start)) / 60;
}

/** Open ISO days, sorted. */
export function openDayList(settings) {
  const week = weekDays(settings.weekStart);
  return [...settings.openDays].sort((a, b) => a - b).map((dayIndex) => week[dayIndex]);
}

/** Day index (0 = Monday) if the date belongs to the week; null otherwise. */
function dayIndexOf(settings, day) {
  const index = daysBetween(settings.weekStart, day);
  return index >= 0 && index < 7 ? index : null;
}

/** Label of an ISO day ("Monday"); if it does not belong to the week, the date itself. */
function dayLabelOf(settings, day) {
  const index = dayIndexOf(settings, day);
  return index === null ? day : translate(settings.locale, `day.${index}`);
}

/** Lower-case day label, for use inside a sentence ("monday"). */
function dayLabelLowerOf(settings, day) {
  const index = dayIndexOf(settings, day);
  return index === null ? day : translate(settings.locale, `day.lower.${index}`);
}

/** Interval in absolute minutes (relative to 00:00 of the week start). */
function toInterval(settings, day, start, end) {
  return {
    startMin: absMinutes(settings.weekStart, day, start),
    endMin: absMinutes(settings.weekStart, day, end),
  };
}

/** Absolute minute at which the last shift of the previous week ended (null if not provided). */
function prevWeekEnd(employee, settings) {
  const raw = employee.prevWeekLastShiftEnd;
  if (!raw || raw.length < 16) return null;
  const day = raw.slice(0, 10);
  const time = raw.slice(11, 16);
  return absMinutes(settings.weekStart, day, time);
}

// ---------- Absences, blocks and target hours ----------

/** Key of a blocked shift: "<day index 0-6>|<shift>" (it repeats every week). */
export function blockKey(dayIndex, shiftKey) {
  return `${dayIndex}|${shiftKey}`;
}

/** Does the employee have that shift blocked on that day (ISO date)? */
export function isShiftBlocked(employee, settings, day, shiftKey) {
  const blocked = employee.blockedShifts ?? [];
  if (blocked.length === 0) return false;
  const dayIndex = daysBetween(settings.weekStart, day);
  return blocked.includes(blockKey(dayIndex, shiftKey));
}

/**
 * Why an employee cannot be assigned to a day and shift: 'absent' (absent that day),
 * 'blocked' (blocked shift) or null if they can be assigned. What is already assigned can still be edited or removed.
 * @returns {'absent'|'blocked'|null}
 */
export function unavailabilityReason(employee, settings, day, shiftKey) {
  if ((employee.absences ?? []).includes(day)) return 'absent';
  if (isShiftBlocked(employee, settings, day, shiftKey)) return 'blocked';
  return null;
}

/** Status of an hours difference against the target: 'under' | 'over' | 'ok'. */
export function diffStatusOf(diff) {
  if (diff < -DIFF_TOLERANCE) return 'under';
  if (diff > DIFF_TOLERANCE) return 'over';
  return 'ok';
}

/** Absence hours of an employee (prorated by open day, capped at their contract). */
export function absenceHoursOf(employee, settings) {
  const openDays = new Set(openDayList(settings));
  const absentOpenDays = (employee.absences ?? []).filter((day) => openDays.has(day)).length;
  const hoursPerDay = employee.contractHours / Math.max(1, settings.contractDaysPerWeek);
  return Math.min(employee.contractHours, absentOpenDays * hoursPerDay);
}

/** Hours an employee should work this week: contract minus absences. */
export function targetHours(employee, settings) {
  return Math.max(0, employee.contractHours - absenceHoursOf(employee, settings));
}

// ---------- Minimum staff and coverage ----------

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
  const isCount = (value) => Number.isInteger(value) && value >= 0;
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

/** Total number of people a shift needs (sum of every category). */
export function requiredHeadcount(settings, overrides, day, shiftKey) {
  const required = requiredByCategory(settings, overrides, day, shiftKey);
  return Object.values(required).reduce((sum, count) => sum + count, 0);
}

/** Groups categories by rank, highest first: Map(rank -> categories of that rank). */
function groupCategoriesByRank(settings) {
  const groups = new Map();
  for (const category of categoryList(settings)) {
    if (!groups.has(category.rank)) groups.set(category.rank, []);
    groups.get(category.rank).push(category);
  }
  return groups;
}

/**
 * Coverage of a shift. `supply` = { categoryId: covered places } (a person working a full shift = 1;
 * extra shifts count as a fraction). Each person occupies a single place: it is distributed from
 * the top down and any surplus high rank covers lower-rank places.
 * Returns { required, missing, byCategory: { id: { required, missing } } } (in places).
 */
export function coverageGap(settings, need, supply) {
  const byCategory = {};
  let required = 0;
  let missing = 0;
  let surplus = 0; // surplus places of higher ranks, which can cover those of this rank

  for (const categories of groupCategoriesByRank(settings).values()) {
    const needed = categories.reduce((sum, category) => sum + (need[category.id] ?? 0), 0);
    const supplied = categories.reduce((sum, category) => sum + (supply[category.id] ?? 0), 0);
    const available = supplied + surplus;
    let rankMissing = Math.max(0, needed - available);
    surplus = Math.max(0, available - needed);
    required += needed;
    missing += rankMissing;

    // What is missing in the rank is distributed among its categories in order.
    for (const category of categories) {
      const categoryNeed = need[category.id] ?? 0;
      const categoryMissing = Math.min(categoryNeed, rankMissing);
      rankMissing -= categoryMissing;
      byCategory[category.id] = { required: categoryNeed, missing: categoryMissing };
    }
  }
  return { required, missing, byCategory };
}

/** Places covered per category in a shift (each employee counts at most 1). */
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
    const categoryId = categoryOf(employee, settings)?.id;
    if (!categoryId) continue;
    const places = Math.min(1, hoursByEmployee.get(employee.id) / shiftLength);
    supply[categoryId] = (supply[categoryId] ?? 0) + places;
  }
  return supply;
}

/** Joins texts with commas and a final conjunction: "A, B and C". */
function joinWithAnd(parts, locale) {
  if (parts.length <= 1) return parts[0] ?? '';
  const allButLast = parts.slice(0, -1).join(', ');
  return `${allButLast}${translate(locale, 'sheet.joinAnd')}${parts[parts.length - 1]}`;
}

/** Text like "1 Manager and 0.5 Sales assistant" with what is missing per category. */
export function describeMissing(settings, gap) {
  const parts = categoryList(settings)
    .filter((category) => (gap.byCategory[category.id]?.missing ?? 0) > DIFF_TOLERANCE)
    .map((category) => `${round2(gap.byCategory[category.id].missing)} ${category.name}`);
  return joinWithAnd(parts, settings.locale);
}

// ---------- Generation ----------

/** State of an employee during generation. */
function createWorker(employee, settings) {
  return {
    employee,
    items: [], // trabajo ya asignado: { day, startMin, endMin }
    remainingHours: targetHours(employee, settings),
    prevWeekEnd: prevWeekEnd(employee, settings),
  };
}

/** One slot for each open day and shift, with its minimum staff and accumulated coverage. */
function createSlots(settings, overrides) {
  const slots = [];
  for (const day of openDayList(settings)) {
    for (const shiftKey of SHIFT_KEYS) {
      const shift = settings.shifts[shiftKey];
      slots.push({
        day,
        key: shiftKey,
        start: shift.start,
        end: shift.end,
        hours: shiftHours(shift),
        need: requiredByCategory(settings, overrides, day, shiftKey),
        supply: {}, // places covered per category (extra shifts count as a fraction)
      });
    }
  }
  return slots;
}

/** Records on an employee that they work in that interval: occupies the day and spends pending hours. */
function bookWorker(worker, day, interval) {
  worker.items.push({ day, startMin: interval.startMin, endMin: interval.endMin });
  worker.remainingHours -= (interval.endMin - interval.startMin) / 60;
}

/** Records in a slot the places covered by an employee's work in that interval. */
function bookSlot(slot, worker, interval, settings) {
  const categoryId = categoryOf(worker.employee, settings)?.id;
  if (!categoryId) return;
  const places = (interval.endMin - interval.startMin) / 60 / slot.hours;
  slot.supply[categoryId] = (slot.supply[categoryId] ?? 0) + places;
}

/**
 * Can the employee work in the slot? Checks absences, blocked shifts, days off,
 * overlaps and minimum rest (with what is already assigned and with the last shift of the previous week).
 * @param {object} worker
 * @param {object} slot
 * @param {{settings: object, minRestMinutes: number, maxWorkDays: number}} rules
 */
function canWork(worker, slot, rules) {
  const { settings, minRestMinutes, maxWorkDays } = rules;
  const { employee } = worker;
  if ((employee.absences ?? []).includes(slot.day)) return false;
  if (isShiftBlocked(employee, settings, slot.day, slot.key)) return false;

  const workedDays = new Set(worker.items.map((item) => item.day));
  const isNewWorkDay = !workedDays.has(slot.day);
  if (isNewWorkDay && workedDays.size >= maxWorkDays) return false;

  const candidate = toInterval(settings, slot.day, slot.start, slot.end);
  if (worker.prevWeekEnd !== null && candidate.startMin - worker.prevWeekEnd < minRestMinutes) return false;

  for (const item of worker.items) {
    const overlaps = candidate.startMin < item.endMin && item.startMin < candidate.endMin;
    if (overlaps) return false;
    const gap = candidate.startMin >= item.endMin
      ? candidate.startMin - item.endMin
      : item.startMin - candidate.endMin;
    if (gap < minRestMinutes) return false;
  }
  return true;
}

/** Places missing in a slot for the categories of a rank. */
function missingForRank(slot, rank, rules) {
  const gap = coverageGap(rules.settings, slot.need, slot.supply);
  return Object.entries(gap.byCategory)
    .filter(([categoryId]) => rules.rankByCategory.get(categoryId) === rank)
    .reduce((sum, [, categoryGap]) => sum + categoryGap.missing, 0);
}

/**
 * Picks the slot with pending places in that rank and the fewest eligible candidates (the hardest
 * to cover goes first). Returns { slot, candidates } or null if no coverable slot is left.
 */
function findMostConstrainedSlot(slots, workers, rank, rules) {
  const { settings } = rules;
  let best = null;

  for (const slot of slots) {
    if (slot.hours <= 0) continue;
    if (missingForRank(slot, rank, rules) <= EPSILON) continue;

    const candidates = workers.filter((worker) => {
      const category = categoryOf(worker.employee, settings);
      return Boolean(category) && category.rank >= rank
        && worker.remainingHours >= slot.hours - EPSILON
        && canWork(worker, slot, rules);
    });
    if (candidates.length === 0) continue;
    if (!best || candidates.length < best.candidates.length) best = { slot, candidates };
  }
  return best;
}

/** The candidate with the most pending hours wins; on a tie, the lowest rank. */
function pickCandidate(candidates, settings) {
  return candidates.reduce((current, challenger) => {
    if (challenger.remainingHours > current.remainingHours + EPSILON) return challenger;
    if (challenger.remainingHours < current.remainingHours - EPSILON) return current;
    const challengerRank = categoryOf(challenger.employee, settings)?.rank ?? 0;
    const currentRank = categoryOf(current.employee, settings)?.rank ?? 0;
    return challengerRank < currentRank ? challenger : current;
  });
}

/** Ranks with some minimum left to cover in the given slots, highest first. */
function ranksWithNeeds(settings, slots) {
  const ranks = categoryList(settings)
    .filter((category) => slots.some((slot) => (slot.need[category.id] ?? 0) > 0))
    .map((category) => category.rank);
  return [...new Set(ranks)]; // categoryList is already sorted from highest to lowest
}

/**
 * Generates a schedule. Returns { assignments, warnings, stats }.
 * 1) Greedy fill of full shifts by rank, highest first (the highest category places first;
 *    within each rank, the slot with the fewest candidates).
 * It does not create partial extra shifts: the organizer adds those by hand (leftover hours
 * remain as an "under target" warning).
 *
 * `options.keep` are existing assignments that are respected as is (they count towards
 * rest, work days, hours and coverage). `options.only = { day, shift }` limits generation
 * to that shift. It also returns `added`: only the new assignments.
 * To generate a single shift, use `generateShift()`.
 */
export function generate(settings, employees, overrides = {}, options = {}) {
  const keep = options.keep ?? [];
  const only = options.only ?? null;
  const openDays = openDayList(settings);
  const rules = {
    settings,
    minRestMinutes: settings.minRestHours * 60,
    maxWorkDays: Math.max(0, openDays.length - settings.daysOffPerEmployee),
    rankByCategory: new Map(categoryList(settings).map((category) => [category.id, category.rank])),
  };

  const workerById = new Map(employees.map((employee) => [employee.id, createWorker(employee, settings)]));
  const workers = [...workerById.values()];
  const slots = createSlots(settings, overrides);

  // Kept assignments occupy hours, days and places as if they were already scheduled.
  for (const assignment of keep) {
    const worker = workerById.get(assignment.employeeId);
    if (!worker) continue;
    const interval = toInterval(settings, assignment.day, assignment.start, assignment.end);
    bookWorker(worker, assignment.day, interval);
    const slot = slots.find((s) => s.day === assignment.day && s.key === assignment.shift);
    if (slot) bookSlot(slot, worker, interval, settings);
  }

  // Shifts that can be generated (all of them, or only the requested one).
  const targets = only ? slots.filter((slot) => slot.day === only.day && slot.key === only.shift) : slots;

  // Full shifts, by rank from highest to lowest: this way high-rank employees are not
  // spent on low places before covering the places only they can fill.
  const added = [];
  for (const rank of ranksWithNeeds(settings, targets)) {
    for (;;) {
      const best = findMostConstrainedSlot(targets, workers, rank, rules);
      if (!best) break;

      const { slot } = best;
      const worker = pickCandidate(best.candidates, settings);
      const interval = toInterval(settings, slot.day, slot.start, slot.end);
      bookWorker(worker, slot.day, interval);
      bookSlot(slot, worker, interval, settings);
      added.push({
        id: uid(),
        employeeId: worker.employee.id,
        day: slot.day,
        shift: slot.key,
        start: slot.start,
        end: slot.end,
        partial: false,
      });
    }
  }

  const assignments = [...keep, ...added];
  const { warnings, stats } = validate(settings, employees, overrides, assignments);
  return { assignments, added, warnings, stats };
}

/**
 * Completes a single shift (day + shift) without touching anything else: keeps every existing
 * assignment, including those of that shift, and adds full shifts until its minimum staff is met,
 * respecting absences, blocks, rest, days off and each employee's pending hours
 * (taking into account what is already assigned in the rest of the week).
 * Returns { added, assignments, warnings, stats, missingText }; `missingText` describes what
 * is still missing in that shift ('' when it is covered).
 */
export function generateShift(settings, employees, overrides, assignments, day, shiftKey) {
  const result = generate(settings, employees, overrides, { keep: assignments, only: { day, shift: shiftKey } });
  const need = requiredByCategory(settings, overrides, day, shiftKey);
  const supply = shiftSupply(settings, employees, result.assignments, day, shiftKey);
  const missingText = describeMissing(settings, coverageGap(settings, need, supply));
  return { ...result, missingText };
}

// ---------- Validation ----------

function createWarning(type, message, extra = {}) {
  return { type, message, ...extra };
}

/** Warns when no category exists: without one, employees cannot be assigned to a place. */
function checkCategories(settings) {
  if (categoryList(settings).length > 0) return [];
  return [createWarning('config', createTranslator(settings.locale)('warning.noCategories'))];
}

/** Warns about configured shifts whose end time is not later than their start time. */
function checkShiftTimes(settings) {
  const t = createTranslator(settings.locale);
  return SHIFT_KEYS
    .filter((shiftKey) => shiftHours(settings.shifts[shiftKey]) <= 0)
    .map((shiftKey) => createWarning(
      'config',
      t('warning.shiftTimes', { shift: t(`shift.lower.${shiftKey}`) }),
    ));
}

/**
 * Warnings about a specific assignment of an employee that exists.
 * @param {{week: string[], openDays: Set<string>}} calendar Days of the week and open days.
 */
function checkAssignment(assignment, employee, settings, calendar) {
  const warnings = [];
  const t = createTranslator(settings.locale);
  const { week, openDays } = calendar;
  const dayLabel = dayLabelLowerOf(settings, assignment.day);
  const ids = { assignmentId: assignment.id, employeeId: employee.id };

  if (!week.includes(assignment.day) || !openDays.has(assignment.day)) {
    warnings.push(createWarning(
      'closed',
      t('warning.closed', { name: employee.name, day: assignment.day }),
      ids,
    ));
  }
  if ((employee.absences ?? []).includes(assignment.day)) {
    warnings.push(createWarning(
      'absent',
      t('warning.absent', { name: employee.name, day: dayLabel }),
      ids,
    ));
  }
  if (isShiftBlocked(employee, settings, assignment.day, assignment.shift)) {
    warnings.push(createWarning(
      'blocked',
      t('warning.blocked', {
        name: employee.name,
        shift: t(`shift.lower.${assignment.shift}`),
        day: dayLabel,
      }),
      ids,
    ));
  }
  if (parseHM(assignment.end) <= parseHM(assignment.start)) {
    warnings.push(createWarning(
      'config',
      t('warning.badRange', { name: employee.name, day: assignment.day }),
      ids,
    ));
  }
  return warnings;
}

/**
 * Checks every assignment and groups them by employee.
 * @returns {{warnings: Array, byEmployee: Map<string, Array>}}
 */
function checkAssignments(settings, employees, assignments) {
  const warnings = [];
  const calendar = { week: weekDays(settings.weekStart), openDays: new Set(openDayList(settings)) };
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const byEmployee = new Map(employees.map((employee) => [employee.id, []]));

  for (const assignment of assignments) {
    const employee = employeeById.get(assignment.employeeId);
    if (!employee) {
      warnings.push(createWarning(
        'unknown-employee',
        createTranslator(settings.locale)('warning.unknownEmployee', { day: assignment.day }),
        { assignmentId: assignment.id },
      ));
      continue;
    }
    byEmployee.get(employee.id).push(assignment);
    warnings.push(...checkAssignment(assignment, employee, settings, calendar));
  }
  return { warnings, byEmployee };
}

/** Warnings about hours against the target and days off for an employee. */
function checkWorkload(employee, { assigned, target, workDays }, settings, maxWorkDays) {
  const warnings = [];
  const t = createTranslator(settings.locale);
  const ids = { employeeId: employee.id };

  if (assigned < target - DIFF_TOLERANCE) {
    warnings.push(createWarning(
      'under',
      t('warning.under', {
        name: employee.name,
        assigned: round2(assigned),
        target: round2(target),
        missing: round2(target - assigned),
      }),
      ids,
    ));
  } else if (assigned > target + DIFF_TOLERANCE) {
    warnings.push(createWarning(
      'over',
      t('warning.over', { name: employee.name, assigned: round2(assigned), target: round2(target) }),
      ids,
    ));
  }
  if (workDays > maxWorkDays) {
    warnings.push(createWarning(
      'daysoff',
      t('warning.daysOff', {
        name: employee.name,
        days: workDays,
        daysOff: settings.daysOffPerEmployee,
        max: maxWorkDays,
      }),
      ids,
    ));
  }
  return warnings;
}

/** Warnings about overlaps and insufficient rest between an employee's shifts (and with the previous week). */
function checkRest(employee, assignments, settings) {
  const warnings = [];
  const t = createTranslator(settings.locale);
  const minRestMinutes = settings.minRestHours * 60;
  const week = weekDays(settings.weekStart);

  const intervals = assignments
    .filter((assignment) => week.includes(assignment.day))
    .map((assignment) => ({
      assignment,
      ...toInterval(settings, assignment.day, assignment.start, assignment.end),
    }))
    .sort((a, b) => a.startMin - b.startMin);

  let latestEnd = prevWeekEnd(employee, settings);
  let latestEndIsPrevWeek = latestEnd !== null;

  for (const current of intervals) {
    const { assignment } = current;
    const ids = { assignmentId: assignment.id, employeeId: employee.id };

    if (latestEnd !== null) {
      const overlaps = current.startMin < latestEnd && !latestEndIsPrevWeek;
      if (overlaps) {
        warnings.push(createWarning(
          'overlap',
          t('warning.overlap', { name: employee.name, day: dayLabelLowerOf(settings, assignment.day) }),
          ids,
        ));
      } else if (current.startMin - latestEnd < minRestMinutes) {
        const restHours = round2((current.startMin - latestEnd) / 60);
        const prevWeekNote = latestEndIsPrevWeek ? t('warning.restPrevWeek') : '';
        warnings.push(createWarning(
          'rest',
          t('warning.rest', {
            name: employee.name,
            rest: restHours,
            day: dayLabelLowerOf(settings, assignment.day),
            min: settings.minRestHours,
            prevWeek: prevWeekNote,
          }),
          ids,
        ));
      }
    }
    if (latestEnd === null || current.endMin > latestEnd) {
      latestEnd = current.endMin;
      latestEndIsPrevWeek = false;
    }
  }
  return warnings;
}

/**
 * Statistics and warnings per employee, in employee list order.
 * @returns {{warnings: Array, employeeStats: Array, totals: object}}
 */
function checkEmployees(settings, employees, assignmentsByEmployee) {
  const warnings = [];
  const employeeStats = [];
  const totals = { assigned: 0, absence: 0, contract: 0 };
  const maxWorkDays = Math.max(0, openDayList(settings).length - settings.daysOffPerEmployee);

  for (const employee of employees) {
    const own = assignmentsByEmployee.get(employee.id);
    const assigned = own.reduce((sum, assignment) => sum + Math.max(0, assignmentHours(assignment)), 0);
    const target = targetHours(employee, settings);
    const absence = absenceHoursOf(employee, settings);
    const workDays = new Set(own.map((assignment) => assignment.day)).size;

    totals.assigned += assigned;
    totals.absence += absence;
    totals.contract += employee.contractHours;
    employeeStats.push({
      id: employee.id,
      name: employee.name,
      contract: employee.contractHours,
      absenceHours: round2(absence),
      target: round2(target),
      assigned: round2(assigned),
      status: diffStatusOf(round2(assigned - target)),
      workDays,
    });

    warnings.push(
      ...checkWorkload(employee, { assigned, target, workDays }, settings, maxWorkDays),
      ...checkRest(employee, own, settings),
    );
  }
  return { warnings, employeeStats, totals };
}

/** Warnings about shifts that do not reach their minimum staff (per category). */
function checkCoverage(settings, employees, overrides, assignments) {
  const warnings = [];
  const t = createTranslator(settings.locale);
  for (const day of openDayList(settings)) {
    for (const shiftKey of SHIFT_KEYS) {
      if (shiftHours(settings.shifts[shiftKey]) <= 0) continue;

      const need = requiredByCategory(settings, overrides, day, shiftKey);
      const supply = shiftSupply(settings, employees, assignments, day, shiftKey);
      const gap = coverageGap(settings, need, supply);
      if (gap.missing <= DIFF_TOLERANCE) continue;

      const covered = round2(gap.required - gap.missing);
      warnings.push(createWarning(
        'unfilled',
        t('warning.unfilled', {
          day: dayLabelOf(settings, day),
          shift: t(`shift.lower.${shiftKey}`),
          missing: describeMissing(settings, gap),
          covered,
          required: gap.required,
        }),
        { day, shift: shiftKey },
      ));
    }
  }
  return warnings;
}

/**
 * Warns about categories for which there are not enough employees (of that category or higher)
 * for the minimum staff. It only counts how many people exist, not their availability.
 * One warning per category.
 */
function checkStaffing(settings, employees, overrides) {
  const warnings = [];
  if (employees.length === 0) return warnings;

  const t = createTranslator(settings.locale);
  const categories = categoryList(settings);
  const needs = openDayList(settings).flatMap((day) => (
    SHIFT_KEYS.map((shiftKey) => requiredByCategory(settings, overrides, day, shiftKey))
  ));

  for (const category of categories) {
    const available = employees.filter((employee) => (categoryOf(employee, settings)?.rank ?? 0) >= category.rank).length;
    const rankedUp = categories.filter((other) => other.rank >= category.rank);
    const peakNeeded = needs.reduce((peak, need) => (
      Math.max(peak, rankedUp.reduce((sum, other) => sum + need[other.id], 0))
    ), 0);

    if (peakNeeded > available) {
      warnings.push(createWarning(
        'staff',
        t('warning.staff', { needed: peakNeeded, category: category.name, available }),
      ));
    }
  }
  return warnings;
}

/** Warnings about the weekly hours cap (warning only, it restricts nothing). */
function checkWeeklyCap(settings, totals) {
  const t = createTranslator(settings.locale);
  const cap = settings.weeklyCap;
  if (totals.contract > cap + EPSILON) {
    return [createWarning(
      'cap-contracts',
      t('warning.capContracts', { contract: round2(totals.contract), cap }),
    )];
  }
  const planned = totals.assigned + totals.absence;
  if (planned > cap + EPSILON) {
    return [createWarning('cap', t('warning.cap', { planned: round2(planned), cap }))];
  }
  return [];
}

/** Warning types that are errors (they break a rule); the rest are plain warnings. */
const ERROR_WARNING_TYPES = new Set([
  'cap', 'cap-contracts', 'rest', 'overlap', 'absent', 'blocked', 'staff', 'closed', 'daysoff', 'config',
  'unknown-employee',
]);

/** @returns {boolean} true if the warning is an error (not a plain warning). */
export function isErrorWarning(warning) {
  return ERROR_WARNING_TYPES.has(warning.type);
}

/** Ids of assignments that break a rule (they are marked in the views). */
export function badAssignmentIds(warnings) {
  const errorsWithAssignment = warnings.filter((warning) => warning.assignmentId && isErrorWarning(warning));
  return new Set(errorsWithAssignment.map((warning) => warning.assignmentId));
}

/** Validates a schedule (generated or edited by hand). It never throws: it returns warnings. */
export function validate(settings, employees, overrides, assignments) {
  const assignmentCheck = checkAssignments(settings, employees, assignments);
  const employeeCheck = checkEmployees(settings, employees, assignmentCheck.byEmployee);
  const { totals } = employeeCheck;

  const warnings = [
    ...checkCategories(settings),
    ...checkShiftTimes(settings),
    ...assignmentCheck.warnings,
    ...employeeCheck.warnings,
    ...checkCoverage(settings, employees, overrides, assignments),
    ...checkStaffing(settings, employees, overrides),
    ...checkWeeklyCap(settings, totals),
  ];

  const stats = {
    employees: employeeCheck.employeeStats,
    totalAssigned: round2(totals.assigned),
    absenceHours: round2(totals.absence),
    totalContract: round2(totals.contract),
    plannedHours: round2(totals.assigned + totals.absence),
    exceedsCap: totals.assigned + totals.absence > settings.weeklyCap + EPSILON
      || totals.contract > settings.weeklyCap + EPSILON,
    cap: settings.weeklyCap,
    budget: round2(settings.weeklyCap - totals.absence),
  };
  return { warnings, stats };
}
