import { test, expect } from '@playwright/test';

test('kanban board displays three boards', async ({ page }) => {
  await page.goto('http://localhost:3000');
  // Check each board page accessible
  const boards = ['Wealth Board', 'BAV Board', 'Cancer Board'];
  for (const name of boards) {
    await page.click(`text=${name}`);
    await expect(page.locator(`#board-${name.toLowerCase().replace(' ', '-')}`)).toBeVisible();
  }
});

test('kanban columns exist', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Wealth Board');
  const cols = ['IDEAS', 'TODO', 'IN PROGRESS', 'COMPLETED'];
  for (const col of cols) {
    await expect(page.locator(`.column-header:has-text("${col}")`)).toBeVisible();
  }
});

test('create new card via API and verify UI', async ({ page, request }) => {
  // Create a card on Wealth board
  const boardResp = await request.get('http://localhost:3000/api/kanban/boards');
  const boards = await boardResp.json();
  const wealthBoard = boards.find((b: any) => b.slug === 'wealth-analytica');
  expect(wealthBoard).toBeDefined();

  const cardPayload = {
    title: 'Test Card',
    description: 'Auto test card',
    column: 'todo',
    tags: 'company:wealth,test'
  };
  const createResp = await request.post(
    `http://localhost:3000/api/kanban/board/wealth-analytica/cards`,
    { data: cardPayload }
  );
  expect(createResp.status()).toBe(200);
  const card = await createResp.json();
  expect(card.id).toBeGreaterThan(0);

  // Reload page and verify card appears
  await page.goto('http://localhost:3000');
  await page.click('text=Wealth Board');
  await expect(page.locator(`.card:has-text("Test Card")`)).toBeVisible();
});

test('card drag-and-drop changes column', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Wealth Board');
  const card = page.locator('.card').first();
  const sourceCol = card.locator('..'); // parent .column
  const targetCol = page.locator('.column[data-column="inprogress"]');
  await card.dragTo(targetCol);
  // Verify card now in inprogress
  await expect(targetCol.locator('.card').first()).toContainText(card.textContent() || '');
});