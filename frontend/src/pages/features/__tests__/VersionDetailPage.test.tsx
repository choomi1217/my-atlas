import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VersionDetailPage from '../VersionDetailPage';
import {
  versionApi,
  testRunApi,
  productApi,
  testCaseApi,
  segmentApi,
  statisticsApi,
} from '@/api/features';
import type { Dashboard, ProgressStats, Version, VersionPhase } from '@/types/features';

vi.mock('@/api/features', () => ({
  versionApi: { getById: vi.fn(), getFailedTestCases: vi.fn() },
  testRunApi: { getByProductId: vi.fn() },
  versionPhaseApi: {},
  productApi: { getByCompanyId: vi.fn() },
  testCaseApi: { getByProductId: vi.fn() },
  segmentApi: { getByProductId: vi.fn() },
  statisticsApi: { getDashboard: vi.fn() },
}));

// Chart stub exposes which phase the chart is showing
vi.mock('@/components/features/statistics/TrendChartSection', () => ({
  TrendChartSection: ({ selectedPhaseId }: { selectedPhaseId: number | null }) => (
    <div data-testid="trend-chart-stub">{String(selectedPhaseId)}</div>
  ),
}));
vi.mock('@/components/features/statistics/ReleaseReadinessCard', () => ({ ReleaseReadinessCard: () => null }));
vi.mock('@/components/features/statistics/AgingBugList', () => ({ AgingBugList: () => null }));
vi.mock('@/components/features/statistics/BlockedTcList', () => ({ BlockedTcList: () => null }));
vi.mock('@/components/features/statistics/DailyReportModal', () => ({ DailyReportModal: () => null }));
vi.mock('@/components/features/ProgressStats', () => ({ default: () => null }));
vi.mock('@/components/features/VersionCopyModal', () => ({ default: () => null }));

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

const makePhase = (id: number, phaseName: string, orderIndex: number): VersionPhase => ({
  id,
  phaseName,
  testRuns: [],
  totalTestCaseCount: 0,
  orderIndex,
  phaseProgress: emptyStats,
});

const version: Version = {
  id: 100,
  productId: 10,
  name: 'v1.0',
  phases: [makePhase(201, 'Phase A', 0), makePhase(202, 'Phase B', 1)],
  totalProgress: emptyStats,
  isReleaseDatePassed: false,
  createdAt: '2026-11-01T00:00:00',
  updatedAt: '2026-11-01T00:00:00',
};

const dashboard: Dashboard = {
  releaseReadiness: {
    ready: true,
    verdict: 'GO',
    criteria: [],
    progress: {
      totalTc: 0,
      completed: 0,
      pass: 0,
      fail: 0,
      openFail: 0,
      blocked: 0,
      overallPassRate: 0,
      overallProgressRate: 0,
    },
  },
  phaseTrends: [],
  agingBugs: [],
  blockedTcs: [],
  failedTcs: [],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/features/companies/1/products/10/versions/100']}>
      <Routes>
        <Route
          path="/features/companies/:companyId/products/:productId/versions/:versionId"
          element={<VersionDetailPage />}
        />
        <Route
          path="/features/companies/:companyId/products/:productId/versions/:versionId/phases/:phaseId"
          element={<div data-testid="phase-page" />}
        />
      </Routes>
    </MemoryRouter>
  );

const SELECTED = 'bg-indigo-100';

describe('VersionDetailPage', () => {
  beforeEach(() => {
    vi.mocked(productApi.getByCompanyId).mockResolvedValue([]);
    vi.mocked(versionApi.getById).mockResolvedValue(version);
    vi.mocked(versionApi.getFailedTestCases).mockResolvedValue([]);
    vi.mocked(testRunApi.getByProductId).mockResolvedValue([]);
    vi.mocked(testCaseApi.getByProductId).mockResolvedValue([]);
    vi.mocked(segmentApi.getByProductId).mockResolvedValue([]);
    vi.mocked(statisticsApi.getDashboard).mockResolvedValue(dashboard);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('highlights the first phase tab and charts it by default', async () => {
    renderPage();

    const tabA = await screen.findByRole('button', { name: 'Phase A' });
    expect(tabA).toHaveClass(SELECTED);
    expect(screen.getByRole('button', { name: 'Phase B' })).not.toHaveClass(SELECTED);
    expect(screen.getByTestId('trend-chart-stub')).toHaveTextContent('201');
  });

  it('moves the highlight and chart to the clicked phase tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Phase B' }));

    expect(screen.getByRole('button', { name: 'Phase B' })).toHaveClass(SELECTED);
    expect(screen.getByRole('button', { name: 'Phase A' })).not.toHaveClass(SELECTED);
    expect(screen.getByTestId('trend-chart-stub')).toHaveTextContent('202');
  });

  it('keeps the tab selected when clicked again (no toggle-off)', async () => {
    const user = userEvent.setup();
    renderPage();

    const tabB = await screen.findByRole('button', { name: 'Phase B' });
    await user.click(tabB);
    await user.click(tabB);

    expect(tabB).toHaveClass(SELECTED);
    expect(screen.getByTestId('trend-chart-stub')).toHaveTextContent('202');
  });

  it('shows Failed TCs and opens the failed phase on row click', async () => {
    const user = userEvent.setup();
    vi.mocked(statisticsApi.getDashboard).mockResolvedValue({
      ...dashboard,
      failedTcs: [
        {
          testResultId: 9,
          testCaseId: 42,
          testCaseTitle: '로그인 실패',
          testCasePath: [],
          phaseId: 202,
          phaseName: 'Phase B',
          priority: null,
          comment: '[AI FAIL] 버튼 없음',
        },
      ],
    });
    renderPage();

    await user.click(await screen.findByTestId('failed-tc-row'));

    expect(await screen.findByTestId('phase-page')).toBeInTheDocument();
  });
});
