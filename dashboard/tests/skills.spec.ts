import { test, expect } from '@playwright/test';

test('skills page loads', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Skills');
  await expect(page.locator('#page-skills')).toBeVisible();
  await expect(page.locator('.skills-list')).toBeVisible();
});

test('skills browse returns placeholder or list', async ({ page, request }) => {
  const resp = await request.get('http://localhost:3000/api/skills');
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body.skillsDir).toBeDefined();
});