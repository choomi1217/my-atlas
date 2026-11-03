import { test, expect } from '@playwright/test';
import {
  buildRgbaPng,
  claimAgentJob,
  completeAgentJob,
  createAgentJob,
  createTestCompany,
  createTestProduct,
  createTestSegment,
  createTestTestCase,
  deleteCompany,
  loginAsAdminInBrowser,
  putAgentFrame,
  putAgentProgress,
  recordAgentResult,
} from '../helpers/api-helpers';
import { AutomationPage } from '../pages/automation-page';

/**
 * registry_v26/v27/v28 → v31 — AI 실행 라이브 뷰 UI E2E (워커는 API로 흉내).
 * v31: 라이브 뷰는 Job 페이지(/automation/jobs/:id)에 있다. 프레임·진행 상황은 실제 백엔드에 PUT한다.
 * v26: 실행 중에는 라이브 프레임(<img>)이 보이고, DONE 이후에는 라이브 뷰가 사라져야 한다.
 * v27: 실행 중 TC 헤더 / 노드 플로우 / 현재 step 상세 / 확대 오버레이가 보여야 한다.
 * v28: 노드 한 줄 요약, 노드 클릭 시 해당 step/전제조건 상세, '현재 Step 보기'·재클릭으로 복귀.
 */

const POLL = { timeout: 10_000 };
const FRAME_WIDTH = 320;
const FRAME = buildRgbaPng(FRAME_WIDTH, 200);

function buildProgress(testCaseId: number) {
  return {
    testCaseId,
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
  };
}

