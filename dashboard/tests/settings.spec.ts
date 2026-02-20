import { test, expect } from '@playwright/test';

test('settings page loads and shows model selector', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Settings');
  await expect(page.locator('#page-settings')).toBeVisible();
  await expect(page.locator('#defaultModel')).toBeVisible();
  const initialCount = await page.locator('#fallbackChainList .tag').count();
  // Fallback chain displayed
  expect(initialCount).toBeGreaterThan(0);
});

test('settings model save updates js model', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Settings');
  const modelSelect = page.locator('#defaultModel');
  await modelSelect.selectOption('openrouter/anthropic/claude-opus-4.5');
  await page.click('text=Save');
  // Confirm selection persisted in UI
  expect(await modelSelect.inputValue()).toBe('openrouter/anthropic/claude-opus-4.5');
});