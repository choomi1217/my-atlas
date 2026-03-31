import { useState, useEffect } from 'react';
import {
  TestCase,
  TestStep,
  TestCasePriority,
  TestCaseType,
  TestCaseStatus,
} from '@/types/features';

interface TestCaseFormData {
  title: string;
  description: string;
  promptText: string;
  priority: TestCasePriority;
  testType: TestCaseType;
  status: TestCaseStatus;
  preconditions: string;
  steps: TestStep[];
  expectedResult: string;
}

interface TestCaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TestCaseFormData) => Promise<void>;
  initialData?: TestCase | null;
  pathDisplay: string;
}

const emptyForm: TestCaseFormData = {
  title: '',
  description: '',
  promptText: '',
  priority: TestCasePriority.MEDIUM,
  testType: TestCaseType.FUNCTIONAL,
  status: TestCaseStatus.ACTIVE,
  preconditions: '',
  steps: [{ order: 1, action: '', expected: '' }],
  expectedResult: '',
};

export default function TestCaseFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  pathDisplay,
}: TestCaseFormModalProps) {
  const [form, setForm] = useState<TestCaseFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title,
        description: initialData.description || '',
        promptText: initialData.promptText || '',
        priority: initialData.priority,
        testType: initialData.testType,
        status: initialData.status,
        preconditions: initialData.preconditions || '',
        steps:
          initialData.steps && initialData.steps.length > 0
            ? initialData.steps
            : [{ order: 1, action: '', expected: '' }],
        expectedResult: initialData.expectedResult || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!initialData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStep = (idx: number, field: 'action' | 'expected', value: string) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 h-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800">
              {isEdit ? 'Edit Test Case' : 'Add Test Case'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* Body (scrollable) */}
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
            {/* Path (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Path
              </label>
              <div className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded border">
                {pathDisplay || 'Path를 선택해주세요.'}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="Test case title..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Priority / TestType / Status */}
            <div className="grid grid-cols-3 gap-3">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as TestCaseStatus,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.values(TestCaseStatus).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preconditions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preconditions
              </label>
              <textarea
                value={form.preconditions}
                onChange={(e) =>
                  setForm({ ...form, preconditions: e.target.value })
                }
                placeholder="Preconditions..."
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
                  >
                    <span className="text-xs text-gray-400 mt-2 flex-shrink-0">
                      #{step.order}
                    </span>
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        value={step.action}
                        onChange={(e) => updateStep(idx, 'action', e.target.value)}
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

            {/* Expected Result */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Result
              </label>
              <textarea
                value={form.expectedResult}
                onChange={(e) =>
                  setForm({ ...form, expectedResult: e.target.value })
                }
                placeholder="Expected result..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md
                         hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !form.title.trim()}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md
                         hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
