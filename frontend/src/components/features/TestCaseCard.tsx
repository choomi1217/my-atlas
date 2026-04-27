import ImageRefText from './ImageRefText';
import TestCaseSteps from './TestCaseSteps';
import { TestCase } from '@/types/features';
import { TC_DND_MIME } from '@/utils/tcDnd';

interface TestCaseCardProps {
  testCase: TestCase;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (tc: TestCase) => void;
  onDelete: (info: { id: number; title: string }) => void;
}

const priorityBorderClass = (priority: TestCase['priority']): string => {
  if (priority === 'HIGH') return 'border-l-red-400';
  if (priority === 'MEDIUM') return 'border-l-yellow-400';
  return 'border-l-gray-300';
};

const priorityBadgeClass = (priority: TestCase['priority']): string => {
  if (priority === 'HIGH') return 'bg-red-100 text-red-700';
  if (priority === 'MEDIUM') return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-500';
};

export default function TestCaseCard({
  testCase,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: TestCaseCardProps) {
  const handleDragStart = (e: React.DragEvent<HTMLElement>) => {
    e.dataTransfer.setData(TC_DND_MIME, String(testCase.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <article
      draggable
      onDragStart={handleDragStart}
      data-testid="tc-card"
      data-tc-id={testCase.id}
      className={`group bg-white border rounded-lg shadow border-l-4 ${priorityBorderClass(testCase.priority)}`}
    >
      {/* Header zone */}
      <header
        onClick={onToggle}
        className="p-4 cursor-pointer hover:bg-gray-50 transition border-b border-gray-100"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-medium">{testCase.title}</h4>
            <div className="flex gap-1.5 mt-2">
              <span
                className={`text-xs px-2 py-1 rounded font-medium ${priorityBadgeClass(testCase.priority)}`}
              >
                {testCase.priority}
              </span>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                {testCase.testType}
              </span>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                {testCase.status}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(testCase);
                }}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 rounded"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete({ id: testCase.id, title: testCase.title });
                }}
                className="px-3 py-1 text-sm bg-red-100 text-red-600 hover:bg-red-200 rounded"
              >
                Delete
              </button>
            </div>
            <span className="text-[11px] text-gray-400">
              Created: {new Date(testCase.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </header>

      {/* Body zone */}
      {isExpanded && (
        <div className="p-4" data-testid="tc-body">
          {(testCase.description || testCase.preconditions) && (
            <dl className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-4">
              {testCase.description && (
                <>
                  <dt className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                    Description
                  </dt>
                  <dd className="text-sm leading-relaxed text-gray-800">
                    {testCase.description}
                  </dd>
                </>
              )}
              {testCase.preconditions && (
                <>
                  <dt className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                    Preconditions
                  </dt>
                  <dd className="text-sm leading-relaxed text-gray-800">
                    {testCase.preconditions}
                  </dd>
                </>
              )}
            </dl>
          )}

          <TestCaseSteps steps={testCase.steps} images={testCase.images} />

          {testCase.expectedResults && testCase.expectedResults.length > 0 && (
            <div
              data-testid="tc-final-expected"
              className="mt-4 border-l-[3px] border-green-600 bg-green-50 p-3.5 rounded-md"
            >
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-4 h-4 text-green-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-xs uppercase tracking-wide font-medium text-green-800">
                  Final Expected Result
                </span>
              </div>
              <ol
                data-testid="tc-final-expected-list"
                className="list-decimal pl-5 space-y-1 text-sm leading-relaxed text-gray-800"
              >
                {testCase.expectedResults.map((item, idx) => (
                  <li key={idx} data-testid="tc-final-expected-item">
                    <ImageRefText text={item} images={testCase.images} />
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
