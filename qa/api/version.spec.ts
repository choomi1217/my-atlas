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

test.describe('Version API E2E', () => {
  let companyId: number;
  let productId: number;
  let testRunId: number;
  let versionId: number;
  let versionPastDateId: number;
  let testCaseId1: number;
  let testCaseId2: number;
  let segmentId: number;

  test.beforeAll(async () => {
    // Create test company
    const companyResponse = await request.post('/api/companies', {
      data: { name: 'E2E Version Company' },
    });
    const companyBody = await companyResponse.json() as any;
    companyId = companyBody.data.id;

    // Create test product
    const productResponse = await request.post('/api/products', {
      data: {
        companyId,
        name: 'E2E Version Product',
        platform: 'WEB',
      },
    });
    const productBody = await productResponse.json() as any;
    productId = productBody.data.id;

    // Create segment
    const segmentResponse = await request.post('/api/segments', {
      data: {
        productId,
        name: 'Version Segment',
        parentId: null,
      },
    });
    const segmentBody = await segmentResponse.json() as any;
    segmentId = segmentBody.data.id;

    // Create test cases
    const tc1Response = await request.post('/api/test-cases', {
      data: {
        productId,
        title: 'Version TC 1',
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
        title: 'Version TC 2',
        path: [segmentId],
        priority: 'HIGH',
        testType: 'FUNCTIONAL',
        status: 'DRAFT',
      },
    });
    const tc2Body = await tc2Response.json() as any;
    testCaseId2 = tc2Body.data.id;

    // Create test run
    const testRunResponse = await request.post(`/api/products/${productId}/test-runs`, {
      data: {
        name: 'E2E Version Test Run',
        description: 'Test run for version tests',
        testCaseIds: [testCaseId1, testCaseId2],
      },
    });
    const testRunBody = await testRunResponse.json() as any;
    testRunId = testRunBody.data.id;
  });

  test('POST /api/products/{productId}/versions - 정상 생성 (미래 날짜)', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30); // 30 days in future
    const dateString = futureDate.toISOString().split('T')[0];

    const response = await request.post(`/api/products/${productId}/versions`, {
      data: {
        productId,
        name: 'v1.0.0-future',
        releaseDate: dateString,
        description: 'Future release',
        phases: [
          {
            phaseName: '1차 테스트',
            testRunIds: [testRunId],
            orderIndex: 1,
          },
        ],
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('v1.0.0-future');
    expect(body.data.releaseDate).toBe(dateString);
    expect(body.data.isReleaseDatePassed).toBe(false);
    expect(body.data.warningMessage).toBeNull();
    versionId = body.data.id;
  });

  test('GET /api/versions/{id} - 미래 날짜 조회', async () => {
    const response = await request.get(`/api/versions/${versionId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.isReleaseDatePassed).toBe(false);
    expect(body.data.warningMessage).toBeNull();
  });

  test('POST /api/products/{productId}/versions - 과거 날짜 생성', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5); // 5 days ago
    const dateString = pastDate.toISOString().split('T')[0];

    const response = await request.post(`/api/products/${productId}/versions`, {
      data: {
        productId,
        name: 'v0.9.0-past',
        releaseDate: dateString,
        description: 'Past release date',
        phases: [
          {
            phaseName: '1차 테스트',
            testRunIds: [testRunId],
            orderIndex: 1,
          },
        ],
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.data.isReleaseDatePassed).toBe(true);
    expect(body.data.warningMessage).toContain('지났습니다');
    versionPastDateId = body.data.id;
  });

  test('GET /api/versions/{id} - 과거 날짜 경고 메시지 확인', async () => {
    const response = await request.get(`/api/versions/${versionPastDateId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.isReleaseDatePassed).toBe(true);
    expect(body.data.warningMessage).toBeDefined();
    expect(body.data.warningMessage).toContain('릴리스 예정일');
  });

  test('POST /api/products/{productId}/versions - null release_date 처리', async () => {
    const response = await request.post(`/api/products/${productId}/versions`, {
      data: {
        productId,
        name: 'v2.0.0-unlimited',
        releaseDate: null,
        description: 'No release date limit',
        phases: [
          {
            phaseName: '1차 테스트',
            testRunIds: [testRunId],
            orderIndex: 1,
          },
        ],
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.data.isReleaseDatePassed).toBe(false);
    expect(body.data.warningMessage).toBeNull();
  });

  test('PATCH /api/versions/{id} - 정보 수정 (과거 날짜여도 수정 가능)', async () => {
    const response = await request.patch(`/api/versions/${versionPastDateId}`, {
      data: {
        name: 'v0.9.0-past-updated',
        description: 'Updated description',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.data.description).toBe('Updated description');
    // Still past date, still should have warning
    expect(body.data.isReleaseDatePassed).toBe(true);
  });

  test('POST /api/versions/{id}/copy - 정상 복사 (미래 날짜)', async () => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 45);
    const dateString = newDate.toISOString().split('T')[0];

    const response = await request.post(`/api/versions/${versionId}/copy`, {
      data: {
        newName: 'v1.0.0-copy',
        newReleaseDate: dateString,
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.data.name).toBe('v1.0.0-copy');
    expect(body.data.releaseDate).toBe(dateString);
    expect(body.data.copiedFrom).toBe(versionId);
    expect(body.data.isReleaseDatePassed).toBe(false);
  });

  test('POST /api/versions/{id}/copy - 과거 날짜 버전도 복사 가능', async () => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 30);
    const dateString = newDate.toISOString().split('T')[0];

    const response = await request.post(`/api/versions/${versionPastDateId}/copy`, {
      data: {
        newName: 'v0.9.0-copy-from-past',
        newReleaseDate: dateString,
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.data.copiedFrom).toBe(versionPastDateId);
    expect(body.data.isReleaseDatePassed).toBe(false);
  });

  test('GET /api/products/{productId}/versions - 버전 목록 조회', async () => {
    const response = await request.get(`/api/products/${productId}/versions`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    // Should have versions created in tests
    const future = body.data.find((v: any) => v.id === versionId);
    const past = body.data.find((v: any) => v.id === versionPastDateId);
    expect(future).toBeDefined();
    expect(past).toBeDefined();
    expect(past.isReleaseDatePassed).toBe(true);
  });

  // skip 사유: DELETE API는 구현되어 있으나, 테스트 실행 시 다른 테스트의 데이터 의존성과
  // 충돌 가능성이 있어 최초 커밋(b95f524)부터 skip 처리. 독립적인 테스트 데이터 설계 후 활성화 필요.
  test.skip('DELETE /api/versions/{id} - 버전 삭제', async () => {
    // Create a dedicated test run for deletion test
    const deleteTestRunResponse = await request.post(`/api/products/${productId}/test-runs`, {
      data: {
        name: 'E2E Deletion Test Run',
        description: 'Test run for version deletion',
        testCaseIds: [testCaseId1],
      },
    });
    expect(deleteTestRunResponse.status()).toBe(201);
    const deleteTestRunBody = await deleteTestRunResponse.json() as any;
    const deleteTestRunId = deleteTestRunBody.data.id;

    // Create a version to delete
    const response = await request.post(`/api/products/${productId}/versions`, {
      data: {
        productId,
        name: 'v0.5.0-to-delete',
        releaseDate: null,
        description: 'To be deleted',
        phases: [
          {
            phaseName: '1차 테스트',
            testRunIds: [deleteTestRunId],
            orderIndex: 1,
          },
        ],
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    const versionToDelete = body.data.id;

    // Delete it
    const deleteResponse = await request.delete(`/api/versions/${versionToDelete}`);
    expect(deleteResponse.status()).toBe(200);

    // Verify deletion - version should be gone
    const verifyResponse = await request.get(`/api/versions/${versionToDelete}`);
    expect(verifyResponse.status()).toBe(404);

    // Cleanup: delete the test run we created
    await request.delete(`/api/test-runs/${deleteTestRunId}`).catch(() => {});
  });

  // skip 사유: 백엔드에 버전 이름 중복 방지 로직(unique constraint 또는 existsByName)이
  // 미구현 상태. 해당 기능 구현 후 활성화 필요.
  test.skip('POST /api/products/{productId}/versions - 중복된 이름 방지', async () => {
    // Create a dedicated test run for duplicate test
    const dupTestRunResponse = await request.post(`/api/products/${productId}/test-runs`, {
      data: {
        name: 'E2E Duplicate Test Run',
        description: 'Test run for duplicate version test',
        testCaseIds: [testCaseId2],
      },
    });
    expect(dupTestRunResponse.status()).toBe(201);
    const dupTestRunBody = await dupTestRunResponse.json() as any;
    const dupTestRunId = dupTestRunBody.data.id;

    // Create first version
    const firstResponse = await request.post(`/api/products/${productId}/versions`, {
      data: {
        productId,
        name: 'v1.1.1-unique',
        releaseDate: null,
        description: 'First version',
        phases: [
          {
            phaseName: '1차 테스트',
            testRunIds: [dupTestRunId],
            orderIndex: 1,
          },
        ],
      },
    });
    expect(firstResponse.status()).toBe(201);

    // Try to create second with same name
    const secondResponse = await request.post(`/api/products/${productId}/versions`, {
      data: {
        productId,
        name: 'v1.1.1-unique',
        releaseDate: null,
        description: 'Duplicate name',
        phases: [
          {
            phaseName: '1차 테스트',
            testRunIds: [dupTestRunId],
            orderIndex: 1,
          },
        ],
      },
    });
    expect(secondResponse.status()).toBe(400);

    // Cleanup: delete the test run we created
    await request.delete(`/api/test-runs/${dupTestRunId}`).catch(() => {});
  });

  test.afterAll(async () => {
    // Cleanup test company
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});
