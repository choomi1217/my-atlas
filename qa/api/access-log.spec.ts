import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * Ops v36 — api_access_log polling exclusion API E2E
 *
 * Validates ApiAccessLogFilter.shouldNotFilter() behavior:
 *  - GET /api/agent-executions** is NOT written to api_access_log (3s worker polling,
 *    no consumer reads it, and it was poisoning the topEndpoints ranking).
 *  - The endpoint itself still answers normally — only logging was disabled.
 *  - Unrelated endpoints are still logged (proves monitoring wasn't killed wholesale).
 *  - GET /api/admin/monitoring/api-summary still returns a well-formed ApiAccessSummary.
 *
 * Observation channel: GET /api/admin/monitoring/api-summary?from&to (ADMIN only),
 * wrapped in the shared ApiResponse envelope (payload lives under body.data).
 *
 * ⚠️ This spec NEVER deletes from api_access_log (production data protection rule).
 * Every assertion is a BEFORE/AFTER delta against the live table, never "start from 0".
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

/**
 * How many polling GETs to fire in the core test.
 *
 * This CANNOT be a small fixed number. topEndpoints is `ORDER BY count DESC LIMIT 20`,
 * so a URI only becomes observable once it outranks the 20th entry. Firing 5 calls
 * against a DB whose 20th place sits at ~51 leaves the entry outside the window either
 * way, and the assertion then passes whether or not the filter excludes anything —
 * verified empirically: this spec passed unchanged against a backend WITHOUT the fix.
 *
 * So we read the current window and fire just past its threshold, making the row
 * observable if it were written at all.
 */
const CALL_MARGIN = 5;
/** Safety cap — never hammer the API to chase a very busy window. */
const MAX_POLLING_CALLS = 400;
/** Control calls to a logged endpoint, used as the "logging pipeline is alive" probe. */
const CONTROL_CALLS = 4;

/** URI prefix excluded from logging for GET (POLLING_GET_PREFIXES in ApiAccessLogFilter). */
const AGENT_EXEC_PREFIX = '/api/agent-executions';
/** URI_FEATURE_MAP maps /api/companies -> FEATURE. */
const CONTROL_FEATURE = 'FEATURE';

interface EndpointAccessCount {
  method: string;
  uri: string;
  count: number;
}

interface FeatureAccessCount {
  feature: string;
  count: number;
}

interface ApiAccessSummary {
  totalRequests: number;
  byFeature: FeatureAccessCount[];
  topEndpoints: EndpointAccessCount[];
}

let request: APIRequestContext;
let companyId: number;
let productId: number;

/**
 * Server timezone may differ from the runner's, so widen the window to
 * yesterday..tomorrow instead of betting on "today" boundaries.
 */
function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const FROM = isoDate(-1);
const TO = isoDate(1);

async function fetchSummary(): Promise<ApiAccessSummary> {
  const response = await request.get(
    `/api/admin/monitoring/api-summary?from=${FROM}&to=${TO}`,
  );
  expect(
    response.status(),
    `api-summary expected 200 but got ${response.status()}`,
  ).toBe(200);
  const body = (await response.json()) as { success: boolean; data: ApiAccessSummary };
  return body.data;
}

/** Total logged hits for GET requests under the /api/agent-executions prefix. */
function agentExecutionGetCount(summary: ApiAccessSummary): number {
  return summary.topEndpoints
    .filter((e) => e.method.toUpperCase() === 'GET' && e.uri.startsWith(AGENT_EXEC_PREFIX))
    .reduce((sum, e) => sum + e.count, 0);
}

function featureCount(summary: ApiAccessSummary, feature: string): number {
  return summary.byFeature.find((f) => f.feature === feature)?.count ?? 0;
}

test.beforeAll(async ({ playwright }) => {
  const base = await playwright.request.newContext({ baseURL: API_URL });
  const loginResp = await base.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin' },
  });
  expect(loginResp.status()).toBe(200);
  const token = (await loginResp.json() as { data: { token: string } }).data.token;
  await base.dispose();

  request = await playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  // Own resources only — named with "E2E" so cleanup filters stay safe.
  const companyResponse = await request.post('/api/companies', {
    data: { name: 'E2E Access Log Company' },
  });
  companyId = (await companyResponse.json() as { data: { id: number } }).data.id;

  const productResponse = await request.post('/api/products', {
    data: { companyId, name: 'E2E Access Log Product', platform: 'WEB' },
  });
  productId = (await productResponse.json() as { data: { id: number } }).data.id;
});

test.afterAll(async () => {
  // Delete only what this spec created (cascade from company). Seed data untouched.
  if (request && companyId) {
    await request.delete(`/api/companies/${companyId}`);
  }
  if (request) await request.dispose();
});

test.describe.configure({ mode: 'serial' });

