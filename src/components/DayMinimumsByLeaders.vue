<script setup>
// 'leaders' coverage mode: people and shift leaders needed on one day and shift (day template).
import { computed } from 'vue';
import { setDayStaffing } from '../domain/actions.js';
import { shiftStaffing } from '../domain/coverage.js';
import { state, t } from '../state.js';
import NumberInput from './NumberInput.vue';

const props = defineProps({
  day: { type: String, required: true },
  shiftKey: { type: String, required: true },
});

const staffing = computed(() => shiftStaffing(state.value.settings, state.value.overrides, props.day, props.shiftKey));
</script>

<template>
  <label :title="t('edit.headcountTitle')">
    {{ t('edit.headcountShort') }}
    <NumberInput
      class="narrow"
      :model-value="staffing.headcount"
      integer
      :aria-label="t('edit.headcountAria')"
      @update:model-value="setDayStaffing(state, day, shiftKey, 'headcount', $event)"
    />
  </label>
  <label :title="t('edit.leadersTitle')">
    {{ t('edit.leadersShort') }}
    <NumberInput
      class="narrow"
      :model-value="staffing.leaders"
      integer
      :aria-label="t('edit.leadersAria')"
      @update:model-value="setDayStaffing(state, day, shiftKey, 'leaders', $event)"
    />
  </label>
</template>
