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

test.describe('Test Run API E2E', () => {
  let companyId: number;
  let productId: number;
  let testCaseId1: number;
  let testCaseId2: number;
  let testCaseId3: number;
  let testRunId: number;
  let segmentId: number;

  test.beforeAll(async () => {
    // Create test company
    const companyResponse = await request.post('/api/companies', {
      data: { name: 'E2E Test Run Company' },
    });
    const companyBody = await companyResponse.json() as any;
    companyId = companyBody.data.id;

    // Create test product
    const productResponse = await request.post('/api/products', {
      data: {
        companyId,
        name: 'E2E Test Run Product',
        platform: 'WEB',
      },
    });
    const productBody = await productResponse.json() as any;
    productId = productBody.data.id;

    // Create segment for test cases
    const segmentResponse = await request.post('/api/segments', {
      data: {
        productId,
        name: 'TestRun Segment',
        parentId: null,
      },
    });
    const segmentBody = await segmentResponse.json() as any;
    segmentId = segmentBody.data.id;

    // Create test cases
    const tc1Response = await request.post('/api/test-cases', {
      data: {
        productId,
        title: 'Login Test',
        path: [segmentId],
        description: 'Test login functionality',
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
        title: 'Payment Test',
        path: [segmentId],
        description: 'Test payment functionality',
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
        title: 'Report Test',
        path: [segmentId],
        description: 'Test report generation',
        priority: 'MEDIUM',
        testType: 'FUNCTIONAL',
        status: 'DRAFT',
      },
    });
    const tc3Body = await tc3Response.json() as any;
    testCaseId3 = tc3Body.data.id;
  });

  test('POST /api/products/{productId}/test-runs - 정상 생성', async () => {
    const response = await request.post(`/api/products/${productId}/test-runs`, {
      data: {
        name: 'E2E Regression Suite',
        description: 'Comprehensive regression test suite',
        testCaseIds: [testCaseId1, testCaseId2],
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('E2E Regression Suite');
    expect(body.data.description).toBe('Comprehensive regression test suite');
    expect(body.data.productId).toBe(productId);
    testRunId = body.data.id;
  });

  test('GET /api/test-runs/{id} - 상세 조회', async () => {
    const response = await request.get(`/api/test-runs/${testRunId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(testRunId);
    expect(body.data.name).toBe('E2E Regression Suite');
    expect(Array.isArray(body.data.testCases)).toBe(true);
    expect(body.data.testCases.length).toBe(2);
    expect(body.data.testCases.map((tc: any) => tc.id).sort()).toEqual(
      [testCaseId1, testCaseId2].sort()
    );
  });

  test('GET /api/products/{productId}/test-runs - 목록 조회', async () => {
    const response = await request.get(`/api/products/${productId}/test-runs`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const testRun = body.data.find((tr: any) => tr.id === testRunId);
    expect(testRun).toBeDefined();
    expect(testRun.name).toBe('E2E Regression Suite');
  });

  test('PATCH /api/test-runs/{id} - TC 목록 수정', async () => {
    const response = await request.patch(`/api/test-runs/${testRunId}`, {
      data: {
        name: 'E2E Regression Suite Updated',
        description: 'Updated description',
        testCaseIds: [testCaseId1, testCaseId2, testCaseId3],
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.name).toBe('E2E Regression Suite Updated');
    expect(body.data.testCases.length).toBe(3);
  });

  test('PATCH /api/test-runs/{id} - TC 제거', async () => {
    const response = await request.patch(`/api/test-runs/${testRunId}`, {
      data: {
        name: 'E2E Regression Suite',
        testCaseIds: [testCaseId1],
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.testCases.length).toBe(1);
    expect(body.data.testCases[0].id).toBe(testCaseId1);
  });

  test('DELETE /api/test-runs/{id} - 삭제', async () => {
    const response = await request.delete(`/api/test-runs/${testRunId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
  });

  test('GET /api/test-runs/{id} - 삭제 확인', async () => {
    const response = await request.get(`/api/test-runs/${testRunId}`);
    expect(response.status()).toBe(404);
  });

  test('POST /api/products/{productId}/test-runs - 중복된 이름 방지', async () => {
    // Create first test run
    const firstResponse = await request.post(`/api/products/${productId}/test-runs`, {
      data: {
        name: 'E2E Duplicate Test',
        description: 'First run',
        testCaseIds: [testCaseId1],
      },
    });
    expect(firstResponse.status()).toBe(201);

    // Try to create second test run with same name
    const secondResponse = await request.post(`/api/products/${productId}/test-runs`, {
      data: {
        name: 'E2E Duplicate Test',
        description: 'Second run',
        testCaseIds: [testCaseId2],
      },
    });
    expect(secondResponse.status()).toBe(400);
  });

  test.afterAll(async () => {
    // Cleanup test company
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});
