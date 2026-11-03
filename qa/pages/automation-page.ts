import { Page, Locator } from '@playwright/test';

/**
 * Test Automation 드릴다운 3단 (/automation → /automation/jobs/:id → /automation/jobs/:id/tc/:tcId).
 * 셀렉터 출처: pages/automation/*.tsx, components/features/AgentStopButton.tsx, AgentStepScreenshot.tsx
 */
export class AutomationPage {
  readonly page: Page;
  readonly workerStatus: Locator;
  readonly stopButton: Locator;
  readonly stopConfirm: Locator;
  readonly stepCards: Locator;
  readonly screenshotZoom: Locator;
  readonly rerunButton: Locator;
  readonly rerunError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.workerStatus = page.getByTestId('automation-worker-status');
    this.stopButton = page.getByTestId('automation-stop');
    this.stopConfirm = page.getByTestId('automation-stop-confirm');
    this.stepCards = page.getByTestId('automation-step-card');
    this.screenshotZoom = page.getByTestId('automation-step-screenshot-zoom');
    this.rerunButton = page.getByTestId('automation-rerun');
    this.rerunError = page.getByTestId('automation-rerun-error');
  }

  async goto() {
    await this.page.goto('/automation');
  }

  async gotoJob(jobId: number) {
    await this.page.goto(`/automation/jobs/${jobId}`);
  }

  async gotoTestCase(jobId: number, testCaseId: number) {
    await this.page.goto(`/automation/jobs/${jobId}/tc/${testCaseId}`);
  }

  /** 대기·실행 중 행 (div). Job 링크와 중지 버튼이 형제라 중지해도 이동하지 않는다 */
  queueRow(jobId: number): Locator {
    return this.page
      .getByTestId('automation-queue-row')
      .filter({ has: this.page.locator(`a[href="/automation/jobs/${jobId}"]`) });
  }

  /** 완료 행 — 행 전체가 <a> */
  doneRow(jobId: number): Locator {
    return this.page.locator(
      `a[data-testid="automation-done-row"][href="/automation/jobs/${jobId}"]`,
    );
  }

  /** Job 페이지의 TC 행 — <a> */
  tcRow(jobId: number, testCaseId: number): Locator {
    return this.page.locator(
      `a[data-testid="automation-job-tc-row"][href="/automation/jobs/${jobId}/tc/${testCaseId}"]`,
    );
  }

  /** Job 페이지 헤더의 상태 배지 (h1 바로 옆 span) */
  jobStatus(jobId: number): Locator {
    return this.page
      .getByRole('heading', { name: `Job #${jobId}`, exact: true })
      .locator('xpath=following-sibling::span');
  }
}
