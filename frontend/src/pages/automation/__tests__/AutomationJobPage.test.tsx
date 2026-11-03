import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AutomationJobPage from '../AutomationJobPage';
import { agentExecutionApi } from '@/api/features';
import type {
  AgentContextTestCase,
  AgentExecutionJob,
  AgentExecutionResult,
  AgentLiveProgress,
  AgentVerdict,
} from '@/types/features';

vi.mock('@/api/features', () => ({
  agentExecutionApi: {
    getContext: vi.fn(),
    getJob: vi.fn(),
    listResults: vi.fn(),
    getProgress: vi.fn(),
    getFrame: vi.fn(),
    cancel: vi.fn(),
  },
}));

const makeJob = (overrides: Partial<AgentExecutionJob> = {}): AgentExecutionJob => ({
  id: 5,
  productId: 10,
  phaseId: 200,
  scope: 'PHASE_ALL',
  status: 'RUNNING',
  totalCount: 4,
  doneCount: 2,
  passCount: 1,
  failCount: 0,
  inconclusiveCount: 1,
  createdAt: '2026-11-01T09:00:00',
  ...overrides,
});

const makeTc = (id: number): AgentContextTestCase => ({
  id,
  title: `제목 ${id}`,
  preconditions: null,
  steps: [],
  expectedResults: null,
  segmentPath: null,
});

const makeResult = (testCaseId: number, verdict: AgentVerdict): AgentExecutionResult => ({
  id: testCaseId,
  jobId: 5,
  testCaseId,
  verdict,
  createdAt: '2026-11-01T09:00:00',
});

const progressOn = (testCaseId: number): AgentLiveProgress => ({
  testCaseId,
  testCaseTitle: `제목 ${testCaseId}`,
  tcIndex: 1,
  tcTotal: 4,
  phase: 'ACTING',
  precondition: null,
  currentStep: 1,
  steps: [{ order: 1, action: '터치', expected: '이동', status: 'ACTING', judgment: null }],
});

const mockContext = (ids: number[]) => {
  vi.mocked(agentExecutionApi.getContext).mockResolvedValue({
    jobId: 5,
    scope: 'PHASE_ALL',
    execTargetKind: 'WEB',
    baseUrl: null,
    seedNote: null,
    testCases: ids.map(makeTc),
  });
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/automation/jobs/5']}>
      <Routes>
        <Route path="/automation/jobs/:jobId" element={<AutomationJobPage />} />
      </Routes>
    </MemoryRouter>
  );

const tcRow = (id: number) => screen.findByRole('link', { name: new RegExp(`T${id}`) });

describe('AutomationJobPage', () => {
  beforeEach(() => {
    mockContext([1]);
    vi.mocked(agentExecutionApi.getJob).mockResolvedValue(makeJob());
    vi.mocked(agentExecutionApi.listResults).mockResolvedValue([]);
    vi.mocked(agentExecutionApi.getProgress).mockResolvedValue(null);
    vi.mocked(agentExecutionApi.getFrame).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the verdict, running and waiting state per TC while active', async () => {
    mockContext([1, 2, 3, 4]);
    vi.mocked(agentExecutionApi.listResults).mockResolvedValue([
      makeResult(1, 'PASS'),
      makeResult(2, 'INCONCLUSIVE'),
    ]);
    vi.mocked(agentExecutionApi.getProgress).mockResolvedValue(progressOn(3));

    renderPage();

    const passRow = await tcRow(1);
    expect(passRow).toHaveAttribute('href', '/automation/jobs/5/tc/1');
    expect(within(passRow).getByText('제목 1')).toBeInTheDocument();
    expect(within(passRow).getByText('PASS')).toBeInTheDocument();
    expect(within(await tcRow(2)).getByText('판정불가')).toBeInTheDocument();
    expect(within(await tcRow(3)).getByText('실행 중')).toBeInTheDocument();
    expect(within(await tcRow(4)).getByText('대기')).toBeInTheDocument();
  });

  it('shows 미실행 for a TC with no result once the job has ended', async () => {
    vi.mocked(agentExecutionApi.getJob).mockResolvedValue(makeJob({ status: 'CANCELLED' }));

    renderPage();

    expect(within(await tcRow(1)).getByText('미실행')).toBeInTheDocument();
  });

  it('still lists a result that is missing from the context', async () => {
    mockContext([1]);
    vi.mocked(agentExecutionApi.listResults).mockResolvedValue([makeResult(99, 'FAIL')]);

    renderPage();

    expect(within(await tcRow(99)).getByText('FAIL')).toBeInTheDocument();
    expect(await tcRow(1)).toBeInTheDocument();
  });

  it('builds rows from results when the context cannot be loaded', async () => {
    vi.mocked(agentExecutionApi.getContext).mockRejectedValue(new Error('404'));
    vi.mocked(agentExecutionApi.listResults).mockResolvedValue([makeResult(2, 'PASS')]);

    renderPage();

    expect(within(await tcRow(2)).getByText('PASS')).toBeInTheDocument();
  });

  it('shows the live view and stop button while active', async () => {
    renderPage();

    expect(await screen.findByTestId('agent-live-waiting')).toBeInTheDocument();
    expect(screen.getByTestId('automation-stop')).toBeInTheDocument();
  });

  it('hides the live view and stop button when terminal', async () => {
    vi.mocked(agentExecutionApi.getJob).mockResolvedValue(makeJob({ status: 'DONE' }));

    renderPage();

    await screen.findByRole('heading', { name: 'Job #5' });
    expect(screen.queryByTestId('agent-live-waiting')).not.toBeInTheDocument();
    expect(screen.queryByTestId('automation-stop')).not.toBeInTheDocument();
    expect(agentExecutionApi.getFrame).not.toHaveBeenCalled();
  });

  it('switches to the terminal view right after stopping', async () => {
    const user = userEvent.setup();
    vi.mocked(agentExecutionApi.cancel).mockResolvedValue(makeJob({ status: 'CANCELLED' }));
    renderPage();

    await user.click(await screen.findByTestId('automation-stop'));
    await user.click(screen.getByTestId('automation-stop-confirm'));

    expect(agentExecutionApi.cancel).toHaveBeenCalledWith(5);
    await waitFor(() =>
      expect(screen.queryByTestId('automation-stop-confirm')).not.toBeInTheDocument()
    );
    expect(screen.queryByTestId('automation-stop')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-live-waiting')).not.toBeInTheDocument();
  });

  it('shows the error when the job cannot be loaded', async () => {
    vi.mocked(agentExecutionApi.getJob).mockRejectedValue(new Error('Job 없음'));

    renderPage();

    expect(await screen.findByText('Job 없음')).toBeInTheDocument();
  });
});
