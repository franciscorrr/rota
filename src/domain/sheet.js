// Spreadsheet-style view model (employees in rows, shifts in columns).
// Pure module: no DOM. It turns the state into data ready to render.

import { createTranslator, shiftLabel, translate } from './i18n.js';
import {
  DIFF_TOLERANCE,
  SHIFT_KEYS,
  breakMinutesOf,
  categoryList,
  categoryOf,
  coverageGap,
  describeMissing,
  diffStatusOf,
  isShiftBlocked,
  netAssignmentHours,
  openDayList,
  requiredByCategory,
  round2,
  shiftSupply,
  unavailabilityReason,
} from './scheduler.js';
import { daysBetween } from './time.js';

// ---------- Helpers ----------

/** Weekday name of an ISO date ("Monday"); if it is not in the week, the date itself. */
function dayNameOf(settings, day) {
  const index = daysBetween(settings.weekStart, day);
  return index >= 0 && index < 7 ? translate(settings.locale, `day.${index}`) : day;
}

/** "16/11" from an ISO date. */
function dayAndMonth(day) {
  return `${day.slice(8)}/${day.slice(5, 7)}`;
}

/** "Monday 16/11" from an ISO date. */
function dayAndDate(settings, day) {
  return `${dayNameOf(settings, day)} ${dayAndMonth(day)}`;
}

/** Readable time range of a shift: "09:00–15:00". */
function timeRange(start, end) {
  return `${start}–${end}`;
}

/** Assignments of a day and shift (from all employees), sorted by start time. */
function sortedByStart(assignments) {
  return [...assignments].sort((a, b) => a.start.localeCompare(b.start));
}

/** Total places covered (sum of every category), rounded. */
function totalCovered(supply) {
  return round2(Object.values(supply).reduce((sum, places) => sum + places, 0));
}

/** Categories with a minimum staff > 0 in a shift, with what is missing in each one. */
function categoriesWithNeed(settings, need, gap) {
  return categoryList(settings)
    .filter((category) => need[category.id] > 0)
    .map((category) => ({
      id: category.id,
      name: category.name,
      rank: category.rank,
      required: need[category.id],
      missing: round2(gap.byCategory[category.id].missing),
    }));
}

// ---------- Sheet ----------

/** Cell without an assigned shift: absence, block or empty. */
function createIdleCell(kind, lines) {
  return { kind, lines, hours: 0, breakMinutes: 0, bad: false, assignmentIds: [] };
}

/** Cell with a shift: an employee's assignments on a day and shift (at least one). */
function createWorkCell(ownAssignments, badIds, settings) {
  const sorted = sortedByStart(ownAssignments);
  return {
    kind: 'work',
    lines: sorted.map((assignment) => timeRange(assignment.start, assignment.end)),
    hours: round2(sorted.reduce((sum, assignment) => sum + netAssignmentHours(settings, assignment), 0)),
    breakMinutes: sorted.reduce((sum, assignment) => sum + breakMinutesOf(settings, assignment), 0),
    bad: sorted.some((assignment) => badIds.has(assignment.id)),
    assignmentIds: sorted.map((assignment) => assignment.id),
  };
}

/** Cell of an employee in a column (day + shift): work, absence, block or empty. */
function buildEmployeeCell(employee, column, { settings, assignments, badIds }) {
  const own = assignments.filter((assignment) => (
    assignment.employeeId === employee.id
    && assignment.day === column.day
    && assignment.shift === column.shift
  ));
  if (own.length > 0) return createWorkCell(own, badIds, settings);
  if ((employee.absences ?? []).includes(column.day)) {
    return createIdleCell('absent', [translate(settings.locale, 'sheet.absent')]);
  }
  if (isShiftBlocked(employee, settings, column.day, column.shift)) {
    return createIdleCell('blocked', [translate(settings.locale, 'sheet.blocked')]);
  }
  return createIdleCell('empty', []);
}

/** Employee row: its cells and its hour totals. */
function buildRow(employee, columns, { statsByEmployee, ...context }) {
  const fallbackStats = { contract: employee.contractHours, target: 0, assigned: 0, workDays: 0 };
  const stats = statsByEmployee.get(employee.id) ?? fallbackStats;
  const diff = round2(stats.assigned - stats.target);

  return {
    id: employee.id,
    name: employee.name,
    category: categoryOf(employee, context.settings)?.name ?? '',
    cells: columns.map((column) => buildEmployeeCell(employee, column, context)),
    contract: stats.contract,
    target: stats.target,
    assigned: stats.assigned,
    diff,
    status: diffStatusOf(diff),
    workDays: stats.workDays,
  };
}

