import { test, expect, APIRequestContext } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:8080';

test.describe('PATCH /api/segments/reorder (PR-C)', () => {
  let request: APIRequestContext;
  let token: string;
  let companyId: number;
  let productId: number;
  let segmentIds: number[] = [];

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({ baseURL: API_URL });

    // login
    const login = await request.post('/api/auth/login', {
      data: { username: 'admin', password: 'admin' },
    });
    const loginBody = await login.json() as { data: { token: string } };
    token = loginBody.data.token;

    // cleanup E2E companies
    const allCompanies = await request.get('/api/companies', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = ((await allCompanies.json()) as { data: { id: number; name: string }[] }).data || [];
    for (const c of list) {
      if (c.name.includes('E2E') || c.name.includes('Test')) {
        await request.delete(`/api/companies/${c.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }

    // create company + activate + product
    const company = await request.post('/api/companies', {
      data: { name: 'E2E Reorder Co' },
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()) as { data: { id: number } };
    companyId = company.data.id;

    await request.patch(`/api/companies/${companyId}/activate`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const product = await request.post('/api/products', {
      data: { companyId, name: 'E2E Reorder Product', platform: 'WEB' },
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()) as { data: { id: number } };
    productId = product.data.id;

    // create 3 root segments A, B, C in that order
    for (const name of ['A', 'B', 'C']) {
      const res = await request.post('/api/segments', {
        data: { productId, name, parentId: null },
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()) as { data: { id: number } };
      segmentIds.push(res.data.id);
    }
  });

  test.afterAll(async () => {
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    await request.dispose();
  });

  test('정상 reorder 시 응답 200 + 조회 시 변경된 순서로 반환', async () => {
    // initial order: A, B, C → reorder to C, A, B
    const reorderResp = await request.patch('/api/segments/reorder', {
      data: {
        productId,
        parentId: null,
        segmentIds: [segmentIds[2], segmentIds[0], segmentIds[1]],
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(reorderResp.status()).toBe(200);

    // GET 으로 확인
    const list = await request.get(`/api/segments?productId=${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()) as { data: { id: number; name: string; orderIndex: number }[] };

    const rootSorted = list.data
      .filter((s) => true)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    expect(rootSorted[0].id).toBe(segmentIds[2]);
    expect(rootSorted[0].orderIndex).toBe(0);
    expect(rootSorted[1].id).toBe(segmentIds[0]);
    expect(rootSorted[1].orderIndex).toBe(1);
    expect(rootSorted[2].id).toBe(segmentIds[1]);
    expect(rootSorted[2].orderIndex).toBe(2);
  });

  test('빈 segmentIds 는 400 으로 거부', async () => {
    const resp = await request.patch('/api/segments/reorder', {
      data: { productId, parentId: null, segmentIds: [] },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status()).toBe(400);
  });

  test('다른 product 의 segmentIds 가 섞이면 400', async () => {
    // 별도 product + segment 생성
    const product2 = await request.post('/api/products', {
      data: { companyId, name: 'E2E Reorder Other Product', platform: 'WEB' },
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()) as { data: { id: number } };

    const otherSeg = await request.post('/api/segments', {
      data: { productId: product2.data.id, name: 'OTHER', parentId: null },
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()) as { data: { id: number } };

    const resp = await request.patch('/api/segments/reorder', {
      data: {
        productId,  // 원래 product
        parentId: null,
        segmentIds: [otherSeg.data.id], // 다른 product 의 segment
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status()).toBe(400);
  });

  test('존재하지 않는 segment id 는 400', async () => {
    const resp = await request.patch('/api/segments/reorder', {
      data: { productId, parentId: null, segmentIds: [99999999] },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status()).toBe(400);
  });
});