test.describe('Agent Live View UI (worker simulated via API)', () => {
  let companyId: number;
  let productId: number;
  let testCaseId: number;

  test.beforeAll(async () => {
    companyId = (await createTestCompany()).id;
    productId = (await createTestProduct(companyId, 'E2E Agent Live View Product')).id;
    const segment = await createTestSegment(productId, 'E2E Agent Live View Segment');
    testCaseId = (await createTestTestCase(productId, 'E2E Agent Live View TC', [segment.id])).id;
  });

  test.afterAll(async () => {
    // 이 spec이 만든 회사만 삭제 (cascade)
    if (companyId) await deleteCompany(companyId);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
  });

  async function startRunningJob(): Promise<number> {
    const jobId = await createAgentJob({ scope: 'SINGLE', productId, targetTestCaseId: testCaseId });
    await claimAgentJob(jobId, `e2e-web-${Date.now()}`);
    return jobId;
  }

  async function finish(jobId: number) {
    await recordAgentResult(jobId, testCaseId, 'PASS');
    await completeAgentJob(jobId);
  }

  test('Job 페이지 - 실행 중 라이브 프레임 표시, DONE 후 라이브 뷰 사라짐', async ({ page }) => {
    const automation = new AutomationPage(page);
    const jobId = await startRunningJob();
    await automation.gotoJob(jobId);

    // 프레임 전: 대기 표시 → 업로드 후 폴링으로 프레임 표시
    await expect(page.getByTestId('agent-live-waiting')).toBeVisible(POLL);
    await putAgentFrame(jobId, FRAME);
    const frame = page.getByTestId('agent-live-frame');
    await expect(frame).toBeVisible(POLL);
    await expect(frame).toHaveAttribute('alt', 'AI 실행 화면');
    await expect
      .poll(() => frame.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(FRAME_WIDTH);

    // DONE 이후: 라이브 뷰 전체가 사라지고 완료 표시
    await finish(jobId);
    await expect(page.getByText('완료 1/1')).toBeVisible(POLL);
    await expect(frame).toBeHidden();
    await expect(page.getByTestId('agent-live-waiting')).toBeHidden();
    await expect(page.getByText('실행 화면', { exact: true })).toBeHidden();
  });

  test('Job 페이지 - 실행 중 TC/step 노드 플로우·상세·확대 표시, DONE 후 사라짐', async ({ page }) => {
    const automation = new AutomationPage(page);
    const jobId = await startRunningJob();
    await putAgentProgress(jobId, buildProgress(testCaseId));
    await putAgentFrame(jobId, FRAME);
    await automation.gotoJob(jobId);

    // TC 헤더
    const tcHeader = page.getByTestId('agent-live-tc');
    await expect(tcHeader).toBeVisible(POLL);
    await expect(tcHeader).toContainText('TC 1/1');
    await expect(tcHeader).toContainText(`T${testCaseId}`);

    // 노드 플로우: 전제조건 + step 3개 상태
    const flow = page.getByTestId('agent-live-flow');
    await expect(flow.getByTestId('agent-live-node-pre')).toBeVisible();
    await expect(flow.getByTestId('agent-live-node-pre')).toHaveAttribute('data-status', 'DONE');
    await expect(flow.getByTestId('agent-live-node-1')).toHaveAttribute('data-status', 'PASS');
    await expect(flow.getByTestId('agent-live-node-2')).toHaveAttribute('data-status', 'FAIL');
    await expect(flow.getByTestId('agent-live-node-3')).toHaveAttribute('data-status', 'JUDGING');

    // 현재 위치 상세 (step 동작 텍스트는 노드 요약에도 있으므로 detail로 스코프)
    const detail = page.getByTestId('agent-live-detail');
    await expect(detail).toContainText('Step 3/3');
    await expect(detail).toContainText('기대 결과 판정 중');
    await expect(detail).toContainText('검색 버튼 클릭');
    await expect(detail).toContainText('결과 목록 표시');

    // v28: 노드 한 줄 요약 + 클릭 시 상세 (확대 오버레이는 같은 testid의 플로우를 하나 더 그리므로 열기 전에 검증)
    const pre = flow.getByTestId('agent-live-node-pre');
    const node2 = flow.getByTestId('agent-live-node-2');
    const follow = detail.getByTestId('agent-live-detail-follow');
    await expect(flow.getByTestId('agent-live-node-1-summary')).toHaveText('검색창 클릭');
    await expect(flow.getByTestId('agent-live-node-pre-summary')).toHaveText('홈 > 검색');
    await expect(follow).toBeHidden();

    // step 2 노드 선택 → 해당 step 상세 (판정 포함)
    await node2.click();
    await expect(node2).toHaveAttribute('aria-pressed', 'true');
    await expect(detail).toContainText('Step 2/3');
    await expect(detail).toContainText('✕ FAIL');
    await expect(detail).toContainText('검색어 입력');
    await expect(detail).toContainText('FAIL: 자동완성 없음');

    // '현재 Step 보기' → 현재 step 추적으로 복귀
    await follow.click();
    await expect(node2).toHaveAttribute('aria-pressed', 'false');
    await expect(detail).toContainText('Step 3/3');
    await expect(detail).toContainText('기대 결과 판정 중');
    await expect(follow).toBeHidden();

    // 전제조건 노드 선택 → 경로 상세, 다시 클릭하면 선택 해제
    await pre.click();
    await expect(pre).toHaveAttribute('aria-pressed', 'true');
    await expect(detail).toContainText('전제조건');
    await expect(detail).toContainText('홈 > 검색');
    await pre.click();
    await expect(pre).toHaveAttribute('aria-pressed', 'false');
    await expect(detail).toContainText('Step 3/3');
    await expect(detail).toContainText('기대 결과 판정 중');

    // 확대: 열기 → 오버레이(다크 플로우 포함) → Esc로 닫기
    await expect(page.getByTestId('agent-live-frame')).toBeVisible();
    await page.getByTestId('agent-live-zoom-open').click();
    const zoom = page.getByTestId('agent-live-zoom');
    await expect(zoom).toBeVisible();
    await expect(zoom.getByTestId('agent-live-flow')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(zoom).toBeHidden();

    // DONE 이후: 플로우·상세도 함께 사라진다
    await finish(jobId);
    await expect(page.getByText('완료 1/1')).toBeVisible(POLL);
    await expect(page.getByTestId('agent-live-flow')).toBeHidden();
    await expect(page.getByTestId('agent-live-detail')).toBeHidden();
    await expect(page.getByTestId('agent-live-tc')).toBeHidden();
  });
});