test.describe('Ops v36 — api_access_log polling exclusion', () => {
  test('GET /api/agent-executions - answers 2xx but is not recorded in api_access_log', async () => {
    const before = await fetchSummary();
    const agentBefore = agentExecutionGetCount(before);
    const featureBefore = featureCount(before, CONTROL_FEATURE);

    // Size the burst so a logged row would actually surface in the LIMIT 20 window.
    const counts = before.topEndpoints.map((e) => e.count);
    const threshold = before.topEndpoints.length < 20 ? 0 : Math.min(...counts);
    const pollingCalls = threshold + CALL_MARGIN;
    test.skip(
      pollingCalls > MAX_POLLING_CALLS,
      `topEndpoints 20th place is ${threshold}; ${pollingCalls} calls would be needed to make the row observable, over the ${MAX_POLLING_CALLS} cap`,
    );

    // 1) Fire the polling GETs that used to flood the table.
    for (let i = 1; i <= pollingCalls; i += 1) {
      const resp = await request.get(`/api/agent-executions?productId=${productId}`);
      expect(
        resp.status(),
        `polling call ${i}/${pollingCalls} expected 200 but got ${resp.status()} — the endpoint must stay functional, only logging is off`,
      ).toBe(200);
      const body = (await resp.json()) as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    }

    // 2) Then fire control calls to a *logged* endpoint. Because these happen strictly
    //    after the polling calls, once the control rows become visible in the summary,
    //    any row the polling calls would have written is necessarily visible too.
    //    This gives a real happens-before barrier instead of a blind waitForTimeout.
    for (let i = 1; i <= CONTROL_CALLS; i += 1) {
      const resp = await request.get('/api/companies');
      expect(resp.status()).toBe(200);
    }

    // 3) Wait (condition-based) until the control traffic shows up in the summary.
    await expect
      .poll(
        async () => featureCount(await fetchSummary(), CONTROL_FEATURE),
        {
          message: `logged ${CONTROL_FEATURE} traffic never appeared in api-summary — the access-log pipeline itself looks broken`,
          timeout: 20_000,
          intervals: [250, 500, 1000, 2000],
        },
      )
      .toBeGreaterThanOrEqual(featureBefore + CONTROL_CALLS);

    // 4) The barrier has passed — the polling GETs must have added nothing.
    //    A pre-existing (historical) entry can only lose rank as other counters grow,
    //    so it can never *enter* the LIMIT 20 window on its own. Any increase here
    //    therefore means new rows were written for GET /api/agent-executions.
    const after = await fetchSummary();
    expect(
      agentExecutionGetCount(after),
      `GET ${AGENT_EXEC_PREFIX} count rose from ${agentBefore} after ${pollingCalls} polling calls (20th place was ${threshold}) — shouldNotFilter() is no longer excluding polling GETs`,
    ).toBeLessThanOrEqual(agentBefore);
  });

  test('GET /api/companies - unrelated endpoints are still recorded (regression guard)', async () => {
    const before = await fetchSummary();
    const totalBefore = before.totalRequests;
    const featureBefore = featureCount(before, CONTROL_FEATURE);

    for (let i = 1; i <= CONTROL_CALLS; i += 1) {
      const resp = await request.get('/api/companies');
      expect(resp.status()).toBe(200);
    }

    // byFeature/totalRequests are the reliable signal here: countByFeature has no LIMIT,
    // unlike topEndpoints (GROUP BY method, uri ... LIMIT 20) where a low-traffic URI can
    // legitimately fall outside the window on a busy DB.
    await expect
      .poll(
        async () => featureCount(await fetchSummary(), CONTROL_FEATURE),
        {
          message: `${CONTROL_FEATURE} traffic was not logged — v36 must exclude ONLY polling GETs, not disable access logging`,
          timeout: 20_000,
          intervals: [250, 500, 1000, 2000],
        },
      )
      .toBeGreaterThanOrEqual(featureBefore + CONTROL_CALLS);

    const after = await fetchSummary();
    expect(after.totalRequests).toBeGreaterThanOrEqual(totalBefore + CONTROL_CALLS);
  });

  test('GET /api/admin/monitoring/api-summary - returns a well-formed ApiAccessSummary', async () => {
    const response = await request.get(
      `/api/admin/monitoring/api-summary?from=${FROM}&to=${TO}`,
    );
    expect(response.status()).toBe(200);

    const body = (await response.json()) as { success: boolean; data: ApiAccessSummary };
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    const summary = body.data;
    expect(typeof summary.totalRequests).toBe('number');
    expect(summary.totalRequests).toBeGreaterThanOrEqual(0);

    // Shared dev DB always has data — assert structure, never emptiness.
    expect(Array.isArray(summary.byFeature)).toBe(true);
    expect(Array.isArray(summary.topEndpoints)).toBe(true);

    for (const entry of summary.byFeature) {
      expect(typeof entry.feature).toBe('string');
      expect(typeof entry.count).toBe('number');
    }

    for (const entry of summary.topEndpoints) {
      expect(typeof entry.method).toBe('string');
      expect(typeof entry.uri).toBe('string');
      expect(typeof entry.count).toBe('number');
    }

    // topEndpoints is GROUP BY method, uri ORDER BY count DESC LIMIT 20.
    expect(summary.topEndpoints.length).toBeLessThanOrEqual(20);
    const counts = summary.topEndpoints.map((e) => e.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});
