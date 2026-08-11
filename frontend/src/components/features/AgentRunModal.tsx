import { useEffect, useRef, useState } from 'react';
import { agentExecutionApi } from '@/api/features';
import {
  AgentExecutionJob,
  AgentExecutionResult,
  AgentVerdict,
  TestCase,
} from '@/types/features';

interface AgentRunModalProps {
  productId: number;
  testCase: TestCase;
  onClose: () => void;
}

const POLL_INTERVAL_MS = 2000;

const verdictClass = (verdict: AgentVerdict): string => {
  if (verdict === 'PASS') return 'bg-green-100 text-green-700';
  if (verdict === 'FAIL') return 'bg-red-100 text-red-700';
  return 'bg-yellow-100 text-yellow-700';
};

/**
 * TC 단건 AI 시험 실행(dry run) 모달.
 * Job 생성 → 2초 폴링 → 완료 시 verdict + step별 판정 증적 표시.
 * 결과는 TestResult에 기록되지 않는다(dry run).
 */
export default function AgentRunModal({
  productId,
  testCase,
  onClose,
}: AgentRunModalProps) {
  const [job, setJob] = useState<AgentExecutionJob | null>(null);
  const [result, setResult] = useState<AgentExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const stoppedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // StrictMode(dev)는 effect를 mount→cleanup→mount 로 두 번 실행한다.
    // cleanup이 stopped=true 로 만들어도 여기서 다시 false 로 되돌려 폴링이 살아있게 한다.
    stoppedRef.current = false;

    const clearTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!startedRef.current) {
      startedRef.current = true;
      (async () => {
        try {
          const jobId = await agentExecutionApi.createSingle(
            productId,
            testCase.id
          );
          timerRef.current = setInterval(async () => {
            if (stoppedRef.current) return;
            try {
              const j = await agentExecutionApi.getJob(jobId);
              if (stoppedRef.current) return;
              setJob(j);
              if (j.status === 'DONE' || j.status === 'FAILED') {
                clearTimer();
                if (j.status === 'DONE') {
                  try {
                    setResult(
                      await agentExecutionApi.getResult(jobId, testCase.id)
                    );
                  } catch {
                    // 결과 미기록(예: 실행 오류) — job 상태만 표시
                  }
                }
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : '폴링 오류');
              clearTimer();
            }
          }, POLL_INTERVAL_MS);
        } catch (err) {
          setError(err instanceof Error ? err.message : '실행 시작 실패');
        }
      })();
    }

    return () => {
      stoppedRef.current = true;
      clearTimer();
    };
  }, [productId, testCase.id]);

  const running = !job || job.status === 'PENDING' || job.status === 'RUNNING';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">AI 시험 실행</h3>
            <p className="text-sm text-gray-500 truncate">{testCase.title}</p>
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
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {/* 진행 상태 */}
          <div className="flex items-center gap-3 mb-4">
            {running ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-700">
                  {job?.status === 'RUNNING'
                    ? '에이전트가 브라우저에서 실행 중…'
                    : '실행 대기 중… (워커 시작 대기)'}
                </span>
              </>
            ) : job?.status === 'FAILED' ? (
              <span className="text-sm text-red-700">
                실행 실패: {job.errorMessage || '알 수 없는 오류'}
              </span>
            ) : (
              <span className="text-sm text-gray-700">실행 완료</span>
            )}
          </div>

          {/* 판정 결과 */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">판정:</span>
                <span
                  className={`text-sm font-semibold px-2.5 py-1 rounded ${verdictClass(result.verdict)}`}
                >
                  {result.verdict}
                </span>
                {result.durationMs != null && (
                  <span className="text-xs text-gray-400">
                    {Math.round(result.durationMs / 1000)}s
                  </span>
                )}
                {result.tokenCost != null && (
                  <span className="text-xs text-gray-400">
                    ~{result.tokenCost} tokens
                  </span>
                )}
              </div>

              {result.aiFailureAnalysis && (
                <div className="p-3 bg-red-50 border-l-[3px] border-red-500 rounded text-sm text-gray-800">
                  {result.aiFailureAnalysis}
                </div>
              )}

              {/* step별 증적 */}
              <div className="border rounded-lg divide-y">
                {(result.stepLogs ?? []).map((s) => (
                  <div key={s.order} className="p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-gray-400 flex-shrink-0">
                        #{s.order}
                      </span>
                      <div className="min-w-0 text-sm">
                        <div className="text-gray-800">{s.actionTaken}</div>
                        <div className="text-gray-500 mt-0.5">
                          {s.judgment}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {(result.stepLogs ?? []).length === 0 && (
                  <div className="p-3 text-sm text-gray-400">
                    step 증적이 없습니다.
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400">
                * 시험 실행(dry run) — 결과는 TestResult에 기록되지 않습니다.
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
