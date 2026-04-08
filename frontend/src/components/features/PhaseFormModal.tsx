import { useState, useEffect } from 'react';
import { VersionPhase, TestRun } from '@/types/features';

interface PhaseFormData {
  phaseName: string;
  testRunId: number;
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
  testRunId: 0,
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
        testRunId: initialData.testRunId,
      });
    } else {
      setForm(emptyForm);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!initialData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phaseName.trim()) {
      alert('Phase 이름을 입력하세요');
      return;
    }
    if (!form.testRunId) {
      alert('TestRun을 선택하세요');
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

            {/* Test Run Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                TestRun 선택 *
              </label>
              <select
                value={form.testRunId || ''}
                onChange={(e) =>
                  setForm({ ...form, testRunId: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">TestRun을 선택하세요</option>
                {availableTestRuns.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.name} ({tr.testCaseCount} TC)
                  </option>
                ))}
              </select>
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
