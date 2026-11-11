<script setup>
// Hours summary and schedule warning list (already validated in state.js).
import { computed } from 'vue';
import { isErrorWarning } from '../domain/scheduler.js';
import { state, stats, t, warnings } from '../state.js';

const summary = computed(() => t.value('results.summary', {
  assigned: stats.value.totalAssigned,
  absence: stats.value.absenceHours,
  planned: stats.value.plannedHours,
  cap: stats.value.cap,
  contract: stats.value.totalContract,
}));
</script>

<template>
  <div>
    <p class="summary" :class="{ error: stats.exceedsCap }">{{ summary }}</p>
  </div>
  <div>
    <template v-if="state.employees.length > 0">
      <p v-if="warnings.length === 0" class="ok">{{ t('results.noWarnings') }}</p>
      <template v-else>
        <h3>{{ t('results.warnings', { count: warnings.length }) }}</h3>
        <ul class="warnings">
          <li v-for="(warning, index) in warnings" :key="index" :class="isErrorWarning(warning) ? 'error' : 'warn'">
            {{ warning.message }}
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>
