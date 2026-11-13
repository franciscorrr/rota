<script setup>
// Employee table: name, category, contract, absences, blocked shifts and the end of the
// last shift of the previous week.
import { computed } from 'vue';
import {
  addCategory,
  addEmployee,
  blockShift,
  blockableShifts,
  isAbsentAllWeek,
  removeEmployee,
  rename,
  setAbsence,
  setAbsentAllWeek,
  unblockShift,
} from '../domain/actions.js';
import { categoryList, categoryOf } from '../domain/scheduler.js';
import { weekDays } from '../domain/time.js';
import { state, t, translateDay, translateDayShort } from '../state.js';
import NumberInput from './NumberInput.vue';

const TABLE_HEADERS = [
  'employees.name',
  'employees.category',
  'employees.contract',
  'employees.absences',
  'employees.blocked',
  'employees.prevWeek',
  '',
];

const settings = computed(() => state.value.settings);
const categories = computed(() => categoryList(settings.value));
const hasCategories = computed(() => categories.value.length > 0);
const blockOptions = computed(() => blockableShifts(settings.value));

/** The 7 ISO days of the week with their index, only the open ones. */
const openWeek = computed(() => weekDays(settings.value.weekStart)
  .map((day, dayIndex) => ({ day, dayIndex }))
  .filter(({ dayIndex }) => settings.value.openDays.includes(dayIndex)));
const openWeekDays = computed(() => openWeek.value.map(({ day }) => day));

function blockLabel(blockId) {
  return blockOptions.value.find((option) => option.id === blockId)?.label ?? blockId;
}

function freeBlockOptions(employee) {
  return blockOptions.value.filter((option) => !(employee.blockedShifts ?? []).includes(option.id));
}

function onBlockSelected(employee, event) {
  if (event.target.value) blockShift(employee, event.target.value);
  event.target.value = '';
}
</script>

<template>
  <p v-if="state.employees.length === 0" class="hint">{{ t('employees.empty') }}</p>
  <div v-else class="overflow-auto">
    <table>
      <thead>
        <tr><th v-for="header in TABLE_HEADERS" :key="header">{{ header ? t(header) : '' }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="employee in state.employees" :key="employee.id">
          <td>
            <input
              type="text"
              :value="employee.name"
              :aria-label="t('employees.nameAria')"
              @change="$event.target.value = rename(employee, $event.target.value)"
            />
          </td>
          <td>
            <select
              :aria-label="t('employees.categoryAria', { name: employee.name })"
              :value="categoryOf(employee, settings)?.id ?? ''"
              @change="employee.categoryId = $event.target.value"
            >
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ t('config.categoryOption', { name: category.name, rank: category.rank }) }}
              </option>
            </select>
          </td>
          <td>
            <NumberInput
              v-model="employee.contractHours"
              class="narrow"
              :step="0.5"
              :aria-label="t('employees.contractAria')"
            />
          </td>
          <td>
            <div class="row days">
              <label
                v-for="{ day, dayIndex } in openWeek"
                :key="day"
                :title="t('employees.dayTitle', { day: translateDay(dayIndex), date: day })"
              >
                <input
                  type="checkbox"
                  :checked="employee.absences.includes(day)"
                  @change="setAbsence(employee, day, $event.target.checked)"
                />
                {{ translateDayShort(dayIndex) }}
              </label>
              <button
                type="button"
                class="small secondary"
                :disabled="openWeekDays.length === 0"
                :title="isAbsentAllWeek(employee, openWeekDays)
                  ? t('employees.unmarkAllTitle')
                  : t('employees.markAllTitle')"
                @click="setAbsentAllWeek(employee, openWeekDays, !isAbsentAllWeek(employee, openWeekDays))"
              >
                {{ isAbsentAllWeek(employee, openWeekDays) ? t('employees.absentNone') : t('employees.absentAll') }}
              </button>
            </div>
          </td>
          <td>
            <div class="row blocks">
              <button
                v-for="blockId in employee.blockedShifts ?? []"
                :key="blockId"
                type="button"
                class="small outline secondary"
                :aria-label="t('employees.unblockAria', { shift: blockLabel(blockId) })"
                @click="unblockShift(employee, blockId)"
              >
                {{ blockLabel(blockId) }} ×
              </button>
              <select
                :aria-label="t('employees.blockAria', { name: employee.name })"
                :disabled="freeBlockOptions(employee).length === 0"
                @change="onBlockSelected(employee, $event)"
              >
                <option value="">{{ t('employees.addBlock') }}</option>
                <option v-for="option in freeBlockOptions(employee)" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
              </select>
            </div>
          </td>
          <td>
            <input
              v-model.lazy="employee.prevWeekLastShiftEnd"
              type="datetime-local"
              :aria-label="t('employees.prevWeekAria')"
            />
          </td>
          <td>
            <button
              type="button"
              class="small danger"
              :aria-label="t('employees.deleteAria', { name: employee.name })"
              @click="removeEmployee(state, employee.id)"
            >
              {{ t('employees.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-if="!hasCategories" class="warn">
    <p>{{ t('employees.needsCategory') }}</p>
    <button type="button" class="secondary" @click="addCategory(settings)">{{ t('employees.createCategory') }}</button>
  </div>
  <button
    type="button"
    :disabled="!hasCategories"
    :title="hasCategories ? '' : t('config.categoriesEmpty')"
    @click="addEmployee(state)"
  >
    {{ t('employees.add') }}
  </button>
</template>

<style scoped>
input[type='text'] {
  min-width: 10rem;
}
</style>
