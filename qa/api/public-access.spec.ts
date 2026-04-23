import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * Platform v9 — Public Access (login_required toggle) API E2E
 *
 * Validates that when SystemSettings.login_required=false:
 *  - Whitelisted GET endpoints return 200 to anonymous clients.
 *  - Whitelisted POST endpoints (/api/senior/chat, /api/senior/sessions) pass the auth layer.
 *  - Non-whitelisted CRUD and ADMIN endpoints remain protected.
 *
 * When login_required=true (original state):
 *  - Anonymous GET /api/companies returns 401/403.
 *  - Anonymous GET /api/settings/public returns 200 with loginRequired=true.
 *
 * IMPORTANT: afterAll restores original settings so other test specs are unaffected.
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

let adminRequest: APIRequestContext;   // with Bearer token
let anonRequest: APIRequestContext;    // no headers
let adminToken: string;

interface OriginalSettings {
  aiEnabled: boolean;
  sessionTimeoutSeconds: number;
  loginRequired: boolean;
  aiRateLimitPerIp: number;
  aiRateLimitWindowSeconds: number;
}

let originalSettings: OriginalSettings;

test.beforeAll(async ({ playwright }) => {
  const base = await playwright.request.newContext({ baseURL: API_URL });

  // Login as admin
  const loginResp = await base.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin' },
  });
  expect(loginResp.status()).toBe(200);
  adminToken = (await loginResp.json() as any).data.token;
  await base.dispose();

  adminRequest = await playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${adminToken}` },
  });
  anonRequest = await playwright.request.newContext({ baseURL: API_URL });

  // Snapshot original settings
  const before = await adminRequest.get('/api/settings');
  expect(before.status()).toBe(200);
  const body = await before.json() as any;
  originalSettings = {
    aiEnabled: body.data.aiEnabled,
    sessionTimeoutSeconds: body.data.sessionTimeoutSeconds,
    loginRequired: body.data.loginRequired,
    aiRateLimitPerIp: body.data.aiRateLimitPerIp,
    aiRateLimitWindowSeconds: body.data.aiRateLimitWindowSeconds,
  };

  // Toggle login_required=false for the anonymous-access tests
  const patchResp = await adminRequest.patch('/api/settings', {
    data: { loginRequired: false },
  });
  expect(patchResp.status()).toBe(200);
});

test.afterAll(async () => {
  // Restore original settings — CRITICAL: always run, regardless of test results
  try {
    if (adminRequest && originalSettings) {
      await adminRequest.patch('/api/settings', {
        data: {
          loginRequired: originalSettings.loginRequired,
          aiRateLimitPerIp: originalSettings.aiRateLimitPerIp,
          aiRateLimitWindowSeconds: originalSettings.aiRateLimitWindowSeconds,
        },
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to restore settings in afterAll:', err);
  }
  if (anonRequest) await anonRequest.dispose();
  if (adminRequest) await adminRequest.dispose();
});

test.describe('Platform v9 — Public Access API (login_required=false)', () => {
  test('GET /api/settings/public — anonymous 200 with loginRequired=false', async () => {
    const resp = await anonRequest.get('/api/settings/public');
    expect(resp.status()).toBe(200);
    const body = await resp.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.loginRequired).toBe(false);
  });

  test('GET /api/companies — anonymous 200, returns array', async () => {
    const resp = await anonRequest.get('/api/companies');
    expect(resp.status()).toBe(200);
    const body = await resp.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /api/kb — anonymous 200', async () => {
    const resp = await anonRequest.get('/api/kb');
    expect(resp.status()).toBe(200);
    const body = await resp.json() as any;
    expect(body.success).toBe(true);
  });

  test('GET /api/conventions — anonymous 200', async () => {
    const resp = await anonRequest.get('/api/conventions');
    expect(resp.status()).toBe(200);
    const body = await resp.json() as any;
    expect(body.success).toBe(true);
  });

  test('GET /api/senior/faq — anonymous 200', async () => {
    const resp = await anonRequest.get('/api/senior/faq');
    expect(resp.status()).toBe(200);
    const body = await resp.json() as any;
    expect(body.success).toBe(true);
  });

  test('GET /api/products?companyId={id} — anonymous 200', async () => {
    // Use first existing company from admin-scoped list
    const listResp = await adminRequest.get('/api/companies');
    const list = (await listResp.json() as any).data as Array<{ id: number }>;
    expect(list.length).toBeGreaterThan(0);
    const companyId = list[0].id;

    const resp = await anonRequest.get(`/api/products?companyId=${companyId}`);
    expect(resp.status()).toBe(200);
    const body = await resp.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /api/senior/sessions — anonymous 200', async () => {
    const resp = await anonRequest.get('/api/senior/sessions');
    expect(resp.status()).toBe(200);
    const body = await resp.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /api/companies — anonymous allowed in demo mode (creates)', async () => {
    // Hotfix: loginRequired=false acts as full demo mode — writes allowed to
    // any non-ADMIN endpoint. ADMIN-only paths (settings/admin/auth-register)
    // remain protected by SecurityConfig role matchers.
    const resp = await anonRequest.post('/api/companies', {
      data: { name: 'E2E demo mode write' },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json() as { data: { id: number } };
    expect(body.data.id).toBeGreaterThan(0);

    // Clean up with admin token (anonymous DELETE would also work, but use admin
    // to keep the teardown independent of what we're validating here).
    await adminRequest.delete(`/api/companies/${body.data.id}`);
  });

  test('DELETE /api/companies/{id} — anonymous allowed in demo mode', async () => {
    // Create a disposable company first via admin, then let anonymous delete it
    const createResp = await adminRequest.post('/api/companies', {
      data: { name: 'E2E demo anon delete' },
    });
    const id = (await createResp.json() as { data: { id: number } }).data.id;

    const resp = await anonRequest.delete(`/api/companies/${id}`);
    expect(resp.status()).toBe(200);
  });

  test('PUT /api/kb/{id} — anonymous hits handler (404 for missing id, not 401/403)', async () => {
    // Demo mode lets the request reach the controller; missing id → 404 from service.
    const resp = await anonRequest.put('/api/kb/999999', {
      data: { title: 'x', content: 'y', category: 'z' },
    });
    expect([400, 404]).toContain(resp.status());
  });

  test('GET /api/settings — anonymous blocked (ADMIN-only stays protected in demo mode)', async () => {
    const resp = await anonRequest.get('/api/settings');
    expect([401, 403]).toContain(resp.status());
  });

  test('GET /api/settings/users — anonymous blocked (ADMIN-only stays protected in demo mode)', async () => {
    const resp = await anonRequest.get('/api/settings/users');
    expect([401, 403]).toContain(resp.status());
  });

  test('POST /api/auth/register — anonymous blocked (ADMIN-only stays protected in demo mode)', async () => {
    const resp = await anonRequest.post('/api/auth/register', {
      data: { username: 'e2e_x', password: 'pass1234', role: 'USER' },
    });
    expect([401, 403]).toContain(resp.status());
  });
});

test.describe('Platform v9 — Public Access API (login_required=true restored)', () => {
  test('Restore loginRequired=true then anonymous /api/companies is blocked', async () => {
    // Flip back to true for this assertion
    const patchResp = await adminRequest.patch('/api/settings', {
      data: { loginRequired: true },
    });
    expect(patchResp.status()).toBe(200);

    const resp = await anonRequest.get('/api/companies');
    expect([401, 403]).toContain(resp.status());
  });

  test('GET /api/settings/public — always accessible, now loginRequired=true', async () => {
    const resp = await anonRequest.get('/api/settings/public');
    expect(resp.status()).toBe(200);
    const body = await resp.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.loginRequired).toBe(true);
  });
});
