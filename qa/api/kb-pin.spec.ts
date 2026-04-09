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

test.describe('KB Pin/Unpin API E2E', () => {
  let kbId: number;

  // Setup: create a KB entry for pin tests
  test.beforeAll(async ({ playwright }) => {
    const setupRequest = await playwright.request.newContext({
      baseURL: API_URL,
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
      const cleanupRequest = await playwright.request.newContext({
        baseURL: API_URL,
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
