import { test, expect, Page } from '@playwright/test';
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
 * registry_v26/v27 — AI 실행 라이브 뷰 UI E2E (워커 stub 모드).
 * agent-execution API를 route 모킹: 프레임 엔드포인트는 1x1 PNG, 진행 상황 엔드포인트는 3 step 진행 상황을 돌려준다.
 * v26: 실행 중에는 라이브 프레임(<img>)이 보이고, DONE 이후에는 라이브 뷰가 사라져야 한다.
 * v27: 실행 중 TC 헤더 / 노드 플로우 / 현재 step 상세 / 확대 오버레이가 보여야 한다.
 */

const JOB_ID = 987656;
const RUNNING_POLLS = 3;
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

interface StubCounters {
  jobPolls: number;
  framePolls: number;
}

/**
 * 워커 없이 AgentRunModal이 쓰는 API를 모두 route 모킹한다.
 * @param isDone job 폴링마다 호출 (인자: 누적 폴링 수). true면 DONE 응답.
 */
async function stubAgentApi(
  page: Page,
  ids: { productId: number; testCaseId: number },
  isDone: (jobPolls: number) => boolean,
): Promise<StubCounters> {
  const counters: StubCounters = { jobPolls: 0, framePolls: 0 };

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
    counters.jobPolls += 1;
    const done = isDone(counters.jobPolls);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'ok',
        data: {
          id: JOB_ID,
          productId: ids.productId,
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
    counters.framePolls += 1;
    await route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 });
  });

  await page.route(`**/api/agent-executions/${JOB_ID}/progress`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'ok',
        data: {
          testCaseId: ids.testCaseId,
          testCaseTitle: 'E2E Agent Live View TC',
          tcIndex: 1,
          tcTotal: 1,
          phase: 'JUDGING',
          precondition: { text: '홈 > 검색', status: 'DONE' },
          currentStep: 3,
          steps: [
            { order: 1, action: '검색창 클릭', expected: '검색창 포커스', status: 'PASS', judgment: 'PASS: 포커스됨' },
            { order: 2, action: '검색어 입력', expected: '자동완성 표시', status: 'FAIL', judgment: 'FAIL: 자동완성 없음' },
            { order: 3, action: '검색 버튼 클릭', expected: '결과 목록 표시', status: 'JUDGING', judgment: null },
          ],
        },
      }),
    });
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
          testCaseId: ids.testCaseId,
          verdict: 'PASS',
          stepLogs: [{ order: 0, actionTaken: 'click(a0)', observed: '/', judgment: 'PASS: 정상' }],
          durationMs: 1000,
          tokenCost: 10,
          createdAt: new Date(0).toISOString(),
        },
      }),
    });
  });

  return counters;
}

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

  async function openRunModal(page: Page) {
    await page.goto(`/features/companies/${companyId}/products/${productId}`);

    const card = page.locator(`[data-testid="tc-card"][data-tc-id="${testCaseId}"]`);
    const runButton = card.getByRole('button', { name: 'AI 시험 실행' });
    await expect(runButton).toBeVisible();
    await runButton.click();

    await expect(page.getByRole('heading', { name: 'AI 시험 실행' })).toBeVisible();
  }

  test('AI 시험 실행 - 실행 중 라이브 프레임 표시, DONE 후 라이브 뷰 사라짐', async ({ page }) => {
    await loginAsAdminInBrowser(page);
    const counters = await stubAgentApi(page, { productId, testCaseId }, (n) => n > RUNNING_POLLS);

    await openRunModal(page);

    // 실행 중: 라이브 프레임 표시
    const frame = page.getByTestId('agent-live-frame');
    await expect(frame).toBeVisible({ timeout: 10_000 });
    await expect(frame).toHaveAttribute('alt', 'AI 실행 화면');
    expect(counters.jobPolls).toBeLessThanOrEqual(RUNNING_POLLS);
    expect(counters.framePolls).toBeGreaterThan(0);

    // DONE 이후: 라이브 뷰 전체가 사라지고 완료 표시
    await expect(page.getByText('실행 완료', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(frame).toBeHidden();
    await expect(page.getByTestId('agent-live-waiting')).toBeHidden();
    await expect(page.getByText('실행 화면', { exact: true })).toBeHidden();
    expect(counters.jobPolls).toBeGreaterThan(RUNNING_POLLS);
  });

  test('AI 시험 실행 - 실행 중 TC/step 노드 플로우·상세·확대 표시, DONE 후 사라짐', async ({ page }) => {
    await loginAsAdminInBrowser(page);
    // 테스트가 finish=true로 바꿀 때까지 RUNNING 유지 — 폴링 횟수에 의존하지 않는다
    let finish = false;
    await stubAgentApi(page, { productId, testCaseId }, () => finish);

    await openRunModal(page);

    // TC 헤더
    const tcHeader = page.getByTestId('agent-live-tc');
    await expect(tcHeader).toBeVisible({ timeout: 10_000 });
    await expect(tcHeader).toContainText('TC 1/1');
    await expect(tcHeader).toContainText(`T${testCaseId}`);

    // 노드 플로우: 전제조건 + step 3개 상태
    const flow = page.getByTestId('agent-live-flow');
    await expect(flow.getByTestId('agent-live-node-pre')).toBeVisible();
    await expect(flow.getByTestId('agent-live-node-pre')).toHaveAttribute('data-status', 'DONE');
    await expect(flow.getByTestId('agent-live-node-1')).toHaveAttribute('data-status', 'PASS');
    await expect(flow.getByTestId('agent-live-node-2')).toHaveAttribute('data-status', 'FAIL');
    await expect(flow.getByTestId('agent-live-node-3')).toHaveAttribute('data-status', 'JUDGING');

    // 현재 위치 상세
    const detail = page.getByTestId('agent-live-detail');
    await expect(detail).toContainText('Step 3/3');
    await expect(detail).toContainText('기대 결과 판정 중');
    await expect(detail).toContainText('검색 버튼 클릭');
    await expect(detail).toContainText('결과 목록 표시');

    // 확대: 열기 → 오버레이(다크 플로우 포함) → Esc로 닫기
    await expect(page.getByTestId('agent-live-frame')).toBeVisible();
    await page.getByTestId('agent-live-zoom-open').click();
    const zoom = page.getByTestId('agent-live-zoom');
    await expect(zoom).toBeVisible();
    await expect(zoom.getByTestId('agent-live-flow')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(zoom).toBeHidden();

    // DONE 이후: 플로우·상세도 함께 사라진다
    finish = true;
    await expect(page.getByText('실행 완료', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('agent-live-flow')).toBeHidden();
    await expect(page.getByTestId('agent-live-detail')).toBeHidden();
    await expect(page.getByTestId('agent-live-tc')).toBeHidden();
  });
});
