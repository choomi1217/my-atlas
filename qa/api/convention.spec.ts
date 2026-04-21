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
  // Clean up any E2E conventions left over
  const response = await request.get('/api/conventions');
  const body = await response.json() as any;
  if (body.success && Array.isArray(body.data)) {
    for (const item of body.data) {
      if (item.term?.includes('E2E')) {
        await request.delete(`/api/conventions/${item.id}`).catch(() => {});
      }
    }
  }
  await request.dispose();
});

test.describe('Convention API E2E', () => {
  let conventionId: number;

  test('GET /api/conventions - returns list', async () => {
    const response = await request.get('/api/conventions');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /api/conventions - create convention', async () => {
    const response = await request.post('/api/conventions', {
      data: {
        term: 'E2E-TC',
        definition: 'End-to-End Test Case',
        category: 'Testing',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.term).toBe('E2E-TC');
    expect(body.data.definition).toBe('End-to-End Test Case');
    expect(body.data.category).toBe('Testing');
    conventionId = body.data.id;
  });

  test('GET /api/conventions/{id} - retrieve created convention', async () => {
    const response = await request.get(`/api/conventions/${conventionId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(conventionId);
    expect(body.data.term).toBe('E2E-TC');
  });

  test('PUT /api/conventions/{id} - update convention', async () => {
    const response = await request.put(`/api/conventions/${conventionId}`, {
      data: {
        term: 'E2E-TC-Updated',
        definition: 'Updated End-to-End Test Case',
        category: 'QA',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.term).toBe('E2E-TC-Updated');
    expect(body.data.category).toBe('QA');
  });

  test('POST /api/conventions - validation: blank term returns 400', async () => {
    const response = await request.post('/api/conventions', {
      data: { term: '', definition: 'Some definition' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('POST /api/conventions - validation: blank definition returns 400', async () => {
    const response = await request.post('/api/conventions', {
      data: { term: 'Valid Term', definition: '' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('PUT /api/conventions/{id} - validation: blank term returns 400', async () => {
    const response = await request.put(`/api/conventions/${conventionId}`, {
      data: { term: '', definition: 'Updated definition', category: 'QA' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('PUT /api/conventions/{id} - validation: blank definition returns 400', async () => {
    const response = await request.put(`/api/conventions/${conventionId}`, {
      data: { term: 'E2E-TC-Updated', definition: '', category: 'QA' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('PUT /api/conventions/{id} - non-existent convention returns error', async () => {
    const response = await request.put('/api/conventions/999999', {
      data: { term: 'E2E-Ghost', definition: 'Does not exist', category: 'QA' },
    });
    expect([400, 404]).toContain(response.status());
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('DELETE /api/conventions/{id} - delete convention', async () => {
    const response = await request.delete(`/api/conventions/${conventionId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
  });

  test('GET /api/conventions/{id} - deleted convention returns 404', async () => {
    const response = await request.get(`/api/conventions/${conventionId}`);
    expect(response.status()).toBe(404);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('DELETE /api/conventions/{id} - non-existent convention returns error', async () => {
    const response = await request.delete('/api/conventions/999999');
    expect([400, 404]).toContain(response.status());
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('POST /api/conventions - create with imageUrl field', async () => {
    const response = await request.post('/api/conventions', {
      data: {
        term: 'E2E-WithImage',
        definition: 'Convention with image URL',
        category: 'Testing',
        imageUrl: 'http://localhost:8080/api/convention-images/test.png',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.term).toBe('E2E-WithImage');
    expect(body.data.imageUrl).toBe('http://localhost:8080/api/convention-images/test.png');
    // Clean up
    await request.delete(`/api/conventions/${body.data.id}`).catch(() => {});
  });
});

test.describe('Convention Category API E2E', () => {
  const uniqueCatName = `E2E-Cat-${Date.now()}`;
  let categoryId: number;

  test('GET /api/conventions/categories - returns list', async () => {
    const response = await request.get('/api/conventions/categories');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /api/conventions/categories - create category', async () => {
    const response = await request.post('/api/conventions/categories', {
      data: { name: uniqueCatName },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.name).toBe(uniqueCatName);
    expect(body.data.id).toBeGreaterThan(0);
    categoryId = body.data.id;
  });

  test('GET /api/conventions/categories/search - search returns matching', async () => {
    const response = await request.get('/api/conventions/categories/search', {
      params: { q: uniqueCatName.substring(0, 10) },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    const match = body.data.find((c: any) => c.name === uniqueCatName);
    expect(match).toBeDefined();
  });

  test('GET /api/conventions/categories/search - empty query returns all', async () => {
    const response = await request.get('/api/conventions/categories/search', {
      params: { q: '' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('POST /api/conventions/categories - duplicate returns error', async () => {
    const response = await request.post('/api/conventions/categories', {
      data: { name: uniqueCatName },
    });
    expect([400, 500]).toContain(response.status());
  });

  test('POST /api/conventions/categories - blank name returns 400', async () => {
    const response = await request.post('/api/conventions/categories', {
      data: { name: '' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('POST /api/conventions - create auto-registers category to word_category', async () => {
    const uniqueCat = `E2E-AutoCat-${Date.now()}`;
    // Create convention with a new category
    const createResp = await request.post('/api/conventions', {
      data: { term: 'E2E-AutoCatTerm', definition: 'Auto category test', category: uniqueCat },
    });
    expect(createResp.status()).toBe(201);
    const createBody = await createResp.json() as any;

    // Verify the category was auto-created in word_category
    const searchResp = await request.get('/api/conventions/categories/search', {
      params: { q: uniqueCat },
    });
    const searchBody = await searchResp.json() as any;
    expect(searchBody.data.some((c: any) => c.name === uniqueCat)).toBe(true);

    // Cleanup
    await request.delete(`/api/conventions/${createBody.data.id}`).catch(() => {});
  });
});

test.describe('Convention Image API E2E', () => {
  // 이미지 업로드는 S3 의존 — CI에서는 S3 자격증명 없으므로 로컬/운영에서만 테스트
  test.skip(!!process.env.CI, 'S3 credentials not available in CI');

  test('POST /api/convention-images - upload image', async () => {
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );

    const response = await request.post('/api/convention-images', {
      multipart: {
        file: {
          name: 'e2e-test-image.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.url).toBeTruthy();
    expect(body.data.url).toContain('images/convention');
  });
});
