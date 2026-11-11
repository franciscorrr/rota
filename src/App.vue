<script setup>
import { watchEffect } from 'vue';
import CellEditor from './components/CellEditor.vue';
import ConfigPanel from './components/ConfigPanel.vue';
import EditView from './components/EditView.vue';
import EmployeesTable from './components/EmployeesTable.vue';
import HoursTable from './components/HoursTable.vue';
import ResultsSummary from './components/ResultsSummary.vue';
import ShiftPopup from './components/ShiftPopup.vue';
import SheetView from './components/SheetView.vue';
import ToolbarButtons from './components/ToolbarButtons.vue';
import { dialog, locale, state, status, t, view } from './state.js';

/** Keeps the document language and the tab title in sync with the interface. */
watchEffect(() => {
  document.documentElement.lang = locale.value;
  document.title = t.value('app.title');
});

const VIEWS = [
  { id: 'sheet', label: 'view.sheet' },
  { id: 'edit', label: 'view.edit' },
];
</script>

<template>
  <header>
    <h1>{{ t('app.title') }}</h1>
    <p class="print-only">{{ t('app.week', { date: state.settings.weekStart }) }}</p>
  </header>

  <main>
    <ToolbarButtons />
    <p class="status no-print" :class="{ error: status.isError }" role="status" aria-live="polite">
      {{ status.message }}
    </p>

    <section id="config" class="no-print" aria-labelledby="h-config">
      <h2 id="h-config">{{ t('section.config') }}</h2>
      <ConfigPanel />
    </section>

    <section id="employees" class="no-print" aria-labelledby="h-emp">
      <h2 id="h-emp">{{ t('section.employees') }}</h2>
      <EmployeesTable />
    </section>

    <section id="results" :data-view="view" aria-labelledby="h-res">
      <h2 id="h-res">{{ t('section.schedule') }}</h2>
      <div class="tabs no-print" role="tablist" :aria-label="t('view.aria')">
        <button
          v-for="tab in VIEWS"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="view === tab.id"
          @click="view = tab.id"
        >
          {{ t(tab.label) }}
        </button>
      </div>
      <ResultsSummary />
      <div id="sheet"><SheetView /></div>
      <div id="grid"><EditView /></div>
      <div id="hours"><HoursTable /></div>
    </section>
  </main>

  <ShiftPopup v-if="dialog?.type === 'shift'" />
  <CellEditor v-else-if="dialog?.type === 'cell'" />
</template>
