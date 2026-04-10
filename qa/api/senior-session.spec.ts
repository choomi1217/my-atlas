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

test.describe('Senior Chat Session API E2E', () => {
  let testSessionId: number;

  // --- GET /api/senior/sessions ---

  test('GET /api/senior/sessions - returns session list', async () => {
    const response = await request.get('/api/senior/sessions');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  // --- POST /api/senior/sessions ---

  test('POST /api/senior/sessions - creates new session', async () => {
    const response = await request.post('/api/senior/sessions');
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('createdAt');
    testSessionId = body.data.id;
  });

  // --- GET /api/senior/sessions/{id} ---

  test('GET /api/senior/sessions/{id} - returns session detail', async () => {
    const response = await request.get(`/api/senior/sessions/${testSessionId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(testSessionId);
    expect(body.data).toHaveProperty('messages');
    expect(Array.isArray(body.data.messages)).toBe(true);
  });

  // --- PATCH /api/senior/sessions/{id} ---

  test('PATCH /api/senior/sessions/{id} - updates session title', async () => {
    const response = await request.patch(`/api/senior/sessions/${testSessionId}`, {
      data: { title: 'E2E Updated Title' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.title).toBe('E2E Updated Title');
  });

  // --- DELETE /api/senior/sessions/{id} ---

  test('DELETE /api/senior/sessions/{id} - deletes session', async () => {
    const response = await request.delete(`/api/senior/sessions/${testSessionId}`);
    expect(response.status()).toBe(200);
  });

  test('GET deleted session - returns error', async () => {
    const response = await request.get(`/api/senior/sessions/${testSessionId}`);
    // Should return 400 or 500 since session no longer exists
    expect(response.status()).not.toBe(200);
  });

  // --- Validation ---

  test('PATCH with blank title - returns 400', async () => {
    // Create a new session for this test
    const createResp = await request.post('/api/senior/sessions');
    const newId = (await createResp.json() as any).data.id;

    const response = await request.patch(`/api/senior/sessions/${newId}`, {
      data: { title: '' },
    });
    expect(response.status()).toBe(400);

    // Cleanup
    await request.delete(`/api/senior/sessions/${newId}`).catch(() => {});
  });

  test('GET non-existent session - returns error', async () => {
    const response = await request.get('/api/senior/sessions/999999');
    expect(response.status()).not.toBe(200);
  });
});
