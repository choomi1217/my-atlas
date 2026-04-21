import { TestCase } from '@/types/features';

interface DraftTcCardProps {
  testCase: TestCase;
  productName?: string;
  segmentPathLabel?: string; // Pre-resolved display string, e.g. "결제 > IC카드 결제"
  isSelected?: boolean;
  onToggleSelect?: (id: number, next: boolean) => void;
  onApplySuggestion?: (id: number) => void;
  onManualAssign?: (id: number) => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  showCheckbox?: boolean;
  showSuggestion?: boolean;
  busy?: boolean;
}

/**
 * Draft TC card used in the Company DRAFT dashboard.
 *
 * Two section variants share this card:
 * - 미배정 (Path 없음): shows 🤖 추천 badge + [추천 적용] + [수동 지정] buttons
 * - 배정완료 (Path 있음): shows current path + [Path 변경] button
 */
export default function DraftTcCard({
  testCase,
  productName,
  segmentPathLabel,
  isSelected = false,
  onToggleSelect,
  onApplySuggestion,
  onManualAssign,
  onEdit,
  onDelete,
  showCheckbox = false,
  showSuggestion = false,
  busy = false,
}: DraftTcCardProps) {
  const suggestion = testCase.suggestedSegmentPath;
  const hasSuggestion = suggestion && suggestion.length > 0;

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
      data-testid="draft-tc-card"
      data-tc-id={testCase.id}
    >
      {showCheckbox && onToggleSelect && (
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          checked={isSelected}
          onChange={(e) => onToggleSelect(testCase.id, e.target.checked)}
          data-testid="draft-tc-checkbox"
          disabled={busy}
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-gray-900 truncate">{testCase.title}</h4>
          <div className="flex items-center gap-1 shrink-0">
            <StatusBadge label={testCase.priority} color="gray" />
            <StatusBadge label={testCase.testType} color="slate" />
          </div>
        </div>

        <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
          {productName && <span>Product: {productName}</span>}
          {testCase.testStudioJobId != null && <span>Job #{testCase.testStudioJobId}</span>}
          {segmentPathLabel && <span>📍 {segmentPathLabel}</span>}
        </div>

        {showSuggestion && hasSuggestion && (
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
            🤖 추천: {suggestion!.join(' > ')}
          </div>
        )}
        {showSuggestion && !hasSuggestion && (
          <div className="mt-2 text-xs text-gray-400">🤖 추천 없음</div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {showSuggestion && hasSuggestion && onApplySuggestion && (
            <button
              onClick={() => onApplySuggestion(testCase.id)}
              className="text-xs px-2.5 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={busy}
              data-testid="draft-tc-apply-suggestion"
            >
              추천 적용
            </button>
          )}
          {onManualAssign && (
            <button
              onClick={() => onManualAssign(testCase.id)}
              className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={busy}
              data-testid="draft-tc-manual-assign"
            >
              {hasSuggestion ? '수동 지정' : 'Path 지정'}
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(testCase.id)}
              className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={busy}
            >
              수정
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(testCase.id)}
              className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
              disabled={busy}
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ label, color }: { label: string; color: 'gray' | 'slate' }) {
  const classes =
    color === 'gray'
      ? 'bg-gray-100 text-gray-700'
      : 'bg-slate-100 text-slate-700';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${classes}`}>
      {label}
    </span>
  );
}
