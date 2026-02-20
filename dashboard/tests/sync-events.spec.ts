import { test, expect } from '@playwright/test';

test('internal sync apply endpoint accepts events (localhost only)', async ({ request }) => {
  const event = {
    type: 'card:create',
    timestamp: new Date().toISOString(),
    source: 'test',
    data: {
      board_id: 1,
      title: 'Sync Test Card',
      description: 'Created via /api/sync/apply',
      column: 'ideas',
      tags: 'company:wealth,sync'
    }
  };
  const resp = await request.post('http://localhost:3000/api/sync/apply', {
    data: event
  });
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body.ok).toBe(true);
});

test('sync event creates card that appears in board API', async ({ request }) => {
  const boardResp = await request.get('http://localhost:3000/api/kanban/board/wealth-analytica');
  expect(boardResp.status()).toBe(200);
  const board = await boardResp.json();
  const syncCard = board.cards.find((c: any) => c.title === 'Sync Test Card');
  expect(syncCard).toBeDefined();
  expect(syncCard.column).toBe('ideas');
});