import { useEffect, useState } from 'react';
import { TestStep, TestCasePriority, TestCaseType } from '@/types/features';
import { StyleExample, StyleExampleInput } from '@/types/test-studio';

interface StyleExampleModalProps {
  isOpen: boolean;
  /** 수정 모드일 때 기존 예시 (id 있음). 생성 모드면 null/undefined. */
  initial?: StyleExample | null;
  onClose: () => void;
  onSubmit: (input: StyleExampleInput) => Promise<void>;
}

interface FormState {
  title: string;
  preconditions: string;
  priority: TestCasePriority;
  testType: TestCaseType;
  steps: TestStep[];
  expectedResults: string[];
}

const emptyForm: FormState = {
  title: '',
  preconditions: '',
  priority: TestCasePriority.MEDIUM,
  testType: TestCaseType.FUNCTIONAL,
  steps: [{ order: 1, action: '', expected: '' }],
  expectedResults: [''],
};

/**
 * 스타일 예시 TC 작성 모달.
 *
 * 기존 TestCaseFormModal의 내용 필드(제목/우선순위/유형/사전조건/Steps/기대결과) UX를 그대로
 * 재현하되, Product 전용 필드(Segment/Path/Status/Images)는 제외한다 — 예시는 Company-scoped다.
 */
export default function StyleExampleModal({
  isOpen,
  initial,
  onClose,
  onSubmit,
}: StyleExampleModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title,
        preconditions: initial.preconditions || '',
        priority: initial.priority || TestCasePriority.MEDIUM,
        testType: initial.testType || TestCaseType.FUNCTIONAL,
        steps:
          initial.steps && initial.steps.length > 0
            ? initial.steps
            : [{ order: 1, action: '', expected: '' }],
        expectedResults:
          initial.expectedResults && initial.expectedResults.length > 0
            ? initial.expectedResults
            : [''],
      });
    } else {
      setForm(emptyForm);
    }
  }, [initial, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!initial?.id;

  const updateStep = (
    idx: number,
    field: 'action' | 'expected',
    value: string
  ) => {
    const updated = [...form.steps];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, steps: updated });
  };

  const addStep = () => {
    setForm({
      ...form,
      steps: [
        ...form.steps,
        { order: form.steps.length + 1, action: '', expected: '' },
      ],
    });
  };

  const removeStep = (idx: number) => {
    if (form.steps.length <= 1) return;
    const updated = form.steps
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, order: i + 1 }));
    setForm({ ...form, steps: updated });
  };

  const updateExpected = (idx: number, value: string) => {
    const updated = [...form.expectedResults];
    updated[idx] = value;
    setForm({ ...form, expectedResults: updated });
  };

  const addExpected = () => {
    setForm({ ...form, expectedResults: [...form.expectedResults, ''] });
  };

  const removeExpected = (idx: number) => {
    if (form.expectedResults.length <= 1) return;
    setForm({
      ...form,
      expectedResults: form.expectedResults.filter((_, i) => i !== idx),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setIsSubmitting(true);
    try {
      const input: StyleExampleInput = {
        title: form.title.trim(),
        preconditions: form.preconditions.trim() || null,
        priority: form.priority,
        testType: form.testType,
        steps: form.steps.filter((s) => s.action.trim() || s.expected.trim()),
        expectedResults: form.expectedResults.filter((r) => r.trim()),
      };
      await onSubmit(input);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="style-example-modal"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 h-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800">
              {isEdit ? '예시 TC 수정' : '예시 TC 추가'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="예: [로그인] 유효한 이메일/비밀번호로 로그인 성공"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
                data-testid="style-example-title-input"
              />
            </div>

            {/* Priority / TestType */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priority: e.target.value as TestCasePriority,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.values(TestCasePriority).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Type
                </label>
                <select
                  value={form.testType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      testType: e.target.value as TestCaseType,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.values(TestCaseType).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preconditions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사전조건
              </label>
              <textarea
                value={form.preconditions}
                onChange={(e) =>
                  setForm({ ...form, preconditions: e.target.value })
                }
                placeholder="사전조건..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Steps */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Steps
              </label>
              <div className="bg-gray-50 p-3 rounded border space-y-2">
                {form.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 bg-white p-2 rounded border"
                    data-testid="style-example-step-row"
                  >
                    <span className="text-xs text-gray-400 mt-2 flex-shrink-0">
                      #{step.order}
                    </span>
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        value={step.action}
                        onChange={(e) =>
                          updateStep(idx, 'action', e.target.value)
                        }
                        placeholder="Action..."
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm
                                   focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                      <input
                        type="text"
                        value={step.expected}
                        onChange={(e) =>
                          updateStep(idx, 'expected', e.target.value)
                        }
                        placeholder="Expected..."
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm
                                   focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                    {form.steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        className="text-gray-300 hover:text-red-500 text-sm mt-2 flex-shrink-0"
                        aria-label="Remove step"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addStep}
                  className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  + Add Step
                </button>
              </div>
            </div>

            {/* Expected Results */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                기대결과
              </label>
              <div className="bg-gray-50 p-3 rounded border space-y-2">
                {form.expectedResults.map((expected, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 bg-white p-2 rounded border"
                  >
                    <span className="text-xs text-gray-400 mt-2 flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={expected}
                      onChange={(e) => updateExpected(idx, e.target.value)}
                      placeholder="기대결과..."
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm
                                 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    {form.expectedResults.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeExpected(idx)}
                        className="text-gray-300 hover:text-red-500 text-sm mt-2 flex-shrink-0"
                        aria-label="Remove expected result"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addExpected}
                  className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  + Add Expected Result
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !form.title.trim()}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              data-testid="style-example-save"
            >
              {isSubmitting ? '저장 중...' : isEdit ? '저장' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
