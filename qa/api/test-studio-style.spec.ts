import { test, expect, APIRequestContext } from '@playwright/test';

let request: APIRequestContext;
const API_URL = process.env.API_URL || 'http://localhost:8080';

/**
 * Test Studio v2.5 — Style-by-Example API E2E.
 *
 * Pure CRUD over 스타일 세트(프로필)/예시 TC/보조 설정 — no generation job is submitted,
 * so NO Claude/OpenAI tokens are consumed.
 */

test.beforeAll(async ({ playwright }) => {
  const loginCtx = await playwright.request.newContext({ baseURL: API_URL });
  const loginResp = await loginCtx.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin' },
  });
  const token = ((await loginResp.json()) as any).data.token;
  await loginCtx.dispose();

  request = await playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
});

test.afterAll(async () => {
  await request.dispose();
});

test.describe.configure({ mode: 'serial' });

test.describe('Test Studio Style API E2E', () => {
  let companyId: number;
  let profileId: number;
  let exampleId: number;

  test.beforeAll(async () => {
    // Clean up only style E2E companies from prior runs.
    const resp = await request.get('/api/companies');
    const list: { id: number; name: string }[] = ((await resp.json()) as any).data || [];
    for (const c of list) {
      if (typeof c.name === 'string' && c.name.includes('E2E TestStudioStyle')) {
        await request.delete(`/api/companies/${c.id}`).catch(() => {});
      }
    }

    const cResp = await request.post('/api/companies', {
      data: { name: 'E2E TestStudioStyle Co' },
    });
    expect(cResp.status()).toBe(201);
    companyId = ((await cResp.json()) as any).data.id;
  });

  test.afterAll(async () => {
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });

  test('GET /config - returns defaults when none configured', async () => {
    const resp = await request.get(`/api/test-studio/config?companyId=${companyId}`);
    expect(resp.status()).toBe(200);
    const body = (await resp.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.selectedProfileId).toBeNull();
    expect(body.data.stepFormat).toBe('ACTION_EXPECTED');
    expect(body.data.detailLevel).toBe('STANDARD');
    expect(body.data.tone).toBe('PLAIN');
  });

  test('GET /config - 400 when companyId missing', async () => {
    const resp = await request.get('/api/test-studio/config');
    expect(resp.status()).toBe(400);
  });

  test('POST /style-profiles - creates a set (201)', async () => {
    const resp = await request.post('/api/test-studio/style-profiles', {
      data: { companyId, name: 'E2E 결제팀 스타일' },
    });
    expect(resp.status()).toBe(201);
    const body = (await resp.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('E2E 결제팀 스타일');
    expect(body.data.exampleCount).toBe(0);
    profileId = body.data.id;
  });

  test('POST /style-profiles - 400 when name blank', async () => {
    const resp = await request.post('/api/test-studio/style-profiles', {
      data: { companyId, name: '' },
    });
    expect(resp.status()).toBe(400);
  });

  test('POST /style-profiles - 400 when company does not exist', async () => {
    const resp = await request.post('/api/test-studio/style-profiles', {
      data: { companyId: 999999999, name: 'E2E bogus' },
    });
    expect(resp.status()).toBe(400);
  });

  test('GET /style-profiles - includes created set', async () => {
    const resp = await request.get(`/api/test-studio/style-profiles?companyId=${companyId}`);
    expect(resp.status()).toBe(200);
    const body = (await resp.json()) as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.find((p: any) => p.id === profileId)).toBeDefined();
  });

  test('POST /examples - adds a verbatim example (201) with JSONB round-trip', async () => {
    const resp = await request.post(
      `/api/test-studio/style-profiles/${profileId}/examples`,
      {
        data: {
          title: '[결제] IC카드 승인 실패',
          preconditions: '단말기 연결됨',
          steps: [
            { order: 1, action: '만료 카드를 삽입한다', expected: '거절 메시지가 표시된다' },
          ],
          expectedResults: ['승인이 거절된다', '재시도 안내가 표시된다'],
          priority: 'HIGH',
          testType: 'FUNCTIONAL',
          sortOrder: 0,
        },
      },
    );
    expect(resp.status()).toBe(201);
    const body = (await resp.json()) as any;
    expect(body.data.title).toBe('[결제] IC카드 승인 실패');
    expect(body.data.steps).toHaveLength(1);
    expect(body.data.steps[0].action).toBe('만료 카드를 삽입한다');
    expect(body.data.expectedResults).toEqual(['승인이 거절된다', '재시도 안내가 표시된다']);
    exampleId = body.data.id;
  });

  test('POST /examples - 400 when title blank', async () => {
    const resp = await request.post(
      `/api/test-studio/style-profiles/${profileId}/examples`,
      { data: { title: '' } },
    );
    expect(resp.status()).toBe(400);
  });

  test('GET /examples - lists the example; profile exampleCount reflects it', async () => {
    const exResp = await request.get(
      `/api/test-studio/style-profiles/${profileId}/examples`,
    );
    expect(exResp.status()).toBe(200);
    expect(((await exResp.json()) as any).data).toHaveLength(1);

    const pResp = await request.get(`/api/test-studio/style-profiles?companyId=${companyId}`);
    const profile = ((await pResp.json()) as any).data.find((p: any) => p.id === profileId);
    expect(profile.exampleCount).toBe(1);
  });

  test('PUT /config - selects the profile as active set', async () => {
    const resp = await request.put('/api/test-studio/config', {
      data: {
        companyId,
        selectedProfileId: profileId,
        stepFormat: 'GIVEN_WHEN_THEN',
        detailLevel: 'DETAILED',
        tone: 'FORMAL',
      },
    });
    expect(resp.status()).toBe(200);
    const body = (await resp.json()) as any;
    expect(body.data.selectedProfileId).toBe(profileId);
    expect(body.data.stepFormat).toBe('GIVEN_WHEN_THEN');
    expect(body.data.tone).toBe('FORMAL');
  });

  test('PUT /config - 400 when selecting a profile from another company', async () => {
    const resp = await request.put('/api/test-studio/config', {
      data: { companyId, selectedProfileId: 999999999 },
    });
    expect(resp.status()).toBe(400);
  });

  test('PUT /style-examples/{id} - updates the example', async () => {
    const resp = await request.put(`/api/test-studio/style-examples/${exampleId}`, {
      data: { title: '[결제] IC카드 승인 실패 (수정)' },
    });
    expect(resp.status()).toBe(200);
    expect(((await resp.json()) as any).data.title).toBe('[결제] IC카드 승인 실패 (수정)');
  });

  test('DELETE /style-examples/{id} - removes the example (204)', async () => {
    const resp = await request.delete(`/api/test-studio/style-examples/${exampleId}`);
    expect(resp.status()).toBe(204);
    const exResp = await request.get(
      `/api/test-studio/style-profiles/${profileId}/examples`,
    );
    expect(((await exResp.json()) as any).data).toHaveLength(0);
  });

  test('DELETE /style-profiles/{id} - removes set and resets config selection', async () => {
    const resp = await request.delete(`/api/test-studio/style-profiles/${profileId}`);
    expect(resp.status()).toBe(204);

    // config.selected_profile_id SET NULL after profile delete (→ Sample fallback)
    const cfgResp = await request.get(`/api/test-studio/config?companyId=${companyId}`);
    expect(((await cfgResp.json()) as any).data.selectedProfileId).toBeNull();
  });
});
