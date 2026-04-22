import { test, expect, APIRequestContext } from '@playwright/test';

let request: APIRequestContext;
const API_URL = process.env.API_URL || 'http://localhost:8080';

// Minimal transparent 1x1 PNG (base64-decoded bytes).
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test.beforeAll(async ({ playwright }) => {
  const loginResp = await (
    await playwright.request.newContext({ baseURL: API_URL })
  ).post('/api/auth/login', { data: { username: 'admin', password: 'admin' } });
  const token = (await loginResp.json() as { data: { token: string } }).data.token;

  request = await playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
});

test.afterAll(async () => {
  await request.dispose();
});

test.describe('TestCase Image URL contract', () => {
  let companyId: number;
  let productId: number;
  let segmentId: number;
  let testCaseId: number;

  test.beforeAll(async () => {
    const companyResp = await request.post('/api/companies', {
      data: { name: 'E2E TC Image Company' },
    });
    companyId = (await companyResp.json() as { data: { id: number } }).data.id;

    const productResp = await request.post('/api/products', {
      data: { companyId, name: 'E2E TC Image Product', platform: 'WEB' },
    });
    productId = (await productResp.json() as { data: { id: number } }).data.id;

    const segmentResp = await request.post('/api/segments', {
      data: { productId, name: 'TCImage Segment', parentId: null },
    });
    segmentId = (await segmentResp.json() as { data: { id: number } }).data.id;

    const tcResp = await request.post('/api/test-cases', {
      data: {
        productId,
        path: [segmentId],
        title: 'E2E TC with image',
        description: 'verify image URL prefix',
        steps: [{ order: 1, action: 'a', expected: 'b' }],
        expectedResult: 'ok',
        priority: 'MEDIUM',
        testType: 'FUNCTIONAL',
        status: 'ACTIVE',
      },
    });
    testCaseId = (await tcResp.json() as { data: { id: number } }).data.id;
  });

  test.afterAll(async () => {
    if (testCaseId) await request.delete(`/api/test-cases/${testCaseId}`);
    if (segmentId) await request.delete(`/api/segments/${segmentId}`);
    if (productId) await request.delete(`/api/products/${productId}`);
    if (companyId) await request.delete(`/api/companies/${companyId}`);
  });

  test('POST /api/feature-images returns /images/feature/ URL', async () => {
    const resp = await request.post('/api/feature-images', {
      multipart: {
        file: { name: 'pixel.png', mimeType: 'image/png', buffer: PNG_BYTES },
      },
    });

    expect(resp.status()).toBe(201);
    const body = await resp.json() as { data: { url: string; filename: string; originalName: string } };
    expect(body.data.url).toMatch(/^\/images\/feature\//);
    expect(body.data.url).not.toMatch(/^\/api\/feature-images\//);
    expect(body.data.filename).not.toContain('/');
  });

  test('POST /api/test-cases/{id}/images returns /images/feature/ URL (not /api/feature-images/)', async () => {
    // Upload first
    const uploadResp = await request.post('/api/feature-images', {
      multipart: {
        file: { name: 'pixel.png', mimeType: 'image/png', buffer: PNG_BYTES },
      },
    });
    const upload = (await uploadResp.json() as {
      data: { url: string; filename: string; originalName: string };
    }).data;

    // Link to TC
    const linkResp = await request.post(`/api/test-cases/${testCaseId}/images`, {
      data: { filename: upload.filename, originalName: upload.originalName },
    });
    expect(linkResp.status()).toBe(201);
    const linkBody = await linkResp.json() as {
      data: { id: number; url: string; filename: string };
    };
    expect(linkBody.data.url).toMatch(/^\/images\/feature\//);
    expect(linkBody.data.url).not.toMatch(/^\/api\/feature-images\//);

    // GET list
    const listResp = await request.get(`/api/test-cases/${testCaseId}/images`);
    expect(listResp.status()).toBe(200);
    const listBody = await listResp.json() as {
      data: Array<{ id: number; url: string; filename: string }>;
    };
    expect(listBody.data.length).toBeGreaterThan(0);
    for (const img of listBody.data) {
      expect(img.url).toMatch(/^\/images\/feature\//);
      expect(img.url).not.toMatch(/^\/api\/feature-images\//);
    }

    // Clean up the linked image
    await request.delete(`/api/test-cases/${testCaseId}/images/${linkBody.data.id}`);
  });

  test('GET /api/test-cases list returns images[].url with /images/feature/ prefix', async () => {
    const uploadResp = await request.post('/api/feature-images', {
      multipart: {
        file: { name: 'pixel.png', mimeType: 'image/png', buffer: PNG_BYTES },
      },
    });
    const upload = (await uploadResp.json() as {
      data: { filename: string; originalName: string };
    }).data;

    const linkResp = await request.post(`/api/test-cases/${testCaseId}/images`, {
      data: { filename: upload.filename, originalName: upload.originalName },
    });
    const linkedId = (await linkResp.json() as { data: { id: number } }).data.id;

    try {
      const listResp = await request.get(`/api/test-cases?productId=${productId}`);
      expect(listResp.status()).toBe(200);
      const body = await listResp.json() as {
        data: Array<{ id: number; images: Array<{ url: string }> }>;
      };
      const tc = body.data.find((t) => t.id === testCaseId);
      expect(tc).toBeDefined();
      expect(tc!.images.length).toBeGreaterThan(0);
      for (const img of tc!.images) {
        expect(img.url).toMatch(/^\/images\/feature\//);
      }
    } finally {
      await request.delete(`/api/test-cases/${testCaseId}/images/${linkedId}`);
    }
  });
});
