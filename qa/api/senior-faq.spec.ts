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

test.describe('Senior FAQ API E2E', () => {
  let faqId: number;

  test('GET /api/senior/faq - returns list', async () => {
    const response = await request.get('/api/senior/faq');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /api/senior/faq - create FAQ', async () => {
    const response = await request.post('/api/senior/faq', {
      data: {
        title: 'E2E Test FAQ',
        content: 'This is an E2E test FAQ entry.',
        tags: 'e2e,test',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('E2E Test FAQ');
    expect(body.data.content).toBe('This is an E2E test FAQ entry.');
    expect(body.data.tags).toBe('e2e,test');
    faqId = body.data.id;
  });

  test('GET /api/senior/faq/{id} - retrieve created FAQ', async () => {
    const response = await request.get(`/api/senior/faq/${faqId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(faqId);
    expect(body.data.title).toBe('E2E Test FAQ');
  });

  test('PUT /api/senior/faq/{id} - update FAQ', async () => {
    const response = await request.put(`/api/senior/faq/${faqId}`, {
      data: {
        title: 'E2E Updated FAQ',
        content: 'Updated content for E2E test.',
        tags: 'e2e,updated',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('E2E Updated FAQ');
  });

  test('POST /api/senior/faq - validation: blank title returns 400', async () => {
    const response = await request.post('/api/senior/faq', {
      data: { title: '', content: 'Content' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('POST /api/senior/faq - validation: blank content returns 400', async () => {
    const response = await request.post('/api/senior/faq', {
      data: { title: 'Valid Title', content: '' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('DELETE /api/senior/faq/{id} - delete FAQ', async () => {
    const response = await request.delete(`/api/senior/faq/${faqId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
  });

  test('GET /api/senior/faq/{id} - deleted FAQ returns 404', async () => {
    const response = await request.get(`/api/senior/faq/${faqId}`);
    expect(response.status()).toBe(404);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });
});
