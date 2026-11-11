// Shared helpers for the browser tests.
//
// `test` is Playwright's with two additions: it automatically accepts the page's `confirm()` dialogs and,
// when each test finishes, fails if there were JavaScript errors or warnings in the console.

import { fileURLToPath } from 'node:url';
import { expect, test as base } from '@playwright/test';

export { expect };

const EXAMPLE_FILE = fileURLToPath(new URL('../examples/example-10-employees.json', import.meta.url));

export const test = base.extend({
  page: async ({ page }, use) => {
    const problems = [];
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`);
    });
    page.on('dialog', (dialog) => dialog.accept());

    await use(page);

    expect(problems, 'errores o avisos en la consola').toEqual([]);
  },
});

/** Opens the application (with empty storage, a new context per test). */
export async function openApp(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Rota' })).toBeVisible();
}

/** Opens the application and imports the 10-employee example. */
export async function openWithExample(page) {
  await openApp(page);
  await page.locator('input[type=file]').setInputFiles(EXAMPLE_FILE);
  await expect(page.locator('table.sheet')).toBeVisible();
}

/** Like openWithExample(), plus generating the schedule. */
export async function openWithSchedule(page) {
  await openWithExample(page);
  await page.getByRole('button', { name: 'Generar horario' }).click();
  await expect(page.locator('td.cell.work').first()).toBeVisible();
}

/** Rows of the employee table. */
export const employeeRows = (page) => page.locator('#employees tbody tr');

/** Open dialog (the cell editor or the shift popup). */
export const openDialog = (page) => page.locator('dialog[open]');
