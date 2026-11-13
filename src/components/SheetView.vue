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
          <!-- First header row: days -->
          <tr>
            <th class="corner" rowspan="2" scope="col">{{ t('sheet.employee') }}</th>
            <th v-for="group in model.dayGroups" :key="group.day" class="day" :colspan="group.span" scope="colgroup">
              {{ group.name }} <small>{{ group.date }}</small>
            </th>
            <th v-for="title in TOTAL_HEADERS" :key="title" class="total-head" rowspan="2" scope="col">
              {{ t(title) }}
            </th>
          </tr>
          <!-- Second header row: shifts -->
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
              <small v-if="cell.kind === 'work'" class="cell-hours">{{ t('sheet.cellHours', { hours: cell.hours }) }}</small>
              <span
                v-if="cell.breakMinutes > 0"
                class="break-mark"
                role="img"
                :aria-label="t('sheet.badgeBreak', { minutes: cell.breakMinutes })"
              >☕</span>
            </td>
            <td class="num">{{ row.contract }} h</td>
            <td class="num">{{ row.target }} h</td>
            <td class="num">{{ row.assigned }} h</td>
            <td class="num diff" :class="row.status">{{ formatDiff(row) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="hours-row">
            <th class="name" scope="row">{{ t('sheet.hoursRow') }}</th>
            <td v-for="(hours, columnIndex) in model.shiftHours" :key="columnIndex" class="shift-hours">
              {{ t('sheet.cellHours', { hours }) }}
            </td>
            <td colspan="4"></td>
          </tr>
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
    <p class="row legend">
      <template v-for="item in LEGEND" :key="item.swatch">
        <span class="swatch" :class="item.swatch"></span>{{ t(item.key) }}
      </template>
    </p>
  </template>
</template>

<style scoped>
.sheet-info {
  min-height: 2em;
  font-family: var(--pico-font-family-monospace);
}

.sheet-wrap {
  overflow: auto;
  max-height: 75vh;
  border: 1px solid var(--pico-muted-border-color);
  border-radius: var(--pico-border-radius);
}

.sheet,
.legend {
  --cell-bg: var(--pico-card-background-color);
  --head-bg: var(--pico-card-sectioning-background-color);
  --line: var(--pico-muted-border-color);
}

.sheet {
  /* Fits the available width: cells and type shrink, and long texts wrap onto two lines.
     Scroll only appears if it still does not fit. */
  width: 100%;
  margin: 0;
  border-collapse: separate;
  border-spacing: 0;
  font-variant-numeric: tabular-nums;
  font-size: clamp(0.66rem, 0.35rem + 0.55vw, 0.9rem);
}

.sheet th,
.sheet td {
  padding: 0.3em clamp(2px, 0.35vw, 8px);
  border: none;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  text-align: center;
  vertical-align: middle;
  background: var(--cell-bg);
}

/* Sticky header (two rows) and first column. */
.sheet thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 2.2em;
  background: var(--head-bg);
}

/* 2.2em of the first row, expressed in the font (0.9em) of these cells. */
.sheet thead tr:nth-child(2) th {
  top: calc(2.2em / 0.9);
}

.sheet th.name,
.sheet th.corner {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 5em;
  max-width: 11em;
  text-align: left;
  background: var(--head-bg);
}

.sheet th.corner {
  z-index: 3;
}

.sheet th small,
.sheet .tag {
  display: block;
  font-weight: 400;
  color: var(--pico-muted-color);
}

.sheet th.day {
  border-left: 2px solid var(--line);
  white-space: nowrap;
}

.sheet th.day small {
  display: inline;
}

.sheet th.shift,
.sheet th.total-head {
  font-size: 0.9em;
  line-height: 1.2;
}

/* The shift header is a button, shown as plain text. */
.shift-head {
  all: unset;
  display: block;
  width: 100%;
  cursor: pointer;
}

.shift-head:hover,
.shift-head:focus-visible {
  text-decoration: underline;
}

.sheet tfoot th,
.sheet tfoot td {
  border-top: 2px solid var(--line);
}

.sheet tfoot tr + tr th,
.sheet tfoot tr + tr td {
  border-top: none;
}

.sheet td.shift-hours {
  font-weight: 600;
}

/* Cells */
.sheet td.cell,
.sheet td.cover {
  line-height: 1.25;
  cursor: pointer;
}

.sheet td.cell:hover,
.sheet td.cover:hover,
.sheet td:focus {
  outline: 2px solid var(--pico-primary);
  outline-offset: -2px;
}

.sheet td.num {
  white-space: nowrap;
}

/* Net hours of the cell (breaks already subtracted). */
.sheet .cell-hours {
  display: block;
  font-weight: 600;
}

/* Discreet break icon in the corner: it is out of the flow, so it takes no space. */
.sheet td.cell {
  position: relative;
}

.sheet td.cell .break-mark {
  position: absolute;
  right: 2px;
  bottom: 1px;
  font-size: 0.7em;
  line-height: 1;
  opacity: 0.75;
}

.sheet td.work {
  background: var(--work-bg);
}

.sheet td.absent {
  background: repeating-linear-gradient(135deg, var(--line) 0 6px, var(--cell-bg) 6px 12px);
  color: var(--pico-muted-color);
  font-style: italic;
}

.sheet td.blocked {
  background: repeating-linear-gradient(45deg, var(--warn-bg) 0 6px, var(--cell-bg) 6px 12px);
  color: var(--warn);
  font-style: italic;
}

.sheet td.bad,
.sheet td.cover.under {
  background: var(--error-bg);
  color: var(--error);
  font-weight: 600;
}

.sheet td.cover.over {
  background: var(--warn-bg);
  color: var(--warn);
}

.sheet td.diff.under {
  color: var(--warn);
  font-weight: 600;
}

.sheet td.diff.over {
  color: var(--error);
  font-weight: 600;
}

.sheet td.diff.ok {
  color: var(--ok);
}

/* Legend */
.legend {
  color: var(--pico-muted-color);
}

.swatch {
  width: 1.1em;
  height: 1.1em;
  border: 1px solid var(--line);
  border-radius: 3px;
  font-size: 0.75em;
  line-height: 1.1em;
  text-align: center;
}

.swatch.work {
  background: var(--work-bg);
}

.swatch.absent {
  background: repeating-linear-gradient(135deg, var(--line) 0 4px, var(--cell-bg) 4px 8px);
}

.swatch.blocked {
  background: repeating-linear-gradient(45deg, var(--warn-bg) 0 4px, var(--cell-bg) 4px 8px);
}

.swatch.break {
  background: var(--work-bg);
}

.swatch.break::before {
  content: '☕';
}

.swatch.bad {
  background: var(--error-bg);
  border-color: var(--error);
}

@media print {
  .sheet-wrap {
    overflow: visible;
    max-height: none;
    border: none;
  }

  .sheet {
    font-size: 0.8rem;
  }
}
</style>
