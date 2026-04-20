import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * API E2E for the new TestCase path endpoints introduced in Test Studio v2:
 *   - PATCH  /api/test-cases/{id}/path
 *   - POST   /api/test-cases/{id}/apply-suggested-path
 *   - POST   /api/test-cases/bulk-apply-suggested-path
 *
 * Cost control:
 *   - These tests never submit a Test Studio generation job, so no Claude / OpenAI
 *     calls are triggered. `apply-suggested-path` success (which walks a real
 *     suggestion through SegmentPathResolver) is exercised in backend unit tests —
 *     here we only cover the error branches that short-circuit before any AI work.
 *   - Fixture company / product / segments are created directly via CRUD APIs
 *     and cleaned up in afterAll.
 */

let request: APIRequestContext;
const API_URL = process.env.API_URL || 'http://localhost:8080';

test.beforeAll(async ({ playwright }) => {
  const loginCtx = await playwright.request.newContext({ baseURL: API_URL });
  const loginResp = await loginCtx.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin' },
  });
  const token = ((await loginResp.json()) as any).data.token;
  await loginCtx.dispose();

  request = await playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
});

test.afterAll(async () => {
  await request.dispose();
});

test.describe.configure({ mode: 'serial' });

test.describe('TestCase Path API E2E', () => {
  // Primary product + 2 segments
  let companyId: number;
  let productId: number;
  let segA: number;
  let segB: number;

  // Other product under a DIFFERENT company, used to prove cross-product segments
  // are rejected by validatePathBelongsToProduct.
  let otherCompanyId: number;
  let otherProductId: number;
  let otherSegmentId: number;

  // TCs created during the suite (cleaned up individually)
  const createdTcIds: number[] = [];

  test.beforeAll(async () => {
    // Clean up E2E companies from previous runs (name-prefixed, never seed data).
    const list = (
      (await (await request.get('/api/companies')).json()) as any
    ).data as { id: number; name: string }[];
    for (const c of list ?? []) {
      if (
        typeof c.name === 'string' &&
        (c.name.includes('E2E Path') || c.name.includes('E2E OtherProduct'))
      ) {
        await request.delete(`/api/companies/${c.id}`).catch(() => {});
      }
    }

    // Primary fixture scope
    const cResp = await request.post('/api/companies', {
      data: { name: 'E2E Path Co' },
    });
    expect(cResp.status()).toBe(201);
    companyId = ((await cResp.json()) as any).data.id;

    const pResp = await request.post('/api/products', {
      data: { companyId, name: 'E2E Path Product', platform: 'WEB' },
    });
    expect(pResp.status()).toBe(201);
    productId = ((await pResp.json()) as any).data.id;

    const sA = await request.post('/api/segments', {
      data: { productId, name: 'E2E Path Segment A', parentId: null },
    });
    expect(sA.status()).toBe(201);
    segA = ((await sA.json()) as any).data.id;

    const sB = await request.post('/api/segments', {
      data: { productId, name: 'E2E Path Segment B', parentId: segA },
    });
    expect(sB.status()).toBe(201);
    segB = ((await sB.json()) as any).data.id;

    // Secondary scope — for the cross-product 400 test.
    const cResp2 = await request.post('/api/companies', {
      data: { name: 'E2E OtherProduct Co' },
    });
    expect(cResp2.status()).toBe(201);
    otherCompanyId = ((await cResp2.json()) as any).data.id;

    const pResp2 = await request.post('/api/products', {
      data: {
        companyId: otherCompanyId,
        name: 'E2E OtherProduct Product',
        platform: 'WEB',
      },
    });
    expect(pResp2.status()).toBe(201);
    otherProductId = ((await pResp2.json()) as any).data.id;

    const sO = await request.post('/api/segments', {
      data: { productId: otherProductId, name: 'E2E Other Seg', parentId: null },
    });
    expect(sO.status()).toBe(201);
    otherSegmentId = ((await sO.json()) as any).data.id;
  });

  test.afterAll(async () => {
    // Delete TCs first (idempotent — ignore if CASCADE already handled them).
    for (const id of createdTcIds) {
      await request.delete(`/api/test-cases/${id}`).catch(() => {});
    }
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
    if (otherCompanyId) {
      await request.delete(`/api/companies/${otherCompanyId}`).catch(() => {});
    }
  });

  // Helper: create a fresh DRAFT TC with empty path, return its id.
  const createDraftTc = async (title: string): Promise<number> => {
    const resp = await request.post('/api/test-cases', {
      data: {
        productId,
        path: [],
        title,
        description: 'E2E path test',
        priority: 'MEDIUM',
        testType: 'FUNCTIONAL',
        status: 'DRAFT',
        steps: [{ order: 1, action: 'a', expected: 'b' }],
      },
    });
    expect(resp.status()).toBe(201);
    const id = ((await resp.json()) as any).data.id as number;
    createdTcIds.push(id);
    return id;
  };

  test('PATCH /api/test-cases/{id}/path — sets path on existing TC (200)', async () => {
    const tcId = await createDraftTc('E2E PATCH path set');

    const resp = await request.patch(`/api/test-cases/${tcId}/path`, {
      data: { path: [segA, segB] },
    });
    expect(resp.status()).toBe(200);
    const body = (await resp.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(tcId);
    expect(Array.isArray(body.data.path)).toBe(true);
    expect(body.data.path).toEqual([segA, segB]);
  });

  test('PATCH /api/test-cases/{id}/path — clears path to empty array (200)', async () => {
    const tcId = await createDraftTc('E2E PATCH path clear');

    // First, set it to something non-empty.
    const set = await request.patch(`/api/test-cases/${tcId}/path`, {
      data: { path: [segA] },
    });
    expect(set.status()).toBe(200);

    // Now clear.
    const resp = await request.patch(`/api/test-cases/${tcId}/path`, {
      data: { path: [] },
    });
    expect(resp.status()).toBe(200);
    const body = (await resp.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(tcId);
    expect(Array.isArray(body.data.path)).toBe(true);
    expect(body.data.path).toEqual([]);
  });

  test('PATCH /api/test-cases/{id}/path — 400 when segment not in product', async () => {
    const tcId = await createDraftTc('E2E PATCH wrong product');

    const resp = await request.patch(`/api/test-cases/${tcId}/path`, {
      data: { path: [otherSegmentId] },
    });
    expect(resp.status()).toBe(400);
    const body = (await resp.json()) as any;
    expect(body.success).toBe(false);
  });

  test('apply-suggested-path — returns NO_SUGGESTION error when TC has no suggestion (200)', async () => {
    // Manually-created TCs never carry a stored suggestion — only the Test Studio
    // generator writes suggestedSegmentPath. So this hits the NO_SUGGESTION branch.
    const tcId = await createDraftTc('E2E apply no-suggestion');

    const resp = await request.post(
      `/api/test-cases/${tcId}/apply-suggested-path`,
    );
    expect(resp.status()).toBe(200);
    const body = (await resp.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.testCaseId).toBe(tcId);
    expect(body.data.error).toBe('NO_SUGGESTION');
    expect(body.data.resolvedLength).toBe(0);
    expect(Array.isArray(body.data.resolvedPath)).toBe(true);
    expect(body.data.resolvedPath.length).toBe(0);
  });

  test('bulk-apply-suggested-path — returns NOT_FOUND for missing ids (200)', async () => {
    const resp = await request.post(
      '/api/test-cases/bulk-apply-suggested-path',
      {
        data: { testCaseIds: [999999] },
      },
    );
    expect(resp.status()).toBe(200);
    const body = (await resp.json()) as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);
    const entry = body.data[0];
    expect(entry.testCaseId).toBe(999999);
    expect(entry.error).toBe('NOT_FOUND');
  });
});
