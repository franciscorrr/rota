import { employeeRows, expect, openWithExample, openWithSchedule, test } from './fixtures.js';

test('renaming an employee also updates their accessibility labels', async ({ page }) => {
  await openWithExample(page);
  const name = employeeRows(page).first().locator('input[type=text]');

  await name.fill('Nombre Nuevo');
  await name.dispatchEvent('change');

  await expect(page.locator('#employees [aria-label="Eliminar a Nombre Nuevo"]')).toHaveCount(1);
});

test('an empty name is discarded and the previous one is kept', async ({ page }) => {
  await openWithExample(page);
  const name = employeeRows(page).first().locator('input[type=text]');
  const previous = await name.inputValue();

  await name.fill('   ');
  await name.dispatchEvent('change');
  await expect(name).toHaveValue(previous);
});

test('"Whole week" marks absences and "Clear all" unmarks them', async ({ page }) => {
  await openWithExample(page);
  const row = employeeRows(page).first();
  const checked = row.locator('input[type=checkbox]:checked');

  await row.getByRole('button', { name: 'Toda la semana' }).click();
  expect(await checked.count()).toBeGreaterThan(0);

  await row.getByRole('button', { name: 'Quitar todos' }).click();
  await expect(checked).toHaveCount(0);
});

test('blocking and unblocking a shift', async ({ page }) => {
  await openWithExample(page);
  const row = employeeRows(page).nth(1);
  const chips = row.locator('.blocks button');
  const before = await chips.count();

  await row.locator('.blocks select').selectOption({ index: 1 });
  await expect(chips).toHaveCount(before + 1);

  await chips.last().click();
  await expect(chips).toHaveCount(before);
});

test('adding and deleting an employee', async ({ page }) => {
  await openWithExample(page);
  await page.getByRole('button', { name: 'Añadir empleado' }).click();
  await expect(employeeRows(page)).toHaveCount(11);

  await employeeRows(page).last().getByRole('button', { name: /Eliminar/ }).click();
  await expect(employeeRows(page)).toHaveCount(10);
});

test('deleting an employee also removes their assignments from the sheet', async ({ page }) => {
  await openWithSchedule(page);
  const rowsBefore = await page.locator('table.sheet tbody tr').count();

  await employeeRows(page).first().getByRole('button', { name: /Eliminar/ }).click();
  await expect(page.locator('table.sheet tbody tr')).toHaveCount(rowsBefore - 1);
});
