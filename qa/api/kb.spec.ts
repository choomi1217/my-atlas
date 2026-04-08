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

test.describe('Knowledge Base API E2E', () => {
  let kbId: number;

  test('GET /api/kb - returns list', async () => {
    const response = await request.get('/api/kb');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /api/kb - create manual KB entry', async () => {
    const response = await request.post('/api/kb', {
      data: {
        title: 'E2E Test Article',
        content: 'This is an E2E test article for knowledge base.',
        category: 'Testing',
        tags: 'e2e,test',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('E2E Test Article');
    expect(body.data.content).toBe('This is an E2E test article for knowledge base.');
    expect(body.data.category).toBe('Testing');
    expect(body.data.tags).toBe('e2e,test');
    kbId = body.data.id;
  });

  test('GET /api/kb/{id} - retrieve created entry', async () => {
    const response = await request.get(`/api/kb/${kbId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(kbId);
    expect(body.data.title).toBe('E2E Test Article');
  });

  test('PUT /api/kb/{id} - update entry', async () => {
    const response = await request.put(`/api/kb/${kbId}`, {
      data: {
        title: 'E2E Updated Article',
        content: 'Updated content for E2E test.',
        category: 'QA',
        tags: 'e2e,updated',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('E2E Updated Article');
    expect(body.data.category).toBe('QA');
  });

  test('POST /api/kb - validation: blank title returns 400', async () => {
    const response = await request.post('/api/kb', {
      data: { title: '', content: 'Content' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('GET /api/kb/jobs - returns job list', async () => {
    const response = await request.get('/api/kb/jobs');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('DELETE /api/kb/{id} - delete entry', async () => {
    const response = await request.delete(`/api/kb/${kbId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
  });

  test('GET /api/kb/{id} - deleted entry returns 404', async () => {
    const response = await request.get(`/api/kb/${kbId}`);
    expect(response.status()).toBe(404);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });
});

test.describe('Knowledge Base Image API E2E', () => {
  let uploadedImageUrl: string;

  test('POST /api/kb/images - upload valid PNG image', async () => {
    // Create a minimal 1x1 red PNG (68 bytes)
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, // 8-bit RGB
      0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
      0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
      0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, // IEND chunk
      0xae, 0x42, 0x60, 0x82,
    ]);

    const response = await request.post('/api/kb/images', {
      multipart: {
        file: {
          name: 'e2e-test-image.png',
          mimeType: 'image/png',
          buffer: pngHeader,
        },
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.url).toBeDefined();
    expect(body.data.url).toContain('/api/kb/images/');
    expect(body.data.url).toMatch(/\.png$/);
    uploadedImageUrl = body.data.url;
  });

  test('GET /api/kb/images/{filename} - serve uploaded image', async () => {
    expect(uploadedImageUrl).toBeDefined();
    const response = await request.get(uploadedImageUrl);
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('image/png');
  });

  test('POST /api/kb/images - empty file returns 400', async () => {
    const response = await request.post('/api/kb/images', {
      multipart: {
        file: {
          name: 'empty.png',
          mimeType: 'image/png',
          buffer: Buffer.alloc(0),
        },
      },
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as any;
    expect(body.success).toBe(false);
  });

  test('GET /api/kb/images/nonexistent.png - returns 404', async () => {
    const response = await request.get('/api/kb/images/nonexistent-file.png');
    expect(response.status()).toBe(404);
  });
});
