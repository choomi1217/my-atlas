import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Version, RunResultStatus } from '@/types/features';
import { versionApi, testResultApi } from '@/api/features';
import ProgressStats from '@/components/features/ProgressStats';
import ResultStatusBadge from '@/components/features/ResultStatusBadge';

export default function VersionPhaseDetailPage() {
  const { versionId, phaseId } = useParams<{
    companyId: string;
    productId: string;
    versionId: string;
    phaseId: string;
  }>();
  const navigate = useNavigate();

  const [version, setVersion] = useState<Version | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!versionId) return;
      try {
        setIsLoading(true);
        setError(null);

        // Load version
        const v = await versionApi.getById(Number(versionId));
        setVersion(v);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load version');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [versionId]);

  const handleResultUpdate = async (resultId: number, status: RunResultStatus) => {
    if (!versionId) return;
    try {
      await testResultApi.updateResult(Number(versionId), resultId, status);
      // Reload version
      const v = await versionApi.getById(Number(versionId));
      setVersion(v);
    } catch (err) {
      console.error('Failed to update result:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-600">Phase 로드 중...</div>
    );
  }

  if (!version) {
    return (
      <div className="p-6 text-center text-gray-600">버전을 찾을 수 없습니다</div>
    );
  }

  const phase = version.phases.find((p) => p.id === Number(phaseId));
  if (!phase) {
    return (
      <div className="p-6 text-center text-gray-600">Phase를 찾을 수 없습니다</div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 hover:text-blue-700 text-sm mb-2"
        >
          ← 돌아가기
        </button>

        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {version.name} &gt; {phase.phaseName}
        </h1>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-gray-600">
              TestRun: {phase.testRunName} ({phase.testRunTestCaseCount} TC)
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {/* Phase Progress */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
        <h3 className="font-semibold text-gray-800 mb-3">Phase 진행률</h3>
        <ProgressStats stats={phase.phaseProgress} showDetailed={true} />
      </div>

      {/* Test Results */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">테스트 결과</h2>

        <div className="space-y-2">
          {phase.phaseProgress.total === 0 ? (
            <p className="text-gray-500">이 Phase의 테스트 결과가 없습니다.</p>
          ) : (
            Array.from({ length: phase.phaseProgress.total }).map((_, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition flex justify-between items-start"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">
                      TC #{idx + 1}
                    </span>
                    <ResultStatusBadge
                      status={RunResultStatus.PASS}
                      size="sm"
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">테스트 케이스 제목</p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-gray-600 mb-2">결과 수정</p>
                  <select
                    defaultValue={RunResultStatus.PASS}
                    onChange={(e) =>
                      handleResultUpdate(idx + 1, e.target.value as RunResultStatus)
                    }
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(RunResultStatus).map(([, value]) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
