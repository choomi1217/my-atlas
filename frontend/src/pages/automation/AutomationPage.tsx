import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentExecutionApi } from '@/api/features';
import AgentStopButton from '@/components/features/AgentStopButton';
import AgentVerdictCounts from '@/components/features/AgentVerdictCounts';
import type {
  AgentExecutionJob,
  AgentJobListItem,
  AgentJobPage,
  AgentWorkerStatus,
} from '@/types/features';
import { apiErrorMessage } from '@/utils/apiError';
import {
  STATUS_LABEL,
  formatDateTime,
  jobTitle,
  statusClass,
} from '@/utils/agentExecution';

const POLL_INTERVAL_MS = 3000;
const ACTIVE_PAGE_SIZE = 100;
const DONE_PAGE_SIZE = 20;

const NO_WORKER = '연결된 워커 없음';
const WORKER_LOST = '워커 응답 없음';

/** 대기 Job을 맡을 워커가 없거나, 실행 중 Job의 워커가 사라졌으면 경고 문구를 돌려준다 */
function jobWarning(job: AgentExecutionJob, workers: AgentWorkerStatus[]): string | null {
  if (job.status === 'PENDING') {
    // 대상 종류를 모르는 Job은 백엔드 기본값(WEB)으로 본다
    const kind = job.execTargetKind ?? 'WEB';
    const matched = workers.some(
      (w) =>
        w.targetKind === kind &&
        (w.productId === job.productId || w.productId === null)
    );
    return matched ? null : NO_WORKER;
  }
  if (
    job.status === 'RUNNING' &&
    job.workerId &&
    !workers.some((w) => w.workerId === job.workerId)
  ) {
    return WORKER_LOST;
  }
  return null;
}

function workerLabel(w: AgentWorkerStatus): string {
  const device = w.deviceName ? ` · ${w.deviceName}` : '';
  return `${w.workerId}${device} (${w.targetKind})`;
}

export default function AutomationPage() {
  const [workers, setWorkers] = useState<AgentWorkerStatus[]>([]);
  const [activeItems, setActiveItems] = useState<AgentJobListItem[]>([]);
  const [activeTotal, setActiveTotal] = useState(0);
  const [donePage, setDonePage] = useState(0);
  const [done, setDone] = useState<AgentJobPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // 중지 직후 3초를 기다리지 않고 즉시 다시 불러오기 위한 키
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const [active, doneList, ws] = await Promise.all([
          agentExecutionApi.listQueue({
            status: ['PENDING', 'RUNNING'],
            page: 0,
            size: ACTIVE_PAGE_SIZE,
            direction: 'ASC',
          }),
          agentExecutionApi.listQueue({
            status: ['DONE', 'FAILED', 'CANCELLED'],
            page: donePage,
            size: DONE_PAGE_SIZE,
            direction: 'DESC',
          }),
          agentExecutionApi.listWorkers(),
        ]);
        if (cancelled) return;
        setActiveItems(active.items);
        setActiveTotal(active.totalElements);
        setDone(doneList);
        setWorkers(ws);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, '목록을 불러오지 못했습니다'));
      } finally {
        inFlight = false;
        if (!cancelled) setLoaded(true);
      }
    };

    void tick();
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [donePage, reloadKey]);

  const totalDonePages = done?.totalPages ?? 0;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Test Automation</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        data-testid="automation-worker-status"
        className="mb-6 px-4 py-3 bg-white border rounded-lg text-sm text-gray-700"
      >
        {workers.length === 0 ? (
          <span className="text-gray-400">{NO_WORKER}</span>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-gray-500">연결된 워커</span>
            {workers.map((w) => (
              <span key={w.workerId} className="font-mono text-xs">
                {workerLabel(w)}
              </span>
            ))}
          </div>
        )}
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          대기·실행 중 ({activeTotal})
        </h2>
        <div className="bg-white border rounded-lg divide-y">
          {activeItems.map((item) => {
            const { job } = item;
            const warning = jobWarning(job, workers);
            return (
              <div
                key={job.id}
                data-testid="automation-queue-row"
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <Link
                  to={`/automation/jobs/${job.id}`}
                  className="flex flex-1 min-w-0 items-center gap-3"
                >
                  <span className="font-mono text-xs text-gray-500 shrink-0">
                    #{job.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-800 truncate">{jobTitle(item)}</div>
                    <div className="text-xs text-gray-400">
                      요청 {formatDateTime(job.createdAt)}
                      {warning && (
                        <span className="ml-2 text-amber-600">{warning}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${statusClass(job.status)}`}
                  >
                    {STATUS_LABEL[job.status]}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {job.doneCount}/{job.totalCount}
                  </span>
                </Link>
                <AgentStopButton
                  jobId={job.id}
                  onStopped={() => setReloadKey((k) => k + 1)}
                />
              </div>
            );
          })}
          {activeItems.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">
              {loaded ? '대기·실행 중인 작업이 없습니다.' : '불러오는 중…'}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">완료</h2>
        <div className="bg-white border rounded-lg divide-y">
          {(done?.items ?? []).map((item) => {
            const { job } = item;
            return (
              <Link
                key={job.id}
                to={`/automation/jobs/${job.id}`}
                data-testid="automation-done-row"
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <span className="font-mono text-xs text-gray-500 shrink-0">
                  #{job.id}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-800 truncate">{jobTitle(item)}</div>
                  <div className="text-xs text-gray-400">
                    요청 {formatDateTime(job.createdAt)}
                  </div>
                </div>
                <AgentVerdictCounts
                  pass={job.passCount}
                  fail={job.failCount}
                  inconclusive={job.inconclusiveCount}
                />
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${statusClass(job.status)}`}
                >
                  {STATUS_LABEL[job.status]}
                </span>
              </Link>
            );
          })}
          {(done?.items.length ?? 0) === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">
              {loaded ? '완료된 작업이 없습니다.' : '불러오는 중…'}
            </div>
          )}
        </div>

        {totalDonePages > 1 && (
          <div className="mt-3 flex items-center justify-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setDonePage((p) => Math.max(0, p - 1))}
              disabled={donePage === 0}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
            >
              이전
            </button>
            <span className="text-gray-500">
              {donePage + 1} / {totalDonePages}
            </span>
            <button
              type="button"
              onClick={() => setDonePage((p) => Math.min(totalDonePages - 1, p + 1))}
              disabled={donePage >= totalDonePages - 1}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
            >
              다음
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
