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

  // Clean up only E2E test companies from previous test runs
  // Preserve seed data (my-atlas, etc.)
  const allCompanies = await request.get('/api/companies');
  const list = (await allCompanies.json() as any).data || [];
  for (const company of list) {
    if (company.name.includes('E2E') || company.name.includes('Test')) {
      await request.delete(`/api/companies/${company.id}`);
    }
  }
});

test.afterAll(async () => {
  await request.dispose();
});

test.describe('Company API E2E', () => {
  let companyId: number;
  let companyId2: number;

  test('GET /api/companies - returns company list with correct structure', async () => {
    const response = await request.get('/api/companies');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /api/companies - create new company', async () => {
    const response = await request.post('/api/companies', {
      data: { name: 'E2E Test Corp' },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('E2E Test Corp');
    expect(body.data.isActive).toBe(false);
    companyId = body.data.id;
  });

  test('POST /api/companies - create second company', async () => {
    const response = await request.post('/api/companies', {
      data: { name: 'E2E Test Corp 2' },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.data.name).toBe('E2E Test Corp 2');
    companyId2 = body.data.id;
  });

  test('GET /api/companies - returns both companies', async () => {
    const response = await request.get('/api/companies');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  test('PATCH /api/companies/{id}/activate - activates company', async () => {
    const response = await request.patch(`/api/companies/${companyId}/activate`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.isActive).toBe(true);
  });

  test('PATCH /api/companies/{id}/activate - only one company can be active (partial unique index)', async () => {
    // Activate second company should deactivate first
    const response = await request.patch(`/api/companies/${companyId2}/activate`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.isActive).toBe(true);

    // Verify first company is now inactive
    const allCompanies = await request.get('/api/companies');
    const list = (await allCompanies.json() as any).data || [];
    const firstCompany = list.find((c: any) => c.id === companyId);
    expect(firstCompany?.isActive).toBe(false);
  });

  test('POST /api/companies - blank name returns 400', async () => {
    const response = await request.post('/api/companies', {
      data: { name: '' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('DELETE /api/companies/{id} - removes company', async () => {
    const response = await request.delete(`/api/companies/${companyId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
  });

  test('GET /api/companies - deleted company no longer in list', async () => {
    const response = await request.get('/api/companies');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    const company = body.data.find((c: any) => c.id === companyId);
    expect(company).toBeUndefined();
  });

  test('PATCH /api/companies/{id}/activate - deleted company returns 400', async () => {
    const response = await request.patch(`/api/companies/${companyId}/activate`);
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test.afterAll(async () => {
    // Cleanup: delete remaining companies
    if (companyId2) {
      await request.delete(`/api/companies/${companyId2}`).catch(() => {});
    }
  });
});

test.describe('Company API v12 - Update, Deactivate, productCount', () => {
  let companyId: number;

  test('POST /api/companies - create company for v12 tests', async () => {
    const response = await request.post('/api/companies', {
      data: { name: 'E2E v12 Company' },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    companyId = body.data.id;
  });

  test('PUT /api/companies/{id} - updates company name', async () => {
    const response = await request.put(`/api/companies/${companyId}`, {
      data: { name: 'E2E v12 Company Renamed' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('E2E v12 Company Renamed');
    expect(body.data.id).toBe(companyId);
  });

  test('PUT /api/companies/{id} - blank name returns 400', async () => {
    const response = await request.put(`/api/companies/${companyId}`, {
      data: { name: '' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('GET /api/companies - response includes productCount field', async () => {
    const response = await request.get('/api/companies');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    const company = body.data.find((c: any) => c.id === companyId);
    expect(company).toBeDefined();
    expect(company.productCount).toBeDefined();
    expect(typeof company.productCount).toBe('number');
    // No products yet, so productCount should be 0
    expect(company.productCount).toBe(0);
  });

  test('GET /api/companies - productCount reflects created products', async () => {
    // Create a product under this company
    const productResponse = await request.post('/api/products', {
      data: {
        companyId,
        name: 'E2E v12 Product',
        platform: 'WEB',
        description: 'Test product for productCount',
      },
    });
    expect(productResponse.status()).toBe(201);

    // Verify productCount is now 1
    const response = await request.get('/api/companies');
    const body = await response.json() as any;
    const company = body.data.find((c: any) => c.id === companyId);
    expect(company.productCount).toBe(1);
  });

  test('PATCH /api/companies/{id}/activate - activate before deactivate test', async () => {
    const response = await request.patch(`/api/companies/${companyId}/activate`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.isActive).toBe(true);
  });

  test('PATCH /api/companies/{id}/deactivate - deactivates company', async () => {
    const response = await request.patch(`/api/companies/${companyId}/deactivate`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.isActive).toBe(false);
    expect(body.data.id).toBe(companyId);
  });

  test('PATCH /api/companies/{id}/deactivate - already inactive company still returns 200', async () => {
    // Deactivate again — should succeed or at least not error
    const response = await request.patch(`/api/companies/${companyId}/deactivate`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.isActive).toBe(false);
  });

  test.afterAll(async () => {
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});
