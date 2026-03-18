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

test.describe('Feature API E2E', () => {
  let companyId: number;
  let productId: number;
  let featureId: number;
  let featureId2: number;

  test.beforeAll(async () => {
    // Create test company and product
    const companyResponse = await request.post('/api/companies', {
      data: { name: 'E2E Feature Test Company' },
    });
    const companyBody = await companyResponse.json() as any;
    companyId = companyBody.data.id;

    const productResponse = await request.post('/api/products', {
      data: {
        companyId,
        name: 'E2E Feature Test Product',
        platform: 'WEB',
      },
    });
    const productBody = await productResponse.json() as any;
    productId = productBody.data.id;
  });

  test('GET /api/features?productId={id} - empty feature list', async () => {
    const response = await request.get(`/api/features?productId=${productId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });

  test('POST /api/features - create feature with embedding', async () => {
    const response = await request.post('/api/features', {
      data: {
        productId,
        path: 'Main › Login',
        name: 'Social Login',
        description: 'Login with social accounts',
        promptText: 'How to test social login?',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Social Login');
    expect(body.data.path).toBe('Main › Login');
    expect(body.data.description).toBe('Login with social accounts');
    expect(Array.isArray(body.data.embedding)).toBe(true);
    featureId = body.data.id;
  });

  test('POST /api/features - create second feature', async () => {
    const response = await request.post('/api/features', {
      data: {
        productId,
        path: 'Account › Settings',
        name: 'Account Settings',
        description: 'User account settings page',
        promptText: 'Test account settings page',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.data.name).toBe('Account Settings');
    featureId2 = body.data.id;
  });

  test('GET /api/features?productId={id} - returns both features', async () => {
    const response = await request.get(`/api/features?productId=${productId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.length).toBe(2);
  });

  test('PUT /api/features/{id} - updates feature', async () => {
    const response = await request.put(`/api/features/${featureId}`, {
      data: {
        name: 'Google OAuth Login',
        description: 'Login with Google OAuth',
        promptText: 'Test Google login flow',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.name).toBe('Google OAuth Login');
    expect(body.data.description).toBe('Login with Google OAuth');
  });

  test('GET /api/features?productId={id} - reflects updated feature', async () => {
    const response = await request.get(`/api/features?productId=${productId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    const feature = body.data.find((f: any) => f.id === featureId);
    expect(feature.name).toBe('Google OAuth Login');
  });

  test('POST /api/features - missing name returns 400', async () => {
    const response = await request.post('/api/features', {
      data: {
        productId,
        path: 'Test › Path',
        description: 'Description',
      },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('POST /api/features/search - vector similarity search returns results', async () => {
    const response = await request.post('/api/features/search', {
      data: {
        query: 'login',
        topK: 5,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('DELETE /api/features/{id} - removes feature', async () => {
    const response = await request.delete(`/api/features/${featureId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
  });

  test('GET /api/features?productId={id} - only one feature remains', async () => {
    const response = await request.get(`/api/features?productId=${productId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(featureId2);
  });

  test('DELETE /api/products/{id} - cascades delete to features', async () => {
    await request.delete(`/api/products/${productId}`);

    const response = await request.get(`/api/features?productId=${productId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.length).toBe(0);
  });

  test.afterAll(async () => {
    // Cleanup
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});
