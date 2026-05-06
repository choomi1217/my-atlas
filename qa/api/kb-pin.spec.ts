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

test.describe('KB Pin/Unpin API E2E', () => {
  let kbId: number;

  // Setup: create a KB entry for pin tests
  test.beforeAll(async ({ playwright }) => {
    const loginResp = await (await playwright.request.newContext({ baseURL: API_URL })).post("/api/auth/login", { data: { username: "admin", password: "admin" } });
    const token = (await loginResp.json() as any).data.token;
    const setupRequest = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    const response = await setupRequest.post('/api/kb', {
      data: {
        title: 'E2E Pin Test Article',
        content: 'This KB entry is used for pin/unpin E2E tests.',
        category: 'Testing',
        tags: 'e2e,pin-test',
      },
    });
    const body = await response.json() as any;
    kbId = body.data.id;
    await setupRequest.dispose();
  });

  // Cleanup: delete the KB entry created for tests
  test.afterAll(async ({ playwright }) => {
    if (kbId) {
      const loginResp = await (await playwright.request.newContext({ baseURL: API_URL })).post("/api/auth/login", { data: { username: "admin", password: "admin" } });
      const token = (await loginResp.json() as any).data.token;
      const cleanupRequest = await playwright.request.newContext({
        baseURL: API_URL,
        extraHTTPHeaders: { Authorization: `Bearer ${token}` },
      });
      await cleanupRequest.delete(`/api/kb/${kbId}`).catch(() => {});
      await cleanupRequest.dispose();
    }
  });

  test('PATCH /api/kb/{id}/pin - pins entry successfully', async () => {
    const response = await request.patch(`/api/kb/${kbId}/pin`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.message).toContain('pinned');
  });

  test('PATCH /api/kb/{id}/pin - already pinned returns error', async () => {
    // Entry was pinned in the previous test
    const response = await request.patch(`/api/kb/${kbId}/pin`);
    expect(response.ok()).toBe(false);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('PATCH /api/kb/{id}/unpin - unpins entry successfully', async () => {
    const response = await request.patch(`/api/kb/${kbId}/unpin`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.message).toContain('unpinned');
  });

  test('PATCH /api/kb/{id}/unpin - not pinned returns error', async () => {
    // Entry was unpinned in the previous test
    const response = await request.patch(`/api/kb/${kbId}/unpin`);
    expect(response.ok()).toBe(false);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('PATCH /api/kb/999999/pin - non-existent returns error', async () => {
    const response = await request.patch('/api/kb/999999/pin');
    expect(response.ok()).toBe(false);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });
});

test.describe('KB Pin Max Limit (v7: 10)', () => {
  const createdIds: number[] = [];

  test.afterAll(async () => {
    // Cleanup: unpin + delete all test items created in this describe
    for (const id of createdIds) {
      await request.patch(`/api/kb/${id}/unpin`).catch(() => {});
      await request.delete(`/api/kb/${id}`).catch(() => {});
    }
  });

  test('attempting to pin 11th entry rejects with max limit error', async () => {
    // Get current curated FAQ size — this equals current pinned count under v7
    const curatedRes = await request.get('/api/senior/faq');
    const curatedBody = await curatedRes.json() as any;
    const currentPinned = curatedBody.data.length;

    // Skip if already at/above max — the assertion below would still hold but
    // we cannot meaningfully fill up if seed data already maxed it
    if (currentPinned >= 10) {
      test.info().annotations.push({
        type: 'note',
        description: `Skipped fill-up — already ${currentPinned} pinned. Will attempt 11th anyway.`,
      });
    }

    // Fill up the gap with E2E test items + pin them
    const gap = Math.max(0, 10 - currentPinned);
    for (let i = 0; i < gap; i++) {
      const createRes = await request.post('/api/kb', {
        data: {
          title: `E2E Pin Limit Test ${i}`,
          content: 'Filler entry for pin limit test',
          category: 'Testing',
        },
      });
      expect(createRes.status()).toBe(201);
      const id = (await createRes.json() as any).data.id;
      createdIds.push(id);
      const pinRes = await request.patch(`/api/kb/${id}/pin`);
      expect(pinRes.status()).toBe(200);
    }

    // Now create the 11th item and try to pin — should fail
    const overflowRes = await request.post('/api/kb', {
      data: {
        title: 'E2E Pin Overflow Test',
        content: 'This should be rejected on pin attempt',
        category: 'Testing',
      },
    });
    expect(overflowRes.status()).toBe(201);
    const overflowId = (await overflowRes.json() as any).data.id;
    createdIds.push(overflowId);

    const pinResponse = await request.patch(`/api/kb/${overflowId}/pin`);
    // v7: 11th pin attempt must be rejected (HTTP error). Specific error message
    // is verified by KnowledgeBaseServiceImplTest unit test (Maximum 10).
    expect(pinResponse.ok()).toBe(false);
    const body = await pinResponse.json() as any;
    expect(body.success).toBe(false);
  });
});
