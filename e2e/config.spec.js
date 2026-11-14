import { employeeRows, expect, openApp, openWithExample, openWithSchedule, test } from './fixtures.js';

test('on startup there are no categories: create one before adding employees', async ({ page }) => {
  await openApp(page);
  const rows = page.locator('fieldset.categories tbody tr');
  await expect(rows).toHaveCount(0);
  await expect(page.locator('fieldset.categories .hint')).toContainText('No hay categorías');

  const addEmployee = page.getByRole('button', { name: 'Añadir empleado' });
  await expect(addEmployee).toBeDisabled();
  const needsCategory = page.getByText('Antes de añadir empleados necesitas al menos una categoría');
  await expect(needsCategory).toBeVisible();

  await page.getByRole('button', { name: 'Añadir categoría' }).click();
  await expect(rows).toHaveCount(1);
  await expect(addEmployee).toBeEnabled();
  await expect(needsCategory).toBeHidden();

  await addEmployee.click();
  await expect(employeeRows(page)).toHaveCount(1);
});

test('adding and removing a category', async ({ page }) => {
  await openWithExample(page);
  const rows = page.locator('fieldset.categories tbody tr');
  await expect(rows).toHaveCount(3);

  await page.getByRole('button', { name: 'Añadir categoría' }).click();
  await expect(rows).toHaveCount(4);

  await rows.last().getByRole('button', { name: /Eliminar/ }).click();
  await expect(rows).toHaveCount(3);
});

test('opening Sunday reflects it in Edit, absences and blocks; closing it reverts it', async ({ page }) => {
  await openWithExample(page);
  const gridRows = page.locator('#grid tbody tr');
  const firstEmployee = employeeRows(page).first();
  const blockOptions = firstEmployee.locator('.blocks select option');
  const gridRowsBefore = await gridRows.count();
  const blockOptionsBefore = await blockOptions.count();
  const sunday = page.locator('#config .days input').nth(6);

  await sunday.check();
  await expect(gridRows).toHaveCount(gridRowsBefore + 1);
  await expect(firstEmployee.locator('.days label', { hasText: /^\s*D\s*$/ })).toHaveCount(1);
  await expect(firstEmployee.locator('.blocks select option', { hasText: 'Domingo' })).toHaveCount(2);
  await expect(blockOptions).toHaveCount(blockOptionsBefore + 2);

  await sunday.uncheck();
  await expect(gridRows).toHaveCount(gridRowsBefore);
  await expect(blockOptions).toHaveCount(blockOptionsBefore);
});

test('changing the week snaps it to Monday and clears the schedule', async ({ page }) => {
  await openWithSchedule(page);
  const week = page.locator('#config input[type=date]');

  await week.fill('2026-11-25'); // Wednesday
  await week.dispatchEvent('change');

  await expect(week).toHaveValue('2026-11-23');
  await expect(page.locator('td.cell.work')).toHaveCount(0);
  await expect(page.locator('.status')).toContainText('lunes 2026-11-23');
});

test('an invalid numeric value in the settings is restored', async ({ page }) => {
  await openWithExample(page);
  const cap = page.getByLabel('Límite semanal');
  const previous = await cap.inputValue();

  await cap.fill('');
  await cap.dispatchEvent('change');
  await expect(cap).toHaveValue(previous);
});

