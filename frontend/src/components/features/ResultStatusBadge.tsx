import { RunResultStatus } from '@/types/features';

interface ResultStatusBadgeProps {
  status: RunResultStatus;
  size?: 'sm' | 'md' | 'lg';
}

export default function ResultStatusBadge({
  status,
  size = 'md',
}: ResultStatusBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const statusClasses: Record<RunResultStatus, string> = {
    [RunResultStatus.PASS]: 'bg-green-100 text-green-800 border border-green-300',
    [RunResultStatus.FAIL]: 'bg-red-100 text-red-800 border border-red-300',
    [RunResultStatus.BLOCKED]:
      'bg-yellow-100 text-yellow-800 border border-yellow-300',
    [RunResultStatus.SKIPPED]:
      'bg-gray-100 text-gray-800 border border-gray-300',
    [RunResultStatus.RETEST]:
      'bg-blue-100 text-blue-800 border border-blue-300',
    [RunResultStatus.UNTESTED]:
      'bg-gray-50 text-gray-600 border border-gray-200',
  };

  const statusLabels: Record<RunResultStatus, string> = {
    [RunResultStatus.PASS]: 'Pass',
    [RunResultStatus.FAIL]: 'Fail',
    [RunResultStatus.BLOCKED]: 'Blocked',
    [RunResultStatus.SKIPPED]: 'Skipped',
    [RunResultStatus.RETEST]: 'Retest',
    [RunResultStatus.UNTESTED]: 'Untested',
  };

  return (
    <span
      className={`font-medium rounded ${sizeClasses[size]} ${
        statusClasses[status]
      }`}
    >
      {statusLabels[status]}
    </span>
  );
}
