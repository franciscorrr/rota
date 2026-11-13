<script setup>
// Sheet view: spreadsheet-style table (employees in rows, shifts in columns) editable by cell.
// It is an accessible grid (`role="grid"`): a single cell with tabindex="0" (roving tabindex) and
// arrow, Home and End navigation. The coverage row is row index `rows.length`.
import { computed, ref } from 'vue';
import { movedPosition } from '../domain/navigation.js';
import { describeCell, formatDiff } from '../domain/sheet.js';
import { openCellEditor, openShiftPopup, sheetModel as model, state, t } from '../state.js';

const TOTAL_HEADERS = ['sheet.contract', 'sheet.target', 'sheet.assigned', 'sheet.diff'];

const LEGEND = [
  { swatch: 'work', key: 'sheet.legendWork' },
  { swatch: 'absent', key: 'sheet.legendAbsent' },
  { swatch: 'blocked', key: 'sheet.legendBlocked' },
  { swatch: 'break', key: 'sheet.legendBreak' },
  { swatch: 'bad', key: 'sheet.legendBad' },
];

const table = ref(null);
const selected = ref({ r: 0, c: 0 });

const coverageRow = computed(() => model.value.rows.length);
const lastColumn = computed(() => model.value.columns.length - 1);

/** Selected cell; if the table has shrunk, it moves towards the edge. */
const position = computed(() => ({
  r: Math.min(selected.value.r, coverageRow.value),
  c: Math.min(selected.value.c, lastColumn.value),
}));

function cellClasses(cell) {
  return ['cell', cell.kind, { bad: cell.bad }];
}

/** Common attributes of the navigable cells (employee and coverage). */
function cellAttrs(rowIndex, columnIndex) {
  const isSelected = rowIndex === position.value.r && columnIndex === position.value.c;
  return { 'data-r': rowIndex, 'data-c': columnIndex, tabindex: isSelected ? 0 : -1 };
}

/** Opens the cell editor (employee + shift) or, on the coverage row, the shift details. */
function openCell(rowIndex, columnIndex) {
  const column = model.value.columns[columnIndex];
  if (!column) return;

  if (rowIndex === coverageRow.value) {
    openShiftPopup(column.day, column.shift);
    return;
  }
  const row = model.value.rows[rowIndex];
  if (row) openCellEditor(row.id, column.day, column.shift);
}

function focusCell({ r, c }) {
  table.value.querySelector(`td[data-r="${r}"][data-c="${c}"]`)?.focus();
}

function onKeydown(event) {
  const cell = event.target.closest('td[data-r]');
  if (!cell) return;
  const current = { r: Number(cell.dataset.r), c: Number(cell.dataset.c) };

  if (event.key === 'Enter' || event.key === 'F2') {
    event.preventDefault();
    openCell(current.r, current.c);
    return;
  }
  const target = movedPosition(event.key, current, { lastRow: coverageRow.value, lastColumn: lastColumn.value });
  if (!target) return;
  event.preventDefault();
  focusCell(target);
}
</script>

<template>
  <p v-if="state.employees.length === 0" class="hint">{{ t('sheet.addEmployees') }}</p>
  <p v-else-if="model.columns.length === 0" class="hint">{{ t('sheet.noOpenDays') }}</p>
  <template v-else>
    <p class="hint no-print">{{ t('sheet.hint') }}</p>
    <p class="sheet-info no-print">{{ describeCell(model, position.r, position.c) }}</p>
    <div class="sheet-wrap">
      <table ref="table" class="sheet" role="grid" :aria-label="t('sheet.aria')" @keydown="onKeydown">
        <thead>
          <tr>
            <th class="corner" rowspan="2" scope="col">{{ t('sheet.employee') }}</th>
            <th v-for="group in model.dayGroups" :key="group.day" class="day" :colspan="group.span" scope="colgroup">
              {{ group.name }} <small>{{ group.date }}</small>
            </th>
            <th v-for="title in TOTAL_HEADERS" :key="title" class="total-head" rowspan="2" scope="col">
              {{ t(title) }}
            </th>
          </tr>
          <tr>
            <th v-for="column in model.columns" :key="column.day + column.shift" class="shift" scope="col">
              <button
                type="button"
                class="shift-head"
                :title="t('sheet.detailTitle', { day: column.dayName, shift: column.shiftLabelLower })"
                aria-haspopup="dialog"
                @click="openShiftPopup(column.day, column.shift)"
              >
                <div>{{ column.shiftLabel }}</div>
                <small>{{ column.time }}</small>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in model.rows" :key="row.id">
            <th class="name" scope="row">{{ row.name }}<small>{{ row.category }}</small></th>
            <td
              v-for="(cell, columnIndex) in row.cells"
              :key="columnIndex"
              :class="cellClasses(cell)"
              v-bind="cellAttrs(rowIndex, columnIndex)"
              @click="openCell(rowIndex, columnIndex)"
              @focus="selected = { r: rowIndex, c: columnIndex }"
            >
              <div v-for="line in cell.lines" :key="line">{{ line }}</div>
              <div
                v-if="cell.breakMinutes > 0"
                class="break-mark"
                :title="t('sheet.badgeBreak', { minutes: cell.breakMinutes })"
              >☕ {{ t('sheet.breakMark', { minutes: cell.breakMinutes }) }}</div>
            </td>
            <td class="num">{{ row.contract }} h</td>
            <td class="num">{{ row.target }} h</td>
            <td class="num">{{ row.assigned }} h</td>
            <td class="num diff" :class="row.status">{{ formatDiff(row) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th class="name" scope="row">{{ t('sheet.coverageRow') }}</th>
            <td
              v-for="(coverage, columnIndex) in model.coverage"
              :key="columnIndex"
              class="cover"
              :class="coverage.status"
              v-bind="cellAttrs(coverageRow, columnIndex)"
              @click="openCell(coverageRow, columnIndex)"
              @focus="selected = { r: coverageRow, c: columnIndex }"
            >
              {{ coverage.covered }}/{{ coverage.required }}
              <small v-if="coverage.missingText" class="tag">
                {{ t('sheet.missingTag', { text: coverage.missingText }) }}
              </small>
            </td>
            <td class="num">{{ model.totals.contract }} h</td>
            <td class="num">{{ model.totals.target }} h</td>
            <td class="num">{{ model.totals.assigned }} h</td>
            <td class="num"></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="legend">
      <template v-for="item in LEGEND" :key="item.swatch">
        <span class="swatch" :class="item.swatch"></span>{{ t(item.key) }}
      </template>
    </p>
  </template>
</template>
