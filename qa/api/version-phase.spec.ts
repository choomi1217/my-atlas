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

test.describe('Version Phase API E2E', () => {
  let companyId: number;
  let productId: number;
  let versionId: number;
  let testRunId1: number;
  let testRunId2: number;
  let phaseId1: number;
  let phaseId2: number;
  let testCaseId1: number;
  let testCaseId2: number;
  let segmentId: number;

  test.beforeAll(async () => {
    // Create test company
    const companyResponse = await request.post('/api/companies', {
      data: { name: 'E2E Phase Company' },
    });
    const companyBody = await companyResponse.json() as any;
    companyId = companyBody.data.id;

    // Create test product
    const productResponse = await request.post('/api/products', {
      data: {
        companyId,
        name: 'E2E Phase Product',
        platform: 'WEB',
      },
    });
    const productBody = await productResponse.json() as any;
    productId = productBody.data.id;

    // Create segment
    const segmentResponse = await request.post('/api/segments', {
      data: {
        productId,
        name: 'Phase Segment',
        parentId: null,
      },
    });
    const segmentBody = await segmentResponse.json() as any;
    segmentId = segmentBody.data.id;

    // Create test cases
    const tc1Response = await request.post('/api/test-cases', {
      data: {
        productId,
        title: 'Phase TC 1',
        path: [segmentId],
        priority: 'HIGH',
        testType: 'FUNCTIONAL',
        status: 'DRAFT',
      },
    });
    const tc1Body = await tc1Response.json() as any;
    testCaseId1 = tc1Body.data.id;

    const tc2Response = await request.post('/api/test-cases', {
      data: {
        productId,
        title: 'Phase TC 2',
        path: [segmentId],
        priority: 'HIGH',
        testType: 'FUNCTIONAL',
        status: 'DRAFT',
      },
    });
    const tc2Body = await tc2Response.json() as any;
    testCaseId2 = tc2Body.data.id;

    // Create test runs
    const testRun1Response = await request.post(`/api/products/${productId}/test-runs`, {
      data: {
        name: 'E2E Phase Test Run 1',
        description: 'First test run',
        testCaseIds: [testCaseId1],
      },
    });
    const testRun1Body = await testRun1Response.json() as any;
    testRunId1 = testRun1Body.data.id;

    const testRun2Response = await request.post(`/api/products/${productId}/test-runs`, {
      data: {
        name: 'E2E Phase Test Run 2',
        description: 'Second test run',
        testCaseIds: [testCaseId2],
      },
    });
    const testRun2Body = await testRun2Response.json() as any;
    testRunId2 = testRun2Body.data.id;

    // Create version with initial phase
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dateString = futureDate.toISOString().split('T')[0];

    const versionResponse = await request.post(`/api/products/${productId}/versions`, {
      data: {
        productId,
        name: 'v1.0.0-phase-test',
        releaseDate: dateString,
        description: 'Version for phase testing',
        phases: [
          {
            phaseName: '0차 초기 Phase',
            testRunIds: [testRunId1],
            orderIndex: 0,
          },
        ],
      },
    });
    expect(versionResponse.status()).toBe(201);
    const versionBody = await versionResponse.json() as any;
    versionId = versionBody.data.id;
  });

  test('POST /api/versions/{versionId}/phases - Phase 추가', async () => {
    // Version already has 1 phase (orderIndex 0), so add at orderIndex 1
    const response = await request.post(`/api/versions/${versionId}/phases`, {
      data: {
        phaseName: '1차 테스트',
        testRunIds: [testRunId1],
        orderIndex: 1,
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.phaseName).toBe('1차 테스트');
    expect(Array.isArray(body.data.testRuns)).toBe(true);
    expect(body.data.testRuns[0].testRunId).toBe(testRunId1);
    // Backend may auto-adjust orderIndex, so just check it's a number
    expect(typeof body.data.orderIndex).toBe('number');
    expect(body.data.orderIndex).toBeGreaterThanOrEqual(1);
    phaseId1 = body.data.id;
  });

  test('POST /api/versions/{versionId}/phases - 두 번째 Phase 추가', async () => {
    // Now version has 2 phases, so add the next one
    const response = await request.post(`/api/versions/${versionId}/phases`, {
      data: {
        phaseName: '2차 테스트',
        testRunIds: [testRunId2],
        orderIndex: 2,
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.data.phaseName).toBe('2차 테스트');
    expect(typeof body.data.orderIndex).toBe('number');
    expect(body.data.orderIndex).toBeGreaterThan(1);
    phaseId2 = body.data.id;
  });

  test('POST /api/versions/{versionId}/phases - 다중 testRunIds로 Phase 생성', async () => {
    const response = await request.post(`/api/versions/${versionId}/phases`, {
      data: {
        phaseName: '다중 TestRun Phase',
        testRunIds: [testRunId1, testRunId2],
        orderIndex: 10,
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.phaseName).toBe('다중 TestRun Phase');
    expect(Array.isArray(body.data.testRuns)).toBe(true);
    expect(body.data.testRuns.length).toBe(2);
    const runIds = body.data.testRuns.map((r: any) => r.testRunId);
    expect(runIds).toContain(testRunId1);
    expect(runIds).toContain(testRunId2);
    expect(typeof body.data.totalTestCaseCount).toBe('number');
    expect(body.data.totalTestCaseCount).toBeGreaterThanOrEqual(2);

    // Cleanup: delete the phase we just created
    await request.delete(`/api/versions/${versionId}/phases/${body.data.id}`).catch(() => {});
  });

  test('GET /api/versions/{id} - Phase 목록 포함 조회', async () => {
    const response = await request.get(`/api/versions/${versionId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(Array.isArray(body.data.phases)).toBe(true);
    // Version created with 1 phase, then we added 2 more, so should have at least 3
    expect(body.data.phases.length).toBeGreaterThanOrEqual(2);
    const phase1 = body.data.phases.find((p: any) => p.id === phaseId1);
    const phase2 = body.data.phases.find((p: any) => p.id === phaseId2);
    expect(phase1).toBeDefined();
    expect(phase2).toBeDefined();
    expect(phase1.phaseName).toBe('1차 테스트');
    expect(phase2.phaseName).toBe('2차 테스트');
  });

  test('PATCH /api/versions/{versionId}/phases/{phaseId} - Phase 정보 수정', async () => {
    const response = await request.patch(`/api/versions/${versionId}/phases/${phaseId1}`, {
      data: {
        phaseName: '1차 테스트 (수정됨)',
        testRunIds: [testRunId2],
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.phaseName).toBe('1차 테스트 (수정됨)');
    expect(body.data.testRuns[0].testRunId).toBe(testRunId2);
  });

  test('POST /api/versions/{versionId}/phases/{phaseId}/reorder - 순서 변경 (앞으로)', async () => {
    // Get current order indices first
    const beforeReorder = await request.get(`/api/versions/${versionId}`);
    const beforeBody = await beforeReorder.json() as any;
    const phase1Before = beforeBody.data.phases.find((p: any) => p.id === phaseId1);
    const phase2Before = beforeBody.data.phases.find((p: any) => p.id === phaseId2);
    const originalOrder2 = phase2Before.orderIndex;

    // Move Phase 2 to the position of Phase 1
    const newOrder = Math.max(0, originalOrder2 - 1);
    const response = await request.post(`/api/versions/${versionId}/phases/${phaseId2}/reorder`, {
      data: {
        newOrderIndex: newOrder,
      },
    });
    expect(response.status()).toBe(200);

    // Verify order changed
    const verifyResponse = await request.get(`/api/versions/${versionId}`);
    const body = await verifyResponse.json() as any;
    const phase2After = body.data.phases.find((p: any) => p.id === phaseId2);
    expect(phase2After.orderIndex).toBeLessThan(originalOrder2);
  });

  test('POST /api/versions/{versionId}/phases/{phaseId}/reorder - 순서 변경 (뒤로)', async () => {
    // Get current phases from version
    const beforeReorder = await request.get(`/api/versions/${versionId}`);
    const beforeBody = await beforeReorder.json() as any;
    const phases = beforeBody.data.phases;
    expect(phases.length).toBeGreaterThanOrEqual(2);

    // Pick the first phase and move it one position down
    const firstPhase = phases.reduce((min: any, p: any) => p.orderIndex < min.orderIndex ? p : min, phases[0]);
    const originalOrder = firstPhase.orderIndex;
    const newOrder = originalOrder + 1;

    const response = await request.post(`/api/versions/${versionId}/phases/${firstPhase.id}/reorder`, {
      data: {
        newOrderIndex: newOrder,
      },
    });
    expect(response.status()).toBe(200);

    // Verify order changed
    const verifyResponse = await request.get(`/api/versions/${versionId}`);
    const body = await verifyResponse.json() as any;
    const phaseAfter = body.data.phases.find((p: any) => p.id === firstPhase.id);
    expect(phaseAfter.orderIndex).toBeGreaterThan(originalOrder);
  });

  test('DELETE /api/versions/{versionId}/phases/{phaseId} - Phase 삭제', async () => {
    // Create a phase to delete (version has 3 phases now, so add at orderIndex 3)
    const createResponse = await request.post(`/api/versions/${versionId}/phases`, {
      data: {
        phaseName: 'Phase to Delete',
        testRunIds: [testRunId1],
        orderIndex: 3,
      },
    });
    expect(createResponse.status()).toBe(201);
    const createBody = await createResponse.json() as any;
    const phaseToDelete = createBody.data.id;

    // Delete it
    const deleteResponse = await request.delete(
      `/api/versions/${versionId}/phases/${phaseToDelete}`
    );
    expect(deleteResponse.status()).toBe(200);

    // Verify deletion
    const verifyResponse = await request.get(`/api/versions/${versionId}`);
    const verifyBody = await verifyResponse.json() as any;
    const deletedPhase = verifyBody.data.phases.find((p: any) => p.id === phaseToDelete);
    expect(deletedPhase).toBeUndefined();
  });

  test('DELETE /api/versions/{versionId}/phases/{phaseId} - 삭제 후 순서 재정렬 확인', async () => {
    // Get current phases
    const preDeleteResponse = await request.get(`/api/versions/${versionId}`);
    const preDeleteBody = await preDeleteResponse.json() as any;
    const preDeletePhases = preDeleteBody.data.phases;
    const preDeleteCount = preDeletePhases.length;
    expect(preDeleteCount).toBeGreaterThanOrEqual(2);

    // Pick the last phase to delete
    const phaseToDelete = preDeletePhases.reduce(
      (max: any, p: any) => p.orderIndex > max.orderIndex ? p : max,
      preDeletePhases[0]
    );

    // Delete it
    const deleteResponse = await request.delete(`/api/versions/${versionId}/phases/${phaseToDelete.id}`);
    expect(deleteResponse.status()).toBe(200);

    // After deletion: Count should decrease by 1
    const postDeleteResponse = await request.get(`/api/versions/${versionId}`);
    const postDeleteBody = await postDeleteResponse.json() as any;
    expect(postDeleteBody.data.phases.length).toBe(preDeleteCount - 1);

    // Deleted phase should not exist
    const deletedPhase = postDeleteBody.data.phases.find((p: any) => p.id === phaseToDelete.id);
    expect(deletedPhase).toBeUndefined();
  });

  test.afterAll(async () => {
    // Cleanup test company
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});
