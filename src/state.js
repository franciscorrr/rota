// Shared application state. Components read from here and modify `state` with the actions in
// src/domain/actions.js; everything derived (warnings, statistics, sheet) recalculates itself.

import { computed, ref, watch } from 'vue';
import { changeLocale } from './domain/actions.js';
import { DEFAULT_LOCALE, createTranslator, dayName, dayShort, shiftLabel, translate } from './domain/i18n.js';
import { badAssignmentIds, validate } from './domain/scheduler.js';
import { buildSheet } from './domain/sheet.js';
import { loadState, saveState } from './domain/storage.js';

/** Schedule state: { settings, employees, overrides, assignments }. Deeply reactive. */
export const state = ref(loadState());

/** Active schedule view: 'sheet' (cell-editable sheet) | 'edit' (shift editor). */
export const view = ref('sheet');

/** Status bar message. */
export const status = ref({ message: '', isError: false });

/** Open dialog: null | { type: 'shift', day, shift } | { type: 'cell', employeeId, day, shift }. */
export const dialog = ref(null);

/** Shows a message in the status bar (instead of alert()). */
export function setStatus(message, isError = false) {
  status.value = { message, isError };
}

// ---------- Language ----------

/** Active interface language ('es' | 'en'), taken from `settings.locale`. */
export const locale = computed(() => state.value.settings.locale ?? DEFAULT_LOCALE);

/**
 * Reactive translator of the active language: use it in components as `t('key', { parameter })`.
 * When the language changes, a new translator is created and the interface re-renders.
 */
export const t = computed(() => createTranslator(locale.value));

/** Long day name (0 = Monday) in the active language. */
export const translateDay = (dayIndex, localeId) => dayName(localeId ?? locale.value, dayIndex);

/** Short day name (0 = Monday) in the active language. */
export const translateDayShort = (dayIndex, localeId) => dayShort(localeId ?? locale.value, dayIndex);

/** Shift name in the active language. */
export const translateShift = (shiftKey, localeId) => shiftLabel(localeId ?? locale.value, shiftKey);

/** Changes the interface language and announces it in the status bar. */
export function setLocale(localeId) {
  if (!changeLocale(state.value, localeId)) return;
  setStatus(translate(localeId, 'status.language', {
    language: translate(localeId, `language.${localeId}`),
  }));
}

// ---------- Derived data ----------

const validation = computed(() => {
  const { settings, employees, overrides, assignments } = state.value;
  return validate(settings, employees, overrides, assignments);
});

export const warnings = computed(() => validation.value.warnings);
export const stats = computed(() => validation.value.stats);

/** Ids of assignments that break a rule. */
export const badIds = computed(() => badAssignmentIds(warnings.value));

/** Data needed by buildSheet(), shiftDetail() and cellDetail(). */
export const sheetInput = computed(() => {
  const { settings, employees, overrides, assignments } = state.value;
  return { settings, employees, overrides, assignments, badIds: badIds.value };
});

/** Sheet model (rows, columns, coverage and totals). */
export const sheetModel = computed(() => buildSheet({ ...sheetInput.value, stats: stats.value }));

// ---------- Persistence ----------

/** Every state change is saved in the browser; if it cannot be saved, the status bar warns about it. */
watch(
  state,
  () => {
    if (!saveState(state.value)) {
      setStatus(translate(locale.value, 'status.saveFailed'), true);
    }
  },
  { deep: true },
);

// ---------- Dialogs ----------

/** Opens the (read-only) popup with the details of a shift. */
export function openShiftPopup(day, shift) {
  dialog.value = { type: 'shift', day, shift };
}

/** Opens the editor for an employee's assignments in a shift. */
export function openCellEditor(employeeId, day, shift) {
  dialog.value = { type: 'cell', employeeId, day, shift };
}

export function closeDialog() {
  dialog.value = null;
}