test('changing the language translates the interface and survives a reload', async ({ page }) => {
  await openWithSchedule(page);
  await page.getByLabel('Idioma').selectOption('en');

  await expect(page.getByRole('heading', { name: 'Rota' })).toBeVisible();
  await expect(page).toHaveTitle('Rota');
  expect(await page.locator('html').getAttribute('lang')).toBe('en');
  await expect(page.getByRole('button', { name: 'Generate schedule' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await expect(page.locator('.summary')).toContainText('Planned hours');
  await expect(page.locator('.sheet tfoot tr:last-child th')).toContainText('Coverage');
  await expect(page.locator('.status')).toContainText('Language changed to English');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Rota' })).toBeVisible();
  await expect(page.getByLabel('Language')).toHaveValue('en');
  await expect(page.locator('.warnings li').first()).not.toContainText('asignad');

  await page.getByLabel('Language').selectOption('es');
  await expect(page.getByRole('heading', { name: 'Rota' })).toBeVisible();
});

test('category names from the imported file are kept when the language changes', async ({ page }) => {
  await openWithExample(page);
  const categoryName = page.locator('fieldset.categories tbody tr').first().locator('input[type=text]');
  await expect(categoryName).toHaveValue('Manager');

  await page.getByLabel('Idioma').selectOption('en');
  await expect(categoryName).toHaveValue('Manager');

  await categoryName.fill('Boss');
  await categoryName.dispatchEvent('change');
  await page.getByLabel('Language').selectOption('es');
  await expect(categoryName).toHaveValue('Boss');

  await page.getByLabel('Idioma').selectOption('en');
  await expect(categoryName).toHaveValue('Boss');
});

test('the empty-categories notice creates the first category in one click', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Crear una categoría' }).click();

  await expect(page.locator('fieldset.categories tbody tr')).toHaveCount(1);
  await expect(page.getByText('Antes de añadir empleados necesitas')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Añadir empleado' })).toBeEnabled();
});

test('breaks within the shift: off by default, shown on long shifts and kept after a reload', async ({ page }) => {
  await openWithSchedule(page);
  const toggle = page.getByRole('checkbox', { name: 'Descansos dentro del turno' });
  const afterHours = page.getByLabel('Horas de la regla de descanso 1');
  const minutes = page.getByLabel('Minutos de la regla de descanso 1');

  await expect(toggle).not.toBeChecked();
  await expect(afterHours).toBeDisabled();
  await expect(page.locator('.break-mark')).toHaveCount(0);
  const hoursWithoutBreaks = await page.locator('.sheet tfoot tr:last-child td.num').nth(2).innerText();

  // The example shifts last 6 h: with a 5 h threshold every assignment includes the break.
  await toggle.check();
  await afterHours.fill('5');
  await afterHours.dispatchEvent('change');
  await minutes.fill('30');
  await minutes.dispatchEvent('change');

  // The table only shows an icon; the minutes are in the cell editor popup.
  const markedCell = page.locator('td.cell.work', { has: page.locator('.break-mark') }).first();
  await expect(markedCell.locator('.break-mark')).not.toContainText('min');
  await expect(markedCell.locator('.cell-hours')).toHaveText('5.5 h');
  await markedCell.click();
  await expect(page.getByRole('dialog').getByText('30 min')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Total en este turno: 5.5 h');
  await page.keyboard.press('Escape');
  // The footer row shows the net hours of each shift.
  await expect(page.locator('.sheet tfoot td.shift-hours').first()).toHaveText(/^\d+(\.\d+)? h$/);
  await expect(page.locator('.legend')).toContainText('Incluye descanso');
  await expect(page.locator('.sheet tfoot tr:last-child td.num').nth(2)).not.toHaveText(hoursWithoutBreaks);

  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Descansos dentro del turno' })).toBeChecked();
  await expect(page.locator('td.cell.work .break-mark').first()).toBeVisible();

  await page.getByRole('checkbox', { name: 'Descansos dentro del turno' }).uncheck();
  await expect(page.locator('.break-mark')).toHaveCount(0);
  await expect(page.locator('.sheet tfoot tr:last-child td.num').nth(2)).toHaveText(hoursWithoutBreaks);
});

test('breaks within the shift: several rules, the highest one exceeded applies', async ({ page }) => {
  await openWithSchedule(page);
  await page.getByRole('checkbox', { name: 'Descansos dentro del turno' }).check();
  const fill = async (label, value) => {
    const input = page.getByLabel(label);
    await input.fill(value);
    await input.dispatchEvent('change');
  };

  // The example shifts last 6 h. Rules: > 5 h -> 15 min and > 5.5 h -> 30 min: the second one wins.
  await fill('Horas de la regla de descanso 1', '5');
  await page.getByRole('button', { name: 'Añadir regla de descanso' }).click();
  await expect(page.getByLabel('Horas de la regla de descanso 2')).toHaveValue('7');
  await fill('Horas de la regla de descanso 2', '5.5');
  await fill('Minutos de la regla de descanso 2', '30');

  const markedCell = page.locator('td.cell.work', { has: page.locator('.break-mark') }).first();
  await expect(markedCell.locator('.cell-hours')).toHaveText('5.5 h');

  // Deleting the highest rule leaves the 15 min one.
  await page.getByRole('button', { name: 'Eliminar la regla de descanso 2' }).click();
  await expect(page.getByLabel('Horas de la regla de descanso 2')).toHaveCount(0);
  await expect(markedCell.locator('.cell-hours')).toHaveText('5.75 h');

  await page.reload();
  await expect(page.getByLabel('Horas de la regla de descanso 1')).toHaveValue('5');
});
