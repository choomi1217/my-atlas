import { useState, useEffect } from 'react';
import { Version } from '@/types/features';

interface VersionFormData {
  name: string;
  description: string;
  releaseDate: string;
}

interface VersionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: VersionFormData) => Promise<void>;
  initialData?: Version | null;
}

const emptyForm: VersionFormData = {
  name: '',
  description: '',
  releaseDate: '',
};

export default function VersionFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: VersionFormModalProps) {
  const [form, setForm] = useState<VersionFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name,
        description: initialData.description || '',
        releaseDate: initialData.releaseDate || '',
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
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="version-form-modal"
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4"
        role="dialog"
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {isEdit ? '버전 수정' : '새 버전'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="예: v2.0 Release QA"
              />
            </div>

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

            <p className="text-xs text-gray-500">
              Phase는 버전 생성 후 상세 페이지에서 추가할 수 있습니다.
            </p>

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
                {isSubmitting ? '저장 중...' : isEdit ? '수정' : '생성'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
