import { test, expect, APIRequestContext } from '@playwright/test';

let request: APIRequestContext;
const API_URL = process.env.API_URL || 'http://localhost:8080';

test.beforeAll(async ({ playwright }) => {
  request = await playwright.request.newContext({
    baseURL: API_URL,
  });
});

test.afterAll(async () => {
  await request.dispose();
});

test.describe('Senior FAQ API E2E (Curated KB View)', () => {

  test('GET /api/senior/faq - returns curated KB list', async () => {
    const response = await request.get('/api/senior/faq');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /api/senior/faq - response includes KB fields', async () => {
    const response = await request.get('/api/senior/faq');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    // If there are entries, verify they have the KB-specific fields
    if (body.data.length > 0) {
      const entry = body.data[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('content');
      expect(entry).toHaveProperty('hitCount');
      expect(entry).toHaveProperty('pinnedAt');
      // hitCount should be a number
      expect(typeof entry.hitCount).toBe('number');
    }
  });
});
