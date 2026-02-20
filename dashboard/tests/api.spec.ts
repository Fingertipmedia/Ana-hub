import { test, expect } from '@playwright/test';

test('API health returns ok', async ({ request }) => {
  const response = await request.get('http://localhost:3000/api/health');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe('ok');
});

test('API settings models returns list', async ({ request }) => {
  const response = await request.get('http://localhost:3000/api/settings/models');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.available).toBeInstanceOf(Array);
  expect(body.default).toBeDefined();
});

test('API kanban boards returns seeded boards', async ({ request }) => {
  const response = await request.get('http://localhost:3000/api/kanban/boards');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.length).toBeGreaterThanOrEqual(3);
});