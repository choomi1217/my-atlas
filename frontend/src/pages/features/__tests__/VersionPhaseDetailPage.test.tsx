import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VersionPhaseDetailPage from '../VersionPhaseDetailPage';
import {
  versionApi,
  testResultApi,
  testCaseApi,
  segmentApi,
  agentExecutionApi,
} from '@/api/features';
import type {
  Version,
  ProgressStats,
  AgentExecutionJob,
  AgentExecutionResult,
} from '@/types/features';

vi.mock('@/api/features', () => ({
  versionApi: { getById: vi.fn() },
  testResultApi: { getByVersionPhaseId: vi.fn(), updateResult: vi.fn() },
  testCaseApi: { getByProductId: vi.fn() },
  segmentApi: { getByProductId: vi.fn() },
  testResultCommentApi: { getComments: vi.fn() },
  ticketApi: {
    getByResultId: vi.fn(),
    create: vi.fn(),
    refresh: vi.fn(),
    refreshAllByPhase: vi.fn(),
  },
  featureImageApi: {},
  agentExecutionApi: {
    createBatch: vi.fn(),
    getJob: vi.fn(),
    listResults: vi.fn(),
    getFrame: vi.fn(),
  },
}));

const emptyStats: ProgressStats = {
  total: 0,
  completed: 0,
  pass: 0,
  fail: 0,
  blocked: 0,
  skipped: 0,
  retest: 0,
  untested: 0,
};

const makeVersion = (name: string): Version => ({
  id: 100,
  productId: 10,
  name,
  phases: [
    {
      id: 200,
      phaseName: 'Phase 1',
      testRuns: [],
      totalTestCaseCount: 1,
      orderIndex: 0,
      phaseProgress: emptyStats,
    },
  ],
  totalProgress: emptyStats,
  isReleaseDatePassed: false,
  createdAt: '2026-10-01T00:00:00',
  updatedAt: '2026-10-01T00:00:00',
});

const doneJob: AgentExecutionJob = {
  id: 77,
  productId: 10,
  phaseId: 200,
  scope: 'PHASE_ALL',
  status: 'DONE',
  totalCount: 1,
  doneCount: 1,
  passCount: 1,
  failCount: 0,
  inconclusiveCount: 0,
  createdAt: '2026-10-01T00:00:00',
};

const passResult: AgentExecutionResult = {
  id: 1,
  jobId: 77,
  testCaseId: 501,
  verdict: 'PASS',
  createdAt: '2026-10-01T00:00:00',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/features/companies/1/products/10/versions/100/phases/200']}>
      <Routes>
        <Route
          path="/features/companies/:companyId/products/:productId/versions/:versionId/phases/:phaseId"
          element={<VersionPhaseDetailPage />}
        />
      </Routes>
    </MemoryRouter>
  );

describe('VersionPhaseDetailPage', () => {
  beforeEach(() => {
    vi.mocked(versionApi.getById).mockResolvedValue(makeVersion('v1.0'));
    vi.mocked(testResultApi.getByVersionPhaseId).mockResolvedValue([]);
    vi.mocked(testCaseApi.getByProductId).mockResolvedValue([]);
    vi.mocked(segmentApi.getByProductId).mockResolvedValue([]);
    vi.mocked(agentExecutionApi.createBatch).mockResolvedValue(77);
    vi.mocked(agentExecutionApi.getJob).mockResolvedValue(doneJob);
    vi.mocked(agentExecutionApi.listResults).mockResolvedValue([passResult]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows Loading... on initial load, then renders the page', async () => {
    renderPage();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'AI 일괄 실행' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('keeps BatchAgentRunModal results after job DONE triggers a silent reload (registry_v25)', async () => {
    // Second getById (the reload after DONE) returns a renamed version so we can observe it landed.
    vi.mocked(versionApi.getById)
      .mockResolvedValueOnce(makeVersion('v1.0'))
      .mockResolvedValueOnce(makeVersion('v1.0-reloaded'));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'AI 일괄 실행' }));
    expect(screen.getByText('실행 범위를 선택하세요:')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '실행' }));

    expect(agentExecutionApi.createBatch).toHaveBeenCalledWith(10, 200, 'PHASE_ALL');

    // Poll fires after 2000ms -> DONE -> onDone -> loadData(true)
    await waitFor(() => expect(versionApi.getById).toHaveBeenCalledTimes(2), {
      timeout: 5000,
    });
    // Reload resolved and page re-rendered with new data
    expect(
      await screen.findByRole('heading', { level: 1, name: /v1\.0-reloaded/ })
    ).toBeInTheDocument();

    // Modal survived the reload and still shows its result view
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    const modal = screen
      .getByRole('heading', { level: 3, name: 'AI 일괄 실행' })
      .closest('.fixed') as HTMLElement;
    expect(modal).not.toBeNull();
    expect(within(modal).getByText('완료 1/1')).toBeInTheDocument();
    expect(within(modal).getByText('PASS')).toBeInTheDocument();
    expect(within(modal).getByText('T501')).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: '닫기' })).toBeInTheDocument();
    expect(screen.queryByText('실행 범위를 선택하세요:')).not.toBeInTheDocument();
    expect(agentExecutionApi.createBatch).toHaveBeenCalledTimes(1);
  }, 10000);
});
