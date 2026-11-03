import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AutomationPage from '../AutomationPage';
import { agentExecutionApi } from '@/api/features';
import type {
  AgentExecutionJob,
  AgentJobListItem,
  AgentWorkerStatus,
} from '@/types/features';

vi.mock('@/api/features', () => ({
  agentExecutionApi: {
    listQueue: vi.fn(),
    listWorkers: vi.fn(),
    cancel: vi.fn(),
  },
}));

const NO_WORKER = '연결된 워커 없음';
const WORKER_LOST = '워커 응답 없음';

const makeJob = (overrides: Partial<AgentExecutionJob> = {}): AgentExecutionJob => ({
  id: 1,
  productId: 10,
  phaseId: 200,
  scope: 'PHASE_ALL',
  status: 'PENDING',
  execTargetKind: 'WEB',
  totalCount: 4,
  doneCount: 1,
  passCount: 1,
  failCount: 0,
  inconclusiveCount: 0,
  createdAt: '2026-11-01T09:00:00',
  ...overrides,
});

const makeItem = (
  job: Partial<AgentExecutionJob> = {},
  overrides: Partial<AgentJobListItem> = {}
): AgentJobListItem => ({
  job: makeJob(job),
  productName: '패스오더',
  companyId: 1,
  phaseName: '1차',
  versionId: 5,
  versionName: 'v1.0',
  testCaseTitle: null,
  ...overrides,
});

const makeWorker = (overrides: Partial<AgentWorkerStatus> = {}): AgentWorkerStatus => ({
  workerId: 'host:web',
  targetKind: 'WEB',
  productId: 10,
  deviceName: null,
  currentJobId: null,
  lastSeenAt: '2026-11-01T09:00:00',
  ...overrides,
});

