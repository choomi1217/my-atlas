import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Version, TestRun, TestCase, Segment, FailedTestCaseInfo } from '@/types/features';
import {
  versionApi,
  testRunApi,
  versionPhaseApi,
  productApi,
  testCaseApi,
  segmentApi,
} from '@/api/features';
import VersionCopyModal from '@/components/features/VersionCopyModal';
import ProgressStats from '@/components/features/ProgressStats';
import TestCaseGroupSelector from '@/components/features/TestCaseGroupSelector';

export default function VersionDetailPage() {
  const { companyId, productId, versionId } = useParams<{
    companyId: string;
    productId: string;
    versionId: string;
  }>();
  const navigate = useNavigate();

  const [version, setVersion] = useState<Version | null>(null);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [failedTcs, setFailedTcs] = useState<FailedTestCaseInfo[]>([]);
  const [productName, setProductName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copiedFromName, setCopiedFromName] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editReleaseDate, setEditReleaseDate] = useState('');

  // Inline Phase creation state
  const [isCreatingPhase, setIsCreatingPhase] = useState(false);
  const [phaseName, setPhaseName] = useState('');
  const [selectedTestRunIds, setSelectedTestRunIds] = useState<number[]>([]);
  const [selectedTcIds, setSelectedTcIds] = useState<Set<number>>(new Set());
  const [selectedFailedTcIds, setSelectedFailedTcIds] = useState<Set<number>>(new Set());
  const [isSubmittingPhase, setIsSubmittingPhase] = useState(false);
  const [showTcSelector, setShowTcSelector] = useState(false);
  const [showFailedTcs, setShowFailedTcs] = useState(false);

  useEffect(() => {
    loadData();
  }, [versionId, productId, companyId]);

  const loadData = async () => {
    if (!versionId || !productId) return;
    try {
      setIsLoading(true);
      setError(null);

      const products = await productApi.getByCompanyId(Number(companyId));
      const product = products.find((p) => p.id === Number(productId));
      if (product) setProductName(product.name);

      const [v, runs, tcs, segs] = await Promise.all([
        versionApi.getById(Number(versionId)),
        testRunApi.getByProductId(Number(productId)),
        testCaseApi.getByProductId(Number(productId)),
        segmentApi.getByProductId(Number(productId)),
      ]);
      setVersion(v);
      setTestRuns(runs);
      setAllTestCases(tcs);
      setSegments(segs);

      // Load failed TCs
      try {
        const failed = await versionApi.getFailedTestCases(Number(versionId));
        setFailedTcs(failed);
      } catch {
        setFailedTcs([]);
      }

      if (v.copiedFrom) {
        try {
          const source = await versionApi.getById(v.copiedFrom);
          setCopiedFromName(source.name);
        } catch {
          setCopiedFromName(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (data: { newName: string; newReleaseDate: string }) => {
    if (!version) return;
    try {
      const copied = await versionApi.copy(version.id, data.newName, data.newReleaseDate || null);
      navigate(`/features/companies/${companyId}/products/${productId}/versions/${copied.id}`);
    } catch (err) {
      console.error('Failed to copy version:', err);
    }
  };

  const handleDeletePhase = async (phaseId: number) => {
    if (!confirm('이 Phase를 삭제하시겠습니까?')) return;
    if (!version) return;
    try {
      await versionPhaseApi.deletePhase(version.id, phaseId);
      const v = await versionApi.getById(version.id);
      setVersion(v);
    } catch (err) {
      console.error('Failed to delete phase:', err);
    }
  };

  const handleStartEdit = () => {
    if (!version) return;
    setEditName(version.name);
    setEditDescription(version.description || '');
    setEditReleaseDate(version.releaseDate || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!version || !editName.trim()) return;
    try {
      const updated = await versionApi.update(
        version.id, editName.trim(),
        editDescription.trim() || undefined,
        editReleaseDate || undefined
      );
      setVersion(updated);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update version:', err);
    }
  };

  const handleDeleteVersion = async () => {
    if (!confirm('이 버전을 삭제하시겠습니까?')) return;
    if (!version) return;
    try {
      await versionApi.delete(version.id);
      navigate(`/features/companies/${companyId}/products/${productId}/versions`);
    } catch (err) {
      console.error('Failed to delete version:', err);
    }
  };

  // Phase creation
  const toggleTestRun = (id: number) => {
    setSelectedTestRunIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleFailedTc = (tcId: number) => {
    setSelectedFailedTcIds((prev) => {
      const next = new Set(prev);
      if (next.has(tcId)) next.delete(tcId);
      else next.add(tcId);
      return next;
    });
  };

  const totalSelectedTcCount = useMemo(() => {
    const fromRuns = testRuns
      .filter((tr) => selectedTestRunIds.includes(tr.id))
      .reduce((sum, tr) => sum + tr.testCaseCount, 0);
    return fromRuns + selectedTcIds.size + selectedFailedTcIds.size;
  }, [selectedTestRunIds, selectedTcIds, selectedFailedTcIds, testRuns]);

  const handleCreatePhase = async () => {
    if (!version || !phaseName.trim()) return;
    if (selectedTestRunIds.length === 0 && selectedTcIds.size === 0 && selectedFailedTcIds.size === 0) {
      alert('TestRun 또는 TestCase를 1개 이상 선택하세요');
      return;
    }
    setIsSubmittingPhase(true);
    try {
      const directTcIds = [...selectedTcIds, ...selectedFailedTcIds];
      await versionPhaseApi.addPhase(
        version.id,
        phaseName.trim(),
        selectedTestRunIds,
        directTcIds.length > 0 ? directTcIds : undefined
      );
      // Reset form
      setPhaseName('');
      setSelectedTestRunIds([]);
      setSelectedTcIds(new Set());
      setSelectedFailedTcIds(new Set());
      setIsCreatingPhase(false);
      setShowTcSelector(false);
      setShowFailedTcs(false);
      // Reload
      const v = await versionApi.getById(version.id);
      setVersion(v);
      const failed = await versionApi.getFailedTestCases(version.id);
      setFailedTcs(failed);
    } catch (err) {
      console.error('Failed to add phase:', err);
      alert('Phase 생성에 실패했습니다.');
    } finally {
      setIsSubmittingPhase(false);
    }
  };

  const cancelPhaseCreation = () => {
    setIsCreatingPhase(false);
    setPhaseName('');
    setSelectedTestRunIds([]);
    setSelectedTcIds(new Set());
    setSelectedFailedTcIds(new Set());
    setShowTcSelector(false);
    setShowFailedTcs(false);
  };

  if (isLoading) {
    return <div className="p-6 text-center text-gray-600">버전 로드 중...</div>;
  }

  if (!version) {
    return <div className="p-6 text-center text-gray-600">버전을 찾을 수 없습니다</div>;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:text-blue-700 text-sm mb-2">
          ← 돌아가기
        </button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              {version.isReleaseDatePassed && <span className="text-2xl">⚠️</span>}
              <h1 className="text-3xl font-bold text-gray-800">{version.name}</h1>
            </div>
            <p className="text-gray-600 mt-1">Product: {productName}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleStartEdit} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
            <button onClick={() => setIsCopyModalOpen(true)} className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">버전 복사</button>
            <button onClick={handleDeleteVersion} className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50">삭제</button>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>}

      {version.isReleaseDatePassed && version.warningMessage && (
        <div className="mb-4 p-4 bg-orange-100 border border-orange-300 text-orange-800 rounded-lg">
          <p className="font-semibold">{version.warningMessage}</p>
        </div>
      )}

      {/* Version Info */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Description</label>
              <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Release Date</label>
              <input type="date" value={editReleaseDate} onChange={(e) => setEditReleaseDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} disabled={!editName.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">Save</button>
              <button onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600">릴리스 예정일</p>
              <p className="text-sm font-semibold text-gray-800">
                {version.releaseDate ? new Date(version.releaseDate).toLocaleDateString() : '미정'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">복사 출처</p>
              <p className="text-sm font-semibold text-gray-800">
                {version.copiedFrom ? copiedFromName || `ID: ${version.copiedFrom}` : '신규'}
              </p>
            </div>
            {version.description && (
              <div className="col-span-2">
                <p className="text-xs text-gray-600">설명</p>
                <p className="text-sm text-gray-800">{version.description}</p>
              </div>
            )}
          </div>
        )}
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
          {!isCreatingPhase && (
            <button
              onClick={() => setIsCreatingPhase(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              + Phase 추가
            </button>
          )}
        </div>

        {/* Inline Phase Creation */}
        {isCreatingPhase && (
          <div className="border-2 border-blue-300 rounded-lg p-5 mb-6 bg-blue-50">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Phase 생성</h3>
            <div className="space-y-4">
              {/* Phase Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phase 이름 *</label>
                <input
                  type="text"
                  value={phaseName}
                  onChange={(e) => setPhaseName(e.target.value)}
                  placeholder="예: 1차 기능 테스트"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* TestRun Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TestRun 선택</label>
                {testRuns.length === 0 ? (
                  <p className="text-sm text-gray-500">사용 가능한 TestRun이 없습니다.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto bg-white">
                    {testRuns.map((tr) => (
                      <label key={tr.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                        <input type="checkbox" checked={selectedTestRunIds.includes(tr.id)} onChange={() => toggleTestRun(tr.id)}
                          className="rounded border-gray-300 text-blue-600" />
                        <span className="text-sm flex-1">{tr.name}</span>
                        <span className="text-xs text-gray-400">{tr.testCaseCount} TC</span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedTestRunIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    선택: {selectedTestRunIds.length}개, 총{' '}
                    {testRuns.filter((tr) => selectedTestRunIds.includes(tr.id)).reduce((s, tr) => s + tr.testCaseCount, 0)} TC
                  </p>
                )}
              </div>

              {/* Individual TC Selection (collapsible) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowTcSelector(!showTcSelector)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {showTcSelector ? '▼ TC 개별 선택 접기' : '▶ TC 개별 선택 펼치기'} ({selectedTcIds.size}개 선택)
                </button>
                {showTcSelector && (
                  <div className="mt-2 border border-gray-200 rounded-lg bg-white max-h-64 overflow-y-auto">
                    <TestCaseGroupSelector
                      segments={segments}
                      testCases={allTestCases}
                      selectedIds={selectedTcIds}
                      onChange={setSelectedTcIds}
                    />
                  </div>
                )}
              </div>

              {/* Failed TC Selection */}
              {failedTcs.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowFailedTcs(!showFailedTcs)}
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    {showFailedTcs ? '▼' : '▶'} Failed TC 추가 ({failedTcs.length}건, {selectedFailedTcIds.size}개 선택)
                  </button>
                  {showFailedTcs && (
                    <div className="mt-2 border border-orange-200 rounded-lg bg-orange-50 max-h-48 overflow-y-auto">
                      {failedTcs.map((ftc) => (
                        <label key={ftc.testCaseId}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-orange-100 cursor-pointer border-b border-orange-100 last:border-b-0">
                          <input type="checkbox" checked={selectedFailedTcIds.has(ftc.testCaseId)}
                            onChange={() => toggleFailedTc(ftc.testCaseId)}
                            className="rounded border-orange-300 text-orange-600" />
                          <span className="text-sm flex-1">
                            TC-{ftc.testCaseId}: {ftc.testCaseTitle}
                          </span>
                          <span className="text-xs text-orange-500">
                            {ftc.failedInPhaseName}에서 FAIL {ftc.ticketCount > 0 && `| ${ftc.ticketCount}건 티켓`}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Summary & Actions */}
              <div className="flex justify-between items-center pt-3 border-t">
                <p className="text-sm text-gray-600">
                  총 TC: ~{totalSelectedTcCount}개 (중복 제거 후 변동 가능)
                </p>
                <div className="flex gap-2">
                  <button onClick={cancelPhaseCreation}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                    취소
                  </button>
                  <button onClick={handleCreatePhase} disabled={isSubmittingPhase || !phaseName.trim()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {isSubmittingPhase ? 'Phase 생성 중...' : 'Phase 생성'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase List */}
        {version.phases.length === 0 && !isCreatingPhase ? (
          <p className="text-gray-500">Phase가 없습니다. Phase를 추가하여 테스트를 시작하세요.</p>
        ) : (
          <div className="space-y-3">
            {version.phases.map((phase, index) => (
              <div
                key={phase.id}
                onClick={() =>
                  navigate(`/features/companies/${companyId}/products/${productId}/versions/${version.id}/phases/${phase.id}`)
                }
                className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {index + 1}️⃣ {phase.phaseName}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {phase.testRuns.length > 0 && (
                        <>TestRun: {phase.testRuns.map((tr) => `${tr.testRunName} (${tr.testCaseCount} TC)`).join(', ')} — </>
                      )}
                      총 {phase.totalTestCaseCount} TC
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePhase(phase.id); }}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    삭제
                  </button>
                </div>
                <ProgressStats stats={phase.phaseProgress} title="Phase 진행률" showDetailed={true} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Copy Modal */}
      {version && (
        <VersionCopyModal
          isOpen={isCopyModalOpen}
          onClose={() => setIsCopyModalOpen(false)}
          onSubmit={handleCopy}
          versionName={version.name}
        />
      )}
    </div>
  );
}
