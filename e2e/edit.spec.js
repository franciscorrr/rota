import { expect, openWithSchedule, test } from './fixtures.js';

/** First cell (day and shift) of the Edit view. */
async function firstEditCell(page) {
  await openWithSchedule(page);
  await page.getByRole('tab', { name: 'Edición' }).click();
  return page.locator('#grid tbody tr').first().locator('td').first();
}

test('changing the day minimum stores it, keeps focus and an empty value restores it', async ({ page }) => {
  const cell = await firstEditCell(page);
  const input = cell.locator('.mins input').first();
  const previous = Number(await input.inputValue());

  await input.focus();
  await input.fill(String(previous + 1));
  await input.dispatchEvent('change');
  await expect(input).toHaveValue(String(previous + 1));
  await expect(input).toBeFocused();

  await input.fill('');
  await input.dispatchEvent('change');
  await expect(input).toHaveValue(String(previous + 1));
});

test('adding and removing someone from a shift', async ({ page }) => {
  const cell = await firstEditCell(page);
  const assigned = cell.locator('ul.assigned li');
  const before = await assigned.count();

  await cell.locator('select').selectOption({ index: 2 });
  await cell.getByRole('button', { name: 'Añadir' }).click();
  await expect(assigned).toHaveCount(before + 1);

  await assigned.first().getByRole('button').click();
  await expect(assigned).toHaveCount(before);
});

test('adding without choosing an employee warns in the status bar', async ({ page }) => {
  const cell = await firstEditCell(page);
  await cell.getByRole('button', { name: 'Añadir' }).click();
  await expect(page.locator('.status')).toContainText('Elige un empleado');
});

test('people who are absent or have the shift blocked cannot be chosen', async ({ page }) => {
  const cell = await firstEditCell(page);
  await expect(cell.locator('select option[disabled]').first()).toContainText(/ausente|bloqueado/);
});

test('"Generate shift" completes the shift and announces it in the status bar', async ({ page }) => {
  await openWithSchedule(page);
  await page.getByRole('tab', { name: 'Edición' }).click();
  await page.locator('#grid .gen-shift').first().click();
  await expect(page.locator('.status')).not.toBeEmpty();
});
