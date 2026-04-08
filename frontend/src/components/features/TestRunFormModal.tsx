import { useState, useEffect } from 'react';
import { TestRun, TestCase } from '@/types/features';

interface TestRunFormData {
  name: string;
  description: string;
  testCaseIds: number[];
}

interface TestRunFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TestRunFormData) => Promise<void>;
  initialData?: TestRun | null;
  availableTestCases: TestCase[];
}

const emptyForm: TestRunFormData = {
  name: '',
  description: '',
  testCaseIds: [],
};

export default function TestRunFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  availableTestCases,
}: TestRunFormModalProps) {
  const [form, setForm] = useState<TestRunFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name,
        description: initialData.description || '',
        testCaseIds: [],
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
      alert('테스트 실행 이름을 입력하세요');
      return;
    }
    if (form.testCaseIds.length === 0) {
      alert('최소 1개 이상의 테스트 케이스를 선택하세요');
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
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-96 overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {isEdit ? '테스트 실행 수정' : '새 테스트 실행'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름 *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="테스트 실행 이름"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
                placeholder="설명 (선택사항)"
              />
            </div>

            {/* Test Cases */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                테스트 케이스 선택 *
              </label>
              <div className="border border-gray-300 rounded-lg p-3 max-h-32 overflow-y-auto">
                {availableTestCases.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    사용 가능한 테스트 케이스가 없습니다
                  </p>
                ) : (
                  availableTestCases.map((tc) => (
                    <label
                      key={tc.id}
                      className="flex items-center gap-2 mb-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.testCaseIds.includes(tc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm({
                              ...form,
                              testCaseIds: [...form.testCaseIds, tc.id],
                            });
                          } else {
                            setForm({
                              ...form,
                              testCaseIds: form.testCaseIds.filter(
                                (id) => id !== tc.id
                              ),
                            });
                          }
                        }}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm text-gray-700">{tc.title}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                선택됨: {form.testCaseIds.length}개
              </p>
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
