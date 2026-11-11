<script setup>
// Toolbar: generate, clear, print, export, import and reset.
import { clearAssignments, generateWeek } from '../domain/actions.js';
import { defaultState, exportJSON, parseImport } from '../domain/storage.js';
import { locale, setStatus, state, t } from '../state.js';

/** Downloads a text as a JSON file. */
function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in Firefox/Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Generates the schedule for the whole week (replaces the current one, with confirmation). */
function generateSchedule() {
  if (state.value.employees.length === 0) {
    setStatus(t.value('status.noEmployeesGenerate'), true);
    return;
  }
  const hasCurrentSchedule = state.value.assignments.length > 0;
  const confirmed = !hasCurrentSchedule || confirm(t.value('confirm.replaceSchedule'));
  if (!confirmed) return;

  if (!generateWeek(state.value)) {
    setStatus(t.value('warning.noCategories'), true);
    return;
  }
  setStatus(t.value('status.generated'));
}

/** Removes every assignment (with confirmation). */
function clearSchedule() {
  if (state.value.assignments.length === 0) return;
  if (!confirm(t.value('confirm.clearSchedule'))) return;

  clearAssignments(state.value);
  setStatus(t.value('status.cleared'));
}

function printPage() {
  window.print();
}

function exportSchedule() {
  const filename = t.value('toolbar.exportFilename', { week: state.value.settings.weekStart });
  download(`${filename}.json`, exportJSON(state.value));
  setStatus(t.value('status.exported'));
}

/** Reads the chosen file and replaces the state with its content. */
function importSchedule(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      state.value = parseImport(String(reader.result), locale.value);
      setStatus(t.value('status.imported', { name: file.name }));
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  reader.addEventListener('error', () => setStatus(t.value('status.readError'), true));
  reader.readAsText(file);
}

/** Deletes employees, settings and schedule (with confirmation), keeping the interface language. */
function resetAll() {
  if (!confirm(t.value('confirm.reset'))) return;

  state.value = defaultState(locale.value);
  setStatus(t.value('status.reset'));
}
</script>

<template>
  <div class="toolbar no-print">
    <button type="button" class="primary" @click="generateSchedule">{{ t('toolbar.generate') }}</button>
    <button type="button" @click="clearSchedule">{{ t('toolbar.clear') }}</button>
    <button type="button" @click="printPage">{{ t('toolbar.print') }}</button>
    <button type="button" @click="exportSchedule">{{ t('toolbar.export') }}</button>
    <label class="file-btn">
      {{ t('toolbar.import') }}
      <input type="file" accept="application/json,.json" hidden @change="importSchedule" />
    </label>
    <button type="button" class="danger" @click="resetAll">{{ t('toolbar.reset') }}</button>
  </div>
</template>
