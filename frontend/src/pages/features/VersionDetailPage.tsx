import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Version, TestRun } from '@/types/features';
import {
  versionApi,
  testRunApi,
  versionPhaseApi,
  productApi,
} from '@/api/features';
import VersionCopyModal from '@/components/features/VersionCopyModal';
import PhaseFormModal from '@/components/features/PhaseFormModal';
import ProgressStats from '@/components/features/ProgressStats';

export default function VersionDetailPage() {
  const { companyId, productId, versionId } = useParams<{
    companyId: string;
    productId: string;
    versionId: string;
  }>();
  const navigate = useNavigate();

  const [version, setVersion] = useState<Version | null>(null);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [productName, setProductName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!versionId || !productId) return;
      try {
        setIsLoading(true);
        setError(null);

        // Load product name
        const products = await productApi.getByCompanyId(Number(companyId));
        const product = products.find((p) => p.id === Number(productId));
        if (product) {
          setProductName(product.name);
        }

        // Load version
        const v = await versionApi.getById(Number(versionId));
        setVersion(v);

        // Load test runs
        const runs = await testRunApi.getByProductId(Number(productId));
        setTestRuns(runs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load version');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [versionId, productId, companyId]);

  const handleCopy = async (data: {
    newName: string;
    newReleaseDate: string;
  }) => {
    if (!version) return;
    try {
      const copied = await versionApi.copy(
        version.id,
        data.newName,
        data.newReleaseDate || null
      );
      // Navigate to new version
      navigate(
        `/features/companies/${companyId}/products/${productId}/versions/${copied.id}`
      );
    } catch (err) {
      console.error('Failed to copy version:', err);
    }
  };

  const handleAddPhase = async (data: {
    phaseName: string;
    testRunId: number;
  }) => {
    if (!version) return;
    try {
      await versionPhaseApi.addPhase(version.id, data.phaseName, data.testRunId);
      // Reload version
      const v = await versionApi.getById(version.id);
      setVersion(v);
    } catch (err) {
      console.error('Failed to add phase:', err);
    }
  };

  const handleDeletePhase = async (phaseId: number) => {
    if (!confirm('이 Phase를 삭제하시겠습니까?')) return;
    if (!version) return;
    try {
      await versionPhaseApi.deletePhase(version.id, phaseId);
      // Reload version
      const v = await versionApi.getById(version.id);
      setVersion(v);
    } catch (err) {
      console.error('Failed to delete phase:', err);
    }
  };

  const handleDeleteVersion = async () => {
    if (!confirm('이 버전을 삭제하시겠습니까?')) return;
    if (!version) return;
    try {
      await versionApi.delete(version.id);
      navigate(
        `/features/companies/${companyId}/products/${productId}/versions`
      );
    } catch (err) {
      console.error('Failed to delete version:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-600">버전 로드 중...</div>
    );
  }

  if (!version) {
    return (
      <div className="p-6 text-center text-gray-600">버전을 찾을 수 없습니다</div>
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

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              {version.isReleaseDatePassed && (
                <span className="text-2xl">⚠️</span>
              )}
              <h1 className="text-3xl font-bold text-gray-800">
                {version.name}
              </h1>
            </div>
            <p className="text-gray-600 mt-1">Product: {productName}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsCopyModalOpen(true)}
              className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
            >
              분기
            </button>
            <button
              onClick={handleDeleteVersion}
              className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50"
            >
              삭제
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {/* Warning Banner */}
      {version.isReleaseDatePassed && version.warningMessage && (
        <div className="mb-4 p-4 bg-orange-100 border border-orange-300 text-orange-800 rounded-lg">
          <p className="font-semibold">{version.warningMessage}</p>
          <p className="text-sm mt-2">
            계속 진행하거나 버전을 분기하여 새로운 일정으로 계획할 수 있습니다.
          </p>
        </div>
      )}

      {/* Version Info */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-600">릴리스 예정일</p>
            <p className="text-sm font-semibold text-gray-800">
              {version.releaseDate
                ? new Date(version.releaseDate).toLocaleDateString()
                : '미정'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">복사 출처</p>
            <p className="text-sm font-semibold text-gray-800">
              {version.copiedFrom ? `Version #${version.copiedFrom}` : '신규'}
            </p>
          </div>
          {version.description && (
            <div className="col-span-2">
              <p className="text-xs text-gray-600">설명</p>
              <p className="text-sm text-gray-800">{version.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
        <h3 className="font-semibold text-gray-800 mb-3">전체 진행률</h3>
        <ProgressStats stats={version.totalProgress} showDetailed={true} />
      </div>

      {/* Phases */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Phase</h2>
          <button
            onClick={() => setIsPhaseModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            + Phase 추가
          </button>
        </div>

        {version.phases.length === 0 ? (
          <p className="text-gray-500">Phase가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {version.phases.map((phase, index) => (
              <div
                key={phase.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {index + 1}️⃣ {phase.phaseName}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      TestRun: {phase.testRunName} ({phase.testRunTestCaseCount}{' '}
                      TC)
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeletePhase(phase.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    삭제
                  </button>
                </div>

                <ProgressStats
                  stats={phase.phaseProgress}
                  title="Phase 진행률"
                  showDetailed={true}
                />

                <button
                  onClick={() =>
                    navigate(
                      `/features/companies/${companyId}/products/${productId}/versions/${version.id}/phases/${phase.id}`
                    )
                  }
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                >
                  결과 보기 →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {version && (
        <>
          <VersionCopyModal
            isOpen={isCopyModalOpen}
            onClose={() => setIsCopyModalOpen(false)}
            onSubmit={handleCopy}
            versionName={version.name}
          />
          <PhaseFormModal
            isOpen={isPhaseModalOpen}
            onClose={() => setIsPhaseModalOpen(false)}
            onSubmit={handleAddPhase}
            availableTestRuns={testRuns}
          />
        </>
      )}
    </div>
  );
}
