// Date and time utilities. No DOM dependencies.
// Translated day names live in i18n.js: here there is only arithmetic.

const MS_PER_DAY = 86400000;
const MINUTES_PER_DAY = 1440;

/** ISO date (YYYY-MM-DD) to UTC milliseconds. */
function parseISO(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Weekday index of an ISO date (0 = Monday ... 6 = Sunday). */
function weekdayIndex(iso) {
  const sundayBasedIndex = new Date(parseISO(iso)).getUTCDay();
  return (sundayBasedIndex + 6) % 7;
}

/** "09:30" -> 570 (minutes since midnight). */
export function parseHM(hm) {
  const [hours, minutes] = hm.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Hours a configured shift lasts ({ start, end }). */
export function shiftHours(shift) {
  return (parseHM(shift.end) - parseHM(shift.start)) / 60;
}

/** Hours an assignment lasts (negative if the end is before the start). */
export function assignmentHours(assignment) {
  return (parseHM(assignment.end) - parseHM(assignment.start)) / 60;
}

/** 570 -> "09:30". */
export function formatHM(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Adds n days to an ISO date (YYYY-MM-DD). */
export function addDays(iso, count) {
  return new Date(parseISO(iso) + count * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Calendar days from `from` to `to` (to - from). */
export function daysBetween(from, to) {
  return Math.round((parseISO(to) - parseISO(from)) / MS_PER_DAY);
}

/** The 7 ISO days of the week starting at weekStart. */
export function weekDays(weekStart) {
  return Array.from({ length: 7 }, (_, offset) => addDays(weekStart, offset));
}

/** Absolute minutes of (day, hm) relative to 00:00 of weekStart. */
export function absMinutes(weekStart, day, hm) {
  return daysBetween(weekStart, day) * MINUTES_PER_DAY + parseHM(hm);
}

/** Converts a local Date to ISO (YYYY-MM-DD) without going through UTC. */
export function toLocalISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Monday of the week of the given date (index 0 = Monday). */
export function mondayOf(iso) {
  return addDays(iso, -weekdayIndex(iso));
}

/** Next Monday (or today, if today is Monday). */
export function nextMonday(from = new Date()) {
  const today = toLocalISO(from);
  const daysUntilMonday = (7 - weekdayIndex(today)) % 7;
  return addDays(today, daysUntilMonday);
}
