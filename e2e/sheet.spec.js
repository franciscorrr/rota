import { expect, openApp, openDialog, openWithExample, openWithSchedule, test } from './fixtures.js';

const cell = (page, row, column) => page.locator(`td[data-r="${row}"][data-c="${column}"]`);

test('with no employees the sheet asks to add them', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#sheet .hint')).toContainText('Añade empleados');
});

test('importing the example loads 10 employees', async ({ page }) => {
  await openWithExample(page);
  await expect(page.locator('#employees tbody tr')).toHaveCount(10);
  await expect(page.locator('.status')).toContainText('Importado');
});

test('generating the schedule fills the sheet and the summary', async ({ page }) => {
  await openWithSchedule(page);
  expect(await page.locator('td.cell.work').count()).toBeGreaterThan(20);
  await expect(page.locator('.summary')).toContainText('Horas planificadas');
});

test('arrows, Home and End move the selected cell (roving tabindex)', async ({ page }) => {
  await openWithSchedule(page);
  await cell(page, 0, 0).focus();

  await page.keyboard.press('ArrowRight');
  await expect(cell(page, 0, 1)).toHaveAttribute('tabindex', '0');
  await expect(cell(page, 0, 0)).toHaveAttribute('tabindex', '-1');

  await page.keyboard.press('End');
  await expect(cell(page, 0, 11)).toHaveAttribute('tabindex', '0');

  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await expect(cell(page, 1, 0)).toBeFocused();
  await expect(page.locator('.sheet-info')).not.toBeEmpty();
});

test('Enter opens the cell editor and Escape closes it returning focus', async ({ page }) => {
  await openWithSchedule(page);
  await cell(page, 1, 0).focus();

  await page.keyboard.press('Enter');
  await expect(page.locator('dialog.cell-editor[open]')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(openDialog(page)).toHaveCount(0);
  await expect(cell(page, 1, 0)).toBeFocused();
});

test('the cell editor removes and adds assignments', async ({ page }) => {
  await openWithSchedule(page);
  const works = page.locator('td.cell.work');
  const before = await works.count();

  await works.first().click();
  await openDialog(page).getByRole('button', { name: 'Quitar' }).click();
  await expect(openDialog(page)).toHaveCount(0);
  await expect(works).toHaveCount(before - 1);

  await page.locator('td.cell.empty').first().click();
  await openDialog(page).getByRole('button', { name: 'Añadir' }).click();
  await expect(openDialog(page)).toHaveCount(0);
  await expect(works).toHaveCount(before);
});

test('an invalid time range shows the error and does not close the editor', async ({ page }) => {
  await openWithSchedule(page);
  await page.locator('td.cell.work').first().click();

  await openDialog(page).locator('input[type=time]').first().fill('16:00');
  await openDialog(page).getByRole('button', { name: 'Guardar' }).click();

  await expect(page.locator('.popup-error')).toContainText('posterior');
  await expect(openDialog(page)).toHaveCount(1);
});

test('an absence cell does not allow adding assignments', async ({ page }) => {
  await openWithSchedule(page);
  await page.locator('td.cell.absent').first().click();

  await expect(openDialog(page)).toContainText('ausente');
  await expect(openDialog(page).getByRole('button', { name: 'Añadir' })).toHaveCount(0);
});

test('the shift popup shows coverage and allows generating the shift', async ({ page }) => {
  await openWithSchedule(page);
  await page.locator('.shift-head').first().click();

  await expect(page.locator('.popup-cover')).toContainText('Cobertura');
  await openDialog(page).getByRole('button', { name: 'Generar este turno' }).click();
  await expect(page.locator('.popup-note')).toHaveCount(1);
});

test('"Edit in Edit view" switches tabs and hides the sheet', async ({ page }) => {
  await openWithSchedule(page);
  await page.locator('.shift-head').first().click();
  await openDialog(page).getByRole('button', { name: 'Editar en «Edición»' }).click();

  await expect(page.locator('#results')).toHaveAttribute('data-view', 'edit');
  await expect(page.getByRole('tab', { name: 'Edición' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('#grid')).toBeVisible();
});

test('printing always shows the sheet, even from the Edit tab', async ({ page }) => {
  await openWithSchedule(page);
  await page.getByRole('tab', { name: 'Edición' }).click();

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#sheet')).toBeVisible();
  await expect(page.locator('#grid')).toBeHidden();
  await expect(page.locator('#hours')).toBeHidden();
});

test('the sheet needs no horizontal scroll at 1280 px', async ({ page }) => {
  await openWithSchedule(page);
  const { scrollWidth, clientWidth } = await page.locator('.sheet-wrap').evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});
