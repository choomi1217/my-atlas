import { test, expect } from '@playwright/test';
import {
  createTestCompany,
  activateCompany,
  createTestProduct,
  createTestSegment,
  createTestTestCase,
  deleteCompany,
  loginAsAdminInBrowser,
} from '../helpers/api-helpers';

/**
 * registry_v26 — AI 실행 라이브 뷰 UI E2E (워커 stub 모드).
 * agent-execution API를 route 모킹: Job은 처음 3회 폴링 동안 RUNNING, 이후 DONE.
 * 프레임 엔드포인트는 1x1 PNG를 돌려준다.
 * 실행 중에는 라이브 프레임(<img>)이 보이고, DONE 이후에는 라이브 뷰가 사라져야 한다.
 */

const JOB_ID = 987656;
const RUNNING_POLLS = 3;
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Agent Live View UI (worker stubbed)', () => {
  let companyId: number;
  let productId: number;
  let testCaseId: number;

  test.beforeAll(async () => {
    const company = await createTestCompany('E2E Agent Live View Co');
    companyId = company.id;
    await activateCompany(companyId);
    const product = await createTestProduct(companyId, 'E2E Agent Live View Product');
    productId = product.id;
    const segment = await createTestSegment(productId, 'E2E Agent Live View Segment');
    const tc = await createTestTestCase(productId, 'E2E Agent Live View TC', [segment.id]);
    testCaseId = tc.id;
  });

  test.afterAll(async () => {
    // 이 spec이 만든 회사만 삭제 (cascade)
    if (companyId) await deleteCompany(companyId);
  });

  test('AI 시험 실행 - 실행 중 라이브 프레임 표시, DONE 후 라이브 뷰 사라짐', async ({ page }) => {
    await loginAsAdminInBrowser(page);

    let jobPolls = 0;
    let framePolls = 0;

    await page.route('**/api/agent-executions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'ok', data: { jobId: JOB_ID } }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/agent-executions/${JOB_ID}`, async (route) => {
      jobPolls += 1;
      const done = jobPolls > RUNNING_POLLS;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'ok',
          data: {
            id: JOB_ID,
            productId,
            scope: 'SINGLE',
            status: done ? 'DONE' : 'RUNNING',
            totalCount: 1,
            doneCount: done ? 1 : 0,
            passCount: done ? 1 : 0,
            failCount: 0,
            inconclusiveCount: 0,
            createdAt: new Date(0).toISOString(),
          },
        }),
      });
    });

    await page.route(`**/api/agent-executions/${JOB_ID}/frame`, async (route) => {
      framePolls += 1;
      await route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 });
    });

    await page.route(`**/api/agent-executions/${JOB_ID}/results/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'ok',
          data: {
            id: 1,
            jobId: JOB_ID,
            testCaseId,
            verdict: 'PASS',
            stepLogs: [{ order: 0, actionTaken: 'click(a0)', observed: '/', judgment: 'PASS: 정상' }],
            durationMs: 1000,
            tokenCost: 10,
            createdAt: new Date(0).toISOString(),
          },
        }),
      });
    });

    await page.goto(`/features/companies/${companyId}/products/${productId}`);

    const card = page.locator(`[data-testid="tc-card"][data-tc-id="${testCaseId}"]`);
    const runButton = card.getByRole('button', { name: 'AI 시험 실행' });
    await expect(runButton).toBeVisible();
    await runButton.click();

    await expect(page.getByRole('heading', { name: 'AI 시험 실행' })).toBeVisible();

    // 실행 중: 라이브 프레임 표시
    const frame = page.getByTestId('agent-live-frame');
    await expect(frame).toBeVisible({ timeout: 10_000 });
    await expect(frame).toHaveAttribute('alt', 'AI 실행 화면');
    expect(jobPolls).toBeLessThanOrEqual(RUNNING_POLLS);
    expect(framePolls).toBeGreaterThan(0);

    // DONE 이후: 라이브 뷰 전체가 사라지고 완료 표시
    await expect(page.getByText('실행 완료', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(frame).toBeHidden();
    await expect(page.getByTestId('agent-live-waiting')).toBeHidden();
    await expect(page.getByText('실행 화면', { exact: true })).toBeHidden();
    expect(jobPolls).toBeGreaterThan(RUNNING_POLLS);
  });
});
