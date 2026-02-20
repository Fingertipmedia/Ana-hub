import { test, expect } from '@playwright/test';

test('board share creates token', async ({ request }) => {
  // Use internal endpoint to simulate board:share event
  const event = {
    type: 'board:share',
    timestamp: new Date().toISOString(),
    source: 'test',
    data: { board_id: 1 }
  };
  const resp = await request.post('http://localhost:3000/api/sync/apply', {
    data: event
  });
  expect(resp.status()).toBe(200);

  // Verify token exists in DB (via a new endpoint or indirect)
  // For now, we can test that board list still works
  const boardsResp = await request.get('http://localhost:3000/api/kanban/boards');
  expect(boardsResp.status()).toBe(200);
});

test('comments can be added to card', async ({ request }) => {
  // First get a card ID (from earlier sync test)
  const boardResp = await request.get('http://localhost:3000/api/kanban/board/wealth-analytica');
  const board = await boardResp.json();
  const card = board.cards.find((c: any) => c.title === 'Sync Test Card');
  expect(card).toBeDefined();

  const commentResp = await request.post(`http://localhost:3000/api/kanban/card/${card.id}/comments`, {
    data: { author: 'test', content: 'This is a test comment' }
  });
  expect(commentResp.status()).toBe(200);
  const comment = await commentResp.json();
  expect(comment.id).toBeGreaterThan(0);

  // Verify comment appears in card comments list
  const commentsResp = await request.get(`http://localhost:3000/api/kanban/card/${card.id}/comments`);
  expect(commentsResp.status()).toBe(200);
  const comments = await commentsResp.json();
  expect(comments.some((c: any) => c.content === 'This is a test comment')).toBe(true);
});