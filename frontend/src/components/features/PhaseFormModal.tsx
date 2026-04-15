import { useState, useEffect, useMemo } from 'react';
import { VersionPhase, TestRun } from '@/types/features';

interface PhaseFormData {
  phaseName: string;
  testRunIds: number[];
}

interface PhaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PhaseFormData) => Promise<void>;
  initialData?: VersionPhase | null;
  availableTestRuns: TestRun[];
}

const emptyForm: PhaseFormData = {
  phaseName: '',
  testRunIds: [],
};

export default function PhaseFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  availableTestRuns,
}: PhaseFormModalProps) {
  const [form, setForm] = useState<PhaseFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        phaseName: initialData.phaseName,
        testRunIds: initialData.testRuns.map((tr) => tr.testRunId),
      });
    } else {
      setForm(emptyForm);
    }
  }, [initialData, isOpen]);

  const selectedCount = form.testRunIds.length;
  const totalTcCount = useMemo(() => {
    return availableTestRuns
      .filter((tr) => form.testRunIds.includes(tr.id))
      .reduce((sum, tr) => sum + tr.testCaseCount, 0);
  }, [form.testRunIds, availableTestRuns]);

  if (!isOpen) return null;

  const isEdit = !!initialData;

  const toggleTestRun = (id: number) => {
    setForm((prev) => ({
      ...prev,
      testRunIds: prev.testRunIds.includes(id)
        ? prev.testRunIds.filter((v) => v !== id)
        : [...prev.testRunIds, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phaseName.trim()) {
      alert('Phase 이름을 입력하세요');
      return;
    }
    if (form.testRunIds.length === 0) {
      alert('TestRun을 1개 이상 선택하세요');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {isEdit ? 'Phase 수정' : '새 Phase 추가'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phase Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phase 이름 *
              </label>
              <input
                type="text"
                value={form.phaseName}
                onChange={(e) =>
                  setForm({ ...form, phaseName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 1차 테스트, Regression"
              />
            </div>

            {/* Test Run Multi-Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                TestRun 선택 * (1개 이상)
              </label>
              <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                {availableTestRuns.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">
                    사용 가능한 TestRun이 없습니다
                  </div>
                ) : (
                  availableTestRuns.map((tr) => (
                    <label
                      key={tr.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={form.testRunIds.includes(tr.id)}
                        onChange={() => toggleTestRun(tr.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-800 flex-1">
                        {tr.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {tr.testCaseCount} TC
                      </span>
                    </label>
                  ))
                )}
              </div>
              {selectedCount > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  선택: {selectedCount}개, 총 {totalTcCount} TC
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
