<script setup>
// Hours per employee table: contract, absences, target and assigned.
import { state, stats, t } from '../state.js';

const HEADERS = ['hours.employee', 'hours.contract', 'hours.absences', 'hours.target', 'hours.assigned', 'hours.days'];
</script>

<template>
  <template v-if="state.employees.length > 0">
    <h3>{{ t('hours.title') }}</h3>
    <div class="overflow-auto">
      <table>
        <thead>
          <tr><th v-for="header in HEADERS" :key="header">{{ t(header) }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="employee in stats.employees" :key="employee.id">
            <td>{{ employee.name }}</td>
            <td>{{ employee.contract }} h</td>
            <td>{{ employee.absenceHours }} h</td>
            <td>{{ employee.target }} h</td>
            <td :class="{ warn: employee.status !== 'ok' }">{{ employee.assigned }} h</td>
            <td>{{ employee.workDays }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
