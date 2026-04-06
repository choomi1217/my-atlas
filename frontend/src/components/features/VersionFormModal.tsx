import { useState, useEffect } from 'react';
import { Version, TestRun } from '@/types/features';

interface PhaseFormData {
  phaseName: string;
  testRunId: number;
}

interface VersionFormData {
  name: string;
  description: string;
  releaseDate: string;
  phases: PhaseFormData[];
}

interface VersionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: VersionFormData) => Promise<void>;
  initialData?: Version | null;
  availableTestRuns: TestRun[];
}

const emptyForm: VersionFormData = {
  name: '',
  description: '',
  releaseDate: '',
  phases: [{ phaseName: '', testRunId: 0 }],
};

export default function VersionFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  availableTestRuns,
}: VersionFormModalProps) {
  const [form, setForm] = useState<VersionFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name,
        description: initialData.description || '',
        releaseDate: initialData.releaseDate || '',
        phases: initialData.phases.map((p) => ({
          phaseName: p.phaseName,
          testRunId: p.testRunId,
        })),
      });
    } else {
      setForm(emptyForm);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!initialData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('버전 이름을 입력하세요');
      return;
    }
    if (form.phases.length === 0 || form.phases.some((p) => !p.testRunId)) {
      alert('모든 phase에 TestRun을 할당하세요');
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

  const addPhase = () => {
    setForm({
      ...form,
      phases: [...form.phases, { phaseName: '', testRunId: 0 }],
    });
  };

  const removePhase = (index: number) => {
    setForm({
      ...form,
      phases: form.phases.filter((_, i) => i !== index),
    });
  };

  const updatePhase = (
    index: number,
    field: keyof PhaseFormData,
    value: string | number
  ) => {
    const newPhases = [...form.phases];
    newPhases[index] = {
      ...newPhases[index],
      [field]: value,
    };
    setForm({ ...form, phases: newPhases });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="version-form-modal">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-96 overflow-y-auto" role="dialog">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {isEdit ? '버전 수정' : '새 버전'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                버전명 *
              </label>
              <input
                type="text"
                data-testid="version-name-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: v9, v2.1-hotfix"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                설명
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-16"
                placeholder="설명 (선택사항)"
              />
            </div>

            {/* Release Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                릴리스 예정일
              </label>
              <input
                type="date"
                value={form.releaseDate}
                onChange={(e) =>
                  setForm({ ...form, releaseDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Phases */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phase 구성 *
              </label>
              <div className="space-y-2">
                {form.phases.map((phase, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Phase 이름"
                      value={phase.phaseName}
                      onChange={(e) =>
                        updatePhase(index, 'phaseName', e.target.value)
                      }
                      className="flex-1 px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={phase.testRunId || ''}
                      onChange={(e) =>
                        updatePhase(index, 'testRunId', Number(e.target.value))
                      }
                      className="flex-1 px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">TestRun 선택</option>
                      {availableTestRuns.map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          {tr.name}
                        </option>
                      ))}
                    </select>
                    {form.phases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePhase(index)}
                        className="px-2 py-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addPhase}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700"
              >
                + Phase 추가
              </button>
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
