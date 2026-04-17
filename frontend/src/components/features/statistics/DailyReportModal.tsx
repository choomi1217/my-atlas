import { useEffect, useState } from 'react';
import { DailyReport } from '@/types/features';
import { statisticsApi } from '@/api/features';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  phaseId: number;
  date: string;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({
  isOpen,
  onClose,
  phaseId,
  date,
}) => {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    statisticsApi.getDailyReport(phaseId, date)
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, phaseId, date]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-800">
            Daily Report — {date}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-center text-gray-400 py-8">로딩 중...</div>
          ) : !report ? (
            <div className="text-center text-gray-400 py-8">데이터가 없습니다.</div>
          ) : (
            <div className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  {report.phaseName}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <StatRow label="Pass Rate" value={`${report.passRate}%`} />
                  <StatRow label="진행률" value={`${report.progressRate}%`} />
                  <StatRow label="총 TC" value={`${report.totalTc}`} />
                  <StatRow label="Pass" value={`${report.passCount}`} color="text-green-600" />
                  <StatRow label="Fail" value={`${report.failCount}`} color="text-red-600" />
                  <StatRow label="Blocked" value={`${report.blockedCount}`} color="text-yellow-600" />
                  <StatRow label="Skipped" value={`${report.skippedCount}`} />
                  <StatRow label="Retest" value={`${report.retestCount}`} />
                  <StatRow label="Untested" value={`${report.untestedCount}`} />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Bug 통계</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <StatRow label="신규 Critical" value={`${report.newBugCritical}`} color="text-red-600" />
                  <StatRow label="신규 Major" value={`${report.newBugMajor}`} color="text-orange-600" />
                  <StatRow label="신규 Minor" value={`${report.newBugMinor}`} color="text-yellow-600" />
                  <StatRow label="신규 Trivial" value={`${report.newBugTrivial}`} />
                  <StatRow label="종료" value={`${report.closedBugCount}`} color="text-green-600" />
                  <StatRow label="Open" value={`${report.openBugCount}`} />
                  <StatRow label="Aging" value={`${report.agingBugCount}`} color="text-red-500" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-1 px-2 rounded bg-gray-50">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${color || 'text-gray-800'}`}>{value}</span>
    </div>
  );
}
