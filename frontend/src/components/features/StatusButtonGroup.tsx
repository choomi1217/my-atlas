import { RunResultStatus } from '@/types/features';

interface StatusButtonGroupProps {
  current: RunResultStatus;
  onChange: (status: RunResultStatus) => void;
  disabled?: boolean;
}

const STATUS_CONFIG: Record<
  Exclude<RunResultStatus, RunResultStatus.UNTESTED>,
  { label: string; abbr: string; bg: string; bgActive: string; text: string; border: string }
> = {
  [RunResultStatus.PASS]: {
    label: 'Pass',
    abbr: 'P',
    bg: 'bg-green-50 hover:bg-green-100',
    bgActive: 'bg-green-600 text-white ring-2 ring-green-300',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  [RunResultStatus.FAIL]: {
    label: 'Fail',
    abbr: 'F',
    bg: 'bg-red-50 hover:bg-red-100',
    bgActive: 'bg-red-600 text-white ring-2 ring-red-300',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  [RunResultStatus.BLOCKED]: {
    label: 'Blocked',
    abbr: 'B',
    bg: 'bg-yellow-50 hover:bg-yellow-100',
    bgActive: 'bg-yellow-500 text-white ring-2 ring-yellow-300',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  [RunResultStatus.SKIPPED]: {
    label: 'Skip',
    abbr: 'S',
    bg: 'bg-gray-50 hover:bg-gray-100',
    bgActive: 'bg-gray-500 text-white ring-2 ring-gray-300',
    text: 'text-gray-600',
    border: 'border-gray-200',
  },
  [RunResultStatus.RETEST]: {
    label: 'Retest',
    abbr: 'R',
    bg: 'bg-blue-50 hover:bg-blue-100',
    bgActive: 'bg-blue-600 text-white ring-2 ring-blue-300',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
};

const STATUSES = [
  RunResultStatus.PASS,
  RunResultStatus.FAIL,
  RunResultStatus.BLOCKED,
  RunResultStatus.SKIPPED,
  RunResultStatus.RETEST,
] as const;

export default function StatusButtonGroup({
  current,
  onChange,
  disabled = false,
}: StatusButtonGroupProps) {
  return (
    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
      {STATUSES.map((status) => {
        const config = STATUS_CONFIG[status];
        const isActive = current === status;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (isActive) {
                onChange(RunResultStatus.UNTESTED);
              } else {
                onChange(status);
              }
            }}
            title={config.label}
            className={`px-2 py-0.5 text-xs font-semibold rounded border transition-all
              ${isActive ? config.bgActive : `${config.bg} ${config.text} ${config.border}`}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {isActive ? `✓ ${config.abbr}` : config.abbr}
          </button>
        );
      })}
    </div>
  );
}
