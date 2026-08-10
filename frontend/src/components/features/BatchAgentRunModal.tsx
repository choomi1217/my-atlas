import { useEffect, useRef, useState } from 'react';
import { agentExecutionApi } from '@/api/features';
import {
  AgentExecutionJob,
  AgentExecutionResult,
  AgentExecutionScope,
  AgentVerdict,
} from '@/types/features';

interface BatchAgentRunModalProps {
  productId: number;
  phaseId: number;
  phaseName: string;
  onClose: () => void;
  /** Job 완료 시 부모가 결과를 재로딩하도록 (AGENT 배지·상태 반영) */
  onDone: () => void;
}

const POLL_INTERVAL_MS = 2000;

type BatchScope = Extract<
  AgentExecutionScope,
  'PHASE_ALL' | 'PHASE_UNTESTED' | 'PHASE_PREV_FAIL'
>;

const SCOPE_OPTIONS: { value: BatchScope; label: string; desc: string }[] = [
  { value: 'PHASE_ALL', label: '전체', desc: 'Phase의 모든 TC' },
  { value: 'PHASE_UNTESTED', label: 'Untested만', desc: '미실행(UNTESTED) TC만' },
  { value: 'PHASE_PREV_FAIL', label: '이전 FAIL만', desc: '이전에 실패한 TC만' },
];

const verdictClass = (v: AgentVerdict): string => {
  if (v === 'PASS') return 'bg-green-100 text-green-700';
  if (v === 'FAIL') return 'bg-red-100 text-red-700';
  return 'bg-yellow-100 text-yellow-700';
};

/**
 * Phase 일괄 AI 실행 모달 (시나리오 2).
 * scope 선택 → Job 생성 → 폴링(진행 바 + TC별 판정) → 완료 시 부모 결과 재로딩.
 * 결과는 TestResult에 executed_by=AGENT 로 자동 기록된다.
 */
export default function BatchAgentRunModal({
  productId,
  phaseId,
  phaseName,
  onClose,
  onDone,
}: BatchAgentRunModalProps) {
  const [scope, setScope] = useState<BatchScope>('PHASE_ALL');
  const [started, setStarted] = useState(false);
  const [job, setJob] = useState<AgentExecutionJob | null>(null);
  const [results, setResults] = useState<AgentExecutionResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startedRef = useRef(false);
  const stoppedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const start = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
    stoppedRef.current = false;
    try {
      const jobId = await agentExecutionApi.createBatch(productId, phaseId, scope);
      timerRef.current = setInterval(async () => {
        if (stoppedRef.current) return;
        try {
          const [j, rs] = await Promise.all([
            agentExecutionApi.getJob(jobId),
            agentExecutionApi.listResults(jobId),
          ]);
          if (stoppedRef.current) return;
          setJob(j);
          setResults(rs);
          if (j.status === 'DONE' || j.status === 'FAILED' || j.status === 'CANCELLED') {
            if (timerRef.current) clearInterval(timerRef.current);
            onDoneRef.current();
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : '폴링 오류');
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : '실행 시작 실패');
    }
  };

  const running =
    started && (!job || job.status === 'PENDING' || job.status === 'RUNNING');
  const total = job?.totalCount ?? 0;
  const done = job?.doneCount ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

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
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {!started ? (
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
          ) : (
            <div className="space-y-4">
              {/* 진행 바 */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">
                    {running ? '실행 중…' : '완료'} {done}/{total}
                  </span>
                  <span className="flex gap-2 text-xs">
                    <span className="text-green-600">PASS {job?.passCount ?? 0}</span>
                    <span className="text-red-600">FAIL {job?.failCount ?? 0}</span>
                    <span className="text-yellow-600">
                      판정불가 {job?.inconclusiveCount ?? 0}
                    </span>
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* TC별 판정 */}
              <div className="border rounded-lg divide-y max-h-[45vh] overflow-auto">
                {results.map((r) => (
                  <div key={r.id} className="p-3 flex items-start gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${verdictClass(r.verdict)}`}
                    >
                      {r.verdict}
                    </span>
                    <div className="min-w-0 text-sm">
                      <span className="text-gray-500 font-mono text-xs">
                        T{r.testCaseId}
                      </span>
                      {r.aiFailureAnalysis && (
                        <div className="text-gray-600 mt-0.5">
                          {r.aiFailureAnalysis}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {results.length === 0 && (
                  <div className="p-3 text-sm text-gray-400">
                    {running ? '워커가 실행을 시작하면 결과가 표시됩니다…' : '결과 없음'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2">
          {!started ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                취소
              </button>
              <button
                onClick={start}
                className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                실행
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
