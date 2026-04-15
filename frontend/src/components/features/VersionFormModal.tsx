import { useState, useEffect } from 'react';
import { Version, TestRun } from '@/types/features';

interface PhaseFormData {
  phaseName: string;
  testRunIds: number[];
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
  phases: [{ phaseName: '', testRunIds: [] }],
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
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name,
        description: initialData.description || '',
        releaseDate: initialData.releaseDate || '',
        phases: initialData.phases.map((p) => ({
          phaseName: p.phaseName,
          testRunIds: p.testRuns.map((tr) => tr.testRunId),
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
    if (
      form.phases.length === 0 ||
      form.phases.some((p) => p.testRunIds.length === 0)
    ) {
      alert('모든 phase에 TestRun을 1개 이상 할당하세요');
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
      phases: [...form.phases, { phaseName: '', testRunIds: [] }],
    });
  };

  const removePhase = (index: number) => {
    setForm({
      ...form,
      phases: form.phases.filter((_, i) => i !== index),
    });
  };

  const updatePhaseName = (index: number, value: string) => {
    const newPhases = [...form.phases];
    newPhases[index] = { ...newPhases[index], phaseName: value };
    setForm({ ...form, phases: newPhases });
  };

  const toggleTestRunForPhase = (phaseIndex: number, testRunId: number) => {
    const newPhases = [...form.phases];
    const current = newPhases[phaseIndex].testRunIds;
    newPhases[phaseIndex] = {
      ...newPhases[phaseIndex],
      testRunIds: current.includes(testRunId)
        ? current.filter((id) => id !== testRunId)
        : [...current, testRunId],
    };
    setForm({ ...form, phases: newPhases });
  };

  const getPhaseTestRunSummary = (phase: PhaseFormData) => {
    const selected = availableTestRuns.filter((tr) =>
      phase.testRunIds.includes(tr.id)
    );
    if (selected.length === 0) return 'TestRun 선택';
    if (selected.length === 1) return selected[0].name;
    return `${selected.length}개 선택`;
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="version-form-modal"
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        role="dialog"
      >
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
              <div className="space-y-3">
                {form.phases.map((phase, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Phase 이름"
                        value={phase.phaseName}
                        onChange={(e) =>
                          updatePhaseName(index, e.target.value)
                        }
                        className="flex-1 px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
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

                    {/* TestRun multi-select dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenDropdown(
                            openDropdown === index ? null : index
                          )
                        }
                        className="w-full px-2 py-2 border border-gray-300 rounded text-sm text-left hover:bg-gray-50 flex items-center justify-between"
                      >
                        <span
                          className={
                            phase.testRunIds.length === 0
                              ? 'text-gray-400'
                              : 'text-gray-800'
                          }
                        >
                          {getPhaseTestRunSummary(phase)}
                        </span>
                        <span className="text-gray-400">▼</span>
                      </button>

                      {openDropdown === index && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                          {availableTestRuns.map((tr) => (
                            <label
                              key={tr.id}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={phase.testRunIds.includes(tr.id)}
                                onChange={() =>
                                  toggleTestRunForPhase(index, tr.id)
                                }
                                className="rounded border-gray-300 text-blue-600"
                              />
                              <span className="text-sm flex-1">{tr.name}</span>
                              <span className="text-xs text-gray-400">
                                {tr.testCaseCount} TC
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {phase.testRunIds.length > 0 && (
                      <div className="text-xs text-gray-500">
                        선택: {phase.testRunIds.length}개, 총{' '}
                        {availableTestRuns
                          .filter((tr) => phase.testRunIds.includes(tr.id))
                          .reduce((sum, tr) => sum + tr.testCaseCount, 0)}{' '}
                        TC
                      </div>
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
