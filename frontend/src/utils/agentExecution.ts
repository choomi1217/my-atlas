import type {
  AgentExecutionStatus,
  AgentJobListItem,
  AgentVerdict,
} from '@/types/features';

/** 대기·실행 중이면 아직 끝나지 않은 Job */
export const isActiveStatus = (status: AgentExecutionStatus): boolean =>
  status === 'PENDING' || status === 'RUNNING';

export const verdictClass = (verdict: AgentVerdict): string => {
  if (verdict === 'PASS') return 'bg-green-100 text-green-700';
  if (verdict === 'FAIL') return 'bg-red-100 text-red-700';
  return 'bg-yellow-100 text-yellow-700';
};

export const verdictLabel = (verdict: AgentVerdict): string =>
  verdict === 'INCONCLUSIVE' ? '판정불가' : verdict;

export const STATUS_LABEL: Record<AgentExecutionStatus, string> = {
  PENDING: '대기',
  RUNNING: '실행 중',
  DONE: '완료',
  FAILED: '실패',
  CANCELLED: '중지됨',
};

export const statusClass = (status: AgentExecutionStatus): string => {
  if (status === 'RUNNING') return 'bg-indigo-100 text-indigo-700';
  if (status === 'DONE') return 'bg-green-100 text-green-700';
  if (status === 'FAILED') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
};

export const formatDateTime = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString('ko-KR') : '-';

/** 목록 행 제목: SINGLE은 TC 제목, Phase 실행은 제품 > 버전 > Phase */
export const jobTitle = (item: AgentJobListItem): string => {
  const { job } = item;
  if (job.scope === 'SINGLE') {
    return item.testCaseTitle ?? `T${job.targetTestCaseId ?? ''}`;
  }
  const parts = [item.productName, item.versionName, item.phaseName].filter(
    (p): p is string => !!p
  );
  return parts.length > 0 ? parts.join(' > ') : `Job #${job.id}`;
};
