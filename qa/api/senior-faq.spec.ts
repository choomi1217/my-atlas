import { test, expect, APIRequestContext } from '@playwright/test';

let request: APIRequestContext;
const API_URL = process.env.API_URL || 'http://localhost:8080';

test.beforeAll(async ({ playwright }) => {
  // Login to get admin token
  const loginResp = await (await playwright.request.newContext({ baseURL: API_URL })).post("/api/auth/login", { data: { username: "admin", password: "admin" } });
  const token = (await loginResp.json() as any).data.token;

  request = await playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
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

  test('GET /api/senior/faq - response includes KB fields + snippet (v7)', async () => {
    const response = await request.get('/api/senior/faq');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    // If there are entries, verify they have the KB-specific fields + v7 snippet
    if (body.data.length > 0) {
      const entry = body.data[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('content');
      expect(entry).toHaveProperty('snippet');
      expect(entry).toHaveProperty('category');
      expect(entry).toHaveProperty('source');
      expect(entry).toHaveProperty('hitCount');
      expect(entry).toHaveProperty('pinnedAt');
      expect(typeof entry.snippet).toBe('string');
      expect(typeof entry.hitCount).toBe('number');
      // pinnedAt must NOT be null since v7 returns pinned only
      expect(entry.pinnedAt).not.toBeNull();
    }
  });

  test('GET /api/senior/faq - returns at most 10 entries (v7 max)', async () => {
    const response = await request.get('/api/senior/faq');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.length).toBeLessThanOrEqual(10);
  });

  test('GET /api/senior/faq - all returned entries have non-null pinnedAt (v7 pinned only)', async () => {
    const response = await request.get('/api/senior/faq');
    const body = await response.json() as any;
    for (const entry of body.data) {
      expect(entry.pinnedAt).not.toBeNull();
    }
  });
});
