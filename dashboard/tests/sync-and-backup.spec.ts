import { test, expect } from '@playwright/test';

test('settings backup/restore buttons exist', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Settings');
  await expect(page.locator('#backupNow')).toBeVisible();
  await expect(page.locator('#restoreLatest')).toBeVisible();
});

test('token usage API returns model list', async ({ request }) => {
  const resp = await request.get('http://localhost:3000/api/tokens');
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body.models).toBeInstanceOf(Array);
  expect(body.models.length).toBeGreaterThan(0);
});

test('sync status shown on dashboard', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page.locator('#syncStatus')).toBeVisible();
  await expect(page.locator('#syncLog')).toBeVisible();
});

test('models settings can be updated via API', async ({ request }) => {
  const updatePayload = {
    default: 'openrouter/stepfun/step-3.5-flash:free',
    fallbackChain: ['openrouter/deepseek/deepseek-v3.2', 'openrouter/google/gemini-3-pro-preview']
  };
  const resp = await request.post('http://localhost:3000/api/settings/models', {
    data: updatePayload
  });
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body.models.default).toBe(updatePayload.default);
});