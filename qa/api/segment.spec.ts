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
    // Isolated product to avoid DB pollution from sibling tests
    const productResp = await request.post('/api/products', {
      data: { companyId, name: 'E2E Delete Cascade Product', platform: 'WEB' },
    });
    const isolatedProductId = (await productResp.json() as { data: { id: number } }).data.id;

    // Setup: 2 roots (last-root guard requires sibling) + 1 child under DeleteRoot
    const rootResp = await request.post('/api/segments', {
      data: { productId: isolatedProductId, name: 'DeleteRoot', parentId: null },
    });
    const delRootId = (await rootResp.json() as { data: { id: number } }).data.id;

    await request.post('/api/segments', {
      data: { productId: isolatedProductId, name: 'DeleteChild', parentId: delRootId },
    });

    const siblingResp = await request.post('/api/segments', {
      data: { productId: isolatedProductId, name: 'SiblingRoot', parentId: null },
    });
    const siblingId = (await siblingResp.json() as { data: { id: number } }).data.id;

    const response = await request.delete(`/api/segments/${delRootId}`);
    expect(response.status()).toBe(200);

    // DeleteRoot + DeleteChild cascade-deleted; SiblingRoot remains
    const listResponse = await request.get(`/api/segments?productId=${isolatedProductId}`);
    const listBody = await listResponse.json() as { data: { id: number }[] };
    expect(listBody.data.length).toBe(1);
    expect(listBody.data[0].id).toBe(siblingId);

    // Cleanup
    await request.delete(`/api/products/${isolatedProductId}`).catch(() => {});
  });

  test('DELETE /api/segments/{id} - cannot delete last root segment in product', async () => {
    // Fresh product to guarantee single-root state, isolated from sibling tests
    const productResp = await request.post('/api/products', {
      data: { companyId, name: 'E2E LastRoot Guard Product', platform: 'WEB' },
    });
    const guardProductId = (await productResp.json() as { data: { id: number } }).data.id;

    const onlyRoot = await request.post('/api/segments', {
      data: { productId: guardProductId, name: 'OnlyRoot', parentId: null },
    });
    const onlyRootId = (await onlyRoot.json() as { data: { id: number } }).data.id;

    const response = await request.delete(`/api/segments/${onlyRootId}`);
    expect(response.status()).toBe(400);

    // Cleanup: delete the product (cascades segments)
    await request.delete(`/api/products/${guardProductId}`).catch(() => {});
  });

  test.afterAll(async () => {
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});

