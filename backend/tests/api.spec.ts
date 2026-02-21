import { test, expect } from '@playwright/test';

test('health endpoint', async ({ request }) => {
  const res = await request.get('http://127.0.0.1:3000/api/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe('ok');
});

test('list boards', async ({ request }) => {
  const res = await request.get('http://127.0.0.1:3000/api/kanban/boards');
  expect(res.ok()).toBeTruthy();
  const boards = await res.json();
  expect(boards.length).toBeGreaterThanOrEqual(3);
  const slugs = boards.map((b: any) => b.slug);
  expect(slugs).toContain('wealth-analytica');
  expect(slugs).toContain('bav-futures');
  expect(slugs).toContain('prostate-cancer');
});

test('create and fetch card', async ({ request }) => {
  const boards = await request.get('http://127.0.0.1:3000/api/kanban/boards').then(r => r.json());
  const wa = boards.find((b: any) => b.slug === 'wealth-analytica');
  expect(wa).toBeDefined();

  const createRes = await request.post(
    'http://127.0.0.1:3000/api/kanban/board/wealth-analytica/cards',
    { data: { title: 'API test card', description: 'Created by Playwright', column: 'todo', agent: 'Ana', tokens: 1 } }
  );
  expect(createRes.ok()).toBeTruthy();
  const card = await createRes.json();
  expect(card.title).toBe('API test card');
  expect(card.board_id).toBe(wa.id);

  const boardRes = await request.get(`http://127.0.0.1:3000/api/kanban/board/wealth-analytica`);
  expect(boardRes.ok()).toBeTruthy();
  const board = await boardRes.json();
  const found = board.cards.find((c: any) => c.id === card.id);
  expect(found).toBeDefined();
});

test('add comment to card', async ({ request }) => {
  const boardRes = await request.get('http://127.0.0.1:3000/api/kanban/board/wealth-analytica');
  expect(boardRes.ok()).toBeTruthy();
  const board = await boardRes.json();
  const card = board.cards[0];
  expect(card).toBeDefined();

  const commentRes = await request.post(
    `http://127.0.0.1:3000/api/kanban/card/${card.id}/comments`,
    { data: { author: 'Ana', content: 'Test comment from Playwright', source: 'test' } }
  );
  expect(commentRes.ok()).toBeTruthy();
  const comment = await commentRes.json();
  expect(comment.id).toBeDefined();

  const commentsRes = await request.get(`http://127.0.0.1:3000/api/kanban/card/${card.id}/comments`);
  expect(commentsRes.ok()).toBeTruthy();
  const comments = await commentsRes.json();
  const found = comments.find((c: any) => c.id === comment.id);
  expect(found).toBeDefined();
});
