<script setup>
// Settings: language, week, limits, opening days, employee categories and shifts.
import { computed } from 'vue';
import {
  addCategory,
  changeWeek,
  removeCategory,
  rename,
  setShiftMinimum,
  setShiftTime,
} from '../domain/actions.js';
import { localeOptions } from '../domain/i18n.js';
import { SHIFT_KEYS, categoryList } from '../domain/scheduler.js';
import { locale, setLocale, setStatus, state, t, translateDay, translateShift } from '../state.js';
import NumberInput from './NumberInput.vue';

const NUMBER_FIELDS = [
  {
    key: 'weeklyCap',
    label: 'config.weeklyCap',
    min: 0,
    step: 1,
    hint: 'config.weeklyCapHint',
  },
  { key: 'minRestHours', label: 'config.minRestHours', min: 0, step: 0.5 },
  {
    key: 'daysOffPerEmployee',
    label: 'config.daysOff',
    min: 0,
    step: 1,
    integer: true,
    hint: 'config.daysOffHint',
  },
  {
    key: 'contractDaysPerWeek',
    label: 'config.contractDays',
    min: 1,
    step: 1,
    integer: true,
    hint: 'config.contractDaysHint',
  },
];

const settings = computed(() => state.value.settings);
const categories = computed(() => categoryList(settings.value));
const canDeleteCategory = computed(() => settings.value.categories.length > 1);
const languages = computed(() => localeOptions(locale.value));

/** Choosing a day snaps it to the Monday of that week and clears the schedule. */
function onWeekChange(event) {
  const monday = changeWeek(state.value, event.target.value);
  if (monday) setStatus(t.value('status.weekChanged', { monday }));
  event.target.value = settings.value.weekStart;
}

function onShiftTimeChange(shift, property, event) {
  if (!setShiftTime(shift, property, event.target.value)) event.target.value = shift[property];
}
</script>

<template>
  <label class="field language">
    <span>{{ t('language.label') }}</span>
    <select :value="locale" @change="setLocale($event.target.value)">
      <option v-for="language in languages" :key="language.id" :value="language.id">{{ language.name }}</option>
    </select>
  </label>

  <div class="grid-form">
    <label class="field">
      <span>{{ t('config.week') }}</span>
      <input type="date" :value="settings.weekStart" @change="onWeekChange" />
      <small>{{ t('config.weekHint') }}</small>
    </label>
    <label v-for="field in NUMBER_FIELDS" :key="field.key" class="field">
      <span>{{ t(field.label) }}</span>
      <NumberInput
        v-model="settings[field.key]"
        :min="field.min"
        :step="field.step"
        :integer="field.integer"
      />
      <small v-if="field.hint">{{ t(field.hint) }}</small>
    </label>
  </div>

  <div class="field">
    <span>{{ t('config.openDays') }}</span>
    <div class="days">
      <label v-for="dayIndex in 7" :key="dayIndex - 1" class="check">
        <input v-model="settings.openDays" type="checkbox" :value="dayIndex - 1" />
        {{ translateDay(dayIndex - 1) }}
      </label>
    </div>
  </div>

  <fieldset class="categories">
    <legend>{{ t('config.categories') }}</legend>
    <small>{{ t('config.categoriesHint') }}</small>
    <p v-if="categories.length === 0" class="hint">{{ t('config.categoriesEmpty') }}</p>
    <table>
      <thead>
        <tr><th>{{ t('config.category') }}</th><th>{{ t('config.rank') }}</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="category in categories" :key="category.id">
          <td>
            <input
              type="text"
              :value="category.name"
              :aria-label="t('config.categoryNameAria')"
              @change="$event.target.value = rename(category, $event.target.value)"
            />
          </td>
          <td>
            <NumberInput
              v-model="category.rank"
              class="narrow"
              :min="1"
              integer
              :aria-label="t('config.categoryRankAria', { name: category.name })"
            />
          </td>
          <td>
            <button
              type="button"
              class="danger"
              :disabled="!canDeleteCategory"
              :aria-label="t('config.deleteCategoryAria', { name: category.name })"
              @click="removeCategory(state, category.id)"
            >
              {{ t('config.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div><button type="button" @click="addCategory(settings)">{{ t('config.addCategory') }}</button></div>
  </fieldset>

  <div class="grid-form">
    <fieldset v-for="shiftKey in SHIFT_KEYS" :key="shiftKey">
      <legend>{{ translateShift(shiftKey) }}</legend>
      <label class="field">
        <span>{{ t('config.shiftStart') }}</span>
        <input
          type="time"
          :value="settings.shifts[shiftKey].start"
          @change="onShiftTimeChange(settings.shifts[shiftKey], 'start', $event)"
        />
      </label>
      <label class="field">
        <span>{{ t('config.shiftEnd') }}</span>
        <input
          type="time"
          :value="settings.shifts[shiftKey].end"
          @change="onShiftTimeChange(settings.shifts[shiftKey], 'end', $event)"
        />
      </label>
      <div class="field">
        <span>{{ t('config.minimumStaff') }}</span>
        <label v-for="category in categories" :key="category.id" class="check min-row">
          <NumberInput
            class="narrow"
            :model-value="settings.shifts[shiftKey].required?.[category.id] ?? 0"
            integer
            @update:model-value="setShiftMinimum(settings, shiftKey, category.id, $event)"
          />
          {{ t('config.categoryOption', { name: category.name, rank: category.rank }) }}
        </label>
        <small>{{ t('config.minimumStaffHint') }}</small>
      </div>
    </fieldset>
  </div>
</template>
