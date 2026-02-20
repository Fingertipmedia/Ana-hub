import { test, expect } from '@playwright/test';

test('documents page loads', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Documents');
  await expect(page.locator('#page-documents')).toBeVisible();
});

test('documents API returns root placeholder', async ({ request }) => {
  const resp = await request.get('http://localhost:3000/api/documents');
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body.root).toBeDefined();
});