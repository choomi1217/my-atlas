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

test.describe('Segment API E2E', () => {
  let companyId: number;
  let productId: number;
  let rootSegmentId: number;
  let childSegmentId: number;

  test.beforeAll(async () => {
    const companyResponse = await request.post('/api/companies', {
      data: { name: 'E2E Segment Test Company' },
    });
    const companyBody = await companyResponse.json() as { data: { id: number } };
    companyId = companyBody.data.id;

    const productResponse = await request.post('/api/products', {
      data: {
        companyId,
        name: 'E2E Segment Test Product',
        platform: 'WEB',
      },
    });
    const productBody = await productResponse.json() as { data: { id: number } };
    productId = productBody.data.id;
  });

  test('GET /api/segments?productId={id} - empty segment list', async () => {
    const response = await request.get(`/api/segments?productId=${productId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });

  test('POST /api/segments - create root segment', async () => {
    const response = await request.post('/api/segments', {
      data: {
        productId,
        name: 'Main',
        parentId: null,
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as { success: boolean; data: { id: number; name: string; parentId: number | null } };
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Main');
    expect(body.data.parentId).toBeNull();
    rootSegmentId = body.data.id;
  });

  test('POST /api/segments - create child segment', async () => {
    const response = await request.post('/api/segments', {
      data: {
        productId,
        name: 'Login',
        parentId: rootSegmentId,
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as { success: boolean; data: { id: number; name: string; parentId: number } };
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Login');
    expect(body.data.parentId).toBe(rootSegmentId);
    childSegmentId = body.data.id;
  });

  test('GET /api/segments?productId={id} - returns both segments', async () => {
    const response = await request.get(`/api/segments?productId=${productId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as { data: unknown[] };
    expect(body.data.length).toBe(2);
  });

  test('PUT /api/segments/{id} - update segment name', async () => {
    const response = await request.put(`/api/segments/${rootSegmentId}`, {
      data: { name: 'Main Page' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as { data: { name: string } };
    expect(body.data.name).toBe('Main Page');
  });

  test('POST + PATCH /api/segments - reparent segment', async () => {
    // Cleanup segments from previous tests
    if (rootSegmentId) {
      await request.delete(`/api/segments/${rootSegmentId}`).catch(() => {});
    }
    // Recreate segments for reparent test
    const rootResp = await request.post('/api/segments', {
      data: { productId, name: 'ReparentRoot', parentId: null },
    });
    const rootBody = await rootResp.json() as { data: { id: number } };
    const rRoot = rootBody.data.id;

    const childResp = await request.post('/api/segments', {
      data: { productId, name: 'ReparentChild', parentId: rRoot },
    });
    const childBody = await childResp.json() as { data: { id: number } };
    const rChild = childBody.data.id;

    // Create a new root and reparent old root under it
    const newRootResp = await request.post('/api/segments', {
      data: { productId, name: 'NewRoot', parentId: null },
    });
    const newRootBody = await newRootResp.json() as { data: { id: number } };
    const newRootId = newRootBody.data.id;

    const reparentResponse = await request.patch(`/api/segments/${rRoot}/parent`, {
      data: { parentId: newRootId },
    });
    expect(reparentResponse.status()).toBe(200);
    const reparentBody = await reparentResponse.json() as { success: boolean; data: { id: number; parentId: number } };
    expect(reparentBody.success).toBe(true);
    expect(reparentBody.data.parentId).toBe(newRootId);

    // Verify hierarchy: NewRoot > ReparentRoot > ReparentChild
    const listResp = await request.get(`/api/segments?productId=${productId}`);
    const listBody = await listResp.json() as { data: { id: number; parentId: number | null }[] };
    const segments = listBody.data;

    const oldRoot = segments.find(s => s.id === rRoot);
    expect(oldRoot?.parentId).toBe(newRootId);

    const child = segments.find(s => s.id === rChild);
    expect(child?.parentId).toBe(rRoot);

    // Cleanup
    await request.delete(`/api/segments/${newRootId}`);
  });

  test('DELETE /api/segments/{id} - delete root cascades children', async () => {
    // Recreate for deletion test
    const rootResp = await request.post('/api/segments', {
      data: { productId, name: 'DeleteRoot', parentId: null },
    });
    const rootBody = await rootResp.json() as { data: { id: number } };
    const delRootId = rootBody.data.id;

    await request.post('/api/segments', {
      data: { productId, name: 'DeleteChild', parentId: delRootId },
    });

    const response = await request.delete(`/api/segments/${delRootId}`);
    expect(response.status()).toBe(200);

    const listResponse = await request.get(`/api/segments?productId=${productId}`);
    const listBody = await listResponse.json() as { data: unknown[] };
    expect(listBody.data.length).toBe(0);
  });

  test.afterAll(async () => {
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});