test.describe('Segment Reparent (Drag & Drop) E2E', () => {
  let companyId: number;
  let productId: number;
  let segmentA: { id: number; parentId: number | null };
  let segmentB: { id: number; parentId: number | null };
  let segmentC: { id: number; parentId: number | null };

  test.beforeAll(async () => {
    // Create company
    const companyResponse = await request.post('/api/companies', {
      data: { name: 'E2E DnD Test Company' },
    });
    const companyBody = await companyResponse.json() as { data: { id: number } };
    companyId = companyBody.data.id;

    // Create product
    const productResponse = await request.post('/api/products', {
      data: {
        companyId,
        name: 'E2E DnD Test Product',
        platform: 'WEB',
      },
    });
    const productBody = await productResponse.json() as { data: { id: number } };
    productId = productBody.data.id;
  });

  test('PATCH /api/segments/{id}/parent - reparent segment success', async () => {
    // Setup: Create segments A and B
    const respA = await request.post('/api/segments', {
      data: { productId, name: 'E2E DnD Segment A', parentId: null },
    });
    const bodyA = await respA.json() as { data: { id: number; parentId: number | null } };
    segmentA = bodyA.data;

    const respB = await request.post('/api/segments', {
      data: { productId, name: 'E2E DnD Segment B', parentId: null },
    });
    const bodyB = await respB.json() as { data: { id: number; parentId: number | null } };
    segmentB = bodyB.data;

    // Action: Reparent A under B
    const reparentResp = await request.patch(`/api/segments/${segmentA.id}/parent`, {
      data: { parentId: segmentB.id },
    });
    expect(reparentResp.status()).toBe(200);
    const reparentBody = await reparentResp.json() as { success: boolean; data: { id: number; parentId: number } };
    expect(reparentBody.success).toBe(true);
    expect(reparentBody.data.parentId).toBe(segmentB.id);

    // Verify: List segments and confirm hierarchy
    const listResp = await request.get(`/api/segments?productId=${productId}`);
    const listBody = await listResp.json() as { data: { id: number; parentId: number | null }[] };
    const updatedA = listBody.data.find(s => s.id === segmentA.id);
    expect(updatedA?.parentId).toBe(segmentB.id);

    // Cleanup
    await request.delete(`/api/segments/${segmentB.id}`);
  });

  test('PATCH /api/segments/{id}/parent - reparent to root (null)', async () => {
    // Setup: Create A and B with A as child of B
    const respA = await request.post('/api/segments', {
      data: { productId, name: 'E2E DnD Segment A2', parentId: null },
    });
    const bodyA = await respA.json() as { data: { id: number } };
    const idA = bodyA.data.id;

    const respB = await request.post('/api/segments', {
      data: { productId, name: 'E2E DnD Segment B2', parentId: idA },
    });
    const bodyB = await respB.json() as { data: { id: number } };
    const idB = bodyB.data.id;

    // Action: Promote B to root (parent = null)
    const reparentResp = await request.patch(`/api/segments/${idB}/parent`, {
      data: { parentId: null },
    });
    expect(reparentResp.status()).toBe(200);
    const reparentBody = await reparentResp.json() as { success: boolean; data: { parentId: number | null } };
    expect(reparentBody.success).toBe(true);
    expect(reparentBody.data.parentId).toBeNull();

    // Cleanup
    await request.delete(`/api/segments/${idA}`);
    await request.delete(`/api/segments/${idB}`);
  });

  test('PATCH /api/segments/{id}/parent - circular reference prevention', async () => {
    // Setup: Create A > B > C hierarchy
    const respA = await request.post('/api/segments', {
      data: { productId, name: 'E2E DnD Segment A3', parentId: null },
    });
    const bodyA = await respA.json() as { data: { id: number } };
    const idA = bodyA.data.id;

    const respB = await request.post('/api/segments', {
      data: { productId, name: 'E2E DnD Segment B3', parentId: idA },
    });
    const bodyB = await respB.json() as { data: { id: number } };
    const idB = bodyB.data.id;

    const respC = await request.post('/api/segments', {
      data: { productId, name: 'E2E DnD Segment C3', parentId: idB },
    });
    const bodyC = await respC.json() as { data: { id: number } };
    const idC = bodyC.data.id;

    // Action: Try to set A's parent to C (circular reference)
    const reparentResp = await request.patch(`/api/segments/${idA}/parent`, {
      data: { parentId: idC },
    });

    // Verify: Should fail with 400 error
    expect(reparentResp.status()).toBe(400);

    // Verify: A's parentId should remain null
    const listResp = await request.get(`/api/segments?productId=${productId}`);
    const listBody = await listResp.json() as { data: { id: number; parentId: number | null }[] };
    const unchangedA = listBody.data.find(s => s.id === idA);
    expect(unchangedA?.parentId).toBeNull();

    // Cleanup
    await request.delete(`/api/segments/${idA}`);
  });

  test('PATCH /api/segments/{id}/parent - self as parent prevention', async () => {
    // Setup: Create segment A
    const respA = await request.post('/api/segments', {
      data: { productId, name: 'E2E DnD Segment A4', parentId: null },
    });
    const bodyA = await respA.json() as { data: { id: number } };
    const idA = bodyA.data.id;

    // Action: Try to set A's parent to itself
    const reparentResp = await request.patch(`/api/segments/${idA}/parent`, {
      data: { parentId: idA },
    });

    // Verify: Should fail with 400 error
    expect(reparentResp.status()).toBe(400);

    // Cleanup
    await request.delete(`/api/segments/${idA}`);
  });

  test('PATCH /api/segments/{id}/parent - 400 for non-existent segment', async () => {
    // Action: Try to reparent a non-existent segment
    const reparentResp = await request.patch('/api/segments/999999/parent', {
      data: { parentId: null },
    });

    // Verify: Should fail with 400
    expect(reparentResp.status()).toBe(400);
  });

  test.afterAll(async () => {
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
});
