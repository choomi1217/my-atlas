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

  // ─────────────────────────────────────────────────────────────────────────
  // v2 additions — companyId scope + validation + status filter on /test-cases
  // ─────────────────────────────────────────────────────────────────────────

  test('GET /api/test-studio/jobs - 400 when neither productId nor companyId provided', async () => {
    const response = await request.get('/api/test-studio/jobs');
    expect(response.status()).toBe(400);
    const body = (await response.json()) as any;
    expect(body.success).toBe(false);
  });

  test('GET /api/test-studio/jobs - 400 when both productId and companyId provided', async () => {
    const response = await request.get(
      `/api/test-studio/jobs?productId=${productId}&companyId=${companyId}`,
    );
    expect(response.status()).toBe(400);
    const body = (await response.json()) as any;
    expect(body.success).toBe(false);
  });

  test('GET /api/test-studio/jobs?companyId - returns jobs across all products in company', async () => {
    // Create a SECOND product under the same company so we can prove the
    // company-scoped endpoint aggregates across products.
    const pResp = await request.post('/api/products', {
      data: { companyId, name: 'E2E TestStudio API Product 2', platform: 'WEB' },
    });
    expect(pResp.status()).toBe(201);
    const productId2 = ((await pResp.json()) as any).data.id as number;

    // One job per product. POST triggers the async Claude pipeline — keep the
    // markdown tiny to minimise tokens. These 2 POSTs are the only
    // LLM-triggering calls in the v2 additions.
    const make = async (pid: number, title: string) => {
      const resp = await request.post('/api/test-studio/jobs', {
        multipart: {
          productId: String(pid),
          sourceType: 'MARKDOWN',
          title,
          content: '# t\n- a.',
        },
      });
      expect(resp.status()).toBe(201);
      const jobId = ((await resp.json()) as any).data.jobId as number;
      createdJobIds.push(jobId);
      return jobId;
    };

    const jobA = await make(productId, 'E2E CompanyScope A');
    const jobB = await make(productId2, 'E2E CompanyScope B');

    const listResp = await request.get(
      `/api/test-studio/jobs?companyId=${companyId}`,
    );
    expect(listResp.status()).toBe(200);
    const body = (await listResp.json()) as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const ids = body.data.map((j: any) => j.id);
    expect(ids).toContain(jobA);
    expect(ids).toContain(jobB);

    // Sanity: the aggregate includes jobs from at least 2 distinct products.
    const pidsInResult = new Set(
      body.data.map((j: any) => j.productId).filter((v: unknown) => v != null),
    );
    expect(pidsInResult.has(productId)).toBe(true);
    expect(pidsInResult.has(productId2)).toBe(true);
  });

  test('GET /api/test-cases?companyId&status=DRAFT - filters by status across products', async () => {
    // New scope: create a dedicated company with 2 products. This avoids
    // interference from the primary productId which now has DRAFT TCs created
    // asynchronously by the Test Studio generator.
    const cResp = await request.post('/api/companies', {
      data: { name: 'E2E CompanyScope Co' },
    });
    expect(cResp.status()).toBe(201);
    const scopeCompanyId = ((await cResp.json()) as any).data.id as number;

    try {
      const makeProduct = async (n: number): Promise<number> => {
        const r = await request.post('/api/products', {
          data: {
            companyId: scopeCompanyId,
            name: `E2E CompanyScope P${n}`,
            platform: 'WEB',
          },
        });
        expect(r.status()).toBe(201);
        return ((await r.json()) as any).data.id as number;
      };
      const p1 = await makeProduct(1);
      const p2 = await makeProduct(2);

      const makeTc = async (
        pid: number,
        title: string,
        status: 'DRAFT' | 'ACTIVE',
      ): Promise<number> => {
        const r = await request.post('/api/test-cases', {
          data: {
            productId: pid,
            path: [],
            title,
            description: 'scope filter test',
            priority: 'MEDIUM',
            testType: 'FUNCTIONAL',
            status,
            steps: [{ order: 1, action: 'a', expected: 'b' }],
          },
        });
        expect(r.status()).toBe(201);
        return ((await r.json()) as any).data.id as number;
      };
      const d1 = await makeTc(p1, 'E2E Scope DRAFT 1', 'DRAFT');
      const d2 = await makeTc(p2, 'E2E Scope DRAFT 2', 'DRAFT');
      const a1 = await makeTc(p1, 'E2E Scope ACTIVE 1', 'ACTIVE');

      const resp = await request.get(
        `/api/test-cases?companyId=${scopeCompanyId}&status=DRAFT`,
      );
      expect(resp.status()).toBe(200);
      const body = (await resp.json()) as any;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);

      const ids: number[] = body.data.map((t: any) => t.id);
      expect(ids).toContain(d1);
      expect(ids).toContain(d2);
      expect(ids).not.toContain(a1);

      // Everything returned should be DRAFT.
      for (const tc of body.data) {
        expect(tc.status).toBe('DRAFT');
      }
    } finally {
      await request.delete(`/api/companies/${scopeCompanyId}`).catch(() => {});
    }
  });
});
