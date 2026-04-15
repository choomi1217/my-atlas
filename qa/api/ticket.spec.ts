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
  let ticketId: number;

  test.beforeAll(async () => {
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

  test('POST /api/versions/{versionId}/results/{resultId}/tickets - Jira 미설정 시 에러', async () => {
    // Ticket creation requires Jira env vars (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_KEY).
    // In CI/test without Jira config, this should return an error.
    const response = await request.post(
      `/api/versions/${versionId}/results/${resultId}/tickets`,
      {
        data: {
          summary: 'FAIL: E2E Ticket Test',
          description: 'Test ticket from E2E',
        },
      }
    );

    // Expect either:
    // 201 if Jira is configured (create succeeds)
    // 500 or 400 if Jira is not configured (error)
    const status = response.status();
    const body = await response.json() as any;

    if (status === 201) {
      // Jira is configured — ticket was created successfully
      expect(body.success).toBe(true);
      expect(body.data.jiraKey).toBeDefined();
      expect(body.data.summary).toBe('FAIL: E2E Ticket Test');
      expect(body.data.jiraUrl).toBeDefined();
      expect(body.data.status).toBeDefined();
      ticketId = body.data.id;
    } else {
      // Jira not configured — gracefully handle error
      expect([400, 500]).toContain(status);
      // Ticket operations below will be skipped
    }
  });

  test('GET /api/versions/{versionId}/results/{resultId}/tickets - 티켓 생성 후 조회', async () => {
    if (!ticketId) {
      test.skip();
      return;
    }

    const response = await request.get(
      `/api/versions/${versionId}/results/${resultId}/tickets`
    );
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const ticket = body.data.find((t: any) => t.id === ticketId);
    expect(ticket).toBeDefined();
    expect(ticket.summary).toBe('FAIL: E2E Ticket Test');
    expect(ticket.jiraKey).toBeDefined();
  });

  test('POST /api/versions/{versionId}/results/{resultId}/tickets/{ticketId}/refresh - 티켓 상태 새로고침', async () => {
    if (!ticketId) {
      test.skip();
      return;
    }

    const response = await request.post(
      `/api/versions/${versionId}/results/${resultId}/tickets/${ticketId}/refresh`
    );
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
    expect(body.data.status).toBeDefined();
  });

  test('DELETE /api/versions/{versionId}/results/{resultId}/tickets/{ticketId} - 티켓 삭제', async () => {
    if (!ticketId) {
      test.skip();
      return;
    }

    const response = await request.delete(
      `/api/versions/${versionId}/results/${resultId}/tickets/${ticketId}`
    );
    expect(response.status()).toBe(200);

    // Verify deletion
    const verifyResponse = await request.get(
      `/api/versions/${versionId}/results/${resultId}/tickets`
    );
    const verifyBody = await verifyResponse.json() as any;
    const deleted = verifyBody.data.find((t: any) => t.id === ticketId);
    expect(deleted).toBeUndefined();
  });

  test.afterAll(async () => {
    // Cleanup test company (cascades to product, version, etc.)
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});
