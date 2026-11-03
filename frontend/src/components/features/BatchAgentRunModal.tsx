import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentExecutionApi } from '@/api/features';
import { AgentExecutionScope } from '@/types/features';
import { apiErrorMessage } from '@/utils/apiError';

interface BatchAgentRunModalProps {
  productId: number;
  phaseId: number;
  phaseName: string;
  onClose: () => void;
}

type BatchScope = Extract<
  AgentExecutionScope,
  'PHASE_ALL' | 'PHASE_UNTESTED' | 'PHASE_PREV_FAIL'
>;

const SCOPE_OPTIONS: { value: BatchScope; label: string; desc: string }[] = [
  { value: 'PHASE_ALL', label: '전체', desc: 'Phase의 모든 TC' },
  { value: 'PHASE_UNTESTED', label: 'Untested만', desc: '미실행(UNTESTED) TC만' },
  { value: 'PHASE_PREV_FAIL', label: '이전 FAIL만', desc: '이전에 실패한 TC만' },
];

/**
 * Phase 일괄 AI 실행 — 범위 선택만 한다.
 * 실행 → Job 생성 → /automation 으로 이동. 진행·결과는 Test Automation 페이지에서 본다.
 * 결과는 TestResult에 executed_by=AGENT 로 자동 기록된다.
 */
export default function BatchAgentRunModal({
  productId,
  phaseId,
  phaseName,
  onClose,
}: BatchAgentRunModalProps) {
  const navigate = useNavigate();
  const [scope, setScope] = useState<BatchScope>('PHASE_ALL');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await agentExecutionApi.createBatch(productId, phaseId, scope);
      navigate('/automation');
    } catch (err) {
      // 409: 같은 Phase의 대기·실행 중 Job과 TC가 겹침 — 서버 메시지를 그대로 보여준다
      setError(apiErrorMessage(err, '실행 시작 실패'));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">AI 일괄 실행</h3>
            <p className="text-sm text-gray-500 truncate">{phaseName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-5 overflow-auto">
          {error && (
            <div
              data-testid="batch-agent-error"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="space-y-4">
            <p className="text-sm text-gray-600">실행 범위를 선택하세요:</p>
            <div className="space-y-2">
              {SCOPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                    scope === opt.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    className="mt-1"
                    checked={scope === opt.value}
                    onChange={() => setScope(opt.value)}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              * 실행 결과는 TestResult에 AGENT로 자동 기록됩니다 (판정불가 → RETEST).
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
            onClick={start}
            disabled={submitting}
            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? '시작 중…' : '실행'}
          </button>
        </div>
      </div>
    </div>
  );
}
