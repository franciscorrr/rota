<script setup>
// Edit view cell (a day and a shift): day minimum staff, coverage, button to
// generate the shift, assigned people and form to add someone.
import { computed, ref, watch } from 'vue';
import { addAssignment, generateForShift, removeAssignment, setDayMinimum } from '../domain/actions.js';
import { categoryList, categoryOf, requiredByCategory, unavailabilityReason } from '../domain/scheduler.js';
import { shiftDetail } from '../domain/sheet.js';
import { setStatus, sheetInput, state, t } from '../state.js';
import NumberInput from './NumberInput.vue';

const props = defineProps({
  day: { type: String, required: true },
  shiftKey: { type: String, required: true },
});

const UNAVAILABLE_NOTES = { absent: 'edit.absentNote', blocked: 'edit.blockedNote' };

const settings = computed(() => state.value.settings);
const shift = computed(() => settings.value.shifts[props.shiftKey]);
const detail = computed(() => shiftDetail(sheetInput.value, props.day, props.shiftKey));
const categories = computed(() => categoryList(settings.value));
const need = computed(() => requiredByCategory(settings.value, state.value.overrides, props.day, props.shiftKey));

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

/** Text of the selector option: name, category and, if they cannot be assigned, the reason. */
function employeeLabel(employee) {
  const noteKey = UNAVAILABLE_NOTES[unavailableReason(employee)];
  const note = noteKey ? t.value(noteKey) : '';
  return `${employee.name} · ${categoryOf(employee, settings.value)?.name ?? ''}${note}`;
}

function add() {
  if (!employeeId.value) {
    setStatus(t.value('status.chooseEmployee'), true);
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
    setStatus(result.error, true);
    return;
  }
  setStatus('');
  resetForm();
}

function generate() {
  const { message, isError } = generateForShift(state.value, props.day, props.shiftKey);
  setStatus(message, isError);
}
</script>

<template>
  <td>
    <div class="cell-head no-print">
      <div class="mins">
        <label
          v-for="category in categories"
          :key="category.id"
          :title="t('edit.minimumOf', { name: category.name, rank: category.rank })"
        >
          {{ category.name.slice(0, 3) }}
          <NumberInput
            class="narrow tiny"
            :model-value="need[category.id]"
            integer
            :aria-label="t('edit.minimumAria', { name: category.name })"
            @update:model-value="setDayMinimum(state, day, shiftKey, category.id, $event)"
          />
        </label>
      </div>
      <span :class="{ error: detail.status === 'under' }">{{ detail.covered }}/{{ detail.required }}</span>
      <button
        type="button"
        class="gen-shift"
        :title="t('edit.generateShiftTitle')"
        @click="generate"
      >
        {{ t('edit.generateShift') }}
      </button>
    </div>

    <ul class="assigned">
      <li v-for="assignment in detail.assignments" :key="assignment.id" :class="{ bad: assignment.bad }">
        <span>{{ assignment.name }} {{ assignment.start }}–{{ assignment.end }}</span>
        <button
          type="button"
          class="icon no-print"
          :aria-label="t('edit.removeAria', { name: assignment.name })"
          @click="removeAssignment(state, assignment.id)"
        >
          ×
        </button>
      </li>
    </ul>

    <div class="add no-print">
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
      <button type="button" @click="add">{{ t('edit.add') }}</button>
    </div>
  </td>
</template>
