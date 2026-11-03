import { render, screen } from '@testing-library/react';
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
import type { Version, ProgressStats } from '@/types/features';

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
  agentExecutionApi: { createBatch: vi.fn() },
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

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/features/companies/1/products/10/versions/100/phases/200']}>
      <Routes>
        <Route
          path="/features/companies/:companyId/products/:productId/versions/:versionId/phases/:phaseId"
          element={<VersionPhaseDetailPage />}
        />
        <Route path="/automation" element={<div>Automation 페이지</div>} />
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

  it('starts a batch run from the modal and navigates to /automation (registry_v31)', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'AI 일괄 실행' }));
    expect(screen.getByText('실행 범위를 선택하세요:')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '실행' }));

    expect(await screen.findByText('Automation 페이지')).toBeInTheDocument();
    expect(agentExecutionApi.createBatch).toHaveBeenCalledTimes(1);
    expect(agentExecutionApi.createBatch).toHaveBeenCalledWith(10, 200, 'PHASE_ALL');
  });
});
