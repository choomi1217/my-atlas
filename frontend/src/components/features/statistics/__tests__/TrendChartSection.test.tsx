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
});
