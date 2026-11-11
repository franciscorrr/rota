import { employeeRows, expect, openApp, openWithExample, openWithSchedule, test } from './fixtures.js';

test('the schedule and employees survive a reload', async ({ page }) => {
  await openWithSchedule(page);
  const works = await page.locator('td.cell.work').count();

  await page.reload();
  await expect(page.locator('table.sheet')).toBeVisible();
  await expect(page.locator('td.cell.work')).toHaveCount(works);
  await expect(employeeRows(page)).toHaveCount(10);
});

test('"Reset all" clears it and stops persisting the previous data', async ({ page }) => {
  await openWithSchedule(page);
  await page.getByRole('button', { name: 'Restablecer todo' }).click();

  await expect(page.locator('#employees .hint')).toContainText('Aún no hay empleados');
  await page.reload();
  await expect(page.locator('#employees .hint')).toContainText('Aún no hay empleados');
});

test('"Clear schedule" removes assignments but keeps employees', async ({ page }) => {
  await openWithSchedule(page);
  await page.getByRole('button', { name: 'Vaciar horario' }).click();

  await expect(page.locator('td.cell.work')).toHaveCount(0);
  await expect(employeeRows(page)).toHaveCount(10);
});

test('"Generate schedule" with no employees warns', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Generar horario' }).click();
  await expect(page.locator('.status')).toContainText('Añade al menos un empleado');
});

test('export downloads a JSON with the week in its name that can be imported again', async ({ page }) => {
  await openWithSchedule(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^horario-\d{4}-\d{2}-\d{2}\.json$/);

  const path = await download.path();
  await page.getByRole('button', { name: 'Restablecer todo' }).click();
  await page.locator('input[type=file]').setInputFiles(path);
  await expect(employeeRows(page)).toHaveCount(10);
  await expect(page.locator('td.cell.work').first()).toBeVisible();
});

test('importing a file that is not a schedule shows the error and does not change the state', async ({ page }) => {
  await openWithExample(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'roto.json',
    mimeType: 'application/json',
    buffer: Buffer.from('this is not JSON'),
  });
  await expect(page.locator('.status.error')).toBeVisible();
  await expect(employeeRows(page)).toHaveCount(10);
});

test('the language survives import and reset, and the exported one travels in the file', async ({ page }) => {
  await openWithSchedule(page);
  await page.getByLabel('Idioma').selectOption('en');

  await page.locator('input[type=file]').setInputFiles({
    name: 'no-locale.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"employees": []}'),
  });
  await expect(page.getByRole('heading', { name: 'Rota' })).toBeVisible();
  await expect(page.getByLabel('Language')).toHaveValue('en');

  await page.getByRole('button', { name: 'Reset all' }).click();
  await expect(page.getByLabel('Language')).toHaveValue('en');

  await page.locator('input[type=file]').setInputFiles({
    name: 'en.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"settings": {"locale": "es"}}'),
  });
  await expect(page.getByRole('heading', { name: 'Rota' })).toBeVisible();
});
