import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { agentExecutionApi } from '@/api/features';
import AgentStepScreenshot from '@/components/features/AgentStepScreenshot';
import type {
  AgentContextTestCase,
  AgentExecutionJob,
  AgentExecutionResult,
  AgentLiveProgress,
  AgentLiveStepStatus,
  AgentVerdict,
} from '@/types/features';
import { apiErrorMessage } from '@/utils/apiError';
import {
  STATUS_LABEL,
  isActiveStatus,
  statusClass,
  verdictClass,
  verdictLabel,
} from '@/utils/agentExecution';

const POLL_INTERVAL_MS = 2000;

const STEP_STATUS_LABEL: Record<AgentLiveStepStatus, string> = {
  PENDING: '대기',
  ACTING: '실행 중',
  JUDGING: '판정 중',
  PASS: 'PASS',
  FAIL: 'FAIL',
  INCONCLUSIVE: '판정불가',
};

const isVerdict = (s: AgentLiveStepStatus): s is AgentVerdict =>
  s === 'PASS' || s === 'FAIL' || s === 'INCONCLUSIVE';

interface StepCard {
  order: number;
  action: string | null;
  expected: string | null;
  status: AgentLiveStepStatus | null;
  actionTaken: string | null;
  judgment: string | null;
  /** 판정이 나온 Step (결과가 있거나 progress에서 PASS/FAIL/INCONCLUSIVE) */
  settled: boolean;
}

/** stepLogs의 판정 문구는 "PASS: 근거" 형식이다 (agent.js) */
const VERDICT_PREFIX = /^(PASS|FAIL|INCONCLUSIVE)\b/;

/** context 단계 + progress 단계 + 결과 stepLogs를 order 기준으로 병합한다 */
function mergeSteps(
  tc: AgentContextTestCase | undefined,
  progress: AgentLiveProgress | null,
  result: AgentExecutionResult | null
): StepCard[] {
  const cards = new Map<number, StepCard>();
  const get = (order: number): StepCard => {
    let c = cards.get(order);
    if (!c) {
      c = {
        order,
        action: null,
        expected: null,
        status: null,
        actionTaken: null,
        judgment: null,
        settled: false,
      };
      cards.set(order, c);
    }
    return c;
  };

  (tc?.steps ?? []).forEach((s) => {
    const c = get(s.order);
    c.action = s.action;
    c.expected = s.expected;
  });

  // 실행 중: progress 기준 (결과가 나오면 stepLogs가 우선)
  if (!result) {
    (progress?.steps ?? []).forEach((s) => {
      const c = get(s.order);
      c.action = c.action ?? s.action;
      c.expected = c.expected ?? s.expected;
      c.status = s.status;
      c.judgment = s.judgment;
      c.settled = isVerdict(s.status);
    });
  }

  (result?.stepLogs ?? []).forEach((l) => {
    const c = get(l.order);
    c.actionTaken = l.actionTaken;
    c.judgment = l.judgment;
    c.status = VERDICT_PREFIX.exec(l.judgment ?? '')?.[1] as AgentVerdict | undefined ?? null;
    c.settled = true;
  });

  return [...cards.values()].sort((a, b) => a.order - b.order);
}

