<script setup>
// "Generate schedule" button. It appears in the toolbar and at the end of the page.
import { generateWeek } from '../domain/actions.js';
import { setStatus, state, t } from '../state.js';

/** Generates the schedule for the whole week (replaces the current one, with confirmation). */
function generateSchedule() {
  if (state.value.employees.length === 0) {
    setStatus(t.value('status.noEmployeesGenerate'), true);
    return;
  }
  const hasCurrentSchedule = state.value.assignments.length > 0;
  const confirmed = !hasCurrentSchedule || confirm(t.value('confirm.replaceSchedule'));
  if (!confirmed) return;

  if (!generateWeek(state.value)) {
    setStatus(t.value('warning.noCategories'), true);
    return;
  }
  setStatus(t.value('status.generated'));
}
</script>

<template>
  <button type="button" @click="generateSchedule">{{ t('toolbar.generate') }}</button>
</template>
