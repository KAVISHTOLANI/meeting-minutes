import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

test('plan, run and export a meeting', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Meetings that end');
  await expect(page.locator('.hero .agenda-bar')).toBeVisible();
  await page.waitForTimeout(1200);
  await snap(page, 'landing');
  await checkMobile(page, 'landing-mobile');

  await page.getByRole('link', { name: 'Open meetings' }).click();
  await page.getByLabel('Title').fill('Sprint planning');
  await page.getByLabel('Attendees').fill('Ana, Ben, Chloe');
  await page.getByRole('button', { name: 'Create meeting' }).click();
  await expect(page.getByRole('heading', { name: 'Sprint planning' })).toBeVisible();
  await page.getByLabel('Agenda item').fill('Capacity check');
  await page.getByLabel('Minutes', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Add item' }).click();
  await snap(page, 'agenda');
  await checkMobile(page);

  await page.clock.install();
  await page.getByRole('link', { name: 'Run meeting' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.clock.runFor(65_000);
  await expect(page.getByTestId('clock')).toHaveText('3:55');
  await page.getByLabel('Decision', { exact: true }).fill('Keep the weekly cadence');
  await page.getByRole('button', { name: 'Add decision' }).click();
  await page.getByLabel('Action', { exact: true }).fill('Share the board link');
  await page.getByLabel('Owner', { exact: true }).fill('Ana');
  await page.getByRole('button', { name: 'Add action' }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await snap(page, 'run');
  await checkMobile(page, 'run-mobile');

  await page.getByRole('link', { name: 'Finish and view minutes' }).click();
  await expect(page.getByRole('article', { name: 'Minutes preview' })).toContainText('Keep the weekly cadence');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md' }).click();
  expect((await dl).suggestedFilename()).toMatch(/sprint-planning\.md$/);
  await page.reload();
  await expect(page.getByRole('article', { name: 'Minutes preview' })).toContainText('Share the board link');
  await snap(page, 'minutes');
});
