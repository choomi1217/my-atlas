import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AutomationTestCasePage from '../AutomationTestCasePage';
import { agentExecutionApi } from '@/api/features';
import type {
  AgentExecutionJob,
  AgentExecutionResult,
  AgentLiveProgress,
} from '@/types/features';

vi.mock('@/api/features', () => ({
  agentExecutionApi: {
    getContext: vi.fn(),
    getJob: vi.fn(),
    getResult: vi.fn(),
    getProgress: vi.fn(),
    createSelected: vi.fn(),
    createSingle: vi.fn(),
  },
}));

vi.mock('@/components/features/AgentStepScreenshot', () => ({
  default: ({ stepOrder, settled }: { stepOrder: number; settled: boolean }) => (
    <div data-testid={`step-shot-${stepOrder}`} data-settled={String(settled)} />
  ),
}));

const CONFLICT_MESSAGE = '같은 Phase에서 대기·실행 중인 Job(#9)과 TC가 겹칩니다';

const conflictError = Object.assign(new Error('Request failed with status code 409'), {
  isAxiosError: true,
  response: { status: 409, data: { message: CONFLICT_MESSAGE } },
});

const makeJob = (overrides: Partial<AgentExecutionJob> = {}): AgentExecutionJob => ({
  id: 5,
  productId: 10,
  phaseId: 200,
  scope: 'PHASE_ALL',
  status: 'DONE',
  totalCount: 1,
  doneCount: 1,
  passCount: 1,
  failCount: 0,
  inconclusiveCount: 0,
  createdAt: '2026-11-01T09:00:00',
  ...overrides,
});

const makeResult = (stepLogs: AgentExecutionResult['stepLogs']): AgentExecutionResult => ({
  id: 1,
  jobId: 5,
  testCaseId: 3,
  verdict: 'PASS',
  stepLogs,
  createdAt: '2026-11-01T09:00:00',
});

