<script setup>
// Edit view: one cell per day and shift where the minimum staff is changed, people are removed or
// added and the shift is generated automatically.
import { computed } from 'vue';
import { SHIFT_KEYS, openDayList } from '../domain/scheduler.js';
import { daysBetween } from '../domain/time.js';
import { state, t, translateDay, translateShift } from '../state.js';
import EditCell from './EditCell.vue';

const settings = computed(() => state.value.settings);
const days = computed(() => openDayList(settings.value));
</script>

<template>
  <p v-if="days.length === 0" class="hint">{{ t('sheet.noOpenDays') }}</p>
  <div v-else class="table-wrap">
    <table class="schedule">
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
          <EditCell v-for="shiftKey in SHIFT_KEYS" :key="shiftKey" :day="day" :shift-key="shiftKey" />
        </tr>
      </tbody>
    </table>
  </div>
</template>
