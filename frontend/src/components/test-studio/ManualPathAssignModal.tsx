import { useEffect, useState } from 'react';
import { Segment, TestCase } from '@/types/features';
import SegmentTreePicker from '@/components/features/SegmentTreePicker';

interface ManualPathAssignModalProps {
  isOpen: boolean;
  testCase: TestCase | null;
  segments: Segment[];
  onClose: () => void;
  onSave: (testCaseId: number, path: number[]) => Promise<void>;
}

/**
 * Modal that lets the user pick / clear a Segment path for a DRAFT test case.
 *
 * This is a user-initiated action (not a forced code injection). On save we call
 * PATCH /api/test-cases/{id}/path through the parent's onSave handler.
 */
export default function ManualPathAssignModal({
  isOpen,
  testCase,
  segments,
  onClose,
  onSave,
}: ManualPathAssignModalProps) {
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (testCase) {
      setSelectedPath(testCase.path ?? []);
    } else {
      setSelectedPath([]);
    }
  }, [testCase, isOpen]);

  if (!isOpen || !testCase) return null;

  const suggestion = testCase.suggestedSegmentPath;
  const hasSuggestion = suggestion && suggestion.length > 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(testCase.id, selectedPath);
      onClose();
    } catch (e) {
      console.error('Manual path save failed', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="manual-path-modal"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Path 수동 지정</h3>
            <p className="text-xs text-gray-500 truncate max-w-md" title={testCase.title}>
              {testCase.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          {hasSuggestion && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              🤖 Claude 추천: {suggestion!.join(' > ')}{' '}
              <span className="text-amber-700">
                (이대로 사용하려면 카드의 "추천 적용" 버튼을 사용하세요)
              </span>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Segment 경로
            </label>
            <SegmentTreePicker
              segments={segments}
              selectedPath={selectedPath}
              onChange={setSelectedPath}
              emptyLabel="경로 없음 (📦 Segment 미지정으로 되돌림)"
            />
          </div>
          <div className="text-[11px] text-gray-500">
            선택 중: {selectedPath.length === 0
              ? '경로 없음'
              : selectedPath
                  .map((id) => segments.find((s) => s.id === id)?.name ?? `#${id}`)
                  .join(' > ')}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            data-testid="manual-path-save"
          >
            {isSaving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