const mockQueue = (
  active: AgentJobListItem[],
  done: AgentJobListItem[] = [],
  doneTotalPages = 1
) => {
  vi.mocked(agentExecutionApi.listQueue).mockImplementation(async ({ status, page }) =>
    status.includes('PENDING')
      ? { items: active, totalElements: active.length, page: 0, totalPages: 1 }
      : { items: done, totalElements: done.length, page, totalPages: doneTotalPages }
  );
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/automation']}>
      <Routes>
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="/automation/jobs/:jobId" element={<div>Job 상세</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('AutomationPage', () => {
  beforeEach(() => {
    mockQueue([]);
    vi.mocked(agentExecutionApi.listWorkers).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders queue and done rows and connected workers', async () => {
    mockQueue(
      [makeItem({ id: 1, status: 'RUNNING', workerId: 'host:web' })],
      [makeItem({ id: 2, status: 'DONE', doneCount: 4, passCount: 3, failCount: 1 })]
    );
    vi.mocked(agentExecutionApi.listWorkers).mockResolvedValue([makeWorker()]);

    renderPage();

    const queueRow = await screen.findByTestId('automation-queue-row');
    expect(within(queueRow).getByText('패스오더 > v1.0 > 1차')).toBeInTheDocument();
    expect(within(queueRow).getByText('실행 중')).toBeInTheDocument();
    expect(within(queueRow).getByText('1/4')).toBeInTheDocument();
    expect(within(queueRow).getByRole('link')).toHaveAttribute('href', '/automation/jobs/1');

    const doneRow = screen.getByTestId('automation-done-row');
    expect(doneRow).toHaveAttribute('href', '/automation/jobs/2');
    expect(within(doneRow).getByText('완료')).toBeInTheDocument();
    expect(within(doneRow).getByText('PASS 3')).toBeInTheDocument();
    expect(within(doneRow).getByText('FAIL 1')).toBeInTheDocument();

    expect(screen.getByTestId('automation-worker-status')).toHaveTextContent('host:web (WEB)');
  });

  it('requests active jobs oldest first and finished jobs newest first', async () => {
    renderPage();

    await screen.findByText('대기·실행 중인 작업이 없습니다.');
    expect(agentExecutionApi.listQueue).toHaveBeenCalledWith({
      status: ['PENDING', 'RUNNING'],
      page: 0,
      size: 100,
      direction: 'ASC',
    });
    expect(agentExecutionApi.listQueue).toHaveBeenCalledWith({
      status: ['DONE', 'FAILED', 'CANCELLED'],
      page: 0,
      size: 20,
      direction: 'DESC',
    });
  });

  it('shows the TC title for a SINGLE job', async () => {
    mockQueue([
      makeItem(
        { scope: 'SINGLE', phaseId: null, targetTestCaseId: 7 },
        { phaseName: null, versionId: null, versionName: null, testCaseTitle: '로그인' }
      ),
    ]);

    renderPage();

    const row = await screen.findByTestId('automation-queue-row');
    expect(within(row).getByText('로그인')).toBeInTheDocument();
  });

  it('warns on a PENDING job when no worker matches its target kind', async () => {
    mockQueue([makeItem({ status: 'PENDING', execTargetKind: 'ANDROID' })]);
    vi.mocked(agentExecutionApi.listWorkers).mockResolvedValue([makeWorker({ targetKind: 'WEB' })]);

    renderPage();

    const row = await screen.findByTestId('automation-queue-row');
    expect(within(row).getByText(NO_WORKER)).toBeInTheDocument();
  });

  it('warns on a PENDING job when the only worker serves another product', async () => {
    mockQueue([makeItem({ status: 'PENDING', productId: 10 })]);
    vi.mocked(agentExecutionApi.listWorkers).mockResolvedValue([makeWorker({ productId: 11 })]);

    renderPage();

    const row = await screen.findByTestId('automation-queue-row');
    expect(within(row).getByText(NO_WORKER)).toBeInTheDocument();
  });

  it('does not warn when a worker with productId null matches', async () => {
    mockQueue([makeItem({ status: 'PENDING', productId: 10 })]);
    vi.mocked(agentExecutionApi.listWorkers).mockResolvedValue([makeWorker({ productId: null })]);

    renderPage();

    const row = await screen.findByTestId('automation-queue-row');
    expect(within(row).queryByText(NO_WORKER)).not.toBeInTheDocument();
  });

  it('warns on a RUNNING job whose worker is not active', async () => {
    mockQueue([makeItem({ status: 'RUNNING', workerId: 'gone' })]);
    vi.mocked(agentExecutionApi.listWorkers).mockResolvedValue([makeWorker({ workerId: 'other' })]);

    renderPage();

    const row = await screen.findByTestId('automation-queue-row');
    expect(within(row).getByText(WORKER_LOST)).toBeInTheDocument();
  });

  it('does not warn on a RUNNING job with no workerId', async () => {
    mockQueue([makeItem({ status: 'RUNNING', workerId: null })]);

    renderPage();

    const row = await screen.findByTestId('automation-queue-row');
    expect(within(row).queryByText(WORKER_LOST)).not.toBeInTheDocument();
    expect(within(row).queryByText(NO_WORKER)).not.toBeInTheDocument();
  });

  it('stops a job in two steps without navigating to its detail page', async () => {
    const user = userEvent.setup();
    mockQueue([makeItem({ id: 1, status: 'RUNNING' })]);
    vi.mocked(agentExecutionApi.cancel).mockResolvedValue(makeJob({ id: 1, status: 'CANCELLED' }));
    renderPage();

    await user.click(await screen.findByTestId('automation-stop'));
    expect(screen.getByText('중지할까요?')).toBeInTheDocument();
    expect(agentExecutionApi.cancel).not.toHaveBeenCalled();

    const callsBefore = vi.mocked(agentExecutionApi.listQueue).mock.calls.length;
    await user.click(screen.getByTestId('automation-stop-confirm'));

    expect(agentExecutionApi.cancel).toHaveBeenCalledWith(1);
    await waitFor(() =>
      expect(vi.mocked(agentExecutionApi.listQueue).mock.calls.length).toBeGreaterThan(callsBefore)
    );
    expect(screen.queryByText('Job 상세')).not.toBeInTheDocument();
  });

  it('pages through finished jobs', async () => {
    const user = userEvent.setup();
    mockQueue([], [makeItem({ id: 2, status: 'DONE' })], 3);
    renderPage();

    expect(await screen.findByRole('button', { name: '이전' })).toBeDisabled();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전' })).toBeEnabled();
    await waitFor(() =>
      expect(agentExecutionApi.listQueue).toHaveBeenCalledWith(
        expect.objectContaining({ status: ['DONE', 'FAILED', 'CANCELLED'], page: 1 })
      )
    );

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('hides the pager when there is only one page', async () => {
    mockQueue([], [makeItem({ id: 2, status: 'DONE' })], 1);

    renderPage();

    await screen.findByTestId('automation-done-row');
    expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument();
  });

  it('shows the error when the queue fails to load', async () => {
    vi.mocked(agentExecutionApi.listQueue).mockRejectedValue(new Error('네트워크 오류'));

    renderPage();

    expect(await screen.findByText('네트워크 오류')).toBeInTheDocument();
  });
});
