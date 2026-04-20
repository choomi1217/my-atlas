import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Company, Product, Segment, TestCase, TestCaseStatus } from '@/types/features';
import { companyApi, productApi, segmentApi, testCaseApi } from '@/api/features';
import { useCompanyDraftTestCases } from '@/hooks/useCompanyDraftTestCases';
import { useCompanyTestStudioJobs } from '@/hooks/useCompanyTestStudioJobs';
import { TestStudioJob } from '@/types/test-studio';
import DraftTcCard from '@/components/test-studio/DraftTcCard';
import BulkApplyBar from '@/components/test-studio/BulkApplyBar';
import TestStudioJobStatusBadge from '@/components/test-studio/TestStudioJobStatusBadge';
import ManualPathAssignModal from '@/components/test-studio/ManualPathAssignModal';

/**
 * Test Studio Home — single-scroll dashboard for a Company.
 *
 * Sections (top to bottom):
 *   ⏳ 진행 중 Job     — PENDING / PROCESSING (live polling, always expanded)
 *   📋 완료된 Job     — DONE / FAILED (collapsible, collapsed by default)
 *   🤖 Path 미배정 DRAFT — with 추천 적용 / 일괄 적용 / 수동 지정
 *   ✅ Path 배정완료 DRAFT — already has a segment path
 *
 * Entry: "+ TestCase 생성 요청" button navigates to /test-studio/new?companyId=X.
 * Company selection is persisted in the URL (?companyId=X) so reload/sharing works.
 */
