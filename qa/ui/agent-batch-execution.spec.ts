import { test, expect } from '@playwright/test';
import axios from 'axios';
import {
  cleanupAllTestData,
  createTestCompany,
  activateCompany,
  createTestProduct,
  createTestSegment,
  createTestTestCase,
  createTestVersion,
  deleteCompany,
  loginAsAdmin,
  loginAsAdminInBrowser,
} from '../helpers/api-helpers';

const API_URL = process.env.API_URL || 'http://localhost:8080';

/**
 * registry_v25 — [AI 일괄 실행] 완료 후 결과 모달이 사라지던 버그 회귀 테스트 (워커 stub 모드).
 * 완료 시 부모가 loadData(true)로 silent 재로딩해야 모달이 언마운트되지 않고 결과를 유지한다.
 */
test.describe('Agent Batch Execution UI (worker stubbed)', () => {
  let companyId: number;
  let productId: number;
  let versionId: number;
  let phaseId: number;
  let testCaseId: number;

  test.beforeAll(async () => {
    await cleanupAllTestData();
    const company = await createTestCompany('E2E Agent Batch Co');
    companyId = company.id;
    await activateCompany(companyId);
    productId = (await createTestProduct(companyId, 'E2E Agent Batch Product')).id;
    const segment = await createTestSegment(productId, 'E2E Agent Batch Segment');
    testCaseId = (await createTestTestCase(productId, 'E2E Agent Batch TC', [segment.id])).id;
    versionId = (await createTestVersion(productId, 'E2E Agent Batch Version')).id;

    const token = await loginAsAdmin();
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    const run = await axios.post(
      `${API_URL}/api/products/${productId}/test-runs`,
      { name: 'E2E Agent Batch Run', description: 'batch run', testCaseIds: [testCaseId] },
      auth,
    );
    const phase = await axios.post(
      `${API_URL}/api/versions/${versionId}/phases`,
      { phaseName: 'E2E Batch Phase', testRunIds: [run.data.data.id], testCaseIds: [] },
      auth,
    );
    phaseId = phase.data.data.id;
  });

  test.afterAll(async () => {
    if (companyId) await deleteCompany(companyId);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);

    // --- 워커 stub: agent-execution API 모킹 ---
    const jobId = 987655;
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
      const finished = status === 'DONE';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'ok',
          data: {
            id: jobId,
            productId,
            scope: 'PHASE_ALL',
            status,
            totalCount: 1,
            doneCount: finished ? 1 : 0,
            passCount: finished ? 1 : 0,
            failCount: 0,
            inconclusiveCount: 0,
            createdAt: new Date(0).toISOString(),
          },
        }),
      });
    });

    await page.route(`**/api/agent-executions/${jobId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'ok',
          data: [
            {
              id: 1,
              jobId,
              testCaseId,
              verdict: 'PASS',
              stepLogs: [],
              aiFailureAnalysis: null,
              durationMs: 1234,
              tokenCost: 100,
              createdAt: new Date(0).toISOString(),
            },
          ],
        }),
      });
    });
  });

  test('AI 일괄 실행 완료 후 silent 재로딩에도 결과 모달 유지', async ({ page }) => {
    await page.goto(
      `/features/companies/${companyId}/products/${productId}/versions/${versionId}/phases/${phaseId}`,
    );

    const headerButton = page.getByRole('button', { name: 'AI 일괄 실행', exact: true });
    await expect(headerButton).toBeVisible();
    await headerButton.click();

    const modal = page
      .locator('div.fixed.inset-0')
      .filter({ has: page.getByRole('heading', { name: 'AI 일괄 실행' }) });
    await expect(modal.getByText('실행 범위를 선택하세요:')).toBeVisible();

    // 완료(DONE) 시 부모가 GET /api/versions/{id}로 재로딩한다 — 클릭 전에 대기 등록
    const reload = page.waitForResponse(
      (res) =>
        res.request().method() === 'GET' &&
        new URL(res.url()).pathname === `/api/versions/${versionId}`,
      { timeout: 15000 },
    );
    await modal.getByRole('button', { name: '실행', exact: true }).click();

    await expect(modal.getByText('완료 1/1')).toBeVisible({ timeout: 10000 });
    await reload;

    // 재로딩 이후에도 모달이 결과 화면을 유지해야 한다 (scope 선택 화면으로 리셋 금지)
    await expect(page.getByText('Loading...')).toHaveCount(0);
    await expect(modal.getByText('완료 1/1')).toBeVisible();
    await expect(modal.getByText(`T${testCaseId}`, { exact: true })).toBeVisible();
    await expect(modal.getByText('PASS', { exact: true })).toBeVisible();
    await expect(modal.getByText('실행 범위를 선택하세요:')).toHaveCount(0);

    await modal.getByRole('button', { name: '닫기' }).click();
    await expect(modal).toHaveCount(0);
  });
});
