import { useState } from 'react';
import { agentExecutionApi } from '@/api/features';
import type { AgentExecutionJob } from '@/types/features';
import { apiErrorMessage } from '@/utils/apiError';

interface AgentStopButtonProps {
  jobId: number;
  onStopped: (job: AgentExecutionJob) => void;
}

/**
 * Job 중지 버튼. 중지는 되돌릴 수 없으므로 인라인으로 한 번 더 확인받는다.
 * 워커는 TC·step 경계에서 취소 상태를 확인하고 조용히 멈춘다 —
 * 상용 서비스를 조작하는 중일 수 있어 사람이 멈출 수단이 반드시 필요하다.
 */
export default function AgentStopButton({ jobId, onStopped }: AgentStopButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStop = async () => {
    setStopping(true);
    setError(null);
    try {
      const job = await agentExecutionApi.cancel(jobId);
      onStopped(job);
    } catch (err) {
      setError(apiErrorMessage(err, '중지 실패'));
    } finally {
      setStopping(false);
      setConfirming(false);
    }
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {confirming ? (
        <>
          <span className="text-sm text-gray-700">중지할까요?</span>
          <button
            type="button"
            data-testid="automation-stop-confirm"
            onClick={handleStop}
            disabled={stopping}
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded"
          >
            {stopping ? '중지 중…' : '중지'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            계속
          </button>
        </>
      ) : (
        <button
          type="button"
          data-testid="automation-stop"
          onClick={() => setConfirming(true)}
          className="px-4 py-1.5 text-sm border border-red-300 text-red-700 hover:bg-red-50 rounded"
        >
          중지
        </button>
      )}
    </div>
  );
}
