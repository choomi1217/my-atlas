import { test, expect, APIRequestContext } from '@playwright/test';

let request: APIRequestContext;
const API_URL = process.env.API_URL || 'http://localhost:8080';

/**
 * Test Studio API E2E tests.
 *
 * NOTE (cost control):
 *   The POST /api/test-studio/jobs endpoint triggers an async Claude + OpenAI
 *   pipeline (TestStudioGenerator) that costs money per run. Only the
 *   "MARKDOWN creates job" path actually launches the generator; all other
 *   tests exercise 400 validation branches that short-circuit before any AI
 *   call. Assertions never wait for status === DONE (DONE may take 20–40s
 *   and is non-deterministic). We accept any status in the enum.
 */
const VALID_STATUSES = ['PENDING', 'PROCESSING', 'DONE', 'FAILED'] as const;

test.beforeAll(async ({ playwright }) => {
  // Login as admin for all subsequent requests
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

test.describe('Test Studio API E2E', () => {
  let companyId: number;
  let productId: number;
  const createdJobIds: number[] = [];
  let primaryJobId: number | null = null;

  test.beforeAll(async () => {
    // Clean up only E2E/TestStudio-named companies from prior runs
    const resp = await request.get('/api/companies');
    const body = (await resp.json()) as any;
    const list: { id: number; name: string }[] = body.data || [];
    for (const c of list) {
      if (
        typeof c.name === 'string' &&
        (c.name.includes('E2E') || c.name.includes('TestStudio'))
      ) {
        await request.delete(`/api/companies/${c.id}`).catch(() => {});
      }
    }

    // Seed company + product for the test product scope
    const cResp = await request.post('/api/companies', {
      data: { name: 'E2E TestStudio API Co' },
    });
    expect(cResp.status()).toBe(201);
    companyId = ((await cResp.json()) as any).data.id;

    const pResp = await request.post('/api/products', {
      data: { companyId, name: 'E2E TestStudio API Product', platform: 'WEB' },
    });
    expect(pResp.status()).toBe(201);
    productId = ((await pResp.json()) as any).data.id;
  });

  test.afterAll(async () => {
    // Clean up any jobs we created (delete may 400 if already deleted — ignore)
    for (const id of createdJobIds) {
      await request.delete(`/api/test-studio/jobs/${id}`).catch(() => {});
    }
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });

  test('POST /api/test-studio/jobs - MARKDOWN creates job (201)', async () => {
    const response = await request.post('/api/test-studio/jobs', {
      multipart: {
        productId: String(productId),
        sourceType: 'MARKDOWN',
        title: 'E2E NFC PRD',
        content: '# NFC 결제 기능\n- 사용자가 카드를 태그하면 결제가 완료된다.',
      },
    });
    expect(response.status()).toBe(201);
    const body = (await response.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(typeof body.data.jobId).toBe('number');

    primaryJobId = body.data.jobId as number;
    createdJobIds.push(primaryJobId);
  });

  test('POST /api/test-studio/jobs - 400 when product does not exist', async () => {
    const response = await request.post('/api/test-studio/jobs', {
      multipart: {
        productId: '999999999',
        sourceType: 'MARKDOWN',
        title: 'E2E Bogus Product Job',
        content: 'any content',
      },
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as any;
    expect(body.success).toBe(false);
  });

  test('POST /api/test-studio/jobs - 400 when markdown content missing', async () => {
    const response = await request.post('/api/test-studio/jobs', {
      multipart: {
        productId: String(productId),
        sourceType: 'MARKDOWN',
        title: 'E2E Missing Content',
      },
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as any;
    expect(body.success).toBe(false);
  });

  test('POST /api/test-studio/jobs - 400 when title blank', async () => {
    const response = await request.post('/api/test-studio/jobs', {
      multipart: {
        productId: String(productId),
        sourceType: 'MARKDOWN',
        title: '   ',
        content: 'some content',
      },
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as any;
    expect(body.success).toBe(false);
  });

  test('POST /api/test-studio/jobs - 400 when markdown content too long', async () => {
    const longContent = 'a'.repeat(100_001);
    const response = await request.post('/api/test-studio/jobs', {
      multipart: {
        productId: String(productId),
        sourceType: 'MARKDOWN',
        title: 'E2E Oversize',
        content: longContent,
      },
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as any;
    expect(body.success).toBe(false);
  });

  test('GET /api/test-studio/jobs?productId - includes created job with valid status', async () => {
    expect(primaryJobId).not.toBeNull();

    const response = await request.get(
      `/api/test-studio/jobs?productId=${productId}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const found = body.data.find((j: any) => j.id === primaryJobId);
    expect(found).toBeDefined();
    expect(typeof found.id).toBe('number');
    expect(found.sourceType).toBe('MARKDOWN');
    expect(found.sourceTitle).toBe('E2E NFC PRD');
    expect(VALID_STATUSES).toContain(found.status);
  });

  test('GET /api/test-studio/jobs/{id} - returns detail with valid status', async () => {
    expect(primaryJobId).not.toBeNull();

    const response = await request.get(
      `/api/test-studio/jobs/${primaryJobId}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(primaryJobId);
    expect(body.data.sourceTitle).toBe('E2E NFC PRD');
    expect(body.data.sourceType).toBe('MARKDOWN');
    expect(VALID_STATUSES).toContain(body.data.status);
  });

  test('GET /api/test-studio/jobs/{id} - 400 for unknown id', async () => {
    const response = await request.get('/api/test-studio/jobs/99999999');
    expect(response.status()).toBe(400);
    const body = (await response.json()) as any;
    expect(body.success).toBe(false);
  });

  test('DELETE /api/test-studio/jobs/{id} - 204 then 400 on re-fetch', async () => {
    expect(primaryJobId).not.toBeNull();

    const delResp = await request.delete(
      `/api/test-studio/jobs/${primaryJobId}`,
    );
    expect(delResp.status()).toBe(204);

    // remove from the cleanup list — we've deleted it
    const idx = createdJobIds.indexOf(primaryJobId as number);
    if (idx >= 0) createdJobIds.splice(idx, 1);

    const getResp = await request.get(
      `/api/test-studio/jobs/${primaryJobId}`,
    );
    expect(getResp.status()).toBe(400);

    primaryJobId = null;
  });
});
