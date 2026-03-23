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

test.describe('TestCase API E2E', () => {
  let companyId: number;
  let productId: number;
  let segmentId1: number;
  let segmentId2: number;
  let testCaseId: number;
  let testCaseId2: number;

  test.beforeAll(async () => {
    // Create company and product
    const companyResponse = await request.post('/api/companies', {
      data: { name: 'E2E TestCase API Company' },
    });
    const companyBody = await companyResponse.json() as { data: { id: number } };
    companyId = companyBody.data.id;

    const productResponse = await request.post('/api/products', {
      data: {
        companyId,
        name: 'E2E TestCase API Product',
        platform: 'WEB',
      },
    });
    const productBody = await productResponse.json() as { data: { id: number } };
    productId = productBody.data.id;

    // Create segments for path
    const seg1Response = await request.post('/api/segments', {
      data: { productId, name: 'Main', parentId: null },
    });
    const seg1Body = await seg1Response.json() as { data: { id: number } };
    segmentId1 = seg1Body.data.id;

    const seg2Response = await request.post('/api/segments', {
      data: { productId, name: 'Login', parentId: segmentId1 },
    });
    const seg2Body = await seg2Response.json() as { data: { id: number } };
    segmentId2 = seg2Body.data.id;
  });

  test('GET /api/test-cases?productId={id} - empty list', async () => {
    const response = await request.get(`/api/test-cases?productId=${productId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(0);
  });

  test('POST /api/test-cases - create test case with path', async () => {
    const response = await request.post('/api/test-cases', {
      data: {
        productId,
        path: [segmentId1, segmentId2],
        title: 'Test Social Login',
        description: 'Social login feature test',
        promptText: 'How to test social login?',
        priority: 'HIGH',
        testType: 'FUNCTIONAL',
        status: 'DRAFT',
        steps: [
          { order: 1, action: 'Click login', expected: 'Login form shown' },
        ],
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as { success: boolean; data: { id: number; title: string; path: number[]; description: string } };
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Test Social Login');
    expect(body.data.path).toEqual([segmentId1, segmentId2]);
    expect(body.data.description).toBe('Social login feature test');
    testCaseId = body.data.id;
  });

  test('POST /api/test-cases - create second test case', async () => {
    const response = await request.post('/api/test-cases', {
      data: {
        productId,
        path: [segmentId1],
        title: 'Test Main Page',
        priority: 'MEDIUM',
        testType: 'SMOKE',
        status: 'DRAFT',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as { data: { id: number } };
    testCaseId2 = body.data.id;
  });

  test('GET /api/test-cases?productId={id} - returns both', async () => {
    const response = await request.get(`/api/test-cases?productId=${productId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as { data: unknown[] };
    expect(body.data.length).toBe(2);
  });

  test('PUT /api/test-cases/{id} - updates test case', async () => {
    const response = await request.put(`/api/test-cases/${testCaseId}`, {
      data: {
        productId,
        path: [segmentId1, segmentId2],
        title: 'Updated Social Login Test',
        description: 'Updated description',
        priority: 'LOW',
        testType: 'REGRESSION',
        status: 'ACTIVE',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as { data: { title: string; status: string } };
    expect(body.data.title).toBe('Updated Social Login Test');
    expect(body.data.status).toBe('ACTIVE');
  });

  test('POST /api/test-cases - missing title returns 400', async () => {
    const response = await request.post('/api/test-cases', {
      data: {
        productId,
        path: [],
      },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  test('DELETE /api/test-cases/{id} - removes test case', async () => {
    const response = await request.delete(`/api/test-cases/${testCaseId}`);
    expect(response.status()).toBe(200);
  });

  test('GET /api/test-cases?productId={id} - one remains', async () => {
    const response = await request.get(`/api/test-cases?productId=${productId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as { data: { id: number }[] };
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(testCaseId2);
  });

  test('DELETE /api/products/{id} - cascades delete to test cases', async () => {
    await request.delete(`/api/products/${productId}`);

    const response = await request.get(`/api/test-cases?productId=${productId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as { data: unknown[] };
    expect(body.data.length).toBe(0);
  });

  test.afterAll(async () => {
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});
