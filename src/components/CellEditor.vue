<script setup>
// Editor for a sheet cell (employee + shift): add, change or remove their assignments.
import { computed, ref } from 'vue';
import { addAssignment, removeAssignment, updateAssignmentTimes } from '../domain/actions.js';
import { cellDetail } from '../domain/sheet.js';
import { closeDialog, dialog, sheetInput, state, t } from '../state.js';
import AssignmentBadges from './AssignmentBadges.vue';
import DialogBox from './DialogBox.vue';

// Data is read once when opening: the dialog closes after each change.
const { employeeId, day, shift } = dialog.value;
const detail = cellDetail(sheetInput.value, employeeId, day, shift);

const rows = ref(detail.assignments.map(({ id, start, end, bad, breakMinutes }) => ({
  id, start, end, bad, breakMinutes,
})));
const newStart = ref(detail.shiftStart);
const newEnd = ref(detail.shiftEnd);
const error = ref('');

const cannotAssignReason = computed(() => (
  detail.absent ? t.value('cellEditor.absentReason') : t.value('cellEditor.blockedReason')
));

const shiftRange = computed(() => t.value('cellEditor.fullShift', {
  category: detail.category,
  start: detail.shiftStart,
  end: detail.shiftEnd,
}));

/** Applies the result of an action: shows the error on failure; otherwise closes the dialog. */
function finish(result = { ok: true }) {
  if (!result.ok) {
    error.value = result.error;
    return;
  }
  closeDialog();
}

function saveChanges() {
  finish(updateAssignmentTimes(state.value, rows.value));
}

function addNew() {
  finish(addAssignment(state.value, { employeeId, day, shift, start: newStart.value, end: newEnd.value }));
}

function remove(assignmentId) {
  removeAssignment(state.value, assignmentId);
  finish();
}
</script>

<template>
  <DialogBox class="cell-editor" labelledby="cell-editor-title" @close="closeDialog">
    <header>
      <h3 id="cell-editor-title">{{ detail.title }}</h3>
    </header>
    <p class="hint">{{ shiftRange }}</p>

    <template v-if="rows.length > 0">
      <div v-for="row in rows" :key="row.id" class="row" :class="{ error: row.bad }">
        <input v-model="row.start" type="time" :aria-label="t('cellEditor.startAria')" class="time" />
        –
        <input v-model="row.end" type="time" :aria-label="t('cellEditor.endAria')" class="time" />
        <AssignmentBadges :bad="row.bad" :break-minutes="row.breakMinutes" />
        <button type="button" class="small danger" @click="remove(row.id)">{{ t('cellEditor.remove') }}</button>
      </div>
    </template>
    <template v-else-if="detail.canAdd">
      <p class="hint">{{ t('cellEditor.emptyHint') }}</p>
      <div class="row">
        <input v-model="newStart" type="time" :aria-label="t('cellEditor.startAria')" class="time" />
        –
        <input v-model="newEnd" type="time" :aria-label="t('cellEditor.endAria')" class="time" />
      </div>
    </template>
    <p v-else class="hint">{{ cannotAssignReason }}</p>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <footer>
      <button v-if="rows.length > 0" type="button" @click="saveChanges">{{ t('cellEditor.save') }}</button>
      <button v-else-if="detail.canAdd" type="button" @click="addNew">{{ t('cellEditor.add') }}</button>
      <button type="button" class="secondary" @click="closeDialog">{{ t('cellEditor.cancel') }}</button>
    </footer>
  </DialogBox>
</template>
