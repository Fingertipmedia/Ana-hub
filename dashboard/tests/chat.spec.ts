import { test, expect } from '@playwright/test';

test('chat page loads and shows sessions placeholder', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Chat');
  await expect(page.locator('#page-chat')).toBeVisible();
  await expect(page.locator('#chatSessions')).toContainText('sessions');
});

test('chat page model selector populated', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Chat');
  const modelSelect = page.locator('#chatModel');
  await expect(modelSelect).toBeVisible();
  const count = await modelSelect.locator('option').count();
  expect(count).toBeGreaterThan(5);
});

test('chat interface sends message (mock)', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Chat');
  // Open chat interface (assume it starts hidden unless sessions exist; we'll simulate by showing it)
  await page.evaluate(() => {
    document.getElementById('chatInterface')!.classList.remove('hidden');
  });
  const input = page.locator('#messageInput');
  await input.fill('Test message');
  await page.click('#sendBtn');
  // Wait for message to appear in history
  await expect(page.locator('.message.user')).toHaveText('Test message');
});