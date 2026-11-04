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
});

test.afterAll(async () => {
  await request.dispose();
});

test.describe('Ticket API E2E', () => {
  let companyId: number;
  let productId: number;
  let versionId: number;
  let phaseId: number;
  let testRunId: number;
  let testCaseId: number;
  let segmentId: number;
  let resultId: number;
  let notionConfigured: boolean;

  test.beforeAll(async () => {
    const configResponse = await request.get('/api/tickets/config');
    notionConfigured = (await configResponse.json() as any).data.configured === true;

    // Create test company
    const companyResponse = await request.post('/api/companies', {
      data: { name: 'E2E Ticket Company' },
    });
    const companyBody = await companyResponse.json() as any;
    companyId = companyBody.data.id;

    // Create test product
    const productResponse = await request.post('/api/products', {
      data: {
        companyId,
        name: 'E2E Ticket Product',
        platform: 'WEB',
      },
    });
    const productBody = await productResponse.json() as any;
    productId = productBody.data.id;

    // Create segment
    const segmentResponse = await request.post('/api/segments', {
      data: {
        productId,
        name: 'Ticket Segment',
        parentId: null,
      },
    });
    const segmentBody = await segmentResponse.json() as any;
    segmentId = segmentBody.data.id;

    // Create test case
    const tcResponse = await request.post('/api/test-cases', {
      data: {
        productId,
        title: 'Ticket TC 1',
        path: [segmentId],
        priority: 'HIGH',
        testType: 'FUNCTIONAL',
        status: 'DRAFT',
      },
    });
    const tcBody = await tcResponse.json() as any;
    testCaseId = tcBody.data.id;

    // Create test run
    const testRunResponse = await request.post(`/api/products/${productId}/test-runs`, {
      data: {
        name: 'E2E Ticket Test Run',
        description: 'Test run for ticket tests',
        testCaseIds: [testCaseId],
      },
    });
    const testRunBody = await testRunResponse.json() as any;
    testRunId = testRunBody.data.id;

    // Create version (simplified: no phases)
    const versionResponse = await request.post(`/api/products/${productId}/versions`, {
      data: {
        productId,
        name: 'v-ticket-test',
        releaseDate: null,
        description: 'Version for ticket testing',
      },
    });
    expect(versionResponse.status()).toBe(201);
    const versionBody = await versionResponse.json() as any;
    versionId = versionBody.data.id;

    // Add phase via Phase API (with testRunIds so results are generated)
    const phaseResponse = await request.post(`/api/versions/${versionId}/phases`, {
      data: {
        phaseName: 'Ticket Phase',
        testRunIds: [testRunId],
        testCaseIds: [],
      },
    });
    expect(phaseResponse.status()).toBe(201);
    const phaseBody = await phaseResponse.json() as any;
    phaseId = phaseBody.data.id;

    // Get test results for this phase to find a resultId
    const resultsResponse = await request.get(
      `/api/versions/${versionId}/phases/${phaseId}/results`
    );
    expect(resultsResponse.status()).toBe(200);
    const resultsBody = await resultsResponse.json() as any;
    expect(Array.isArray(resultsBody.data)).toBe(true);
    expect(resultsBody.data.length).toBeGreaterThan(0);
    resultId = resultsBody.data[0].id;
  });

  test('GET /api/versions/{versionId}/results/{resultId}/tickets - 빈 티켓 목록 조회', async () => {
    const response = await request.get(
      `/api/versions/${versionId}/results/${resultId}/tickets`
    );
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    // Initially no tickets
    expect(body.data.length).toBe(0);
  });

  test('GET /api/tickets/config - tracker NOTION, configured boolean', async () => {
    const response = await request.get('/api/tickets/config');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.tracker).toBe('NOTION');
    expect(typeof body.data.configured).toBe('boolean');
  });

  // 실제 Notion 페이지를 만들지 않도록 발행(POST)은 미설정 환경에서만 검증한다 (CI에는 Notion 토큰 없음).
  // 발행 성공 이후의 조회·새로고침·삭제는 실제 페이지가 필요해 E2E 범위 밖이다 (단위 테스트가 담당).
  test('POST /api/versions/{versionId}/results/{resultId}/tickets - Notion 미설정 시 502, 티켓 미생성', async () => {
    test.skip(notionConfigured, 'Notion 연동이 설정돼 있어 실제 페이지가 생기므로 건너뜀');

    const response = await request.post(
      `/api/versions/${versionId}/results/${resultId}/tickets`,
      {
        data: {
          summary: 'FAIL: E2E Ticket Test',
          description: 'Test ticket from E2E',
          priority: 'HIGH',
        },
      }
    );

    expect(response.status()).toBe(502);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain('Notion 연동이 설정되지 않았습니다');

    const listResponse = await request.get(
      `/api/versions/${versionId}/results/${resultId}/tickets`
    );
    const listBody = await listResponse.json() as any;
    expect(listBody.data).toEqual([]);
  });

  test('POST /api/versions/{versionId}/phases/{phaseId}/tickets/refresh-all - 티켓 없는 Phase는 0건', async () => {
    const response = await request.post(
      `/api/versions/${versionId}/phases/${phaseId}/tickets/refresh-all`
    );
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data).toBe(0);
  });

  test.afterAll(async () => {
    // Cleanup test company (cascades to product, version, etc.)
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});
