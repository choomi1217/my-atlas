import { test, expect, Page } from '@playwright/test';
import {
  claimAgentJob,
  completeAgentJob,
  createAgentJob,
  createTestCompany,
  createTestPhase,
  createTestProduct,
  createTestSegment,
  createTestTestCase,
  createTestVersion,
  deleteCompany,
  loginAsAdminInBrowser,
  recordAgentResult,
} from '../helpers/api-helpers';
import { AutomationPage } from '../pages/automation-page';

/**
 * registry_v25 → v31 — [AI 일괄 실행] UI E2E (워커는 API로 흉내).
 * v31: 모달은 범위 선택만 하고, 실행하면 Job을 만든 뒤 /automation으로 이동한다.
 * 진행·결과는 목록(대기 → 완료)과 Job 페이지에서 본다. 같은 Phase에서 TC가 겹치면 모달에 409 메시지.
 */

const POLL = { timeout: 10_000 };

test.describe('Agent Batch Execution UI (worker simulated via API)', () => {
  let companyId: number;
  let productId: number;
  let versionId: number;
  let phaseId: number;
  let testCaseId: number;
  let phaseSeq = 0;

  test.beforeAll(async () => {
    companyId = (await createTestCompany()).id;
    productId = (await createTestProduct(companyId, 'E2E Agent Batch Product')).id;
    const segment = await createTestSegment(productId, 'E2E Agent Batch Segment');
    testCaseId = (await createTestTestCase(productId, 'E2E Agent Batch TC', [segment.id])).id;
    versionId = (await createTestVersion(productId, 'E2E Agent Batch Version')).id;
  });

  test.afterAll(async () => {
    if (companyId) await deleteCompany(companyId);
  });

  test.beforeEach(async ({ page }) => {
    // 테스트마다 새 Phase — 앞 테스트의 활성 Job이 409로 막지 않게 한다
    phaseId = await createTestPhase(productId, versionId, `E2E Batch Phase ${++phaseSeq}`, [testCaseId]);
    await loginAsAdminInBrowser(page);
  });

  async function openModal(page: Page) {
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
    return modal;
  }

  test('AI 일괄 실행 - 범위 선택 → 실행 → /automation 이동, 완료 후 결과 표시', async ({ page }) => {
    const automation = new AutomationPage(page);
    const modal = await openModal(page);
    await modal.getByLabel(/Untested만/).check();

    const created = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/agent-executions',
    );
    await modal.getByRole('button', { name: '실행', exact: true }).click();
    const res = await created;
    expect(res.status()).toBe(201);
    expect(res.request().postDataJSON()).toMatchObject({ scope: 'PHASE_UNTESTED', productId, phaseId });
    const jobId = ((await res.json()) as { data: { jobId: number } }).data.jobId;

    await expect(page).toHaveURL(/\/automation$/);
    await expect(modal).toHaveCount(0);
    const row = automation.queueRow(jobId);
    await expect(row).toBeVisible(POLL);
    await expect(row).toContainText('0/1');

    // 워커 역할: claim → PASS → complete. 목록이 폴링으로 완료 섹션에 옮긴다
    await claimAgentJob(jobId, `e2e-web-${Date.now()}`);
    await recordAgentResult(jobId, testCaseId, 'PASS');
    await completeAgentJob(jobId);

    const done = automation.doneRow(jobId);
    await expect(done).toBeVisible(POLL);
    await expect(row).toHaveCount(0);
    await expect(done).toContainText('PASS 1');
    await expect(done).toContainText('완료');

    await done.click();
    await expect(automation.tcRow(jobId, testCaseId).getByText('PASS', { exact: true })).toBeVisible(POLL);
  });

  test('AI 일괄 실행 - 같은 Phase의 대기 Job과 TC가 겹치면 batch-agent-error, 페이지 유지', async ({ page }) => {
    const blocking = await createAgentJob({ scope: 'PHASE_ALL', productId, phaseId });

    const modal = await openModal(page);
    await modal.getByRole('button', { name: '실행', exact: true }).click();

    await expect(modal.getByTestId('batch-agent-error')).toContainText(`Job(#${blocking})`);
    await expect(page).toHaveURL(new RegExp(`/phases/${phaseId}$`));
    await expect(modal.getByRole('button', { name: '실행', exact: true })).toBeEnabled();
  });
});
