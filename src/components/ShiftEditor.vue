<script setup>
// Editor of one day and shift: day minimum staff, coverage, button to generate the shift, assigned
// people and form to add someone. Shared by the Edit view cells and the shift popup of the sheet.
import { computed, ref, watch } from 'vue';
import {
  addAssignment,
  generateForShift,
  removeAssignment,
  updateAssignmentTimes,
} from '../domain/actions.js';
import { categoryOf, coverageMode, tracksLeaders } from '../domain/coverage.js';
import { unavailabilityReason } from '../domain/scheduler.js';
import { shiftDetail } from '../domain/sheet.js';
import { setStatus, sheetInput, state, t } from '../state.js';
import DayMinimumsByCategory from './DayMinimumsByCategory.vue';
import DayMinimumsByLeaders from './DayMinimumsByLeaders.vue';

const props = defineProps({
  day: { type: String, required: true },
  shiftKey: { type: String, required: true },
});

// Every notice also goes to the status bar; `notice` lets a host (the popup) show it too, since a modal covers the bar.
const emit = defineEmits(['notice']);

const UNAVAILABLE_NOTES = { absent: 'edit.absentNote', blocked: 'edit.blockedNote' };

// One component per coverage mode for the minimum staff of this day and shift.
const DAY_MINIMUMS = { categories: DayMinimumsByCategory, leaders: DayMinimumsByLeaders };

const settings = computed(() => state.value.settings);
const shift = computed(() => settings.value.shifts[props.shiftKey]);
const detail = computed(() => shiftDetail(sheetInput.value, props.day, props.shiftKey));
const mode = computed(() => coverageMode(settings.value));

// Add form: the full shift by default.
const employeeId = ref('');
const start = ref(shift.value.start);
const end = ref(shift.value.end);
watch(() => [shift.value.start, shift.value.end], resetForm);

function resetForm() {
  employeeId.value = '';
  start.value = shift.value.start;
  end.value = shift.value.end;
}

function unavailableReason(employee) {
  return unavailabilityReason(employee, settings.value, props.day, props.shiftKey);
}

/** Text of the selector option: name, category, shift leader mark and, if they cannot be assigned, the reason. */
function employeeLabel(employee) {
  const noteKey = UNAVAILABLE_NOTES[unavailableReason(employee)];
  const note = noteKey ? t.value(noteKey) : '';
  const leaderMark = tracksLeaders(settings.value) && employee.canLeadShift ? t.value('edit.canLeadMark') : '';
  const parts = [employee.name, categoryOf(employee, settings.value)?.name, leaderMark];
  return `${parts.filter(Boolean).join(' · ')}${note}`;
}

function notify(message, isError = false) {
  setStatus(message, isError);
  emit('notice', { message, isError });
}

function add() {
  if (!employeeId.value) {
    notify(t.value('status.chooseEmployee'), true);
    return;
  }
  const result = addAssignment(state.value, {
    employeeId: employeeId.value,
    day: props.day,
    shift: props.shiftKey,
    start: start.value,
    end: end.value,
  });
  if (!result.ok) {
    notify(result.error, true);
    return;
  }
  notify('');
  resetForm();
}

/**
 * Applies a new start or end typed inline on an assigned person. If the range is invalid the state does not change,
 * so the input is restored by hand (Vue would not re-render it) and the error is shown.
 */
function changeTime(assignment, field, event) {
  const input = event.target;
  const edit = { id: assignment.id, start: assignment.start, end: assignment.end, [field]: input.value };
  const result = updateAssignmentTimes(state.value, [edit]);
  if (result.ok) {
    notify('');
    return;
  }
  input.value = assignment[field];
  notify(result.error, true);
}

function generate() {
  const { message, isError } = generateForShift(state.value, props.day, props.shiftKey);
  notify(message, isError);
}
</script>

<template>
  <div class="shift-editor">
    <div class="row cell-head no-print">
      <div class="row mins">
        <component :is="DAY_MINIMUMS[mode]" :day="day" :shift-key="shiftKey" />
      </div>
      <span :class="{ error: detail.status === 'under' }">{{ detail.covered }}/{{ detail.required }}</span>
      <button type="button" class="small secondary gen-shift" :title="t('edit.generateShiftTitle')" @click="generate">
        {{ t('edit.generateShift') }}
      </button>
    </div>

    <ul class="assigned">
      <li v-for="assignment in detail.assignments" :key="assignment.id" class="row" :class="{ error: assignment.bad }">
        <span>
          {{ assignment.name }}
          <small
            v-if="assignment.canLead"
            class="lead-mark"
            role="img"
            :title="t('sheet.canLeadTitle')"
            :aria-label="t('sheet.canLeadTitle')"
          >★</small>
        </span>
        <input
          :value="assignment.start"
          type="time"
          class="time"
          :aria-label="t('edit.startOfAria', { name: assignment.name })"
          @change="changeTime(assignment, 'start', $event)"
        />
        –
        <input
          :value="assignment.end"
          type="time"
          class="time"
          :aria-label="t('edit.endOfAria', { name: assignment.name })"
          @change="changeTime(assignment, 'end', $event)"
        />
        <button
          type="button"
          class="small danger no-print"
          :aria-label="t('edit.removeAria', { name: assignment.name })"
          @click="removeAssignment(state, assignment.id)"
        >
          ×
        </button>
        <small
          v-if="assignment.breakMinutes > 0"
          class="break-mark"
          :title="t('sheet.badgeBreak', { minutes: assignment.breakMinutes })"
        >☕ {{ t('sheet.breakMark', { minutes: assignment.breakMinutes }) }}</small>
      </li>
    </ul>

    <div class="row no-print">
      <select v-model="employeeId" :aria-label="t('edit.employeeAria')">
        <option value="">{{ t('edit.addEmployeeOption') }}</option>
        <option
          v-for="employee in state.employees"
          :key="employee.id"
          :value="employee.id"
          :disabled="unavailableReason(employee) !== null"
        >
          {{ employeeLabel(employee) }}
        </option>
      </select>
      <input v-model="start" type="time" :aria-label="t('cellEditor.startAria')" class="time" />
      <input v-model="end" type="time" :aria-label="t('cellEditor.endAria')" class="time" />
      <button type="button" class="secondary" @click="add">{{ t('edit.add') }}</button>
    </div>
  </div>
</template>

<style scoped>
.shift-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cell-head {
  justify-content: space-between;
}

.assigned li > span {
  margin-right: auto;
}
</style>
