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

test.describe('Knowledge Base API E2E', () => {
  let kbId: number;

  test('GET /api/kb - returns list', async () => {
    const response = await request.get('/api/kb');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /api/kb - create manual KB entry', async () => {
    const response = await request.post('/api/kb', {
      data: {
        title: 'E2E Test Article',
        content: 'This is an E2E test article for knowledge base.',
        category: 'Testing',
        tags: 'e2e,test',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('E2E Test Article');
    expect(body.data.content).toBe('This is an E2E test article for knowledge base.');
    expect(body.data.category).toBe('Testing');
    expect(body.data.tags).toBe('e2e,test');
    kbId = body.data.id;
  });

  test('GET /api/kb/{id} - retrieve created entry', async () => {
    const response = await request.get(`/api/kb/${kbId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(kbId);
    expect(body.data.title).toBe('E2E Test Article');
  });

  test('PUT /api/kb/{id} - update entry', async () => {
    const response = await request.put(`/api/kb/${kbId}`, {
      data: {
        title: 'E2E Updated Article',
        content: 'Updated content for E2E test.',
        category: 'QA',
        tags: 'e2e,updated',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('E2E Updated Article');
    expect(body.data.category).toBe('QA');
  });

  test('POST /api/kb - validation: blank title returns 400', async () => {
    const response = await request.post('/api/kb', {
      data: { title: '', content: 'Content' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('GET /api/kb/jobs - returns job list', async () => {
    const response = await request.get('/api/kb/jobs');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('DELETE /api/kb/{id} - delete entry', async () => {
    const response = await request.delete(`/api/kb/${kbId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
  });

  test('GET /api/kb/{id} - deleted entry returns 404', async () => {
    const response = await request.get(`/api/kb/${kbId}`);
    expect(response.status()).toBe(404);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });
});