/** Coverage of a column (day + shift): covered places against the minimum. */
function buildCoverage(column, { settings, employees, overrides, assignments }) {
  const need = requiredByCategory(settings, overrides, column.day, column.shift);
  const supply = shiftSupply(settings, employees, assignments, column.day, column.shift);
  const gap = coverageGap(settings, need, supply);
  const covered = totalCovered(supply);

  let status = 'ok';
  if (gap.missing > DIFF_TOLERANCE) status = 'under';
  else if (covered - gap.required > DIFF_TOLERANCE) status = 'over';

  return {
    required: gap.required,
    covered,
    status,
    missingText: describeMissing(settings, gap),
    categories: categoriesWithNeed(settings, need, gap)
      .map(({ id, name, required, missing }) => ({ id, name, required, missing })),
  };
}

/** Sheet columns: one shift for each open day. */
function buildColumns(settings, days) {
  return days.flatMap((day) => SHIFT_KEYS.map((shift) => ({
    day,
    shift,
    dayName: dayNameOf(settings, day),
    shiftLabel: shiftLabel(settings.locale, shift),
    shiftLabelLower: translate(settings.locale, `shift.lower.${shift}`),
    time: timeRange(settings.shifts[shift].start, settings.shifts[shift].end),
  })));
}

/** Adds up a numeric column of the rows, rounded. */
function sumRows(rows, field) {
  return round2(rows.reduce((sum, row) => sum + row[field], 0));
}

/**
 * Builds the sheet model.
 * `stats` is the result of validate().stats; `badIds` are the ids of assignments
 * that break a rule (they are marked in the cell).
 */
export function buildSheet({ settings, employees, overrides, assignments, stats, badIds = new Set() }) {
  const days = openDayList(settings);
  const columns = buildColumns(settings, days);
  const context = {
    settings,
    employees,
    overrides,
    assignments,
    badIds,
    statsByEmployee: new Map(stats.employees.map((employeeStats) => [employeeStats.id, employeeStats])),
  };

  const rows = employees.map((employee) => buildRow(employee, columns, context));
  const dayGroups = days.map((day) => ({
    day,
    name: dayNameOf(settings, day),
    date: dayAndMonth(day),
    span: SHIFT_KEYS.length,
  }));
  const coverage = columns.map((column) => buildCoverage(column, context));
  const totals = {
    contract: sumRows(rows, 'contract'),
    target: sumRows(rows, 'target'),
    assigned: sumRows(rows, 'assigned'),
  };

  // Net hours worked by all the employees in each column (breaks already subtracted).
  const shiftHours = columns.map((_column, columnIndex) => (
    round2(rows.reduce((sum, row) => sum + row.cells[columnIndex].hours, 0))
  ));

  return { locale: settings.locale, dayGroups, columns, rows, coverage, shiftHours, totals };
}

/** Descriptive text of a column's coverage cell. */
function describeCoverageCell(model, column, columnIndex) {
  const t = createTranslator(model.locale);
  const coverage = model.coverage[columnIndex];
  const where = `${column.dayName} ${column.shiftLabelLower}`;
  const detail = coverage.categories
    .map((category) => `${category.name} ${round2(category.required - category.missing)}/${category.required}`)
    .join(', ');
  const detailText = detail ? ` (${detail})` : '';
  return t('sheet.coverageDetail', {
    where,
    covered: coverage.covered,
    required: coverage.required,
    detail: detailText,
  });
}

/** Descriptive text of an employee's cell in a column. */
function describeEmployeeCell(row, cell, column, locale) {
  const t = createTranslator(locale);
  const where = `${column.dayName} ${column.shiftLabelLower}`;
  if (cell.kind === 'absent') return t('sheet.describeAbsent', { name: row.name, day: column.dayName });
  if (cell.kind === 'blocked') return t('sheet.describeBlocked', { name: row.name, where });
  if (cell.kind === 'empty') return t('sheet.describeEmpty', { name: row.name, where });

  const brokenRule = cell.bad ? t('sheet.describeBad') : '';
  const key = cell.breakMinutes > 0 ? 'sheet.describeWorkBreak' : 'sheet.describeWork';
  return t(key, {
    minutes: cell.breakMinutes,
    name: row.name,
    where,
    times: cell.lines.join(t('sheet.joinAnd')),
    hours: round2(cell.hours),
    bad: brokenRule,
  });
}

