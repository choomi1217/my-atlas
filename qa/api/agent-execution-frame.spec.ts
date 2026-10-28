import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * registry_v26 — AI 실행 라이브 뷰 프레임 API E2E.
 * PUT/GET /api/agent-executions/{id}/frame 를 실제 Job 수명주기(PENDING → RUNNING → DONE)에 걸쳐 검증한다.
 * 워커 역할(claim/complete)은 테스트가 직접 수행한다 — 실제 워커/LLM 호출 없음.
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

/** 1x1 투명 PNG. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const NON_EXISTENT_JOB_ID = 999999999;

let request: APIRequestContext;
let companyId: number;
let productId: number;
let testCaseId: number;

test.beforeAll(async ({ playwright }) => {
  const base = await playwright.request.newContext({ baseURL: API_URL });
  const loginResp = await base.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin' },
  });
  expect(loginResp.status()).toBe(200);
  const token = ((await loginResp.json()) as { data: { token: string } }).data.token;
  await base.dispose();

  request = await playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  const companyResp = await request.post('/api/companies', {
    data: { name: 'E2E Agent Frame Company' },
  });
  expect(companyResp.status()).toBe(201);
  companyId = ((await companyResp.json()) as { data: { id: number } }).data.id;

  const productResp = await request.post('/api/products', {
    data: { companyId, name: 'E2E Agent Frame Product', platform: 'WEB' },
  });
  productId = ((await productResp.json()) as { data: { id: number } }).data.id;

  const segResp = await request.post('/api/segments', {
    data: { productId, name: 'E2E Agent Frame Segment', parentId: null },
  });
  const segmentId = ((await segResp.json()) as { data: { id: number } }).data.id;

  const tcResp = await request.post('/api/test-cases', {
    data: {
      productId,
      path: [segmentId],
      title: 'E2E Agent Frame Test Case',
      steps: [{ order: 0, action: 'open', expected: 'ok' }],
    },
  });
  testCaseId = ((await tcResp.json()) as { data: { id: number } }).data.id;
});

test.afterAll(async () => {
  // 이 spec이 만든 회사만 삭제 (product/TC/job은 cascade). seed 데이터는 건드리지 않는다.
  if (request && companyId) {
    await request.delete(`/api/companies/${companyId}`);
  }
  if (request) await request.dispose();
});

test.describe('Agent Execution Frame API', () => {
  test('PUT/GET /api/agent-executions/{id}/frame - stored while RUNNING, cleared on DONE, 409 afterwards', async () => {
    // Job 생성 (PENDING)
    const createResp = await request.post('/api/agent-executions', {
      data: { scope: 'SINGLE', productId, targetTestCaseId: testCaseId },
    });
    expect(createResp.status()).toBe(201);
    const jobId = ((await createResp.json()) as { data: { jobId: number } }).data.jobId;
    expect(jobId).toBeGreaterThan(0);

    // 워커 역할: claim → RUNNING
    const claimResp = await request.post(`/api/agent-executions/${jobId}/claim`);
    expect(claimResp.status()).toBe(200);
    expect(((await claimResp.json()) as { data: { status: string } }).data.status).toBe('RUNNING');

    // 프레임 업로드 → 204
    const putResp = await request.put(`/api/agent-executions/${jobId}/frame`, {
      headers: { 'Content-Type': 'image/png' },
      data: PNG_1X1,
    });
    expect(putResp.status()).toBe(204);

    // 프레임 조회 → 200, 동일 바이트, image/png, no-store
    const getResp = await request.get(`/api/agent-executions/${jobId}/frame`);
    expect(getResp.status()).toBe(200);
    expect(getResp.headers()['content-type']).toMatch(/^image\/png/);
    expect(getResp.headers()['cache-control']).toContain('no-store');
    expect((await getResp.body()).equals(PNG_1X1)).toBe(true);

    // 워커 역할: complete → DONE (프레임 정리)
    const completeResp = await request.post(`/api/agent-executions/${jobId}/complete`, {
      data: { status: 'DONE' },
    });
    expect(completeResp.status()).toBe(200);
    expect(((await completeResp.json()) as { data: { status: string } }).data.status).toBe('DONE');

    // 종료 후 조회 → 204 (프레임 없음)
    const afterDoneResp = await request.get(`/api/agent-executions/${jobId}/frame`);
    expect(afterDoneResp.status()).toBe(204);

    // 종료 후 업로드 → 409
    const putAfterDoneResp = await request.put(`/api/agent-executions/${jobId}/frame`, {
      headers: { 'Content-Type': 'image/png' },
      data: PNG_1X1,
    });
    expect(putAfterDoneResp.status()).toBe(409);
  });

  test('PUT /api/agent-executions/{id}/frame - 404 for unknown job', async () => {
    const resp = await request.put(`/api/agent-executions/${NON_EXISTENT_JOB_ID}/frame`, {
      headers: { 'Content-Type': 'image/png' },
      data: PNG_1X1,
    });
    expect(resp.status()).toBe(404);
  });
});
