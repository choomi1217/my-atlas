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

test.describe('Product API E2E', () => {
  let companyId: number;
  let productId: number;
  let productId2: number;

  test.beforeAll(async () => {
    // Create a test company for all product tests
    const response = await request.post('/api/companies', {
      data: { name: 'E2E Product Test Company' },
    });
    const body = await response.json() as any;
    companyId = body.data.id;
  });

  test('GET /api/products?companyId={id} - empty product list', async () => {
    const response = await request.get(`/api/products?companyId=${companyId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });

  test('POST /api/products - create WEB product', async () => {
    const response = await request.post('/api/products', {
      data: {
        companyId,
        name: 'Atlas Web App',
        platform: 'WEB',
        description: 'Web application',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Atlas Web App');
    expect(body.data.platform).toBe('WEB');
    productId = body.data.id;
  });

  test('POST /api/products - create MOBILE product', async () => {
    const response = await request.post('/api/products', {
      data: {
        companyId,
        name: 'Atlas Mobile App',
        platform: 'MOBILE',
        description: 'Mobile application',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.data.name).toBe('Atlas Mobile App');
    expect(body.data.platform).toBe('MOBILE');
    productId2 = body.data.id;
  });

  test('GET /api/products?companyId={id} - returns both products', async () => {
    const response = await request.get(`/api/products?companyId=${companyId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.length).toBe(2);
  });

  test('PUT /api/products/{id} - updates product', async () => {
    const response = await request.put(`/api/products/${productId}`, {
      data: {
        name: 'Atlas Web App v2',
        description: 'Updated web application',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.name).toBe('Atlas Web App v2');
    expect(body.data.description).toBe('Updated web application');
  });

  test('GET /api/products?companyId={id} - reflects updated product', async () => {
    const response = await request.get(`/api/products?companyId=${companyId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    const product = body.data.find((p: any) => p.id === productId);
    expect(product.name).toBe('Atlas Web App v2');
  });

  test('POST /api/products - missing name returns 400', async () => {
    const response = await request.post('/api/products', {
      data: {
        companyId,
        platform: 'WEB',
      },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('DELETE /api/products/{id} - removes product', async () => {
    const response = await request.delete(`/api/products/${productId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
  });

  test('GET /api/products?companyId={id} - only one product remains', async () => {
    const response = await request.get(`/api/products?companyId=${companyId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(productId2);
  });

  test('DELETE /api/companies/{id} - cascades delete to products', async () => {
    await request.delete(`/api/companies/${companyId}`);

    const response = await request.get(`/api/products?companyId=${companyId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.length).toBe(0);
  });
});
