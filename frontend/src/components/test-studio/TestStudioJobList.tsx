import { useNavigate, useParams } from 'react-router-dom';
import { TestStudioJob } from '@/types/test-studio';
import TestStudioJobStatusBadge from './TestStudioJobStatusBadge';

interface TestStudioJobListProps {
  jobs: TestStudioJob[];
  isLoading: boolean;
  onDelete: (id: number) => Promise<void>;
}

/**
 * Test Studio — Job history list.
 * Shows title, status badge, counts, errors, and navigation to DRAFT TC view.
 */
export default function TestStudioJobList({
  jobs,
  isLoading,
  onDelete,
}: TestStudioJobListProps) {
  const navigate = useNavigate();
  const { companyId, productId } = useParams<{
    companyId: string;
    productId: string;
  }>();

  const handleViewDrafts = (jobId: number) => {
    navigate(
      `/features/companies/${companyId}/products/${productId}?status=DRAFT&jobId=${jobId}`
    );
  };

  const handleDelete = async (id: number) => {
    const ok = window.confirm('이 Job을 삭제하시겠습니까? (생성된 DRAFT TC는 유지됩니다)');
    if (!ok) return;
    await onDelete(id);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">Loading jobs...</div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-white border rounded-lg shadow p-8 text-center text-gray-500">
        아직 생성된 Job이 없습니다. 위 폼에서 새 Job을 생성해보세요.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-800">Job 히스토리</h2>
      {jobs.map((job) => (
        <div
          key={job.id}
          data-testid="test-studio-job-row"
          data-job-id={job.id}
          className="bg-white border rounded-lg shadow p-4 flex flex-col gap-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 text-lg" aria-hidden>
                  {job.sourceType === 'PDF' ? '📄' : '📝'}
                </span>
                <h3 className="font-semibold text-gray-800 truncate">
                  {job.sourceTitle}
                </h3>
                <TestStudioJobStatusBadge status={job.status} />
              </div>

              <div className="mt-1 text-xs text-gray-500">
                {new Date(job.createdAt).toLocaleString()}
                {job.status === 'DONE' && (
                  <span className="ml-3 text-green-700 font-medium">
                    {job.generatedCount}개 DRAFT 생성
                  </span>
                )}
                {job.status === 'FAILED' && job.errorMessage && (
                  <span className="ml-3 text-red-600">{job.errorMessage}</span>
                )}
                {job.status === 'PROCESSING' && (
                  <span className="ml-3 text-blue-600">진행 중…</span>
                )}
              </div>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              {job.status === 'DONE' && (
                <button
                  data-testid="test-studio-view-drafts"
                  onClick={() => handleViewDrafts(job.id)}
                  className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700
                             rounded hover:bg-indigo-200"
                >
                  DRAFT TC 보기
                </button>
              )}
              <button
                data-testid="test-studio-delete"
                onClick={() => handleDelete(job.id)}
                className="px-3 py-1 text-xs bg-red-100 text-red-600
                           rounded hover:bg-red-200"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
