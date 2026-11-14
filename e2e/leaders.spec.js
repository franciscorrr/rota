import { employeeRows, expect, generateButtons, openApp, openDialog, openWithExample, test } from './fixtures.js';

const LEADERS_MODE = 'Personas y responsables de turno';
const CATEGORIES_MODE = 'Por categorías';
const CAN_LEAD = /puede ser responsable de turno/;

/** Sets the people and shift leaders a shift needs (config panel, every day). */
async function setShiftStaffing(page, shiftName, { headcount, leaders }) {
  const shift = page.getByRole('group', { name: shiftName });
  const people = shift.getByLabel('Personas', { exact: true });
  await people.fill(String(headcount));
  await people.dispatchEvent('change');
  const lead = shift.getByLabel('Responsables de turno', { exact: true });
  await lead.fill(String(leaders));
  await lead.dispatchEvent('change');
}

test('leaders mode: configure people and leaders, flag employees and generate a schedule with a leader per shift', async ({ page }) => {
  await openWithExample(page);
  await expect(page.getByRole('radio', { name: CATEGORIES_MODE })).toBeChecked();
  await expect(page.getByRole('columnheader', { name: 'Responsable de turno' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: CAN_LEAD })).toHaveCount(0);

  await page.getByRole('radio', { name: LEADERS_MODE }).check();
  await setShiftStaffing(page, 'Mañana', { headcount: 2, leaders: 1 });
  await setShiftStaffing(page, 'Tarde', { headcount: 2, leaders: 1 });

  await expect(page.getByRole('columnheader', { name: 'Responsable de turno' })).toBeVisible();
  const flags = page.getByRole('checkbox', { name: CAN_LEAD });
  await expect(flags).toHaveCount(10);
  const markedBefore = await page.getByRole('checkbox', { name: CAN_LEAD, checked: true }).count();
  expect(markedBefore, 'the example marks some employees as shift leaders').toBeGreaterThan(0);
  await expect(page.locator('table.sheet th.name .lead-mark')).toHaveCount(markedBefore);
  await page.getByRole('checkbox', { name: CAN_LEAD, checked: false }).first().check();
  await expect(page.locator('table.sheet th.name .lead-mark')).toHaveCount(markedBefore + 1);

  await generateButtons(page).first().click();
  await expect(page.locator('td.cell.work').first()).toBeVisible();
  await expect(page.getByText(/falta cubrir/)).toHaveCount(0);

  // The coverage row counts people (2 per shift) and no shift is short.
  await expect(page.locator('.sheet tfoot td.cover').first()).toContainText('2/2');
  await expect(page.locator('.sheet tfoot td.cover.under')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('radio', { name: LEADERS_MODE })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: CAN_LEAD }).first()).toBeChecked();
});

test('leaders mode: with nobody flagged the missing leader is reported', async ({ page }) => {
  await openWithExample(page);
  await page.getByRole('radio', { name: LEADERS_MODE }).check();
  // The example already marks some employees as shift leaders: clear them.
  const marked = page.getByRole('checkbox', { name: CAN_LEAD, checked: true });
  expect(await marked.count()).toBeGreaterThan(0);
  while (await marked.count() > 0) await marked.first().uncheck();
  await setShiftStaffing(page, 'Mañana', { headcount: 2, leaders: 1 });
  await setShiftStaffing(page, 'Tarde', { headcount: 2, leaders: 1 });

  await generateButtons(page).first().click();
  await expect(page.getByText(/falta cubrir 1 responsable de turno/).first()).toBeVisible();
  await expect(page.getByText(/solo hay 0 empleado\(s\) marcado\(s\) como responsable de turno/)).toBeVisible();
});

test('switching modes keeps each mode configuration', async ({ page }) => {
  await openWithExample(page);
  const morning = page.getByRole('group', { name: 'Mañana' });
  const categoryInputs = morning.locator('input[type=number]');
  const before = await categoryInputs.evaluateAll((inputs) => inputs.map((input) => input.value));
  expect(before.length).toBeGreaterThan(0);

  await page.getByRole('radio', { name: LEADERS_MODE }).check();
  await expect(morning.getByLabel('Responsables de turno', { exact: true })).toBeVisible();
  await setShiftStaffing(page, 'Mañana', { headcount: 5, leaders: 2 });

  await page.getByRole('radio', { name: CATEGORIES_MODE }).check();
  await expect(morning.getByLabel('Responsables de turno', { exact: true })).toHaveCount(0);
  expect(await categoryInputs.evaluateAll((inputs) => inputs.map((input) => input.value))).toEqual(before);

  await page.getByRole('radio', { name: LEADERS_MODE }).check();
  await expect(morning.getByLabel('Personas', { exact: true })).toHaveValue('5');
  await expect(morning.getByLabel('Responsables de turno', { exact: true })).toHaveValue('2');
});

test('leaders mode: the shift popup changes the people and leaders of that day only', async ({ page }) => {
  await openWithExample(page);
  await page.getByRole('radio', { name: LEADERS_MODE }).check();
  await setShiftStaffing(page, 'Mañana', { headcount: 3, leaders: 1 });

  await page.locator('.shift-head').first().click();
  const popup = openDialog(page);
  await expect(popup).toContainText('Cobertura: 0/3');
  await expect(popup.locator('.mins input')).toHaveCount(2);

  const people = popup.getByLabel('Personas mínimas');
  await people.fill('4');
  await people.dispatchEvent('change');
  await expect(popup).toContainText('Cobertura: 0/4');
  await expect(popup).toContainText('falta 1 responsable de turno y 3 personal');
  await page.keyboard.press('Escape');

  // Only that day changed: the next morning column still asks for 3.
  await page.locator('.shift-head').nth(2).click();
  await expect(openDialog(page)).toContainText('Cobertura: 0/3');
});

test('leaders mode: employees can be added without categories and flagged as leaders', async ({ page }) => {
  await openApp(page);
  const add = page.getByRole('button', { name: 'Añadir empleado' });
  await expect(add).toBeDisabled();

  await page.getByRole('radio', { name: LEADERS_MODE }).check();
  await expect(add).toBeEnabled();
  await add.click();
  await expect(employeeRows(page)).toHaveCount(1);
  await expect(employeeRows(page).first().getByRole('combobox').first()).toContainText('Sin categoría');

  const flag = employeeRows(page).first().getByRole('checkbox', { name: CAN_LEAD });
  await flag.check();
  await expect(page.locator('table.sheet th.name .lead-mark')).toHaveCount(1);

  // The cell editor reads well without a category and marks the shift leader.
  await page.locator('td.cell').first().click();
  const editor = openDialog(page);
  await expect(editor.locator('.hint').first()).toHaveText(/^\s*Turno completo 09:00–15:00/);
  await expect(editor.getByRole('img', { name: 'Puede ser responsable de turno' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('radio', { name: CATEGORIES_MODE }).check();
  await expect(page.locator('table.sheet th.name .lead-mark')).toHaveCount(0);
  await expect(add).toBeDisabled();
});
