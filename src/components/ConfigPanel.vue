<script setup>
// Settings: language, week, limits, opening days, employee categories and shifts.
import { computed } from 'vue';
import {
  addCategory,
  changeWeek,
  removeCategory,
  rename,
  setCoverageMode,
  setShiftTime,
} from '../domain/actions.js';
import { COVERAGE_MODES, categoryList, coverageMode, requiresCategories } from '../domain/coverage.js';
import { localeOptions } from '../domain/i18n.js';
import { SHIFT_KEYS } from '../domain/scheduler.js';
import { locale, setLocale, setStatus, state, t, translateDay, translateShift } from '../state.js';
import NumberInput from './NumberInput.vue';
import ShiftMinimumsByCategory from './ShiftMinimumsByCategory.vue';
import ShiftMinimumsByLeaders from './ShiftMinimumsByLeaders.vue';

const COVERAGE_MODE_LABELS = {
  categories: 'config.coverageModeCategories',
  leaders: 'config.coverageModeLeaders',
};

// One component per coverage mode for the minimum staff of a shift.
const SHIFT_MINIMUMS = { categories: ShiftMinimumsByCategory, leaders: ShiftMinimumsByLeaders };

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
const mode = computed(() => coverageMode(settings.value));
const categoriesRequired = computed(() => requiresCategories(settings.value));
const canDeleteCategory = computed(() => !categoriesRequired.value || settings.value.categories.length > 1);
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
  <fieldset>
    <legend>{{ t('config.general') }}</legend>
    <div class="grid">
      <label>
        {{ t('language.label') }}
        <select :value="locale" @change="setLocale($event.target.value)">
          <option v-for="language in languages" :key="language.id" :value="language.id">{{ language.name }}</option>
        </select>
      </label>
      <label>
        {{ t('config.week') }}
        <input type="date" :value="settings.weekStart" @change="onWeekChange" />
        <small>{{ t('config.weekHint') }}</small>
      </label>
      <label v-for="field in NUMBER_FIELDS" :key="field.key">
        {{ t(field.label) }}
        <NumberInput
          v-model="settings[field.key]"
          :min="field.min"
          :step="field.step"
          :integer="field.integer"
        />
        <small v-if="field.hint">{{ t(field.hint) }}</small>
      </label>
    </div>
  </fieldset>

  <fieldset>
    <label>
      <input v-model="settings.breaks.enabled" type="checkbox" />
      {{ t('config.breaks') }}
    </label>
    <p><small>{{ t('config.breaksHint') }}</small></p>
    <div class="grid">
      <label>
        {{ t('config.breaksAfterHours') }}
        <NumberInput v-model="settings.breaks.afterHours" :min="0.5" :step="0.5" :disabled="!settings.breaks.enabled" />
      </label>
      <label>
        {{ t('config.breaksMinutes') }}
        <NumberInput
          v-model="settings.breaks.minutes"
          :min="0"
          :step="5"
          :integer="true"
          :disabled="!settings.breaks.enabled"
        />
      </label>
    </div>
  </fieldset>

  <fieldset>
    <legend>{{ t('config.openDays') }}</legend>
    <div class="row days">
      <label v-for="dayIndex in 7" :key="dayIndex - 1">
        <input v-model="settings.openDays" type="checkbox" :value="dayIndex - 1" />
        {{ translateDay(dayIndex - 1) }}
      </label>
    </div>
  </fieldset>

  <fieldset class="coverage-mode">
    <legend>{{ t('config.coverageMode') }}</legend>
    <div class="row">
      <label v-for="coverageModeId in COVERAGE_MODES" :key="coverageModeId">
        <input
          type="radio"
          name="coverage-mode"
          :value="coverageModeId"
          :checked="mode === coverageModeId"
          @change="setCoverageMode(settings, coverageModeId)"
        />
        {{ t(COVERAGE_MODE_LABELS[coverageModeId]) }}
      </label>
    </div>
    <p><small>{{ t('config.coverageModeHint') }}</small></p>
  </fieldset>

  <fieldset class="categories">
    <legend>{{ t('config.categories') }}</legend>
    <p><small>{{ t(categoriesRequired ? 'config.categoriesHint' : 'config.categoriesHintLeaders') }}</small></p>
    <p v-if="categories.length === 0" class="hint">
      {{ t(categoriesRequired ? 'config.categoriesEmpty' : 'config.categoriesEmptyLeaders') }}
    </p>
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
              class="small danger"
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
    <button type="button" class="secondary" @click="addCategory(settings)">{{ t('config.addCategory') }}</button>
  </fieldset>

  <div class="grid">
    <fieldset v-for="shiftKey in SHIFT_KEYS" :key="shiftKey">
      <legend>{{ translateShift(shiftKey) }}</legend>
      <label>
        {{ t('config.shiftStart') }}
        <input
          type="time"
          :value="settings.shifts[shiftKey].start"
          @change="onShiftTimeChange(settings.shifts[shiftKey], 'start', $event)"
        />
      </label>
      <label>
        {{ t('config.shiftEnd') }}
        <input
          type="time"
          :value="settings.shifts[shiftKey].end"
          @change="onShiftTimeChange(settings.shifts[shiftKey], 'end', $event)"
        />
      </label>
      <component :is="SHIFT_MINIMUMS[mode]" :shift-key="shiftKey" />
    </fieldset>
  </div>
</template>
