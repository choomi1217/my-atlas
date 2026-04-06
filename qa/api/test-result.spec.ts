import { test, expect, APIRequestContext } from '@playwright/test';

let request: APIRequestContext;
const API_URL = process.env.API_URL || 'http://localhost:8080';

test.beforeAll(async ({ playwright }) => {
  request = await playwright.request.newContext({
    baseURL: API_URL,
  });
});

test.afterAll(async () => {
  await request.dispose();
});

test.describe('Test Result API E2E', () => {
  let companyId: number;
  let productId: number;
  let versionId: number;
  let phaseId: number;
  let testRunId: number;
  let testCaseId1: number;
  let testCaseId2: number;
  let testCaseId3: number;
  let testCaseId4: number;
  let testCaseId5: number;
  let resultId1: number;
  let resultId2: number;
  let resultId3: number;
  let resultId4: number;
  let resultId5: number;
  let segmentId: number;

  test.beforeAll(async () => {
    // Create test company
    const companyResponse = await request.post('/api/companies', {
      data: { name: 'E2E Result Company' },
    });
    const companyBody = await companyResponse.json() as any;
    companyId = companyBody.data.id;

    // Create test product
    const productResponse = await request.post('/api/products', {
      data: {
        companyId,
        name: 'E2E Result Product',
        platform: 'WEB',
      },
    });
    const productBody = await productResponse.json() as any;
    productId = productBody.data.id;

    // Create segment
    const segmentResponse = await request.post('/api/segments', {
      data: {
        productId,
        name: 'Result Segment',
        parentId: null,
      },
    });
    const segmentBody = await segmentResponse.json() as any;
    segmentId = segmentBody.data.id;

    // Create test cases
    const tc1Response = await request.post('/api/test-cases', {
      data: {
        productId,
        title: 'Result TC 1',
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
        title: 'Result TC 2',
        path: [segmentId],
        priority: 'HIGH',
        testType: 'FUNCTIONAL',
        status: 'DRAFT',
      },
    });
    const tc2Body = await tc2Response.json() as any;
    testCaseId2 = tc2Body.data.id;

    const tc3Response = await request.post('/api/test-cases', {
      data: {
        productId,
        title: 'Result TC 3',
        path: [segmentId],
        priority: 'MEDIUM',
        testType: 'FUNCTIONAL',
        status: 'DRAFT',
      },
    });
    const tc3Body = await tc3Response.json() as any;
    testCaseId3 = tc3Body.data.id;

    const tc4Response = await request.post('/api/test-cases', {
      data: {
        productId,
        title: 'Result TC 4',
        path: [segmentId],
        priority: 'MEDIUM',
        testType: 'FUNCTIONAL',
        status: 'DRAFT',
      },
    });
    const tc4Body = await tc4Response.json() as any;
    testCaseId4 = tc4Body.data.id;

    const tc5Response = await request.post('/api/test-cases', {
      data: {
        productId,
        title: 'Result TC 5',
        path: [segmentId],
        priority: 'LOW',
        testType: 'FUNCTIONAL',
        status: 'DRAFT',
      },
    });
    const tc5Body = await tc5Response.json() as any;
    testCaseId5 = tc5Body.data.id;

    // Create test run
    const testRunResponse = await request.post(`/api/products/${productId}/test-runs`, {
      data: {
        name: 'E2E Result Test Run',
        description: 'Test run for result tests',
        testCaseIds: [testCaseId1, testCaseId2, testCaseId3, testCaseId4, testCaseId5],
      },
    });
    const testRunBody = await testRunResponse.json() as any;
    testRunId = testRunBody.data.id;

    // Create version with initial phase
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dateString = futureDate.toISOString().split('T')[0];

    const versionResponse = await request.post(`/api/products/${productId}/versions`, {
      data: {
        productId,
        name: 'v1.0.0-result-test',
        releaseDate: dateString,
        description: 'Version for result testing',
        phases: [
          {
            phaseName: '테스트 Phase',
            testRunId,
            orderIndex: 1,
          },
        ],
      },
    });
    expect(versionResponse.status()).toBe(201);
    const versionBody = await versionResponse.json() as any;
    versionId = versionBody.data.id;

    // Get phase ID from created version
    const phases = versionBody.data.phases;
    if (Array.isArray(phases) && phases.length > 0) {
      // Get the phase with the highest orderIndex (most recently added)
      const sortedPhases = [...phases].sort((a: any, b: any) => b.orderIndex - a.orderIndex);
      phaseId = sortedPhases[0].id;
    } else {
      // Fallback: fetch version and get phase
      const versionFetch = await request.get(`/api/versions/${versionId}`);
      const versionDetail = await versionFetch.json() as any;
      if (Array.isArray(versionDetail.data.phases) && versionDetail.data.phases.length > 0) {
        const sortedPhases = [...versionDetail.data.phases].sort((a: any, b: any) => b.orderIndex - a.orderIndex);
        phaseId = sortedPhases[0].id;
      }
    }
  });

  test('GET /api/versions/{versionId}/results - Option A: Version 전체 결과 조회 (초기 UNTESTED)', async () => {
    const response = await request.get(`/api/versions/${versionId}/results`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(5);
    // All should be UNTESTED initially
    body.data.forEach((result: any) => {
      expect(result.status).toBe('UNTESTED');
    });
    // Store result IDs
    resultId1 = body.data[0].id;
    resultId2 = body.data[1].id;
    resultId3 = body.data[2].id;
    resultId4 = body.data[3].id;
    resultId5 = body.data[4].id;
  });

  test('GET /api/versions/{versionId}/phases/{phaseId}/results - Option B: Phase별 결과 조회', async () => {
    const response = await request.get(`/api/versions/${versionId}/phases/${phaseId}/results`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(5);
  });

  test('PATCH /api/versions/{versionId}/results/{resultId} - UNTESTED → PASS', async () => {
    const response = await request.patch(`/api/versions/${versionId}/results/${resultId1}`, {
      data: {
        status: 'PASS',
        comment: 'All tests passed',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.status).toBe('PASS');
    expect(body.data.comment).toBe('All tests passed');
    expect(body.data.executedAt).toBeDefined();
  });

  test('PATCH /api/versions/{versionId}/results/{resultId} - UNTESTED → FAIL', async () => {
    const response = await request.patch(`/api/versions/${versionId}/results/${resultId2}`, {
      data: {
        status: 'FAIL',
        comment: 'Timeout issue',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.status).toBe('FAIL');
    expect(body.data.comment).toBe('Timeout issue');
  });

  test('PATCH /api/versions/{versionId}/results/{resultId} - UNTESTED → BLOCKED', async () => {
    const response = await request.patch(`/api/versions/${versionId}/results/${resultId3}`, {
      data: {
        status: 'BLOCKED',
        comment: 'Blocked by environment issue',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.status).toBe('BLOCKED');
  });

  test('PATCH /api/versions/{versionId}/results/{resultId} - UNTESTED → SKIPPED', async () => {
    const response = await request.patch(`/api/versions/${versionId}/results/${resultId4}`, {
      data: {
        status: 'SKIPPED',
        comment: 'Not applicable for this version',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.status).toBe('SKIPPED');
  });

  test('PATCH /api/versions/{versionId}/results/{resultId} - UNTESTED → RETEST', async () => {
    const response = await request.patch(`/api/versions/${versionId}/results/${resultId5}`, {
      data: {
        status: 'RETEST',
        comment: 'Needs retesting after fix',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.status).toBe('RETEST');
  });

  test('GET /api/versions/{versionId}/results - 진행률 계산 (Option A)', async () => {
    const response = await request.get(`/api/versions/${versionId}/results`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    const results = body.data;

    // Count statuses
    const pass = results.filter((r: any) => r.status === 'PASS').length;
    const fail = results.filter((r: any) => r.status === 'FAIL').length;
    const blocked = results.filter((r: any) => r.status === 'BLOCKED').length;
    const skipped = results.filter((r: any) => r.status === 'SKIPPED').length;
    const retest = results.filter((r: any) => r.status === 'RETEST').length;
    const untested = results.filter((r: any) => r.status === 'UNTESTED').length;

    expect(pass).toBe(1);
    expect(fail).toBe(1);
    expect(blocked).toBe(1);
    expect(skipped).toBe(1);
    expect(retest).toBe(1);
    expect(untested).toBe(0);
  });

  test('GET /api/versions/{versionId}/phases/{phaseId}/results - 진행률 계산 (Option B)', async () => {
    const response = await request.get(`/api/versions/${versionId}/phases/${phaseId}/results`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    const results = body.data;

    // Verify all 5 results exist
    expect(results.length).toBe(5);

    // Verify statuses
    expect(results.some((r: any) => r.status === 'PASS')).toBe(true);
    expect(results.some((r: any) => r.status === 'FAIL')).toBe(true);
    expect(results.some((r: any) => r.status === 'BLOCKED')).toBe(true);
    expect(results.some((r: any) => r.status === 'SKIPPED')).toBe(true);
    expect(results.some((r: any) => r.status === 'RETEST')).toBe(true);
  });

  test('PATCH /api/versions/{versionId}/results/{resultId} - 상태 변경 (PASS → FAIL)', async () => {
    const response = await request.patch(`/api/versions/${versionId}/results/${resultId1}`, {
      data: {
        status: 'FAIL',
        comment: 'Changed from PASS to FAIL',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.status).toBe('FAIL');
    expect(body.data.comment).toBe('Changed from PASS to FAIL');
  });

  test('PATCH /api/versions/{versionId}/results/{resultId} - 코멘트만 수정', async () => {
    const response = await request.patch(`/api/versions/${versionId}/results/${resultId2}`, {
      data: {
        status: 'FAIL',
        comment: 'Updated comment: Fixed timeout issue',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.comment).toBe('Updated comment: Fixed timeout issue');
  });

  test('PATCH /api/versions/{versionId}/results/{resultId} - null comment 처리', async () => {
    const response = await request.patch(`/api/versions/${versionId}/results/${resultId5}`, {
      data: {
        status: 'PASS',
        comment: null,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.status).toBe('PASS');
  });

  test('PATCH /api/versions/{versionId}/results/{resultId} - executedAt 자동 설정', async () => {
    const beforePatch = new Date();

    const response = await request.patch(`/api/versions/${versionId}/results/${resultId3}`, {
      data: {
        status: 'PASS',
        comment: 'Unblocked and passed',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.executedAt).toBeDefined();

    const executedAt = new Date(body.data.executedAt);
    expect(executedAt.getTime()).toBeGreaterThanOrEqual(beforePatch.getTime());
  });

  test.afterAll(async () => {
    // Cleanup test company
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});
