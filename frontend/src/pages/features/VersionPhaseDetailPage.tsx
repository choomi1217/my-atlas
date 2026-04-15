import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Version,
  TestResult,
  TestResultComment,
  TestCase,
  RunResultStatus,
  ProgressStats,
} from '@/types/features';
import { versionApi, testResultApi, testCaseApi, testResultCommentApi } from '@/api/features';
import ProgressStatsComponent from '@/components/features/ProgressStats';
import ResultStatusBadge from '@/components/features/ResultStatusBadge';
import StatusButtonGroup from '@/components/features/StatusButtonGroup';
import CommentThread from '@/components/features/CommentThread';
import ImageRefText from '@/components/features/ImageRefText';

export default function VersionPhaseDetailPage() {
  const { productId, versionId, phaseId } = useParams<{
    companyId: string;
    productId: string;
    versionId: string;
    phaseId: string;
  }>();
  const navigate = useNavigate();

  const [version, setVersion] = useState<Version | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedResultId, setExpandedResultId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, TestResultComment[]>>({});

  useEffect(() => {
    const loadData = async () => {
      if (!versionId || !phaseId || !productId) return;
      try {
        setIsLoading(true);
        setError(null);

        const [v, r, tc] = await Promise.all([
          versionApi.getById(Number(versionId)),
          testResultApi.getByVersionPhaseId(Number(versionId), Number(phaseId)),
          testCaseApi.getByProductId(Number(productId)),
        ]);

        setVersion(v);
        setResults(r);
        setTestCases(tc);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [versionId, phaseId, productId]);

  const liveStats = useMemo((): ProgressStats => {
    const total = results.length;
    let pass = 0, fail = 0, blocked = 0, skipped = 0, retest = 0, untested = 0;
    for (const r of results) {
      switch (r.status) {
        case RunResultStatus.PASS: pass++; break;
        case RunResultStatus.FAIL: fail++; break;
        case RunResultStatus.BLOCKED: blocked++; break;
        case RunResultStatus.SKIPPED: skipped++; break;
        case RunResultStatus.RETEST: retest++; break;
        default: untested++; break;
      }
    }
    return { total, completed: pass + fail + blocked + skipped + retest, pass, fail, blocked, skipped, retest, untested };
  }, [results]);

  const handleStatusChange = async (resultId: number, newStatus: RunResultStatus) => {
    if (!versionId) return;
    try {
      const updated = await testResultApi.updateResult(
        Number(versionId),
        resultId,
        newStatus
      );
      setResults((prev) =>
        prev.map((r) => (r.id === resultId ? updated : r))
      );
    } catch (err) {
      console.error('Failed to update result:', err);
    }
  };

  const loadComments = useCallback(async (resultId: number) => {
    if (!versionId) return;
    try {
      const data = await testResultCommentApi.getComments(Number(versionId), resultId);
      setComments((prev) => ({ ...prev, [resultId]: data }));
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  }, [versionId]);

  const getTestCaseDetail = (testCaseId: number): TestCase | undefined => {
    return testCases.find((tc) => tc.id === testCaseId);
  };

  const toggleExpand = (resultId: number) => {
    const nextId = expandedResultId === resultId ? null : resultId;
    setExpandedResultId(nextId);
    if (nextId !== null && !comments[nextId]) {
      loadComments(nextId);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center text-gray-600">Loading...</div>;
  }

  if (!version) {
    return <div className="p-6 text-center text-gray-600">Version not found</div>;
  }

  const phase = version.phases.find((p) => p.id === Number(phaseId));
  if (!phase) {
    return <div className="p-6 text-center text-gray-600">Phase not found</div>;
  }

  const statusColors: Record<RunResultStatus, string> = {
    [RunResultStatus.PASS]: 'bg-green-100 border-green-300',
    [RunResultStatus.FAIL]: 'bg-red-100 border-red-300',
    [RunResultStatus.BLOCKED]: 'bg-gray-200 border-gray-400',
    [RunResultStatus.SKIPPED]: 'bg-yellow-50 border-yellow-300',
    [RunResultStatus.RETEST]: 'bg-orange-100 border-orange-300',
    [RunResultStatus.UNTESTED]: 'bg-white border-gray-200',
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 hover:text-blue-700 text-sm mb-2"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {version.name} &gt; {phase.phaseName}
        </h1>
        <p className="text-gray-600">
          TestRun:{' '}
          {phase.testRuns
            .map((tr) => `${tr.testRunName} (${tr.testCaseCount} TC)`)
            .join(', ')}
          {' — '}총 {phase.totalTestCaseCount} TC
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {/* Live Progress Stats */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
        <h3 className="font-semibold text-gray-800 mb-3">Phase Progress</h3>
        <ProgressStatsComponent stats={liveStats} showDetailed={true} />
      </div>

      {/* Test Execution List */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Test Execution ({results.length})
        </h2>

        {results.length === 0 ? (
          <p className="text-gray-500">No test results for this phase.</p>
        ) : (
          <div className="space-y-2">
            {results.map((result) => {
              const tc = getTestCaseDetail(result.testCaseId);
              const isExpanded = expandedResultId === result.id;

              return (
                <div
                  key={result.id}
                  className={`border rounded-lg transition ${statusColors[result.status]}`}
                >
                  {/* Row: ID, Title, Badge, Status Dropdown */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleExpand(result.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs font-mono text-gray-500 shrink-0">
                        T{result.testCaseId}
                      </span>
                      <span className="font-medium text-gray-800 truncate">
                        {result.testCaseTitle}
                      </span>
                      <ResultStatusBadge status={result.status} size="sm" />
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <StatusButtonGroup
                        current={result.status}
                        onChange={(status) => handleStatusChange(result.id, status)}
                      />
                      <span className="text-gray-400 text-sm">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded: Test Case Details */}
                  {isExpanded && tc && (
                    <div className="border-t border-gray-200 p-4 bg-white rounded-b-lg">
                      <div className="grid grid-cols-1 gap-4">
                        {/* Preconditions */}
                        {tc.preconditions && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-1">Preconditions</h4>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{tc.preconditions}</p>
                          </div>
                        )}

                        {/* Steps */}
                        {tc.steps && tc.steps.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Steps</h4>
                            <table className="w-full text-sm border border-gray-200 rounded">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left w-12">#</th>
                                  <th className="px-3 py-2 text-left">Action</th>
                                  <th className="px-3 py-2 text-left">Expected</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tc.steps.map((step) => (
                                  <tr key={step.order} className="border-t border-gray-100">
                                    <td className="px-3 py-2 text-gray-500">{step.order}</td>
                                    <td className="px-3 py-2 text-gray-800"><ImageRefText text={step.action} images={tc.images} /></td>
                                    <td className="px-3 py-2 text-gray-600"><ImageRefText text={step.expected} images={tc.images} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Expected Result */}
                        {tc.expectedResult && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-1">Expected Result</h4>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap"><ImageRefText text={tc.expectedResult} images={tc.images} /></p>
                          </div>
                        )}

                        {/* Comment Thread */}
                        <CommentThread
                          versionId={Number(versionId)}
                          resultId={result.id}
                          comments={comments[result.id] || []}
                          onRefresh={() => loadComments(result.id)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
