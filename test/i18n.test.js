import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOCALE,
  LOCALES,
  MESSAGES,
  createTranslator,
  dayName,
  dayShort,
  isLocale,
  localeOptions,
  shiftLabel,
  shiftLabelLower,
  translate,
} from '../src/domain/i18n.js';
import { validate } from '../src/domain/scheduler.js';
import { defaultState, normalizeState, parseImport } from '../src/domain/storage.js';
import { addEmployee, blockableShifts, describeShiftResult, generateForShift } from '../src/domain/actions.js';

const WEEK = '2026-11-16'; // Monday
const MON = '2026-11-16';

test('catalogs: Spanish and English have exactly the same keys', () => {
  const esKeys = Object.keys(MESSAGES.es).sort();
  const enKeys = Object.keys(MESSAGES.en).sort();
  assert.deepEqual(enKeys, esKeys);
  assert.deepEqual(LOCALES, ['es', 'en']);
  assert.equal(DEFAULT_LOCALE, 'es');
});

test('catalogs: no text is empty and placeholders match across languages', () => {
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [key, text] of Object.entries(MESSAGES.es)) {
    assert.ok(text.trim().length > 0, `empty text in es.${key}`);
    assert.deepEqual(placeholders(MESSAGES.en[key]), placeholders(text), `different placeholders in ${key}`);
  }
});

test('translate: interpolates parameters, falls back to Spanish and never breaks', () => {
  assert.equal(translate('es', 'app.title'), 'Rota');
  assert.equal(translate('en', 'app.title'), 'Rota');
  assert.equal(translate('en', 'results.warnings', { count: 3 }), 'Warnings (3)');
  assert.equal(translate('en', 'warning.daysOff', { name: 'Ana', days: 6, daysOff: 1, max: 5 }),
    'Ana works 6 days and does not respect the 1 day(s) off (max 5).');
  assert.equal(translate('fr', 'app.title'), 'Rota', 'unknown language = Spanish');
  assert.equal(translate('en', 'clave.que.no.existe'), 'clave.que.no.existe');
  assert.equal(translate('es', 'sheet.missingTag'), 'falta {text}', 'a placeholder without a value stays as is');
});

test('createTranslator, isLocale and localeOptions', () => {
  const t = createTranslator('en');
  assert.equal(t('view.sheet'), 'Sheet');
  assert.equal(isLocale('en'), true);
  assert.equal(isLocale('fr'), false);
  assert.deepEqual(localeOptions('es'), [{ id: 'es', name: 'Castellano' }, { id: 'en', name: 'English' }]);
  assert.deepEqual(localeOptions('en'), [{ id: 'es', name: 'Castellano' }, { id: 'en', name: 'English' }]);
});

test('days and shifts are translated', () => {
  assert.equal(dayName('es', 0), 'Lunes');
  assert.equal(dayName('en', 0), 'Monday');
  assert.equal(dayName('en', 6), 'Sunday');
  assert.equal(dayShort('es', 2), 'X');
  assert.equal(dayShort('en', 2), 'W');
  assert.equal(shiftLabel('es', 'afternoon'), 'Tarde');
  assert.equal(shiftLabel('en', 'afternoon'), 'Afternoon');
  assert.equal(shiftLabelLower('en', 'morning'), 'morning');
});

test('the new state starts in Spanish and normalizeState validates the language', () => {
  assert.equal(defaultState().settings.locale, 'es');
  assert.equal(normalizeState({}).settings.locale, 'es');
  assert.equal(normalizeState({ settings: { locale: 'en' } }).settings.locale, 'en');
  assert.equal(normalizeState({ settings: { locale: 'fr' } }).settings.locale, 'es', 'unsupported language');
});

test('warnings are generated in the language of the settings', () => {
  const state = normalizeState({
    settings: {
      weekStart: WEEK,
      locale: 'en',
      categories: [{ id: 'mozo', name: 'Mozo', rank: 1 }],
    },
  });
  addEmployee(state);
  state.employees[0].absences = [MON];
  state.assignments.push({
    id: 'a1', employeeId: state.employees[0].id, day: MON, shift: 'morning',
    start: '09:00', end: '15:00',
  });

  const { warnings } = validate(state.settings, state.employees, state.overrides, state.assignments);
  const absent = warnings.find((warning) => warning.type === 'absent');
  assert.equal(absent.message, 'Employee 1 is absent on monday but has a shift assigned.');

  state.settings.locale = 'es';
  const { warnings: spanish } = validate(state.settings, state.employees, state.overrides, state.assignments);
  assert.equal(spanish.find((warning) => warning.type === 'absent').message,
    'Employee 1 está ausente el lunes pero tiene turno asignado.');
});

test('actions translate names, blocks and messages', () => {
  const state = normalizeState({
    settings: {
      weekStart: WEEK,
      locale: 'en',
      categories: [{ id: 'mozo', name: 'Mozo', rank: 1 }],
      shifts: { morning: { required: { mozo: 1 } } },
    },
  });
  addEmployee(state);
  assert.equal(state.employees[0].name, 'Employee 1');
  assert.equal(blockableShifts(state.settings)[0].label, 'Monday morning');

  const result = generateForShift(state, MON, 'morning');
  assert.match(result.message, /^Monday morning: added /);
  assert.deepEqual(
    describeShiftResult('Monday morning', { added: [], missingText: '1 Stock assistant' }, [], 'en'),
    {
      message: 'Monday morning: nobody could be added. Missing 1 Stock assistant. '
        + 'Nobody else is eligible (absences, blocks, rest, days off or contracted hours).',
      isError: true,
    },
  );
});

test('import: the active language is kept unless the file specifies another one', () => {
  const file = JSON.stringify({ employees: [] });
  assert.equal(parseImport(file, 'en').settings.locale, 'en', 'no language in the file');
  assert.equal(parseImport(file).settings.locale, 'es', 'no active language, Spanish');
  assert.equal(parseImport(JSON.stringify({ settings: { locale: 'en' } })).settings.locale, 'en',
    'the file can bring its own language');
});

test('import: error messages are translated', () => {
  assert.throws(() => parseImport('no es json', 'en'), { message: 'The file is not valid JSON.' });
  assert.throws(() => parseImport('null', 'en'), { message: 'The file does not contain a valid schedule.' });
  assert.throws(() => parseImport('null'), { message: 'El archivo no contiene un horario válido.' });
});
