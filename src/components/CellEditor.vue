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
    <h3 id="cell-editor-title">{{ detail.title }}</h3>
    <p class="hint">{{ shiftRange }}</p>

    <ul v-if="rows.length > 0" class="popup-list edit-list">
      <li v-for="row in rows" :key="row.id" :class="{ bad: row.bad }">
        <input v-model="row.start" type="time" :aria-label="t('cellEditor.startAria')" class="time" />
        –
        <input v-model="row.end" type="time" :aria-label="t('cellEditor.endAria')" class="time" />
        <AssignmentBadges :bad="row.bad" :break-minutes="row.breakMinutes" />
        <button type="button" class="danger" @click="remove(row.id)">{{ t('cellEditor.remove') }}</button>
      </li>
    </ul>
    <template v-else-if="detail.canAdd">
      <p class="hint">{{ t('cellEditor.emptyHint') }}</p>
      <p class="edit-list">
        <input v-model="newStart" type="time" :aria-label="t('cellEditor.startAria')" class="time" />
        –
        <input v-model="newEnd" type="time" :aria-label="t('cellEditor.endAria')" class="time" />
      </p>
    </template>
    <p v-else class="hint">{{ cannotAssignReason }}</p>

    <p class="popup-error" role="alert">{{ error }}</p>
    <div class="popup-actions">
      <button v-if="rows.length > 0" type="button" @click="saveChanges">{{ t('cellEditor.save') }}</button>
      <button v-else-if="detail.canAdd" type="button" @click="addNew">{{ t('cellEditor.add') }}</button>
      <button type="button" @click="closeDialog">{{ t('cellEditor.cancel') }}</button>
    </div>
  </DialogBox>
</template>