const makeProgress = (overrides: Partial<AgentLiveProgress> = {}): AgentLiveProgress => ({
  testCaseId: 3,
  testCaseTitle: '진행 제목',
  tcIndex: 1,
  tcTotal: 1,
  phase: 'ACTING',
  precondition: null,
  currentStep: 2,
  steps: [
    { order: 1, action: '로그인 터치', expected: '홈 이동', status: 'PASS', judgment: '이동 확인' },
    { order: 2, action: '검색 입력', expected: '결과 표시', status: 'ACTING', judgment: null },
  ],
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/automation/jobs/5/tc/3']}>
      <Routes>
        <Route path="/automation/jobs/:jobId/tc/:tcId" element={<AutomationTestCasePage />} />
        <Route path="/automation/jobs/77" element={<div>새 Job 페이지</div>} />
      </Routes>
    </MemoryRouter>
  );

const stepCard = async (order: number) => {
  const label = await screen.findByText(`#${order}`);
  return label.closest('[data-testid="automation-step-card"]') as HTMLElement;
};

describe('AutomationTestCasePage', () => {
  beforeEach(() => {
    vi.mocked(agentExecutionApi.getContext).mockResolvedValue({
      jobId: 5,
      scope: 'PHASE_ALL',
      execTargetKind: 'WEB',
      baseUrl: null,
      seedNote: null,
      testCases: [
        {
          id: 3,
          title: '로그인',
          preconditions: null,
          steps: [
            { order: 1, action: '로그인 터치', expected: '홈 이동' },
            { order: 2, action: '검색 입력', expected: '결과 표시' },
          ],
          expectedResults: null,
          segmentPath: null,
        },
      ],
    });
    vi.mocked(agentExecutionApi.getJob).mockResolvedValue(makeJob());
    // 결과는 TC가 끝나기 전까지 404
    vi.mocked(agentExecutionApi.getResult).mockRejectedValue(new Error('404'));
    vi.mocked(agentExecutionApi.getProgress).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('merges context steps with stepLogs from the result', async () => {
    vi.mocked(agentExecutionApi.getResult).mockResolvedValue(
      makeResult([
        {
          order: 1,
          actionTaken: 'click("로그인")',
          observed: 'app://Home',
          judgment: 'PASS: 이동 확인',
        },
      ])
    );

    renderPage();

    const first = await stepCard(1);
    expect(await within(first).findByText('로그인 터치')).toBeInTheDocument();
    expect(within(first).getByText('기대 결과: 홈 이동')).toBeInTheDocument();
    expect(within(first).getByText('실제 동작: click("로그인")')).toBeInTheDocument();
    expect(within(first).getByText('판정: PASS: 이동 확인')).toBeInTheDocument();
    expect(within(first).getByText('PASS')).toBeInTheDocument();
    expect(screen.getByTestId('step-shot-1')).toHaveAttribute('data-settled', 'true');

    const second = await stepCard(2);
    expect(within(second).getByText('검색 입력')).toBeInTheDocument();
    expect(within(second).queryByText(/^판정:/)).not.toBeInTheDocument();
    expect(screen.getByTestId('step-shot-2')).toHaveAttribute('data-settled', 'false');
  });

  it('adds a card for a stepLog that is not in the context', async () => {
    vi.mocked(agentExecutionApi.getResult).mockResolvedValue(
      makeResult([
        {
          order: 9,
          actionTaken: '',
          observed: '',
          judgment: 'INCONCLUSIVE: 전제조건 미도달',
        },
      ])
    );

    renderPage();

    const card = await stepCard(9);
    expect(within(card).getByText('판정: INCONCLUSIVE: 전제조건 미도달')).toBeInTheDocument();
  });

  it('merges context steps with progress while the TC is running', async () => {
    vi.mocked(agentExecutionApi.getJob).mockResolvedValue(makeJob({ status: 'RUNNING' }));
    vi.mocked(agentExecutionApi.getProgress).mockResolvedValue(makeProgress());

    renderPage();

    const first = await stepCard(1);
    expect(within(first).getByText('PASS')).toBeInTheDocument();
    expect(within(first).getByText('판정: 이동 확인')).toBeInTheDocument();
    expect(screen.getByTestId('step-shot-1')).toHaveAttribute('data-settled', 'true');

    const second = await stepCard(2);
    expect(within(second).getByText('실행 중')).toBeInTheDocument();
    expect(screen.getByTestId('step-shot-2')).toHaveAttribute('data-settled', 'false');
  });

  it('falls back to progress for the title and steps when the context is unavailable', async () => {
    vi.mocked(agentExecutionApi.getContext).mockRejectedValue(new Error('404'));
    vi.mocked(agentExecutionApi.getJob).mockResolvedValue(makeJob({ status: 'RUNNING' }));
    vi.mocked(agentExecutionApi.getProgress).mockResolvedValue(makeProgress());

    renderPage();

    expect(within(await stepCard(1)).getByText('로그인 터치')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('진행 제목');
  });

  it('ignores progress that belongs to another TC', async () => {
    vi.mocked(agentExecutionApi.getJob).mockResolvedValue(makeJob({ status: 'RUNNING' }));
    vi.mocked(agentExecutionApi.getProgress).mockResolvedValue(makeProgress({ testCaseId: 999 }));

    renderPage();

    await screen.findByTestId('automation-rerun');
    const first = await stepCard(1);
    expect(within(first).queryByText('PASS')).not.toBeInTheDocument();
    expect(within(first).queryByText('판정: 이동 확인')).not.toBeInTheDocument();
  });

  it('disables 재실행 while the job is active', async () => {
    vi.mocked(agentExecutionApi.getJob).mockResolvedValue(makeJob({ status: 'RUNNING' }));

    renderPage();

    expect(await screen.findByTestId('automation-rerun')).toBeDisabled();
  });

  it('re-runs as PHASE_SELECTED when the job has a phase and opens the new job', async () => {
    const user = userEvent.setup();
    vi.mocked(agentExecutionApi.createSelected).mockResolvedValue(77);
    renderPage();

    await user.click(await screen.findByTestId('automation-rerun'));

    expect(await screen.findByText('새 Job 페이지')).toBeInTheDocument();
    expect(agentExecutionApi.createSelected).toHaveBeenCalledWith(10, 200, [3]);
    expect(agentExecutionApi.createSingle).not.toHaveBeenCalled();
  });

  it('re-runs as SINGLE when the job has no phase and opens the new job', async () => {
    const user = userEvent.setup();
    vi.mocked(agentExecutionApi.getJob).mockResolvedValue(
      makeJob({ scope: 'SINGLE', phaseId: null })
    );
    vi.mocked(agentExecutionApi.createSingle).mockResolvedValue(77);
    renderPage();

    await user.click(await screen.findByTestId('automation-rerun'));

    expect(await screen.findByText('새 Job 페이지')).toBeInTheDocument();
    expect(agentExecutionApi.createSingle).toHaveBeenCalledWith(10, 3);
    expect(agentExecutionApi.createSelected).not.toHaveBeenCalled();
  });

  it('shows the 409 message and stays on the page', async () => {
    const user = userEvent.setup();
    vi.mocked(agentExecutionApi.createSelected).mockRejectedValue(conflictError);
    renderPage();

    await user.click(await screen.findByTestId('automation-rerun'));

    expect(await screen.findByTestId('automation-rerun-error')).toHaveTextContent(CONFLICT_MESSAGE);
    expect(screen.getByTestId('automation-rerun')).toBeEnabled();
    expect(screen.queryByText('새 Job 페이지')).not.toBeInTheDocument();
  });
});
