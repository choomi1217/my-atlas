import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { TrendChartSection } from '../TrendChartSection';
import type { DailyReport, TrendData } from '@/types/features';

// jsdom has no layout, so real charts render nothing. Swap the chart containers for
// stubs that expose the x-axis data and forward clicks like Recharts does (activeLabel).
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  const ChartStub = ({
    data,
    onClick,
  }: {
    data: { date: string }[];
    onClick?: (e: { activeLabel?: string }) => void;
  }) => (
    <ul data-testid="x-axis">
      {data.map((d) => (
        <li key={d.date}>
          <button type="button" onClick={() => onClick?.({ activeLabel: d.date })}>
            {d.date}
          </button>
        </li>
      ))}
    </ul>
  );
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    LineChart: ChartStub,
    BarChart: ChartStub,
  };
});

const report = (snapshotDate: string): DailyReport => ({
  phaseId: 1,
  phaseName: 'Phase 1',
  snapshotDate,
  totalTc: 5,
  passCount: 2,
  failCount: 1,
  blockedCount: 0,
  skippedCount: 0,
  retestCount: 1,
  untestedCount: 1,
  newBugCritical: 0,
  newBugMajor: 0,
  newBugMinor: 0,
  newBugTrivial: 0,
  closedBugCount: 0,
  openBugCount: 0,
  agingBugCount: 0,
  passRate: 50,
  progressRate: 80,
});

const trend = (dailyReports: DailyReport[]): TrendData => ({
  phaseId: 1,
  phaseName: 'Phase 1',
  from: '2026-11-03',
  to: '2026-11-07',
  dailyReports,
});

const EMPTY_MESSAGE = '선택한 Phase에 스냅샷 데이터가 없습니다.';

describe('TrendChartSection', () => {
  it('shows the empty message when the phase has no daily reports', () => {
    render(<TrendChartSection phaseTrends={[trend([])]} selectedPhaseId={1} onDateClick={vi.fn()} />);

    expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByTestId('x-axis')).not.toBeInTheDocument();
  });

  it('renders the chart when reports exist', () => {
    render(
      <TrendChartSection
        phaseTrends={[trend([report('2026-11-04')])]}
        selectedPhaseId={1}
        onDateClick={vi.fn()}
      />
    );

    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
  });

  it('fills the x axis with every date from..to', () => {
    render(
      <TrendChartSection
        phaseTrends={[trend([report('2026-11-04')])]}
        selectedPhaseId={1}
        onDateClick={vi.fn()}
      />
    );

    const dates = within(screen.getByTestId('x-axis'))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(dates).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
  });

  it('fills dates across a month boundary', () => {
    render(
      <TrendChartSection
        phaseTrends={[{ ...trend([report('2026-10-31')]), from: '2026-10-30', to: '2026-11-02' }]}
        selectedPhaseId={1}
        onDateClick={vi.fn()}
      />
    );

    const dates = within(screen.getByTestId('x-axis'))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(dates).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('calls onDateClick only for dates that have a report', async () => {
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    render(
      <TrendChartSection
        phaseTrends={[trend([report('2026-11-04')])]}
        selectedPhaseId={1}
        onDateClick={onDateClick}
      />
    );

    await user.click(screen.getByRole('button', { name: '2026-11-06' }));
    expect(onDateClick).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '2026-11-04' }));
    expect(onDateClick).toHaveBeenCalledWith(1, '2026-11-04');
  });

  describe('Bug 추이 50% midpoint ratio', () => {
    const bugs = (
      snapshotDate: string,
      newBugCritical: number,
      newBugMajor: number,
      newBugMinor: number,
      newBugTrivial: number
    ): DailyReport => ({ ...report(snapshotDate), newBugCritical, newBugMajor, newBugMinor, newBugTrivial });

    // 10-day period 11-01..11-10 → ceil(10/2) = day 5 = 11-05
    const tenDays = (dailyReports: DailyReport[]): TrendData => ({
      ...trend(dailyReports),
      from: '2026-11-01',
      to: '2026-11-10',
    });

    const openBugTab = async (data: TrendData) => {
      const user = userEvent.setup();
      render(<TrendChartSection phaseTrends={[data]} selectedPhaseId={1} onDateClick={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Bug 추이' }));
    };

    it('is hidden on the Pass Rate tab', () => {
      render(
        <TrendChartSection phaseTrends={[tenDays([bugs('2026-11-01', 1, 0, 0, 0)])]} selectedPhaseId={1} onDateClick={vi.fn()} />
      );

      expect(screen.queryByTestId('bug-midpoint-ratio')).not.toBeInTheDocument();
    });

    it('computes all / High-and-above ratios up to the 50% day', async () => {
      await openBugTab(
        tenDays([
          bugs('2026-11-01', 1, 1, 0, 0), // all 2, high 2
          bugs('2026-11-03', 0, 0, 2, 0), // all 2, high 0
          bugs('2026-11-05', 0, 0, 0, 1), // all 1, high 0 — midpoint day is included
          bugs('2026-11-06', 2, 0, 1, 0), // all 3, high 2 — after midpoint
          bugs('2026-11-10', 0, 1, 1, 0), // all 2, high 1 — after midpoint
        ])
      );

      expect(screen.getByTestId('bug-midpoint-ratio')).toHaveTextContent(
        '테스트 기간 50% 시점(11-05)까지 등록된 버그: 전체 50% (5/10) · High 이상 40% (2/5)'
      );
    });

    it('uses ceil(N/2) for an odd-length period', async () => {
      // 11-03..11-07 (5 days) → day 3 = 11-05
      await openBugTab(trend([bugs('2026-11-05', 1, 0, 0, 0), bugs('2026-11-06', 1, 0, 0, 0)]));

      expect(screen.getByTestId('bug-midpoint-ratio')).toHaveTextContent(
        '50% 시점(11-05)까지 등록된 버그: 전체 50% (1/2) · High 이상 50% (1/2)'
      );
    });

    it('shows - when there are no bugs at all', async () => {
      await openBugTab(tenDays([bugs('2026-11-02', 0, 0, 0, 0)]));

      expect(screen.getByTestId('bug-midpoint-ratio')).toHaveTextContent('전체 - · High 이상 -');
    });

    it('shows - only for High-and-above when there are no critical/major bugs', async () => {
      await openBugTab(tenDays([bugs('2026-11-02', 0, 0, 1, 1), bugs('2026-11-08', 0, 0, 2, 0)]));

      expect(screen.getByTestId('bug-midpoint-ratio')).toHaveTextContent('전체 50% (2/4) · High 이상 -');
    });
  });
});
