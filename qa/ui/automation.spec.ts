import { test, expect, Page } from '@playwright/test';
import {
  buildRgbaPng,
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
  putAgentProgress,
  putAgentScreenshot,
  recordAgentResult,
  sendWorkerHeartbeat,
  TestStepData,
} from '../helpers/api-helpers';
import { AutomationPage } from '../pages/automation-page';

/**
 * registry_v31 Step 1 — Test Automation 페이지 UI E2E.
 * 워커는 API로 흉내 낸다 (claim / progress / results / complete / heartbeat). 실제 워커·LLM 호출 없음.
 * 목록 폴링 3초, 상세 폴링 2초라 상태 전이 대기는 POLL 타임아웃을 쓴다.
 */

const POLL = { timeout: 10_000 };
const PHASE_NAME = 'E2E Automation Phase';

const isCreateJob = (res: { request(): { method(): string }; url(): string }) =>
  res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/agent-executions';

test.describe('Test Automation UI (worker simulated via API)', () => {
  let companyId: number;
  let productId: number;
  let productName: string;
  let segmentId: number;
  let versionId: number;
  let versionName: string;

  test.beforeAll(async () => {
    companyId = (await createTestCompany()).id;
  });

  test.afterAll(async () => {
    // 이 spec이 만든 회사만 삭제 (제품·Job은 cascade)
    if (companyId) await deleteCompany(companyId);
  });

  test.beforeEach(async ({ page }) => {
    // 테스트마다 새 제품: heartbeat는 15초간 메모리에 남으므로 제품을 나눠 테스트끼리 섞이지 않게 한다
    const product = await createTestProduct(companyId);
    productId = product.id;
    productName = product.name;
    segmentId = (await createTestSegment(productId)).id;
    const version = await createTestVersion(productId);
    versionId = version.id;
    versionName = version.name;
    await loginAsAdminInBrowser(page);
  });

  const newTc = async (title = 'E2E Test Case', steps?: TestStepData[]) =>
    (await createTestTestCase(productId, title, [segmentId], 'MEDIUM', steps)).id;

  /** Phase 1개 + 그 TC를 PHASE_SELECTED로 끝까지 실행한 Job */
  async function finishedPhaseJob(tcId: number) {
    const phaseId = await createTestPhase(productId, versionId, PHASE_NAME, [tcId]);
    const jobId = await createAgentJob({ scope: 'PHASE_SELECTED', productId, phaseId, testCaseIds: [tcId] });
    await claimAgentJob(jobId, `e2e-web-${Date.now()}`);
    await recordAgentResult(jobId, tcId, 'PASS');
    await completeAgentJob(jobId);
    return { phaseId, jobId };
  }

  async function openTcPageWithRerunReady(page: Page, jobId: number, tcId: number) {
    const automation = new AutomationPage(page);
    await automation.gotoTestCase(jobId, tcId);
    await expect(automation.rerunButton).toHaveText('재실행', POLL);
    await expect(automation.rerunButton).toBeEnabled();
    return automation;
  }

  test('nav Test Automation - opens /automation', async ({ page }) => {
    const automation = new AutomationPage(page);
    await page.goto('/features');
    await page.getByRole('link', { name: 'Test Automation', exact: true }).click();

    await expect(page).toHaveURL(/\/automation$/);
    await expect(page.getByRole('heading', { name: 'Test Automation', level: 1 })).toBeVisible();
    await expect(automation.workerStatus).toBeVisible();
  });

  test('AI 일괄 실행 - modal 실행 lands on /automation with the queued row', async ({ page }) => {
    const automation = new AutomationPage(page);
    const tcId = await newTc();
    const phaseId = await createTestPhase(productId, versionId, PHASE_NAME, [tcId]);

    await page.goto(
      `/features/companies/${companyId}/products/${productId}/versions/${versionId}/phases/${phaseId}`,
    );
    await page.getByRole('button', { name: 'AI 일괄 실행', exact: true }).click();
    const modal = page
      .locator('div.fixed.inset-0')
      .filter({ has: page.getByRole('heading', { name: 'AI 일괄 실행' }) });
    await expect(modal.getByText('실행 범위를 선택하세요:')).toBeVisible();

    const created = page.waitForResponse(isCreateJob);
    await modal.getByRole('button', { name: '실행', exact: true }).click();
    const res = await created;
    expect(res.status()).toBe(201);
    const jobId = ((await res.json()) as { data: { jobId: number } }).data.jobId;

    await expect(page).toHaveURL(/\/automation$/);
    const row = automation.queueRow(jobId);
    await expect(row).toBeVisible(POLL);
    await expect(row).toContainText(`${productName} > ${versionName} > ${PHASE_NAME}`);
    await expect(row).toContainText('대기');
    await expect(row).toContainText('0/1');
  });

  test('queue row - 연결된 워커 없음 until a heartbeat for its product arrives', async ({ page }) => {
    const automation = new AutomationPage(page);
    const tcId = await newTc();
    const jobId = await createAgentJob({ scope: 'SINGLE', productId, targetTestCaseId: tcId });
    const workerId = `e2e-web-${Date.now()}`;

    await automation.goto();
    const row = automation.queueRow(jobId);
    await expect(row.getByText('연결된 워커 없음')).toBeVisible(POLL);
    await expect(automation.workerStatus).not.toContainText(workerId);

    await sendWorkerHeartbeat(workerId, productId);
    await expect(automation.workerStatus).toContainText(workerId, POLL);
    await expect(row.getByText('연결된 워커 없음')).toHaveCount(0);
    await expect(row).toContainText('대기');
  });

  test('queue row - RUNNING job whose worker sent no heartbeat shows 워커 응답 없음', async ({ page }) => {
    const automation = new AutomationPage(page);
    const tcId = await newTc();
    const jobId = await createAgentJob({ scope: 'SINGLE', productId, targetTestCaseId: tcId });
    await claimAgentJob(jobId, `e2e-lost-${Date.now()}`);

    await automation.goto();
    const row = automation.queueRow(jobId);
    await expect(row).toContainText('실행 중', POLL);
    await expect(row.getByText('워커 응답 없음')).toBeVisible();
    await expect(row.getByText('연결된 워커 없음')).toHaveCount(0);
  });

  test('queue row - two-step stop stays on /automation and moves the job to 완료', async ({ page }) => {
    const automation = new AutomationPage(page);
    const tcId = await newTc();
    const jobId = await createAgentJob({ scope: 'SINGLE', productId, targetTestCaseId: tcId });

    await automation.goto();
    const row = automation.queueRow(jobId);
    await expect(row).toBeVisible(POLL);

    // 1단계 → 계속: 취소하지 않고 원래 버튼으로 돌아온다
    await row.getByTestId('automation-stop').click();
    await expect(row.getByTestId('automation-stop-confirm')).toBeVisible();
    await row.getByRole('button', { name: '계속', exact: true }).click();
    await expect(row.getByTestId('automation-stop-confirm')).toHaveCount(0);
    await expect(row.getByTestId('automation-stop')).toBeVisible();

    // 1단계 → 2단계 중지
    await row.getByTestId('automation-stop').click();
    await row.getByTestId('automation-stop-confirm').click();

    await expect(row).toHaveCount(0, POLL);
    const done = automation.doneRow(jobId);
    await expect(done).toBeVisible(POLL);
    await expect(done).toContainText('중지됨');
    await expect(page).toHaveURL(/\/automation$/);
  });

  test('job page - TC rows go 대기 → 실행 중 → verdict / 미실행 and link to the TC page', async ({ page }) => {
    const automation = new AutomationPage(page);
    const tc1 = await newTc('E2E Automation TC 1');
    const tc2 = await newTc('E2E Automation TC 2');
    const phaseId = await createTestPhase(productId, versionId, PHASE_NAME, [tc1, tc2]);
    const jobId = await createAgentJob({ scope: 'PHASE_ALL', productId, phaseId });

    await automation.gotoJob(jobId);
    const row1 = automation.tcRow(jobId, tc1);
    const row2 = automation.tcRow(jobId, tc2);
    await expect(row1.getByText('대기', { exact: true })).toBeVisible(POLL);
    await expect(row2.getByText('대기', { exact: true })).toBeVisible();

    await claimAgentJob(jobId, `e2e-web-${Date.now()}`);
    await putAgentProgress(jobId, {
      testCaseId: tc1,
      testCaseTitle: 'E2E Automation TC 1',
      tcIndex: 1,
      tcTotal: 2,
      phase: 'ACTING',
      precondition: { text: 'E2E Test Segment', status: 'DONE' },
      currentStep: 1,
      steps: [{ order: 1, action: 'open', expected: 'ok', status: 'ACTING', judgment: null }],
    });
    await expect(row1.getByText('실행 중', { exact: true })).toBeVisible(POLL);

    await recordAgentResult(jobId, tc1, 'PASS');
    await expect(row1.getByText('PASS', { exact: true })).toBeVisible(POLL);
    await expect(row2.getByText('대기', { exact: true })).toBeVisible();

    await completeAgentJob(jobId);
    await expect(row2.getByText('미실행', { exact: true })).toBeVisible(POLL);
    await expect(page.getByText('완료 1/2')).toBeVisible();

    // 드릴다운: TC → Job → 목록
    await row1.click();
    await expect(page).toHaveURL(new RegExp(`/automation/jobs/${jobId}/tc/${tc1}$`));
    await page.getByRole('link', { name: `← Job #${jobId}`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/automation/jobs/${jobId}$`));
    await page.getByRole('link', { name: '← Test Automation', exact: true }).click();
    await expect(page).toHaveURL(/\/automation$/);
  });

  test('TC page - step card shows judgment and screenshot; click zooms, Esc closes', async ({ page }) => {
    const automation = new AutomationPage(page);
    const tcId = await newTc('E2E Automation Step TC', [
      { order: 1, action: 'E2E 검색창 클릭', expected: 'E2E 검색창 포커스' },
    ]);
    const jobId = await createAgentJob({ scope: 'SINGLE', productId, targetTestCaseId: tcId });
    await claimAgentJob(jobId, `e2e-web-${Date.now()}`);
    await putAgentScreenshot(jobId, tcId, 1, buildRgbaPng(64, 48));
    await recordAgentResult(jobId, tcId, 'PASS', [
      { order: 1, actionTaken: 'click(a0)', observed: '/', judgment: 'PASS: 포커스됨' },
    ]);
    await completeAgentJob(jobId);

    await automation.gotoTestCase(jobId, tcId);
    const card = automation.stepCards;
    await expect(card).toHaveCount(1, POLL);
    await expect(card).toContainText('E2E 검색창 클릭');
    await expect(card).toContainText('기대 결과: E2E 검색창 포커스');
    await expect(card).toContainText('실제 동작: click(a0)');
    await expect(card).toContainText('판정: PASS: 포커스됨');
    await expect(card.getByText('PASS', { exact: true })).toBeVisible();

    const thumb = card.getByTestId('automation-step-screenshot');
    await expect(thumb).toBeVisible(POLL);
    // 이미지가 실제로 디코드됐는지 (blob → object URL)
    await expect
      .poll(() => thumb.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(64);

    await thumb.click();
    await expect(automation.screenshotZoom).toBeVisible();
    await expect(automation.screenshotZoom).toHaveAttribute('role', 'dialog');
    await page.keyboard.press('Escape');
    await expect(automation.screenshotZoom).toBeHidden();
  });

  test('TC page rerun - finished phase job creates a PHASE_SELECTED job and opens it', async ({ page }) => {
    const tcId = await newTc();
    const { phaseId, jobId } = await finishedPhaseJob(tcId);

    const automation = await openTcPageWithRerunReady(page, jobId, tcId);
    await expect(page.getByText('재실행하면 Phase 결과가 갱신됩니다')).toBeVisible();

    const created = page.waitForResponse(isCreateJob);
    await automation.rerunButton.click();
    const res = await created;
    expect(res.status()).toBe(201);
    expect(res.request().postDataJSON()).toMatchObject({
      scope: 'PHASE_SELECTED',
      productId,
      phaseId,
      testCaseIds: [tcId],
    });
    const newJobId = ((await res.json()) as { data: { jobId: number } }).data.jobId;
    expect(newJobId).not.toBe(jobId);

    await expect(page).toHaveURL(new RegExp(`/automation/jobs/${newJobId}$`));
    await expect(page.getByRole('heading', { name: `Job #${newJobId}`, exact: true })).toBeVisible(POLL);
    await expect(automation.tcRow(newJobId, tcId).getByText('대기', { exact: true })).toBeVisible(POLL);
  });

  test('TC page rerun - overlapping active job shows automation-rerun-error and stays', async ({ page }) => {
    const tcId = await newTc();
    const { phaseId, jobId } = await finishedPhaseJob(tcId);
    const blocking = await createAgentJob({ scope: 'PHASE_SELECTED', productId, phaseId, testCaseIds: [tcId] });

    const automation = await openTcPageWithRerunReady(page, jobId, tcId);
    await automation.rerunButton.click();

    await expect(automation.rerunError).toContainText(`Job(#${blocking})`, POLL);
    await expect(page).toHaveURL(new RegExp(`/automation/jobs/${jobId}/tc/${tcId}$`));
    await expect(automation.rerunButton).toBeEnabled();
  });
});
