<script setup>
// 'categories' coverage mode: minimum staff of one day and shift for each category (day template).
import { computed } from 'vue';
import { setDayMinimum } from '../domain/actions.js';
import { categoryList, requiredByCategory } from '../domain/coverage.js';
import { state, t } from '../state.js';
import NumberInput from './NumberInput.vue';

const props = defineProps({
  day: { type: String, required: true },
  shiftKey: { type: String, required: true },
});

const settings = computed(() => state.value.settings);
const categories = computed(() => categoryList(settings.value));
const need = computed(() => requiredByCategory(settings.value, state.value.overrides, props.day, props.shiftKey));
</script>

<template>
  <label
    v-for="category in categories"
    :key="category.id"
    :title="t('edit.minimumOf', { name: category.name, rank: category.rank })"
  >
    {{ category.name.slice(0, 3) }}
    <NumberInput
      class="narrow"
      :model-value="need[category.id]"
      integer
      :aria-label="t('edit.minimumAria', { name: category.name })"
      @update:model-value="setDayMinimum(state, day, shiftKey, category.id, $event)"
    />
  </label>
</template>
