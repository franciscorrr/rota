<script setup>
// Read-only popup with the details of a shift: coverage, minimum staff and assigned people.
import { computed, ref } from 'vue';
import { generateForShift } from '../domain/actions.js';
import { shiftDetail } from '../domain/sheet.js';
import { closeDialog, dialog, setStatus, sheetInput, state, t, view } from '../state.js';
import AssignmentBadges from './AssignmentBadges.vue';
import DialogBox from './DialogBox.vue';

const detail = computed(() => shiftDetail(sheetInput.value, dialog.value.day, dialog.value.shift));
const isCovered = computed(() => detail.value.status === 'ok');
const note = ref('');

const coverageText = computed(() => {
  let suffix = '';
  if (detail.value.missingText) suffix = t.value('shiftPopup.missingSuffix', { text: detail.value.missingText });
  else if (isCovered.value) suffix = t.value('shiftPopup.coveredSuffix');
  return t.value('shiftPopup.coverage', {
    covered: detail.value.covered,
    required: detail.value.required,
    suffix,
  });
});

/** Generates the shift and shows the result inside the popup, without leaving it. */
function generateThisShift() {
  const { message, isError } = generateForShift(state.value, detail.value.day, detail.value.shift);
  note.value = message;
  setStatus(message, isError);
}

function editInEditView() {
  closeDialog();
  view.value = 'edit';
}
</script>

<template>
  <DialogBox labelledby="shift-popup-title" @close="closeDialog">
    <h3 id="shift-popup-title">{{ detail.title }} <small>{{ detail.time }}</small></h3>
    <p class="popup-cover" :class="isCovered ? 'ok' : 'error'">{{ coverageText }}</p>
    <p v-if="note" class="popup-note" role="status">{{ note }}</p>

    <h4>{{ t('shiftPopup.minimumStaff') }}</h4>
    <p v-if="detail.categories.length === 0" class="hint">{{ t('shiftPopup.noMinimum') }}</p>
    <ul v-else class="popup-list">
      <li v-for="category in detail.categories" :key="category.name" :class="{ error: category.isShort }">
        {{ t('shiftPopup.categoryLine', { name: category.name, rank: category.rank, required: category.required }) }}
        <em v-if="category.overridden" class="badge">{{ t('shiftPopup.overridden') }}</em>
        <template v-if="category.isShort">{{ t('shiftPopup.short', { missing: category.missing }) }}</template>
      </li>
    </ul>

    <h4>{{ t('shiftPopup.assigned', { count: detail.assignments.length }) }}</h4>
    <p v-if="detail.assignments.length === 0" class="hint">{{ t('shiftPopup.nobody') }}</p>
    <ul v-else class="popup-list">
      <li v-for="assignment in detail.assignments" :key="assignment.id" :class="{ bad: assignment.bad }">
        {{ t(assignment.breakMinutes > 0 ? 'shiftPopup.assignmentLineBreak' : 'shiftPopup.assignmentLine', {
          minutes: assignment.breakMinutes,
          name: assignment.name,
          category: assignment.category,
          start: assignment.start,
          end: assignment.end,
          hours: assignment.hours,
        }) }}
        <AssignmentBadges :bad="assignment.bad" :break-minutes="assignment.breakMinutes" />
      </li>
    </ul>

    <div class="popup-actions">
      <button type="button" :title="t('shiftPopup.generateTitle')" @click="generateThisShift">
        {{ t('shiftPopup.generate') }}
      </button>
      <button type="button" @click="editInEditView">{{ t('shiftPopup.edit') }}</button>
      <button type="button" autofocus @click="closeDialog">{{ t('shiftPopup.close') }}</button>
    </div>
  </DialogBox>
</template>
