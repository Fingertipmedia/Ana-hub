import { test, expect } from '@playwright/test';

test('dashboard loads and shows stats', async ({ page }) => {
  // Assume backend running on localhost:3000
  await page.goto('http://localhost:3000');
  await expect(page.locator('text=Dashboard')).toBeVisible();
  await expect(page.locator('#healthStatus')).toContainText('ok');
  await expect(page.locator('#tokenUsage')).toBeVisible();
});

test('navigation works', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Wealth Board');
  await expect(page.locator('#page-kanban-wealth')).toBeVisible();
  await page.click('text=Settings');
  await expect(page.locator('#page-settings')).toBeVisible();
});

test('kanban board renders columns', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Wealth Board');
  const columns = ['IDEAS', 'TODO', 'IN PROGRESS', 'COMPLETED'];
  for (const col of columns) {
    await expect(page.locator(`.column-header:has-text("${col}")`)).toBeVisible();
  }
});