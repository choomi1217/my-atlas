import { BlockedTcInfo, Segment } from '@/types/features';

interface BlockedTcListProps {
  blockedTcs: BlockedTcInfo[];
  segments?: Segment[];
}

export const BlockedTcList: React.FC<BlockedTcListProps> = ({ blockedTcs, segments = [] }) => {
  const resolvePathNames = (path: number[]): string => {
    return path.map(id => segments.find(s => s.id === id)?.name || '?').join(' > ');
  };

  if (blockedTcs.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Blocked TCs</h4>
        <p className="text-sm text-gray-400">Blocked TC가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700">
          Blocked TCs <span className="text-gray-400 font-normal">({blockedTcs.length})</span>
        </h4>
      </div>
      <div className="divide-y divide-gray-100">
        {blockedTcs.map((tc) => (
          <div key={tc.testResultId} className="px-4 py-2.5 flex items-center gap-3">
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
              BLOCKED
            </span>
            <span className="text-sm text-gray-700 truncate flex-1">{tc.testCaseTitle}</span>
            {tc.testCasePath.length > 0 && (
              <span className="text-xs text-gray-400 truncate max-w-[200px]">
                {resolvePathNames(tc.testCasePath)}
              </span>
            )}
            <span className="text-xs text-gray-400 whitespace-nowrap">{tc.phaseName}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
