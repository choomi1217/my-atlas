import { useState } from 'react';
import { productApi } from '@/api/features';
import { ExecTargetKind, Product } from '@/types/features';

const TARGET_KINDS: { value: ExecTargetKind; label: string; hint: string }[] = [
  { value: 'WEB', label: '웹 (브라우저)', hint: 'Playwright로 Base URL을 열어 실행합니다.' },
  { value: 'ANDROID', label: 'Android 앱', hint: 'Appium으로 에뮬레이터/기기의 앱을 실행합니다. Base URL은 쓰지 않습니다.' },
  { value: 'IOS', label: 'iOS 앱', hint: '아직 지원하지 않습니다.' },
];

interface ExecProfileModalProps {
  product: Product;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

/**
 * Product의 에이전트 실행 프로파일(baseUrl, seed 절차) 설정 모달.
 * baseUrl은 에이전트가 실행할 대상 URL, seedNote는 로그인 등 사전 절차 서술(비밀값 금지).
 */
export default function ExecProfileModal({
  product,
  onClose,
  onSaved,
}: ExecProfileModalProps) {
  const [baseUrl, setBaseUrl] = useState(product.execBaseUrl ?? '');
  const [seedNote, setSeedNote] = useState(product.execSeedNote ?? '');
  const [targetKind, setTargetKind] = useState<ExecTargetKind>(
    product.execTargetKind ?? 'WEB'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWeb = targetKind === 'WEB';

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await productApi.setExecProfile(
        product.id,
        baseUrl.trim(),
        seedNote.trim(),
        targetKind
      );
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">AI 실행 프로파일</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              실행 대상
            </label>
            <select
              value={targetKind}
              onChange={(e) => setTargetKind(e.target.value as ExecTargetKind)}
              className="w-full px-3 py-2 border rounded text-sm bg-white"
            >
              {TARGET_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {TARGET_KINDS.find((k) => k.value === targetKind)?.hint}
            </p>
            {targetKind === 'IOS' && (
              <p className="text-xs text-amber-700 mt-1">
                iOS는 아직 실행할 수 없습니다. 선택해도 워커가 Job을 집지 않습니다.
              </p>
            )}
          </div>

          {isWeb && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:5173"
                className="w-full px-3 py-2 border rounded text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                에이전트가 실행을 시작할 대상 URL
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seed 절차 (로그인 등)
            </label>
            <textarea
              value={seedNote}
              onChange={(e) => setSeedNote(e.target.value)}
              rows={4}
              placeholder="예: /login 에서 id/password로 로그인"
              className="w-full px-3 py-2 border rounded text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              실행 전 필요한 절차를 자연어로. 비밀번호 등 비밀값은 넣지 마세요.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
