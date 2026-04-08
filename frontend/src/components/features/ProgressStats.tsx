import { ProgressStats as ProgressStatsType } from '@/types/features';

interface ProgressStatsProps {
  stats: ProgressStatsType;
  title?: string;
  showDetailed?: boolean;
}

export default function ProgressStats({
  stats,
  title,
  showDetailed = true,
}: ProgressStatsProps) {
  const progressPercentage =
    stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);

  return (
    <div className="space-y-3">
      {title && <h3 className="font-semibold text-gray-700">{title}</h3>}

      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
        <span className="text-sm font-semibold text-gray-700 w-12">
          {progressPercentage}%
        </span>
      </div>

      {/* Completion Count */}
      <p className="text-sm text-gray-600">
        {stats.completed}/{stats.total} 완료
      </p>

      {/* Detailed Stats */}
      {showDetailed && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-600">
          {stats.pass > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              <span>Pass {stats.pass}</span>
            </div>
          )}
          {stats.fail > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-red-600 rounded-full"></span>
              <span>Fail {stats.fail}</span>
            </div>
          )}
          {stats.blocked > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
              <span>Blocked {stats.blocked}</span>
            </div>
          )}
          {stats.skipped > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
              <span>Skipped {stats.skipped}</span>
            </div>
          )}
          {stats.retest > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              <span>Retest {stats.retest}</span>
            </div>
          )}
          {stats.untested > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
              <span>Untested {stats.untested}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
