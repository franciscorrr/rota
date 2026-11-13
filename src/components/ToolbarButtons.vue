<script setup>
// Toolbar: generate, clear, print, export, import and reset.
import { ref } from 'vue';
import { clearAssignments } from '../domain/actions.js';
import { defaultState, exportJSON, parseImport } from '../domain/storage.js';
import { locale, setStatus, state, t } from '../state.js';
import GenerateButton from './GenerateButton.vue';

const fileInput = ref(null);

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
  <div class="row no-print">
    <GenerateButton />
    <button type="button" class="secondary" @click="clearSchedule">{{ t('toolbar.clear') }}</button>
    <button type="button" class="secondary" @click="printPage">{{ t('toolbar.print') }}</button>
    <button type="button" class="secondary" @click="exportSchedule">{{ t('toolbar.export') }}</button>
    <button type="button" class="secondary" @click="fileInput.click()">{{ t('toolbar.import') }}</button>
    <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="importSchedule" />
    <button type="button" class="danger" @click="resetAll">{{ t('toolbar.reset') }}</button>
  </div>
</template>
