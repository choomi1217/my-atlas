import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { TrendData } from '@/types/features';

interface TrendChartSectionProps {
  phaseTrends: TrendData[];
  selectedPhaseId: number | null;
  onDateClick: (phaseId: number, date: string) => void;
}

type TabType = 'bug' | 'passRate';

/** Every 'YYYY-MM-DD' from..to inclusive (UTC math, timezone-safe). */
const dateRange = (from: string, to: string): string[] => {
  const dates: string[] = [];
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(`${from}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
};

export const TrendChartSection: React.FC<TrendChartSectionProps> = ({
  phaseTrends,
  selectedPhaseId,
  onDateClick,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('passRate');

  const activeTrend = selectedPhaseId
    ? phaseTrends.find(t => t.phaseId === selectedPhaseId)
    : null;

  const reportsByDate = new Map((activeTrend?.dailyReports ?? []).map(r => [r.snapshotDate, r]));

  // x axis spans from..to; days without a report stay empty (no point/bar drawn)
  const chartData = activeTrend
    ? dateRange(activeTrend.from, activeTrend.to).map(date => {
        const r = reportsByDate.get(date);
        return r
          ? {
              date,
              passRate: r.passRate,
              progressRate: r.progressRate,
              newBugs: r.newBugCritical + r.newBugMajor + r.newBugMinor + r.newBugTrivial,
              closedBugs: r.closedBugCount,
              openBugs: r.openBugCount,
              critical: r.newBugCritical,
              major: r.newBugMajor,
              minor: r.newBugMinor,
            }
          : { date };
      })
    : [];

  const phaseId = activeTrend?.phaseId;

  // empty days (e.g. after today) have no report to open
  const handleChartClick = (label: unknown) => {
    if (typeof label === 'string' && phaseId && reportsByDate.has(label)) onDateClick(phaseId, label);
  };

  if (phaseTrends.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-center text-gray-400 text-sm">
        Trend 데이터가 없습니다. 스냅샷이 생성되면 차트가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-testid="trend-chart">
      <div className="flex items-center gap-2 p-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('passRate')}
          className={`px-3 py-1.5 rounded text-sm font-medium ${
            activeTab === 'passRate'
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Pass Rate
        </button>
        <button
          onClick={() => setActiveTab('bug')}
          className={`px-3 py-1.5 rounded text-sm font-medium ${
            activeTab === 'bug'
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Bug 추이
        </button>
      </div>

      <div className="p-4">
        {!activeTrend ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Phase를 선택하면 Trend 차트가 표시됩니다.
          </div>
        ) : activeTrend.dailyReports.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            선택한 Phase에 스냅샷 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            {activeTab === 'passRate' ? (
              <LineChart data={chartData} onClick={(e) => handleChartClick(e?.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="passRate" stroke="#22c55e" name="Pass Rate (%)" strokeWidth={2} connectNulls />
                <Line type="monotone" dataKey="progressRate" stroke="#6366f1" name="진행률 (%)" strokeWidth={2} connectNulls />
              </LineChart>
            ) : (
              <BarChart data={chartData} onClick={(e) => handleChartClick(e?.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="critical" stackId="new" fill="#ef4444" name="Critical" />
                <Bar dataKey="major" stackId="new" fill="#f97316" name="Major" />
                <Bar dataKey="minor" stackId="new" fill="#eab308" name="Minor" />
                <Line type="monotone" dataKey="closedBugs" stroke="#22c55e" name="종료" strokeWidth={2} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