export default function AutomationTestCasePage() {
  const { jobId: jobIdParam, tcId: tcIdParam } = useParams<{
    jobId: string;
    tcId: string;
  }>();
  const jobId = Number(jobIdParam);
  const tcId = Number(tcIdParam);
  const navigate = useNavigate();

  const [job, setJob] = useState<AgentExecutionJob | null>(null);
  const [tc, setTc] = useState<AgentContextTestCase | undefined>(undefined);
  const [result, setResult] = useState<AgentExecutionResult | null>(null);
  const [progress, setProgress] = useState<AgentLiveProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  // 실행 내용은 Job 생성 시 고정되므로 한 번만 가져온다
  useEffect(() => {
    let cancelled = false;
    agentExecutionApi
      .getContext(jobId)
      .then((c) => {
        if (!cancelled) setTc(c.testCases.find((t) => t.id === tcId));
      })
      .catch(() => {
        // 컨텍스트가 없는 구버전 Job — 결과·progress 기준으로 그린다
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, tcId]);

  // Job이 끝날 때까지 2초 폴링. 이 TC의 결과가 나오면 결과·progress 조회는 멈추고 Job 상태만 계속 본다
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let hasResult = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const j = await agentExecutionApi.getJob(jobId);
        let r: AgentExecutionResult | null = null;
        let pg: AgentLiveProgress | null = null;
        if (!hasResult) {
          // 결과는 TC가 끝나야 생기므로 그 전에는 404 — 없는 것으로 취급
          const [rs, p] = await Promise.allSettled([
            agentExecutionApi.getResult(jobId, tcId),
            isActiveStatus(j.status) ? agentExecutionApi.getProgress(jobId) : Promise.resolve(null),
          ]);
          r = rs.status === 'fulfilled' ? rs.value : null;
          pg = p.status === 'fulfilled' ? p.value : null;
        }
        if (cancelled) return;
        setJob(j);
        if (r) {
          hasResult = true;
          setResult(r);
          setProgress(null);
        } else if (!hasResult) {
          setProgress(pg && pg.testCaseId === tcId ? pg : null);
        }
        setError(null);
        if (!isActiveStatus(j.status) && timer) {
          clearInterval(timer);
          timer = null;
        }
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Job을 불러오지 못했습니다'));
      } finally {
        inFlight = false;
      }
    };

    void tick();
    timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [jobId, tcId]);

  const active = job ? isActiveStatus(job.status) : false;
  const steps = useMemo(() => mergeSteps(tc, progress, result), [tc, progress, result]);
  const title = tc?.title ?? progress?.testCaseTitle ?? null;

  const handleRerun = async () => {
    if (!job) return;
    setRerunning(true);
    setRerunError(null);
    try {
      const newJobId =
        job.phaseId != null
          ? await agentExecutionApi.createSelected(job.productId, job.phaseId, [tcId])
          : await agentExecutionApi.createSingle(job.productId, tcId);
      navigate(`/automation/jobs/${newJobId}`);
    } catch (err) {
      // 409: 같은 Phase의 대기·실행 중 Job과 TC가 겹침 — 서버 메시지를 그대로 보여준다
      setRerunError(apiErrorMessage(err, '재실행 실패'));
      setRerunning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to={`/automation/jobs/${jobId}`}
        className="text-sm text-indigo-600 hover:underline"
      >
        &larr; Job #{jobId}
      </Link>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {!job ? (
        !error && <div className="mt-4 text-sm text-gray-400">불러오는 중…</div>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">
                  <span className="font-mono text-gray-500">T{tcId}</span>
                  {title && ` ${title}`}
                </h1>
                {result ? (
                  <span
                    className={`text-sm font-semibold px-2.5 py-1 rounded ${verdictClass(result.verdict)}`}
                  >
                    {verdictLabel(result.verdict)}
                  </span>
                ) : (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${statusClass(job.status)}`}
                  >
                    {STATUS_LABEL[job.status]}
                  </span>
                )}
                {result?.durationMs != null && (
                  <span className="text-xs text-gray-400">
                    {Math.round(result.durationMs / 1000)}s
                  </span>
                )}
                {result?.tokenCost != null && (
                  <span className="text-xs text-gray-400">~{result.tokenCost} tokens</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <button
                type="button"
                data-testid="automation-rerun"
                onClick={handleRerun}
                disabled={active || rerunning}
                className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {rerunning ? '시작 중…' : '재실행'}
              </button>
              {job.phaseId != null && (
                <span className="text-xs text-gray-400">
                  재실행하면 Phase 결과가 갱신됩니다
                </span>
              )}
            </div>
          </div>

          {rerunError && (
            <div
              data-testid="automation-rerun-error"
              className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700"
            >
              {rerunError}
            </div>
          )}

          {result?.aiFailureAnalysis && (
            <div className="p-3 bg-red-50 border-l-[3px] border-red-500 rounded text-sm text-gray-800">
              {result.aiFailureAnalysis}
            </div>
          )}

          {!result && job.errorMessage && !active && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {job.errorMessage}
            </div>
          )}

          <div className="space-y-3">
            {steps.map((s) => (
              <div
                key={s.order}
                data-testid="automation-step-card"
                className="bg-white border rounded-lg p-4"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-gray-400 shrink-0">
                    #{s.order}
                  </span>
                  <div className="min-w-0 flex-1 text-sm space-y-1">
                    {s.action && <div className="text-gray-800">{s.action}</div>}
                    {s.expected && (
                      <div className="text-gray-500">기대 결과: {s.expected}</div>
                    )}
                    {s.actionTaken && (
                      <div className="text-gray-700">실제 동작: {s.actionTaken}</div>
                    )}
                    {s.judgment && (
                      <div className="text-gray-600">판정: {s.judgment}</div>
                    )}
                  </div>
                  {s.status && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${
                        isVerdict(s.status)
                          ? verdictClass(s.status)
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {STEP_STATUS_LABEL[s.status]}
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <AgentStepScreenshot
                    jobId={jobId}
                    testCaseId={tcId}
                    stepOrder={s.order}
                    active={active}
                    settled={s.settled}
                  />
                </div>
              </div>
            ))}
            {steps.length === 0 && (
              <div className="p-4 bg-white border rounded-lg text-sm text-gray-400">
                {active ? 'Step 정보를 기다리는 중…' : 'Step 증적이 없습니다.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