/** Descriptive text of a cell. Row `rows.length` is the coverage row. */
export function describeCell(model, rowIndex, columnIndex) {
  const column = model.columns[columnIndex];
  if (!column) return '';
  if (rowIndex === model.rows.length) return describeCoverageCell(model, column, columnIndex);

  const row = model.rows[rowIndex];
  if (!row) return '';
  return describeEmployeeCell(row, row.cells[columnIndex], column, model.locale);
}

// ---------- Shift and cell details (popups) ----------

/** Does the day template change this category's minimum? */
function isOverridden(overrides, day, shiftKey, categoryId) {
  const dayOverrides = overrides[`${day}|${shiftKey}`];
  return typeof dayOverrides === 'object' && categoryId in dayOverrides;
}

/**
 * Details of a specific shift (day + shift): the same data the Edit view cell shows
 * (coverage, minimum per category and assigned people), ready for a popup.
 */
export function shiftDetail({ settings, employees, overrides, assignments, badIds = new Set() }, day, shiftKey) {
  const t = createTranslator(settings.locale);
  const shift = settings.shifts[shiftKey];
  const need = requiredByCategory(settings, overrides, day, shiftKey);
  const supply = shiftSupply(settings, employees, assignments, day, shiftKey);
  const gap = coverageGap(settings, need, supply);
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

  const categories = categoriesWithNeed(settings, need, gap).map(({ id, name, rank, required, missing }) => ({
    name,
    rank,
    required,
    missing,
    isShort: missing > DIFF_TOLERANCE,
    overridden: isOverridden(overrides, day, shiftKey, id),
  }));

  const shiftAssignments = sortedByStart(
    assignments.filter((assignment) => assignment.day === day && assignment.shift === shiftKey),
  );
  const assigned = shiftAssignments.map((assignment) => {
    const employee = employeeById.get(assignment.employeeId);
    return {
      id: assignment.id,
      name: employee?.name ?? t('sheet.removedEmployee'),
      category: employee ? (categoryOf(employee, settings)?.name ?? '') : '',
      start: assignment.start,
      end: assignment.end,
      hours: round2(netAssignmentHours(settings, assignment)),
      breakMinutes: breakMinutesOf(settings, assignment),
      bad: badIds.has(assignment.id),
    };
  });

  return {
    day,
    shift: shiftKey,
    title: `${dayAndDate(settings, day)} · ${shiftLabel(settings.locale, shiftKey)}`,
    time: timeRange(shift.start, shift.end),
    covered: totalCovered(supply),
    required: gap.required,
    status: gap.missing > DIFF_TOLERANCE ? 'under' : 'ok',
    missingText: describeMissing(settings, gap),
    categories,
    assignments: assigned,
  };
}

/**
 * State of an editable cell (employee + day + shift): which assignments it has and whether one
 * can be added (not if the employee is absent or the shift is blocked; what is already assigned
 * can still be changed or removed). Returns null if the employee does not exist.
 */
export function cellDetail({ settings, employees, assignments, badIds = new Set() }, employeeId, day, shiftKey) {
  const employee = employees.find((candidate) => candidate.id === employeeId);
  if (!employee) return null;

  const shift = settings.shifts[shiftKey];
  const reason = unavailabilityReason(employee, settings, day, shiftKey);
  const own = sortedByStart(assignments.filter((assignment) => (
    assignment.employeeId === employeeId && assignment.day === day && assignment.shift === shiftKey
  )));

  return {
    employeeId,
    day,
    shift: shiftKey,
    title: `${employee.name} · ${dayAndDate(settings, day)} · ${shiftLabel(settings.locale, shiftKey)}`,
    category: categoryOf(employee, settings)?.name ?? '',
    shiftStart: shift.start,
    shiftEnd: shift.end,
    absent: reason === 'absent',
    blocked: reason === 'blocked',
    canAdd: reason === null,
    hours: round2(own.reduce((sum, assignment) => sum + netAssignmentHours(settings, assignment), 0)),
    assignments: own.map((assignment) => ({
      id: assignment.id,
      start: assignment.start,
      end: assignment.end,
      breakMinutes: breakMinutesOf(settings, assignment),
      bad: badIds.has(assignment.id),
    })),
  };
}

/** Difference from the target, readable without relying on colour. */
export function formatDiff(row) {
  if (row.status === 'ok') return 'OK';
  const sign = row.diff > 0 ? '+' : '−';
  return `${sign}${Math.abs(row.diff)} h`;
}
