import { AgingBugInfo, TicketTracker } from '@/types/features';
import { priorityColor } from './priorityColor';

interface AgingBugListProps {
  agingBugs: AgingBugInfo[];
}

export const AgingBugList: React.FC<AgingBugListProps> = ({ agingBugs }) => {
  if (agingBugs.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Aging Bugs</h4>
        <p className="text-sm text-gray-400">Aging 버그가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700">
          Aging Bugs <span className="text-gray-400 font-normal">({agingBugs.length})</span>
        </h4>
      </div>
      <div className="divide-y divide-gray-100">
        {agingBugs.map((bug) => (
          <div key={bug.ticketId} className="px-4 py-2.5 flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColor[bug.priority]}`}>
              {bug.priority}
            </span>
            {bug.issueKey && (
              <a
                href={bug.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:underline font-medium"
              >
                {bug.tracker === TicketTracker.NOTION ? 'Notion' : bug.issueKey}
              </a>
            )}
            <span className="text-sm text-gray-700 truncate flex-1">{bug.summary}</span>
            <span className="text-xs text-gray-400 whitespace-nowrap">{bug.phaseName}</span>
            <span className="text-xs text-red-500 font-medium whitespace-nowrap">{bug.agingDays}일</span>
          </div>
        ))}
      </div>
    </div>
  );
};
