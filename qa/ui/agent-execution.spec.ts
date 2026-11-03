import { test, expect, Page } from '@playwright/test';
import {
  claimAgentJob,
  completeAgentJob,
  createAgentJob,
  createTestCompany,
  createTestProduct,
  createTestSegment,
  createTestTestCase,
  deleteCompany,
  loginAsAdminInBrowser,
  recordAgentResult,
} from '../helpers/api-helpers';
import { AutomationPage } from '../pages/automation-page';

/**
 * registry_v20 → v31 — TC 단건 AI 실행 UI E2E (워커는 API로 흉내).
 * [AI 시험 실행] → Job 생성 → /automation/jobs/:id 이동 → 폴링(대기 → 실행 중 → 완료) → PASS 판정 + step 증적.
 * v31에서 AgentRunModal이 삭제되어 진행·결과·중지는 Job 페이지에서 본다.
 */

const POLL = { timeout: 10_000 };

test.describe('Agent Execution UI (worker simulated via API)', () => {
  let companyId: number;
  let productId: number;
  let testCaseId: number;

  test.beforeAll(async () => {
    companyId = (await createTestCompany()).id;
    productId = (await createTestProduct(companyId, 'E2E Agent Product')).id;
    const segment = await createTestSegment(productId, 'E2E Agent Segment');
    testCaseId = (
      await createTestTestCase(productId, 'E2E Agent Test Case', [segment.id], 'MEDIUM', [
        { order: 0, action: 'open', expected: 'ok' },
      ])
    ).id;
  });

  test.afterAll(async () => {
    // 이 spec이 만든 회사만 삭제 (cascade)
    if (companyId) await deleteCompany(companyId);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
  });

  async function openTestCasePage(page: Page) {
    await page.goto(`/features/companies/${companyId}/products/${productId}`);
    const runButton = page
      .locator(`[data-testid="tc-card"][data-tc-id="${testCaseId}"]`)
      .getByRole('button', { name: 'AI 시험 실행' });
    await expect(runButton).toBeVisible();
    return runButton;
  }

  /** [AI 시험 실행] 클릭 → SINGLE Job 생성 → Job 페이지 이동. @returns jobId */
  async function runFromCard(page: Page): Promise<number> {
    const runButton = await openTestCasePage(page);
    const created = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/agent-executions',
    );
    await runButton.click();
    const res = await created;
    expect(res.status()).toBe(201);
    expect(res.request().postDataJSON()).toMatchObject({
      scope: 'SINGLE',
      productId,
      targetTestCaseId: testCaseId,
    });
    const jobId = ((await res.json()) as { data: { jobId: number } }).data.jobId;
    await expect(page).toHaveURL(new RegExp(`/automation/jobs/${jobId}$`));
    return jobId;
  }

  test('AI 시험 실행 → Job 페이지 → 대기·실행 중·완료 폴링, PASS 판정 + step 증적', async ({ page }) => {
    const automation = new AutomationPage(page);
    const jobId = await runFromCard(page);
    const row = automation.tcRow(jobId, testCaseId);

    await expect(automation.jobStatus(jobId)).toHaveText('대기', POLL);
    await expect(row.getByText('대기', { exact: true })).toBeVisible();

    await claimAgentJob(jobId, `e2e-web-${Date.now()}`);
    await expect(automation.jobStatus(jobId)).toHaveText('실행 중', POLL);

    await recordAgentResult(jobId, testCaseId, 'PASS', [
      { order: 0, actionTaken: 'click(a0)', observed: '/features', judgment: 'PASS: 정상' },
    ]);
    await completeAgentJob(jobId);
    await expect(automation.jobStatus(jobId)).toHaveText('완료', POLL);
    await expect(page.getByText('완료 1/1')).toBeVisible();
    await expect(row.getByText('PASS', { exact: true })).toBeVisible();

    // TC 페이지: step 증적
    await row.click();
    await expect(automation.stepCards).toHaveCount(1, POLL);
    await expect(automation.stepCards).toContainText('실제 동작: click(a0)');
    await expect(automation.stepCards).toContainText('판정: PASS: 정상');

    // 단건 실행은 dry run — Phase 결과 갱신 안내가 없다
    await expect(automation.rerunButton).toBeEnabled();
    await expect(page.getByText('재실행하면 Phase 결과가 갱신됩니다')).toHaveCount(0);
  });

  test('Job 페이지 중지 - 2단계 확인 후 중지됨, 중지 버튼 사라짐', async ({ page }) => {
    const automation = new AutomationPage(page);
    const jobId = await runFromCard(page);
    await claimAgentJob(jobId, `e2e-web-${Date.now()}`);
    await expect(automation.jobStatus(jobId)).toHaveText('실행 중', POLL);

    await automation.stopButton.click();
    await automation.stopConfirm.click();

    await expect(automation.jobStatus(jobId)).toHaveText('중지됨', POLL);
    await expect(automation.stopButton).toHaveCount(0);
    await expect(automation.stopConfirm).toHaveCount(0);
  });

  test('단건 재실행 - 새 SINGLE Job을 만들고 그 Job 페이지로 이동', async ({ page }) => {
    const automation = new AutomationPage(page);
    const jobId = await createAgentJob({ scope: 'SINGLE', productId, targetTestCaseId: testCaseId });
    await claimAgentJob(jobId, `e2e-web-${Date.now()}`);
    await recordAgentResult(jobId, testCaseId, 'FAIL');
    await completeAgentJob(jobId);

    await automation.gotoTestCase(jobId, testCaseId);
    await expect(automation.rerunButton).toBeEnabled(POLL);

    const created = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/agent-executions',
    );
    await automation.rerunButton.click();
    const res = await created;
    expect(res.status()).toBe(201);
    expect(res.request().postDataJSON()).toMatchObject({
      scope: 'SINGLE',
      productId,
      targetTestCaseId: testCaseId,
    });
    const newJobId = ((await res.json()) as { data: { jobId: number } }).data.jobId;
    await expect(page).toHaveURL(new RegExp(`/automation/jobs/${newJobId}$`));
  });

  test('AI 시험 실행 실패 - agent-run-error 표시, TC 페이지에 머문다', async ({ page }) => {
    await page.route('**/api/agent-executions', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'E2E 실행 시작 실패', data: null }),
      });
    });

    const runButton = await openTestCasePage(page);
    await runButton.click();

    await expect(page.getByTestId('agent-run-error')).toHaveText('E2E 실행 시작 실패');
    await expect(page).toHaveURL(new RegExp(`/features/companies/${companyId}/products/${productId}$`));
  });
});
