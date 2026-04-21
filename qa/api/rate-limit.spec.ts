import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * Platform v9 — AI Rate Limit (IP-based) API E2E
 *
 * Validates AiRateLimitFilter behavior:
 *  - Anonymous users hit 429 when they exceed `ai_rate_limit_per_ip` within the window.
 *  - Authenticated users are exempt.
 *  - Separate IPs (via X-Forwarded-For) each get their own bucket.
 *  - 429 payload is an ApiResponse with message + data.retryAfterSeconds, plus a Retry-After header.
 *
 * Strategy: temporarily set aiRateLimitPerIp=2, window=60. Keep AI messages minimal (cost).
 *
 * IMPORTANT: afterAll restores original settings so other test specs are unaffected.
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

// Small limit for fast verification
const TEST_LIMIT = 2;
// Long enough that window expiration can't affect ordering in full suite;
// unique IP octets below ensure no collision with prior runs or sibling specs.
const TEST_WINDOW = 3600;

// Unique IP prefix per test-file run — avoids counter state leaking across runs
// (AiRateLimitFilter cache is in-memory and persists while backend process lives).
const UNIQUE = `${Math.floor(Math.random() * 200 + 20)}.${Math.floor(Math.random() * 200 + 20)}`;
const IP_A = `10.${UNIQUE}.10`;
const IP_B = `10.${UNIQUE}.20`;
const IP_ROGUE = `10.${UNIQUE}.55`;

interface OriginalSettings {
  aiEnabled: boolean;
  loginRequired: boolean;
  aiRateLimitPerIp: number;
  aiRateLimitWindowSeconds: number;
}

let adminRequest: APIRequestContext;
let anonRequest: APIRequestContext;         // no X-Forwarded-For
let anonRequestIpA: APIRequestContext;      // X-Forwarded-For: 10.10.10.10
let anonRequestIpB: APIRequestContext;      // X-Forwarded-For: 10.20.30.40
let adminToken: string;
let originalSettings: OriginalSettings;
let restoredAiEnabled = false;   // track whether we had to flip ai_enabled

test.beforeAll(async ({ playwright }) => {
  const base = await playwright.request.newContext({ baseURL: API_URL });
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

  // Snapshot current settings
  const before = await adminRequest.get('/api/settings');
  const body = await before.json() as any;
  originalSettings = {
    aiEnabled: body.data.aiEnabled,
    loginRequired: body.data.loginRequired,
    aiRateLimitPerIp: body.data.aiRateLimitPerIp,
    aiRateLimitWindowSeconds: body.data.aiRateLimitWindowSeconds,
  };

  // AI must be enabled for this test (otherwise Senior Chat returns 503)
  if (!originalSettings.aiEnabled) {
    await adminRequest.patch('/api/settings', { data: { aiEnabled: true } });
    restoredAiEnabled = true;
  }

  // Apply test config: loginRequired=false + small limit/window
  await adminRequest.patch('/api/settings', {
    data: {
      loginRequired: false,
      aiRateLimitPerIp: TEST_LIMIT,
      aiRateLimitWindowSeconds: TEST_WINDOW,
    },
  });

  // Anonymous contexts — force distinct X-Forwarded-For for IP segregation
  anonRequest = await playwright.request.newContext({ baseURL: API_URL });
  anonRequestIpA = await playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { 'X-Forwarded-For': IP_A },
  });
  anonRequestIpB = await playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { 'X-Forwarded-For': IP_B },
  });
});

