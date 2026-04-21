interface BulkApplyBarProps {
  selectedCount: number;
  totalEligible: number;
  onSelectAll: (next: boolean) => void;
  onApplyAll: () => void;
  busy?: boolean;
  allSelected?: boolean;
}

/**
 * Sticky action bar shown above the 미배정 section.
 * Lets the user select all and bulk-apply Claude suggestions in one click.
 */
export default function BulkApplyBar({
  selectedCount,
  totalEligible,
  onSelectAll,
  onApplyAll,
  busy = false,
  allSelected = false,
}: BulkApplyBarProps) {
  if (totalEligible === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2"
      data-testid="bulk-apply-bar"
    >
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            data-testid="bulk-select-all"
            disabled={busy}
          />
          전체 선택 ({selectedCount}/{totalEligible})
        </label>
      </div>
      <button
        onClick={onApplyAll}
        disabled={busy || selectedCount === 0}
        className="text-sm px-3 py-1.5 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="bulk-apply-button"
      >
        {busy ? '적용 중…' : `선택 ${selectedCount}건 일괄 추천 적용`}
      </button>
    </div>
  );
}
