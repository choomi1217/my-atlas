import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { agentExecutionApi } from '@/api/features';
import AgentLiveView from '@/components/features/AgentLiveView';
import AgentStopButton from '@/components/features/AgentStopButton';
import AgentVerdictCounts from '@/components/features/AgentVerdictCounts';
import type {
  AgentExecutionJob,
  AgentExecutionResult,
  AgentJobContext,
  AgentLiveProgress,
} from '@/types/features';
import { apiErrorMessage } from '@/utils/apiError';
import {
  STATUS_LABEL,
  formatDateTime,
  isActiveStatus,
  statusClass,
  verdictClass,
  verdictLabel,
} from '@/utils/agentExecution';

const POLL_INTERVAL_MS = 2000;

interface TcRow {
  id: number;
  title: string | null;
}

export default function AutomationJobPage() {
  const { jobId: jobIdParam } = useParams<{ jobId: string }>();
  const jobId = Number(jobIdParam);

  const [job, setJob] = useState<AgentExecutionJob | null>(null);
  const [results, setResults] = useState<AgentExecutionResult[]>([]);
  const [progress, setProgress] = useState<AgentLiveProgress | null>(null);
  const [context, setContext] = useState<AgentJobContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 실행 내용(TC·Step)은 Job 생성 시 고정되므로 한 번만 가져온다
  useEffect(() => {
    let cancelled = false;
    agentExecutionApi
      .getContext(jobId)
      .then((c) => {
        if (!cancelled) setContext(c);
      })
      .catch(() => {
        // 컨텍스트가 없어도 결과 기준으로 목록을 그린다
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  // 종료될 때까지 2초 폴링. results/progress는 job을 먼저 읽은 뒤 가져와 최종 결과를 놓치지 않는다
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const j = await agentExecutionApi.getJob(jobId);
        const [rs, pg] = await Promise.allSettled([
          agentExecutionApi.listResults(jobId),
          agentExecutionApi.getProgress(jobId),
        ]);
        if (cancelled) return;
        setJob(j);
        if (rs.status === 'fulfilled') setResults(rs.value);
        setProgress(pg.status === 'fulfilled' ? pg.value : null);
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
  }, [jobId]);

  const active = job ? isActiveStatus(job.status) : false;

  // context의 TC 목록 + context에 없는 결과(구버전 Job)
  const rows = useMemo<TcRow[]>(() => {
    const base: TcRow[] = (context?.testCases ?? []).map((tc) => ({
      id: tc.id,
      title: tc.title,
    }));
    const known = new Set(base.map((r) => r.id));
    for (const r of results) {
      if (!known.has(r.testCaseId)) {
        known.add(r.testCaseId);
        base.push({ id: r.testCaseId, title: null });
      }
    }
    return base;
  }, [context, results]);

  const resultByTc = useMemo(() => {
    const map = new Map<number, AgentExecutionResult>();
    results.forEach((r) => map.set(r.testCaseId, r));
    return map;
  }, [results]);

  const total = job?.totalCount ?? 0;
  const done = job?.doneCount ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/automation" className="text-sm text-indigo-600 hover:underline">
        &larr; Test Automation
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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">Job #{job.id}</h1>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${statusClass(job.status)}`}
                >
                  {STATUS_LABEL[job.status]}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                요청 {formatDateTime(job.createdAt)}
                {job.workerId && ` · 워커 ${job.workerId}`}
              </p>
            </div>
            {active && <AgentStopButton jobId={job.id} onStopped={setJob} />}
          </div>

          {job.errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {job.errorMessage}
            </div>
          )}

          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">
                {active ? '실행 중…' : '완료'} {done}/{total}
              </span>
              <AgentVerdictCounts
                pass={job.passCount}
                fail={job.failCount}
                inconclusive={job.inconclusiveCount}
              />
            </div>
            {/* 동적 너비를 인라인 style 없이 그리기 위해 네이티브 progress 사용 */}
            <progress
              value={pct}
              max={100}
              aria-label="Job 진행률"
              className="block w-full h-2 rounded overflow-hidden appearance-none bg-gray-200 [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-value]:bg-indigo-500 [&::-moz-progress-bar]:bg-indigo-500"
            />
          </div>

          <AgentLiveView jobId={job.id} active={active} />

          <div className="bg-white border rounded-lg divide-y">
            {rows.map((row) => {
              const result = resultByTc.get(row.id);
              const running = active && progress?.testCaseId === row.id;
              return (
                <Link
                  key={row.id}
                  to={`/automation/jobs/${job.id}/tc/${row.id}`}
                  data-testid="automation-job-tc-row"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <span className="font-mono text-xs text-gray-500 shrink-0">
                    T{row.id}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-gray-800 truncate">
                    {row.title}
                  </span>
                  {result ? (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${verdictClass(result.verdict)}`}
                    >
                      {verdictLabel(result.verdict)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 shrink-0">
                      {running ? '실행 중' : active ? '대기' : '미실행'}
                    </span>
                  )}
                </Link>
              );
            })}
            {rows.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400">TC 정보가 없습니다.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
