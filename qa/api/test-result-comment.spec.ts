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

test.describe('TestResult Comment API E2E', () => {
  let companyId: number;
  let productId: number;
  let versionId: number;
  let phaseId: number;
  let testRunId: number;
  let testCaseId: number;
  let segmentId: number;
  let resultId: number;
  let commentId: number;
  let replyCommentId: number;

  test.beforeAll(async () => {
    // Create test company
    const companyResponse = await request.post('/api/companies', {
      data: { name: 'E2E Comment Company' },
    });
    const companyBody = await companyResponse.json() as any;
    companyId = companyBody.data.id;

    // Create test product
    const productResponse = await request.post('/api/products', {
      data: {
        companyId,
        name: 'E2E Comment Product',
        platform: 'WEB',
      },
    });
    const productBody = await productResponse.json() as any;
    productId = productBody.data.id;

    // Create segment
    const segmentResponse = await request.post('/api/segments', {
      data: {
        productId,
        name: 'Comment Segment',
        parentId: null,
      },
    });
    const segmentBody = await segmentResponse.json() as any;
    segmentId = segmentBody.data.id;

    // Create test case
    const tcResponse = await request.post('/api/test-cases', {
      data: {
        productId,
        title: 'Comment TC 1',
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
        name: 'E2E Comment Test Run',
        description: 'Test run for comment tests',
        testCaseIds: [testCaseId],
      },
    });
    const testRunBody = await testRunResponse.json() as any;
    testRunId = testRunBody.data.id;

    // Create version with phase
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dateString = futureDate.toISOString().split('T')[0];

    const versionResponse = await request.post(`/api/products/${productId}/versions`, {
      data: {
        productId,
        name: 'v1.0.0-comment-test',
        releaseDate: dateString,
        description: 'Version for comment testing',
        phases: [
          {
            phaseName: 'Comment Phase',
            testRunIds: [testRunId],
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
      phaseId = phases[0].id;
    }

    // Get test result ID
    const resultsResponse = await request.get(`/api/versions/${versionId}/results`);
    const resultsBody = await resultsResponse.json() as any;
    expect(resultsBody.data.length).toBeGreaterThanOrEqual(1);
    resultId = resultsBody.data[0].id;
  });

  test('GET /api/versions/{versionId}/results/{resultId}/comments - returns empty array initially', async () => {
    const response = await request.get(
      `/api/versions/${versionId}/results/${resultId}/comments`
    );
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });

  test('POST /api/versions/{versionId}/results/{resultId}/comments - creates a top-level comment', async () => {
    const response = await request.post(
      `/api/versions/${versionId}/results/${resultId}/comments`,
      {
        data: {
          author: 'E2E Tester',
          content: 'This is a top-level comment for testing.',
          parentId: null,
          imageUrl: null,
        },
      }
    );
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.content).toBe('This is a top-level comment for testing.');
    expect(body.data.author).toBe('E2E Tester');
    expect(body.data.testResultId).toBe(resultId);
    expect(body.data.parentId).toBeNull();
    expect(body.data.id).toBeGreaterThan(0);
    expect(body.data.createdAt).toBeDefined();
    commentId = body.data.id;
  });

  test('POST /api/versions/{versionId}/results/{resultId}/comments - creates a reply (with parentId)', async () => {
    const response = await request.post(
      `/api/versions/${versionId}/results/${resultId}/comments`,
      {
        data: {
          author: 'E2E Reviewer',
          content: 'This is a reply to the top-level comment.',
          parentId: commentId,
        },
      }
    );
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.content).toBe('This is a reply to the top-level comment.');
    expect(body.data.parentId).toBe(commentId);
    replyCommentId = body.data.id;
  });

  test('GET /api/versions/{versionId}/results/{resultId}/comments - returns tree structure (parent with nested children)', async () => {
    const response = await request.get(
      `/api/versions/${versionId}/results/${resultId}/comments`
    );
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    // Should have 1 top-level comment (the reply is nested inside)
    expect(body.data.length).toBe(1);
    const topComment = body.data[0];
    expect(topComment.id).toBe(commentId);
    expect(topComment.content).toBe('This is a top-level comment for testing.');
    expect(Array.isArray(topComment.children)).toBe(true);
    expect(topComment.children.length).toBe(1);

    const reply = topComment.children[0];
    expect(reply.id).toBe(replyCommentId);
    expect(reply.content).toBe('This is a reply to the top-level comment.');
    expect(reply.parentId).toBe(commentId);
  });

  test('DELETE /api/versions/{versionId}/results/{resultId}/comments/{commentId} - removes a comment', async () => {
    // Create a standalone comment to delete
    const createResponse = await request.post(
      `/api/versions/${versionId}/results/${resultId}/comments`,
      {
        data: {
          author: 'Temp User',
          content: 'Comment to be deleted.',
        },
      }
    );
    expect(createResponse.status()).toBe(201);
    const createBody = await createResponse.json() as any;
    const tempCommentId = createBody.data.id;

    // Delete it
    const deleteResponse = await request.delete(
      `/api/versions/${versionId}/results/${resultId}/comments/${tempCommentId}`
    );
    expect(deleteResponse.status()).toBe(200);
    const deleteBody = await deleteResponse.json() as any;
    expect(deleteBody.success).toBe(true);

    // Verify it is gone
    const verifyResponse = await request.get(
      `/api/versions/${versionId}/results/${resultId}/comments`
    );
    const verifyBody = await verifyResponse.json() as any;
    const deleted = verifyBody.data.find((c: any) => c.id === tempCommentId);
    expect(deleted).toBeUndefined();
  });

  test('POST /api/versions/{versionId}/results/{resultId}/comments - empty content returns 400', async () => {
    const response = await request.post(
      `/api/versions/${versionId}/results/${resultId}/comments`,
      {
        data: {
          author: 'E2E Tester',
          content: '',
        },
      }
    );
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test.afterAll(async () => {
    // Cleanup test company (cascades to product, segment, test case, etc.)
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});
