import { PdfUploadJob } from '@/types/senior';

interface PdfJobStatusCardProps {
  job: PdfUploadJob;
}

export default function PdfJobStatusCard({ job }: PdfJobStatusCardProps) {
  const statusConfig = {
    PENDING: {
      bg: 'bg-gray-50 border-gray-200',
      text: 'text-gray-600',
      label: '대기 중',
      icon: (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    PROCESSING: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-600',
      label: '처리 중',
      icon: (
        <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      ),
    },
    DONE: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-600',
      label: '완료',
      icon: (
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    FAILED: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-600',
      label: '실패',
      icon: (
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
  };

  const config = statusConfig[job.status];

  return (
    <div className={`border rounded-lg p-3 ${config.bg}`}>
      <div className="flex items-center gap-2 mb-1">
        {config.icon}
        <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
        <span className="text-xs text-gray-500 ml-auto">{job.originalFilename}</span>
      </div>
      <p className="text-sm font-medium text-gray-800">{job.bookTitle}</p>
      {job.status === 'PROCESSING' && (
        <div className="w-full bg-blue-200 rounded-full h-1 mt-2 overflow-hidden">
          <div className="bg-blue-600 h-1 rounded-full animate-pulse w-full" />
        </div>
      )}
      {job.status === 'DONE' && job.totalChunks && (
        <p className="text-xs text-green-600 mt-1">{job.totalChunks}개 청크 생성</p>
      )}
      {job.status === 'FAILED' && job.errorMessage && (
        <p className="text-xs text-red-600 mt-1">{job.errorMessage}</p>
      )}
    </div>
  );
}
