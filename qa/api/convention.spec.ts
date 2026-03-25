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

test.describe('Convention API E2E', () => {
  let conventionId: number;

  test('GET /api/conventions - returns list', async () => {
    const response = await request.get('/api/conventions');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /api/conventions - create convention', async () => {
    const response = await request.post('/api/conventions', {
      data: {
        term: 'E2E-TC',
        definition: 'End-to-End Test Case',
        category: 'Testing',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.term).toBe('E2E-TC');
    expect(body.data.definition).toBe('End-to-End Test Case');
    expect(body.data.category).toBe('Testing');
    conventionId = body.data.id;
  });

  test('GET /api/conventions/{id} - retrieve created convention', async () => {
    const response = await request.get(`/api/conventions/${conventionId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(conventionId);
    expect(body.data.term).toBe('E2E-TC');
  });

  test('PUT /api/conventions/{id} - update convention', async () => {
    const response = await request.put(`/api/conventions/${conventionId}`, {
      data: {
        term: 'E2E-TC-Updated',
        definition: 'Updated End-to-End Test Case',
        category: 'QA',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.term).toBe('E2E-TC-Updated');
    expect(body.data.category).toBe('QA');
  });

  test('POST /api/conventions - validation: blank term returns 400', async () => {
    const response = await request.post('/api/conventions', {
      data: { term: '', definition: 'Some definition' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('POST /api/conventions - validation: blank definition returns 400', async () => {
    const response = await request.post('/api/conventions', {
      data: { term: 'Valid Term', definition: '' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('DELETE /api/conventions/{id} - delete convention', async () => {
    const response = await request.delete(`/api/conventions/${conventionId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
  });

  test('GET /api/conventions/{id} - deleted convention returns 404', async () => {
    const response = await request.get(`/api/conventions/${conventionId}`);
    expect(response.status()).toBe(404);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });
});
