<script setup>
// 'leaders' coverage mode: people a shift needs (every day) and how many of them are shift leaders.
import { computed } from 'vue';
import { setShiftStaffing } from '../domain/actions.js';
import { state, t } from '../state.js';
import NumberInput from './NumberInput.vue';

const props = defineProps({ shiftKey: { type: String, required: true } });

const settings = computed(() => state.value.settings);
const shift = computed(() => settings.value.shifts[props.shiftKey]);
</script>

<template>
  <p>{{ t('config.minimumStaff') }}</p>
  <label>
    <NumberInput
      class="narrow"
      :model-value="shift.headcount ?? 0"
      integer
      @update:model-value="setShiftStaffing(settings, shiftKey, 'headcount', $event)"
    />
    {{ t('config.headcount') }}
  </label>
  <label>
    <NumberInput
      class="narrow"
      :model-value="shift.leaders ?? 0"
      integer
      @update:model-value="setShiftStaffing(settings, shiftKey, 'leaders', $event)"
    />
    {{ t('config.leaders') }}
  </label>
  <small>{{ t('config.leadersHint') }}</small>
</template>
