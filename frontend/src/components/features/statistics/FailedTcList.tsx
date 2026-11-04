import { FailedTcInfo, Segment } from '@/types/features';
import { priorityColor } from './priorityColor';

interface FailedTcListProps {
  failedTcs: FailedTcInfo[];
  segments?: Segment[];
  onSelect: (tc: FailedTcInfo) => void;
}

export const FailedTcList: React.FC<FailedTcListProps> = ({ failedTcs, segments = [], onSelect }) => {
  const resolvePathNames = (path: number[]): string => {
    return path.map(id => segments.find(s => s.id === id)?.name || '?').join(' > ');
  };

  if (failedTcs.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-4" data-testid="failed-tc-list">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Failed TCs</h4>
        <p className="text-sm text-gray-400">Failed TC가 없습니다.</p>
      </div>
    );
  }

  const unconfirmed = failedTcs.filter(tc => tc.priority === null).length;

  return (
    <div className="rounded-lg border border-gray-200" data-testid="failed-tc-list">
      <div className="px-4 py-3 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700">
          Failed TCs <span className="text-gray-400 font-normal">({failedTcs.length})</span>
          {unconfirmed > 0 && (
            <span className="text-amber-600 font-normal"> · 확인 필요 {unconfirmed}</span>
          )}
        </h4>
      </div>
      <div className="divide-y divide-gray-100">
        {failedTcs.map((tc) => (
          <div
            key={tc.testResultId}
            data-testid="failed-tc-row"
            onClick={() => onSelect(tc)}
            className="px-4 py-2.5 cursor-pointer hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                tc.priority ? priorityColor[tc.priority] : 'bg-amber-100 text-amber-800'
              }`}>
                {tc.priority ?? '확인 필요'}
              </span>
              <span className="text-sm text-gray-700 truncate flex-1">{tc.testCaseTitle}</span>
              {tc.testCasePath.length > 0 && (
                <span className="text-xs text-gray-400 truncate max-w-[200px]">
                  {resolvePathNames(tc.testCasePath)}
                </span>
              )}
              <span className="text-xs text-gray-400 whitespace-nowrap">{tc.phaseName}</span>
            </div>
            {tc.comment && (
              <p className="text-xs text-gray-500 truncate mt-1">{tc.comment}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
