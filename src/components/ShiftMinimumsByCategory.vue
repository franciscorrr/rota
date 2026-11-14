<script setup>
// 'categories' coverage mode: minimum staff of a shift (every day) for each category.
import { computed } from 'vue';
import { setShiftMinimum } from '../domain/actions.js';
import { categoryList } from '../domain/coverage.js';
import { state, t } from '../state.js';
import NumberInput from './NumberInput.vue';

defineProps({ shiftKey: { type: String, required: true } });

const settings = computed(() => state.value.settings);
const categories = computed(() => categoryList(settings.value));
</script>

<template>
  <p>{{ t('config.minimumStaff') }}</p>
  <label v-for="category in categories" :key="category.id">
    <NumberInput
      class="narrow"
      :model-value="settings.shifts[shiftKey].required?.[category.id] ?? 0"
      integer
      @update:model-value="setShiftMinimum(settings, shiftKey, category.id, $event)"
    />
    {{ t('config.categoryOption', { name: category.name, rank: category.rank }) }}
  </label>
  <small>{{ t('config.minimumStaffHint') }}</small>
</template>