test.afterAll(async () => {
  try {
    if (adminRequest && originalSettings) {
      await adminRequest.patch('/api/settings', {
        data: {
          loginRequired: originalSettings.loginRequired,
          aiRateLimitPerIp: originalSettings.aiRateLimitPerIp,
          aiRateLimitWindowSeconds: originalSettings.aiRateLimitWindowSeconds,
          ...(restoredAiEnabled ? { aiEnabled: originalSettings.aiEnabled } : {}),
        },
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to restore rate-limit settings:', err);
  }
  if (anonRequest) await anonRequest.dispose();
  if (anonRequestIpA) await anonRequestIpA.dispose();
  if (anonRequestIpB) await anonRequestIpB.dispose();
  if (adminRequest) await adminRequest.dispose();
});

test.describe.configure({ mode: 'serial' });

test.describe('Platform v9 — AI Rate Limit (IP-based)', () => {
  test.beforeEach(async () => {
    // Re-apply test settings before every test to guard against inter-spec interference.
    await adminRequest.patch('/api/settings', {
      data: {
        loginRequired: false,
        aiRateLimitPerIp: TEST_LIMIT,
        aiRateLimitWindowSeconds: TEST_WINDOW,
      },
    });
  });

  test('Anonymous POST /api/senior/sessions — first TEST_LIMIT requests pass, next is 429', async () => {
    // Use X-Forwarded-For IP A — isolated bucket
    for (let i = 1; i <= TEST_LIMIT; i += 1) {
      const resp = await anonRequestIpA.post('/api/senior/sessions');
      expect(
        resp.status(),
        `call ${i}/${TEST_LIMIT} expected 2xx but got ${resp.status()}`,
      ).toBeLessThan(400);
    }

    const over = await anonRequestIpA.post('/api/senior/sessions');
    expect(over.status()).toBe(429);

    // Retry-After header
    const retryAfter = over.headers()['retry-after'];
    expect(retryAfter).toBeDefined();
    expect(Number(retryAfter)).toBeGreaterThan(0);
    expect(Number.isInteger(Number(retryAfter))).toBe(true);

    // Content-Type and body shape
    const contentType = over.headers()['content-type'] || '';
    expect(contentType).toContain('application/json');

    const body = await over.json() as any;
    expect(body.success).toBe(false);
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
    // Message is Korean per implementation — expect at least one Hangul character
    expect(body.message).toMatch(/[가-힣]/);
    expect(body.data).toBeDefined();
    expect(typeof body.data.retryAfterSeconds).toBe('number');
    expect(body.data.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('POST /api/senior/chat also counted against the same IP bucket', async () => {
    // IP A has already exceeded; any call to /api/senior/chat from same IP must 429
    const resp = await anonRequestIpA.post('/api/senior/chat', {
      data: { message: 'hi' },
    });
    expect(resp.status()).toBe(429);
  });

  test('Different X-Forwarded-For IP has its own bucket (not yet exceeded)', async () => {
    // IP B: first request should succeed (bucket fresh)
    const resp = await anonRequestIpB.post('/api/senior/sessions');
    expect(resp.status()).toBeLessThan(400);
  });

  test('Authenticated ADMIN is exempt from rate limit', async () => {
    // ADMIN should be able to call /api/senior/sessions well past TEST_LIMIT
    const iterations = TEST_LIMIT + 3;  // clearly above the limit
    for (let i = 1; i <= iterations; i += 1) {
      const resp = await adminRequest.post('/api/senior/sessions');
      expect(
        resp.status(),
        `admin call ${i} expected success but got ${resp.status()}`,
      ).toBeLessThan(400);
    }
  });

  test('Anonymous POST /api/senior/chat — rate limit headers set when anonymous allowed', async ({ playwright }) => {
    // Use a fresh distinct IP so we don't collide with earlier IP-A exhaustion.
    // This test verifies the *shape* of a rate-limit exceeded response structure.
    // If anonymous flow is completely blocked (403), this test documents that gap.
    const rogueIp = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { 'X-Forwarded-For': IP_ROGUE },
    });
    try {
      // First call — may be 2xx (whitelist allowed) or 403 (broken anonymous gate).
      const first = await rogueIp.post('/api/senior/sessions');
      // If 2xx, exhaust bucket (TEST_LIMIT=2) and assert 429 headers
      if (first.status() < 400) {
        await rogueIp.post('/api/senior/sessions');   // use up 2nd allowed call
        const over = await rogueIp.post('/api/senior/sessions');
        expect(over.status()).toBe(429);
        expect(over.headers()['retry-after']).toBeDefined();
      } else {
        // Anonymous blocked outright — test framework should surface this
        expect.soft(first.status(), 'anonymous POST should be 2xx when loginRequired=false').toBeLessThan(400);
      }
    } finally {
      await rogueIp.dispose();
    }
  });
});
