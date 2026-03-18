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

test.describe('Company API E2E', () => {
  let companyId: number;
  let companyId2: number;

  test('GET /api/companies - empty state returns empty array', async () => {
    // Clean up first
    const allCompanies = await request.get('/api/companies');
    const list = (await allCompanies.json() as any).data || [];
    for (const company of list) {
      await request.delete(`/api/companies/${company.id}`);
    }

    const response = await request.get('/api/companies');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
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

  test('PATCH /api/companies/{id}/activate - deleted company returns 404', async () => {
    const response = await request.patch(`/api/companies/${companyId}/activate`);
    expect(response.status()).toBe(404);
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
