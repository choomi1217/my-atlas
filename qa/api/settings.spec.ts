import { test, expect, APIRequestContext } from '@playwright/test';

let request: APIRequestContext;
let adminToken: string;
const API_URL = process.env.API_URL || 'http://localhost:8080';

test.beforeAll(async ({ playwright }) => {
  request = await playwright.request.newContext({ baseURL: API_URL });

  // Login as admin
  const loginRes = await request.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin' },
  });
  adminToken = (await loginRes.json() as any).data.token;
});

test.afterAll(async () => {
  await request.dispose();
});

test.describe('Settings API E2E - System Settings', () => {
  test('GET /api/settings - returns current settings', async () => {
    const response = await request.get('/api/settings', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(typeof body.data.aiEnabled).toBe('boolean');
    expect(typeof body.data.sessionTimeoutSeconds).toBe('number');
  });

  test('GET /api/settings - USER gets 403', async () => {
    // Register a test user via settings
    const regRes = await request.post('/api/settings/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `e2e_settings_user_${Date.now()}`, password: 'pass1234', companyIds: [] },
    });
    const testUser = (await regRes.json() as any).data;

    // Login as the test user
    const loginRes = await request.post('/api/auth/login', {
      data: { username: testUser.username, password: 'pass1234' },
    });
    const userToken = (await loginRes.json() as any).data.token;

    // Try to access settings
    const response = await request.get('/api/settings', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(response.status()).toBe(403);

    // Cleanup
    await request.delete(`/api/settings/users/${testUser.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  });

  test('PATCH /api/settings - updates session timeout', async () => {
    // Get current value
    const before = await request.get('/api/settings', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const originalTimeout = (await before.json() as any).data.sessionTimeoutSeconds;

    // Update
    const response = await request.patch('/api/settings', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { sessionTimeoutSeconds: 600 },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.sessionTimeoutSeconds).toBe(600);

    // Restore original
    await request.patch('/api/settings', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { sessionTimeoutSeconds: originalTimeout },
    });
  });
});

test.describe.serial('Settings API E2E - User Management', () => {
  const testUsername = `e2e_settings_${Date.now()}`;
  let testUserId: number;

  test('POST /api/settings/users - register user with companies', async () => {
    // Get existing companies
    const companiesRes = await request.get('/api/companies', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const companies = (await companiesRes.json() as any).data;
    const companyIds = companies.slice(0, 2).map((c: any) => c.id);

    const response = await request.post('/api/settings/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: testUsername, password: 'pass1234', companyIds },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.data.username).toBe(testUsername);
    expect(body.data.role).toBe('USER');
    expect(body.data.companies.length).toBe(companyIds.length);
    testUserId = body.data.id;
  });

  test('GET /api/settings/users - lists users with company mappings', async () => {
    const response = await request.get('/api/settings/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    const testUser = body.data.find((u: any) => u.username === testUsername);
    expect(testUser).toBeDefined();
    expect(testUser.companies.length).toBeGreaterThan(0);
  });

  test('PUT /api/settings/users/{id}/companies - update company access', async () => {
    const companiesRes = await request.get('/api/companies', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const companies = (await companiesRes.json() as any).data;
    const newCompanyIds = [companies[0].id];

    const response = await request.put(`/api/settings/users/${testUserId}/companies`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { companyIds: newCompanyIds },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.companies.length).toBe(1);
  });

  test('Company filtering - USER sees only assigned companies', async () => {
    // Login as test user
    const loginRes = await request.post('/api/auth/login', {
      data: { username: testUsername, password: 'pass1234' },
    });
    const userToken = (await loginRes.json() as any).data.token;

    // Fetch companies as user
    const response = await request.get('/api/companies', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.length).toBe(1);
  });

  test('DELETE /api/settings/users/{id} - deletes user', async () => {
    const response = await request.delete(`/api/settings/users/${testUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(response.status()).toBe(200);
  });

  test('DELETE /api/settings/users - cannot delete ADMIN', async () => {
    // Find admin user ID
    const usersRes = await request.get('/api/settings/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminUser = (await usersRes.json() as any).data.find((u: any) => u.role === 'ADMIN');

    const response = await request.delete(`/api/settings/users/${adminUser.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(response.status()).toBe(400);
  });
});

test.describe('Settings API E2E - Login Response', () => {
  test('Login response includes sessionTimeoutSeconds', async () => {
    const response = await request.post('/api/auth/login', {
      data: { username: 'admin', password: 'admin' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(typeof body.data.sessionTimeoutSeconds).toBe('number');
    expect(body.data.sessionTimeoutSeconds).toBeGreaterThan(0);
  });
});
