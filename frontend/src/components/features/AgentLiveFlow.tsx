import type {
  AgentLiveProgress,
  AgentLiveStep,
  AgentLiveStepStatus,
} from '@/types/features';

interface AgentLiveFlowProps {
  progress: AgentLiveProgress;
  variant?: 'light' | 'dark';
}

const NODE_BASE =
  'shrink-0 min-w-[84px] rounded-lg border px-2 py-1.5 text-center';
const ACTIVE_STYLE =
  'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200';

interface NodeStyle {
  className: string;
  label: string;
  spinner?: boolean;
}

const STEP_STYLES: Record<AgentLiveStepStatus, NodeStyle> = {
  PENDING: { className: 'border-gray-200 text-gray-400', label: '대기' },
  ACTING: { className: ACTIVE_STYLE, label: '수행 중', spinner: true },
  JUDGING: { className: ACTIVE_STYLE, label: '판정 중', spinner: true },
  PASS: {
    className: 'border-green-300 bg-green-50 text-green-700',
    label: '✓ PASS',
  },
  FAIL: {
    className: 'border-red-300 bg-red-50 text-red-700',
    label: '✕ FAIL',
  },
  INCONCLUSIVE: {
    className: 'border-yellow-300 bg-yellow-50 text-yellow-700',
    label: '? 판정불가',
  },
};

const PRECONDITION_STYLES: Record<'RUNNING' | 'DONE' | 'INCOMPLETE', NodeStyle> = {
  RUNNING: { className: ACTIVE_STYLE, label: '이동 중', spinner: true },
  DONE: {
    className: 'border-green-300 bg-green-50 text-green-700',
    label: '✓ 완료',
  },
  INCOMPLETE: {
    className: 'border-yellow-300 bg-yellow-50 text-yellow-700',
    label: '⚠ 미도달',
  },
};

function stepTooltip(step: AgentLiveStep): string {
  const base = `동작: ${step.action}\n기대 결과: ${step.expected}`;
  return step.judgment ? `${base}\n판정: ${step.judgment}` : base;
}

interface FlowNodeProps {
  testId: string;
  status: string;
  title: string;
  name: string;
  style: NodeStyle;
}

function FlowNode({ testId, status, title, name, style }: FlowNodeProps) {
  return (
    <div
      data-testid={testId}
      data-status={status}
      title={title}
      className={`${NODE_BASE} ${style.className}`}
    >
      <div className="text-xs font-semibold">{name}</div>
      <div className="text-[11px] flex items-center justify-center gap-1">
        {style.spinner && (
          <span className="inline-block w-2.5 h-2.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        )}
        {style.label}
      </div>
    </div>
  );
}

function Arrow() {
  return <span className="self-center px-1 text-gray-300">⟶</span>;
}

interface DetailRowsProps {
  rows: { label: string; value: string }[];
  dark: boolean;
}

function DetailRows({ rows, dark }: DetailRowsProps) {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-0.5">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <span className={dark ? 'text-white/60' : 'text-gray-500'}>
            {row.label}
          </span>
          <span className={dark ? 'text-white' : 'text-gray-800'}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** AI 실행 진행 상황 — 헤더(TC), 노드 플로우, 현재 위치 상세 카드 */
export default function AgentLiveFlow({
  progress,
  variant = 'light',
}: AgentLiveFlowProps) {
  const dark = variant === 'dark';
  const { precondition, steps, phase, currentStep } = progress;
  const current = steps.find((s) => s.order === currentStep);

  let detailTitle: string | null = null;
  let detailRows: { label: string; value: string }[] = [];
  if (phase === 'PRECONDITION') {
    detailTitle = '전제조건 화면으로 이동 중';
    detailRows = precondition ? [{ label: '경로', value: precondition.text }] : [];
  } else if (current) {
    detailTitle = `Step ${current.order}/${steps.length} · ${
      phase === 'JUDGING' ? '기대 결과 판정 중' : '동작 수행 중'
    }`;
    detailRows = [
      { label: '동작', value: current.action },
      { label: '기대 결과', value: current.expected },
    ];
  }

  return (
    <div className="mb-2">
      <div
        data-testid="agent-live-tc"
        className="flex items-center gap-2 min-w-0 mb-2 text-sm"
      >
        <span className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-600 text-white">
          TC {progress.tcIndex}/{progress.tcTotal}
        </span>
        <span
          className={`shrink-0 font-mono text-xs ${
            dark ? 'text-white/60' : 'text-gray-500'
          }`}
        >
          T{progress.testCaseId}
        </span>
        <span className={`truncate ${dark ? 'text-white' : 'text-gray-800'}`}>
          {progress.testCaseTitle}
        </span>
      </div>

      <div
        data-testid="agent-live-flow"
        className="flex items-stretch overflow-x-auto pb-1 mb-2"
      >
        {precondition && (
          <>
            <FlowNode
              testId="agent-live-node-pre"
              status={precondition.status}
              title={`경로: ${precondition.text}`}
              name="전제조건"
              style={PRECONDITION_STYLES[precondition.status]}
            />
            {steps.length > 0 && <Arrow />}
          </>
        )}
        {steps.map((step, i) => (
          <div key={step.order} className="flex items-stretch">
            {i > 0 && <Arrow />}
            <FlowNode
              testId={`agent-live-node-${step.order}`}
              status={step.status}
              title={stepTooltip(step)}
              name={`Step ${step.order}`}
              style={STEP_STYLES[step.status]}
            />
          </div>
        ))}
      </div>

      {detailTitle && (
        <div
          data-testid="agent-live-detail"
          className={`rounded border px-3 py-2 text-sm ${
            dark
              ? 'border-white/20 bg-white/10'
              : 'border-indigo-100 bg-indigo-50'
          }`}
        >
          <div
            className={`text-xs font-semibold mb-1 ${
              dark ? 'text-white' : 'text-indigo-700'
            }`}
          >
            {detailTitle}
          </div>
          <DetailRows rows={detailRows} dark={dark} />
        </div>
      )}
    </div>
  );
}
