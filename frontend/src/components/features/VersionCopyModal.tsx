import { useState, useEffect } from 'react';

interface VersionCopyData {
  newName: string;
  newReleaseDate: string;
}

interface VersionCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: VersionCopyData) => Promise<void>;
  versionName: string;
}

export default function VersionCopyModal({
  isOpen,
  onClose,
  onSubmit,
  versionName,
}: VersionCopyModalProps) {
  const [form, setForm] = useState<VersionCopyData>({
    newName: '',
    newReleaseDate: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Generate default new name with suffix
      setForm({
        newName: `${versionName}-延期`,
        newReleaseDate: '',
      });
    }
  }, [isOpen, versionName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.newName.trim()) {
      alert('새 버전 이름을 입력하세요');
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
            버전 분기 (복사)
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            "{versionName}"을(를) 기반으로 새로운 버전을 생성합니다.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                새 버전명 *
              </label>
              <input
                type="text"
                value={form.newName}
                onChange={(e) =>
                  setForm({ ...form, newName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: v9-延期, v9-hotfix"
              />
            </div>

            {/* New Release Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                새 릴리스 예정일
              </label>
              <input
                type="date"
                value={form.newReleaseDate}
                onChange={(e) =>
                  setForm({ ...form, newReleaseDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                선택하지 않으면 제한 없음
              </p>
            </div>

            {/* Info */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>ℹ️ 참고:</strong> 기존 Phase와 동일한 구조로 복사되며,
                테스트 결과는 초기화됩니다.
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
                {isSubmitting ? '분기 중...' : '분기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
