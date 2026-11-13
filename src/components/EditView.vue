<script setup>
// Edit view: one cell per day and shift, each with a ShiftEditor.
import { computed } from 'vue';
import { SHIFT_KEYS, openDayList } from '../domain/scheduler.js';
import { daysBetween } from '../domain/time.js';
import { state, t, translateDay, translateShift } from '../state.js';
import ShiftEditor from './ShiftEditor.vue';

const settings = computed(() => state.value.settings);
const days = computed(() => openDayList(settings.value));
</script>

<template>
  <p v-if="days.length === 0" class="hint">{{ t('sheet.noOpenDays') }}</p>
  <div v-else class="overflow-auto">
    <table>
      <thead>
        <tr>
          <th>{{ t('edit.day') }}</th>
          <th v-for="shiftKey in SHIFT_KEYS" :key="shiftKey">
            {{ translateShift(shiftKey) }} {{ settings.shifts[shiftKey].start }}–{{ settings.shifts[shiftKey].end }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="day in days" :key="day">
          <th scope="row">{{ translateDay(daysBetween(settings.weekStart, day)) }} <small>{{ day }}</small></th>
          <td v-for="shiftKey in SHIFT_KEYS" :key="shiftKey">
            <ShiftEditor :day="day" :shift-key="shiftKey" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
td {
  min-width: 24rem;
}
</style>
