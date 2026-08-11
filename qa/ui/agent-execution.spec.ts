import { test, expect } from '@playwright/test';
import {
  cleanupAllTestData,
  createTestCompany,
  activateCompany,
  createTestProduct,
  loginAsAdminInBrowser,
} from '../helpers/api-helpers';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:8080';

/**
 * registry_v20 Phase 4 Step 9 — 에이전트 실행 UI E2E (워커 stub 모드).
 * agent-execution API를 route 모킹하여 실제 워커/LLM 없이 UI 플로우를 검증한다:
 * [AI 시험 실행] 클릭 → Job 생성 → 폴링(실행 중) → 완료 시 verdict + step 증적 표시.
 */
test.describe('Agent Execution UI (worker stubbed)', () => {
  let companyId: number;
  let productId: number;
  let testCaseId: number;

  test.beforeAll(async () => {
    await cleanupAllTestData();
    const company = await createTestCompany('E2E Agent Co');
    companyId = company.id;
    await activateCompany(companyId);
    const product = await createTestProduct(companyId, 'E2E Agent Product');
    productId = product.id;

    const login = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin',
    });
    const token = login.data.data.token;
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    const seg = await axios.post(
      `${API_URL}/api/segments`,
      { name: 'E2E Agent Segment', productId, parentId: null },
      auth,
    );
    const segmentId = seg.data.data.id;

    const tc = await axios.post(
      `${API_URL}/api/test-cases`,
      {
        productId,
        path: [segmentId],
        title: 'E2E Agent Test Case',
        steps: [{ order: 0, action: 'open', expected: 'ok' }],
      },
      auth,
    );
    testCaseId = tc.data.data.id;
  });

  test.afterAll(async () => {
    await cleanupAllTestData();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);

    // --- 워커 stub: agent-execution API 모킹 ---
    const jobId = 987654;
    let polls = 0;

    await page.route('**/api/agent-executions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'ok', data: { jobId } }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/agent-executions/${jobId}`, async (route) => {
      polls += 1;
      const status = polls >= 2 ? 'DONE' : 'RUNNING';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'ok',
          data: {
            id: jobId,
            productId,
            scope: 'SINGLE',
            status,
            totalCount: 1,
            doneCount: status === 'DONE' ? 1 : 0,
            passCount: status === 'DONE' ? 1 : 0,
            failCount: 0,
            inconclusiveCount: 0,
            createdAt: new Date(0).toISOString(),
          },
        }),
      });
    });

    await page.route(`**/api/agent-executions/${jobId}/results/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'ok',
          data: {
            id: 1,
            jobId,
            testCaseId,
            verdict: 'PASS',
            stepLogs: [
              { order: 0, actionTaken: 'click(a0)', observed: '/features', judgment: 'PASS: 정상' },
            ],
            durationMs: 1234,
            tokenCost: 100,
            createdAt: new Date(0).toISOString(),
          },
        }),
      });
    });
  });

  test('AI 시험 실행 → 진행 표시 → PASS 판정 + step 증적 노출', async ({ page }) => {
    await page.goto(`/features/companies/${companyId}/products/${productId}`);

    // TC 카드의 [AI 시험 실행] 클릭
    const runButton = page.getByRole('button', { name: 'AI 시험 실행' }).first();
    await expect(runButton).toBeVisible();
    await runButton.click();

    // 모달 오픈 + 제목
    await expect(page.getByRole('heading', { name: 'AI 시험 실행' })).toBeVisible();

    // 완료 후 verdict PASS 배지 (폴링이 DONE으로 전이)
    await expect(page.getByText('PASS', { exact: true }).first()).toBeVisible({ timeout: 10000 });

    // step 증적 텍스트
    await expect(page.getByText('PASS: 정상')).toBeVisible();

    // dry run 안내
    await expect(page.getByText(/TestResult에 기록되지 않습니다/)).toBeVisible();
  });
});
