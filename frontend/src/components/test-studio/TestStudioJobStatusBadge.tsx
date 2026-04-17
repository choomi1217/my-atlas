import { TestStudioJobStatus } from '@/types/test-studio';

interface TestStudioJobStatusBadgeProps {
  status: TestStudioJobStatus;
}

const STATUS_CONFIG: Record<
  TestStudioJobStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: '대기 중',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  PROCESSING: {
    label: '처리 중',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  DONE: {
    label: '완료',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  FAILED: {
    label: '실패',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
};

/**
 * Status badge for Test Studio Jobs.
 * Color-coded per {@link TestStudioJobStatus}.
 */
export default function TestStudioJobStatusBadge({
  status,
}: TestStudioJobStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      data-testid="job-status-badge"
      data-status={status}
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