export default function TestStudioHomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const companyIdParam = searchParams.get('companyId');
  const companyId = companyIdParam ? Number(companyIdParam) : null;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);

  // Load companies once
  useEffect(() => {
    const load = async () => {
      setIsLoadingCompanies(true);
      try {
        const list = await companyApi.getAll();
        setCompanies(list);
      } catch (e) {
        console.error('Failed to load companies', e);
      } finally {
        setIsLoadingCompanies(false);
      }
    };
    load();
  }, []);

  const company = companies.find((c) => c.id === companyId) ?? null;

  const handleCompanyChange = (nextId: number | null) => {
    if (nextId == null) {
      searchParams.delete('companyId');
    } else {
      searchParams.set('companyId', String(nextId));
    }
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1">Test Studio</h1>
          <p className="text-gray-600 text-sm">
            디자인 문서 삽입 → TestCase 자동완성 → 원하는 Product, Path에 TestCase를 지정하세요.
          </p>
        </div>
        <button
          onClick={() =>
            navigate(
              companyId
                ? `/test-studio/new?companyId=${companyId}`
                : '/test-studio/new'
            )
          }
          disabled={!companyId}
          className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          data-testid="test-studio-new-job-button"
        >
          + TestCase 생성 요청
        </button>
      </div>

      {/* Company selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Company</label>
        <select
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white min-w-[220px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={companyId ?? ''}
          onChange={(e) =>
            handleCompanyChange(e.target.value ? Number(e.target.value) : null)
          }
          data-testid="test-studio-company-select"
          disabled={isLoadingCompanies}
        >
          <option value="">{isLoadingCompanies ? 'Loading...' : '— 선택 —'}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.isActive ? ' (활성)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Body */}
      {!companyId ? (
        <div className="rounded-md border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          Company를 선택하면 자동 생성된 TestCase와 Job 목록이 표시됩니다.
        </div>
      ) : company == null ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          해당 Company를 찾을 수 없습니다. 다른 Company를 선택해 주세요.
        </div>
      ) : (
        <CompanyDashboard companyId={companyId} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function CompanyDashboard({ companyId }: { companyId: number }) {
  const {
    testCases,
    isLoading: tcLoading,
    refresh: refreshTcs,
  } = useCompanyDraftTestCases(companyId);
  const {
    jobs,
    isLoading: jobsLoading,
    deleteJob,
  } = useCompanyTestStudioJobs(companyId);

  const [products, setProducts] = useState<Product[]>([]);
  const [segmentsByProduct, setSegmentsByProduct] = useState<Record<number, Segment[]>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [busyTcIds, setBusyTcIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [manualAssignTarget, setManualAssignTarget] = useState<TestCase | null>(null);

  // Load products + segments once per company
  useEffect(() => {
    const load = async () => {
      try {
        const ps = await productApi.getByCompanyId(companyId);
        setProducts(ps);
        const segEntries = await Promise.all(
          ps.map(async (p) => [p.id, await segmentApi.getByProductId(p.id)] as const)
        );
        const map: Record<number, Segment[]> = {};
        segEntries.forEach(([pid, segs]) => {
          map[pid] = segs;
        });
        setSegmentsByProduct(map);
      } catch (e) {
        console.error('Failed to load products/segments', e);
      }
    };
    load();
  }, [companyId]);

  const productNameById = useMemo(() => {
    const map: Record<number, string> = {};
    products.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [products]);

  const resolvePathLabel = (tc: TestCase): string => {
    if (!tc.path || tc.path.length === 0) return '';
    const segs = segmentsByProduct[tc.productId] ?? [];
    const byId = new Map<number, Segment>();
    segs.forEach((s) => byId.set(s.id, s));
    return tc.path.map((id) => byId.get(id)?.name ?? `#${id}`).join(' > ');
  };

  // --- Job partitioning ---
  const activeJobs = jobs.filter(
    (j) => j.status === 'PENDING' || j.status === 'PROCESSING'
  );
  const historyJobs = jobs.filter(
    (j) => j.status === 'DONE' || j.status === 'FAILED'
  );

  // --- TC partitioning ---
  const testStudioDrafts = testCases
    .filter((tc) => tc.testStudioJobId != null)
    .filter((tc) => tc.status === TestCaseStatus.DRAFT);
  const unassigned = testStudioDrafts.filter(
    (tc) => !tc.path || tc.path.length === 0
  );
  const assigned = testStudioDrafts.filter(
    (tc) => tc.path && tc.path.length > 0
  );
  const bulkEligible = unassigned.filter(
    (tc) => tc.suggestedSegmentPath && tc.suggestedSegmentPath.length > 0
  );
  const selectedEligible = bulkEligible.filter((tc) => selectedIds.has(tc.id));
  const allEligibleSelected =
    bulkEligible.length > 0 && selectedEligible.length === bulkEligible.length;

  // --- Handlers ---
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggleSelect = (id: number, next: boolean) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });
  };

  const handleSelectAll = (next: boolean) => {
    setSelectedIds(next ? new Set(bulkEligible.map((tc) => tc.id)) : new Set());
  };

  // Reload segments for a single product — needed after "apply suggestion" creates new ones.
  const refreshSegmentsForProduct = async (productId: number) => {
    try {
      const segs = await segmentApi.getByProductId(productId);
      setSegmentsByProduct((prev) => ({ ...prev, [productId]: segs }));
    } catch (e) {
      console.error('Failed to reload segments for product', productId, e);
    }
  };

  const handleApplySuggestion = async (tcId: number) => {
    setBusyTcIds((prev) => new Set(prev).add(tcId));
    try {
      const result = await testCaseApi.applySuggestedPath(tcId);
      if (result.error === 'NO_SUGGESTION') {
        showToast('Claude 추천 경로가 없어 적용할 수 없습니다. 수동 지정을 사용하세요.');
      } else {
        const createdPart =
          result.createdSegmentCount > 0
            ? `, Segment ${result.createdSegmentCount}개 신규 생성`
            : '';
        showToast(`추천 적용 완료 (${result.resolvedLength}단계${createdPart}).`);
      }
      const tc = testCases.find((t) => t.id === tcId);
      if (tc) await refreshSegmentsForProduct(tc.productId);
      await refreshTcs();
    } catch (e) {
      console.error('apply-suggested-path failed', e);
      showToast('추천 적용에 실패했습니다.');
    } finally {
      setBusyTcIds((prev) => {
        const s = new Set(prev);
        s.delete(tcId);
        return s;
      });
    }
  };

  const handleBulkApply = async () => {
    const ids = selectedEligible.map((tc) => tc.id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const results = await testCaseApi.bulkApplySuggestedPath(ids);
      const applied = results.filter((r) => r.resolvedLength > 0).length;
      const totalCreated = results.reduce((sum, r) => sum + (r.createdSegmentCount || 0), 0);
      showToast(
        `${applied}/${ids.length}건 적용${totalCreated > 0 ? `, Segment ${totalCreated}개 신규 생성` : ''}.`
      );
      setSelectedIds(new Set());
      // Reload segments for every affected product
      const affectedProductIds = new Set<number>();
      for (const id of ids) {
        const tc = testCases.find((t) => t.id === id);
        if (tc) affectedProductIds.add(tc.productId);
      }
      await Promise.all(
        Array.from(affectedProductIds).map((pid) => refreshSegmentsForProduct(pid))
      );
      await refreshTcs();
    } catch (e) {
      console.error('bulk apply failed', e);
      showToast('일괄 적용에 실패했습니다.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleManualAssign = (tcId: number) => {
    const tc = testCases.find((t) => t.id === tcId);
    if (!tc) return;
    setManualAssignTarget(tc);
  };

  const handleManualAssignSave = async (testCaseId: number, path: number[]) => {
    await testCaseApi.updatePath(testCaseId, path);
    showToast(path.length === 0 ? '경로를 미배정으로 되돌렸습니다.' : 'Path를 저장했습니다.');
    await refreshTcs();
  };

  const handleDeleteJob = async (jobId: number) => {
    const ok = window.confirm(
      '이 Job을 삭제하시겠습니까? (이미 생성된 DRAFT TC는 유지됩니다)'
    );
    if (!ok) return;
    try {
      await deleteJob(jobId);
      showToast('Job을 삭제했습니다.');
    } catch (e) {
      console.error('deleteJob failed', e);
      showToast('Job 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-md bg-indigo-50 border border-indigo-200 px-4 py-2 text-sm text-indigo-700">
          {toast}
        </div>
      )}

      {/* ⏳ 진행 중 Job */}
      <section data-testid="active-jobs-section">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          ⏳ 진행 중 Job ({activeJobs.length})
        </h2>
        {jobsLoading && jobs.length === 0 ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : activeJobs.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
            진행 중인 Job이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {activeJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                companyId={companyId}
                productName={productNameById[job.productId]}
                onDelete={handleDeleteJob}
              />
            ))}
          </div>
        )}
      </section>

      {/* 📋 완료된 Job (collapsible) */}
      <section data-testid="history-jobs-section">
        <button
          className="w-full flex items-center justify-between text-left py-2"
          onClick={() => setHistoryOpen((v) => !v)}
          data-testid="history-toggle"
        >
          <h2 className="text-lg font-semibold text-gray-900">
            📋 완료된 Job ({historyJobs.length})
          </h2>
          <span className="text-xs text-gray-500">
            {historyOpen ? '▾ 접기' : '▸ 펼치기'}
          </span>
        </button>
        {historyOpen && (
          <div className="mt-2 space-y-2">
            {historyJobs.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                완료된 Job이 없습니다.
              </div>
            ) : (
              historyJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  companyId={companyId}
                  productName={productNameById[job.productId]}
                  onDelete={handleDeleteJob}
                />
              ))
            )}
          </div>
        )}
      </section>

      {/* 🤖 Path 미배정 DRAFT */}
      <section data-testid="unassigned-section">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          🤖 자동 생성 / Path 미배정 ({unassigned.length})
        </h2>

        {bulkEligible.length > 0 && (
          <div className="mb-3">
            <BulkApplyBar
              selectedCount={selectedEligible.length}
              totalEligible={bulkEligible.length}
              onSelectAll={handleSelectAll}
              onApplyAll={handleBulkApply}
              busy={bulkBusy}
              allSelected={allEligibleSelected}
            />
          </div>
        )}

        {tcLoading && testCases.length === 0 ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : unassigned.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Path 미배정 DRAFT TC가 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {unassigned.map((tc) => (
              <DraftTcCard
                key={tc.id}
                testCase={tc}
                productName={productNameById[tc.productId]}
                isSelected={selectedIds.has(tc.id)}
                onToggleSelect={
                  tc.suggestedSegmentPath && tc.suggestedSegmentPath.length > 0
                    ? handleToggleSelect
                    : undefined
                }
                onApplySuggestion={handleApplySuggestion}
                onManualAssign={handleManualAssign}
                showCheckbox={
                  !!tc.suggestedSegmentPath && tc.suggestedSegmentPath.length > 0
                }
                showSuggestion
                busy={busyTcIds.has(tc.id) || bulkBusy}
              />
            ))}
          </div>
        )}
      </section>

      {/* ✅ Path 배정완료 DRAFT */}
      <section data-testid="assigned-section">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          ✅ 자동 생성 / Path 배정완료 ({assigned.length})
        </h2>
        {assigned.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Path가 배정된 DRAFT TC가 아직 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {assigned.map((tc) => (
              <DraftTcCard
                key={tc.id}
                testCase={tc}
                productName={productNameById[tc.productId]}
                segmentPathLabel={resolvePathLabel(tc)}
                onManualAssign={handleManualAssign}
                busy={busyTcIds.has(tc.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Manual Path assign modal */}
      <ManualPathAssignModal
        isOpen={manualAssignTarget != null}
        testCase={manualAssignTarget}
        segments={
          manualAssignTarget
            ? segmentsByProduct[manualAssignTarget.productId] ?? []
            : []
        }
        onClose={() => setManualAssignTarget(null)}
        onSave={handleManualAssignSave}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface JobRowProps {
  job: TestStudioJob;
  companyId: number;
  productName?: string;
  onDelete: (id: number) => Promise<void>;
}

function JobRow({ job, companyId, productName, onDelete }: JobRowProps) {
  const navigate = useNavigate();
  const handleViewDrafts = () => {
    navigate(
      `/features/companies/${companyId}/products/${job.productId}?status=DRAFT&jobId=${job.id}`
    );
  };
  return (
    <div
      className="bg-white border rounded-lg shadow-sm p-3 flex items-center justify-between gap-3"
      data-testid="company-job-row"
      data-job-id={job.id}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span aria-hidden>{job.sourceType === 'PDF' ? '📄' : '📝'}</span>
          <h3 className="font-medium text-sm truncate">{job.sourceTitle}</h3>
          <TestStudioJobStatusBadge status={job.status} />
        </div>
        <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
          {productName && <span>Product: {productName}</span>}
          <span>{new Date(job.createdAt).toLocaleString()}</span>
          {job.status === 'DONE' && (
            <span className="text-green-700 font-medium">
              {job.generatedCount}개 DRAFT 생성
            </span>
          )}
          {job.status === 'FAILED' && job.errorMessage && (
            <span className="text-red-600">{job.errorMessage}</span>
          )}
          {job.status === 'PROCESSING' && (
            <span className="text-blue-600">진행 중…</span>
          )}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {job.status === 'DONE' && (
          <button
            onClick={handleViewDrafts}
            className="px-2.5 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
            data-testid="company-job-view-drafts"
          >
            DRAFT TC 보기
          </button>
        )}
        <button
          onClick={() => onDelete(job.id)}
          className="px-2.5 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
          data-testid="company-job-delete"
        >
          삭제
        </button>
      </div>
    </div>
  );
}
