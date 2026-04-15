import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Version,
  TestResult,
  TestResultComment,
  TestCase,
  Segment,
  Ticket,
  RunResultStatus,
  ProgressStats,
} from '@/types/features';
import {
  versionApi,
  testResultApi,
  testCaseApi,
  segmentApi,
  testResultCommentApi,
  ticketApi,
} from '@/api/features';
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
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedResultId, setExpandedResultId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, TestResultComment[]>>({});
  const [tickets, setTickets] = useState<Record<number, Ticket[]>>({});

  // Ticket creation dialog
  const [ticketDialogResultId, setTicketDialogResultId] = useState<number | null>(null);
  const [ticketSummary, setTicketSummary] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [versionId, phaseId, productId]);

  const loadData = async () => {
    if (!versionId || !phaseId || !productId) return;
    try {
      setIsLoading(true);
      setError(null);

      const [v, r, tc, seg] = await Promise.all([
        versionApi.getById(Number(versionId)),
        testResultApi.getByVersionPhaseId(Number(versionId), Number(phaseId)),
        testCaseApi.getByProductId(Number(productId)),
        segmentApi.getByProductId(Number(productId)),
      ]);

      setVersion(v);
      setResults(r);
      setTestCases(tc);
      setSegments(seg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Build segment name map
  const segmentMap = useMemo(() => {
    const map = new Map<number, string>();
    segments.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [segments]);

  const resolvePathNames = (path: number[]): string => {
    if (!path || path.length === 0) return '';
    return path.map((id) => segmentMap.get(id) || `?`).join(' > ');
  };

  // Group results by segment path
  const groupedResults = useMemo(() => {
    const tcMap = new Map<number, TestCase>();
    testCases.forEach((tc) => tcMap.set(tc.id, tc));

    const groups = new Map<string, { pathName: string; path: number[]; results: TestResult[] }>();

    for (const result of results) {
      const tc = tcMap.get(result.testCaseId);
      const path = tc?.path || [];
      const pathKey = path.length > 0 ? path.join('-') : 'unassigned';
      const pathName = path.length > 0 ? resolvePathNames(path) : '경로 없음';

      if (!groups.has(pathKey)) {
        groups.set(pathKey, { pathName, path, results: [] });
      }
      groups.get(pathKey)!.results.push(result);
    }

    // Sort groups by path name
    return Array.from(groups.entries())
      .sort(([, a], [, b]) => a.pathName.localeCompare(b.pathName));
  }, [results, testCases, segmentMap]);

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
      const updated = await testResultApi.updateResult(Number(versionId), resultId, newStatus);
      setResults((prev) => prev.map((r) => (r.id === resultId ? updated : r)));

      // Auto-open ticket dialog on FAIL
      if (newStatus === RunResultStatus.FAIL) {
        const result = results.find((r) => r.id === resultId);
        setTicketSummary(`FAIL: ${result?.testCaseTitle || 'TC-' + resultId}`);
        setTicketDescription(`Phase: ${phase?.phaseName || ''}\nVersion: ${version?.name || ''}`);
        setTicketDialogResultId(resultId);
        setTicketError(null);
      }
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

  const loadTickets = useCallback(async (resultId: number) => {
    if (!versionId) return;
    try {
      const data = await ticketApi.getByResultId(Number(versionId), resultId);
      setTickets((prev) => ({ ...prev, [resultId]: data }));
    } catch (err) {
      console.error('Failed to load tickets:', err);
    }
  }, [versionId]);

  const handleCreateTicket = async () => {
    if (!versionId || !ticketDialogResultId || !ticketSummary.trim()) return;
    setIsCreatingTicket(true);
    setTicketError(null);
    try {
      await ticketApi.create(Number(versionId), ticketDialogResultId, ticketSummary.trim(), ticketDescription.trim());
      await loadTickets(ticketDialogResultId);
      setTicketDialogResultId(null);
      setTicketSummary('');
      setTicketDescription('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Jira 티켓 생성 실패';
      setTicketError(`Jira 연결을 확인하세요: ${msg}`);
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const handleRefreshTicket = async (resultId: number, ticketId: number) => {
    if (!versionId) return;
    try {
      const updated = await ticketApi.refresh(Number(versionId), resultId, ticketId);
      setTickets((prev) => ({
        ...prev,
        [resultId]: (prev[resultId] || []).map((t) => (t.id === ticketId ? updated : t)),
      }));
    } catch (err) {
      console.error('Failed to refresh ticket:', err);
    }
  };

  const getTestCaseDetail = (testCaseId: number): TestCase | undefined => {
    return testCases.find((tc) => tc.id === testCaseId);
  };

  const toggleExpand = (resultId: number) => {
    const nextId = expandedResultId === resultId ? null : resultId;
    setExpandedResultId(nextId);
    if (nextId !== null) {
      if (!comments[nextId]) loadComments(nextId);
      if (!tickets[nextId]) loadTickets(nextId);
    }
  };

  const getTicketStatusColor = (status: string): string => {
    const lower = status.toLowerCase();
    if (lower.includes('done') || lower.includes('완료') || lower.includes('closed')) return 'bg-green-100 text-green-700';
    if (lower.includes('progress') || lower.includes('진행')) return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-700';
  };

  if (isLoading) return <div className="p-6 text-center text-gray-600">Loading...</div>;
  if (!version) return <div className="p-6 text-center text-gray-600">Version not found</div>;

  const phase = version.phases.find((p) => p.id === Number(phaseId));
  if (!phase) return <div className="p-6 text-center text-gray-600">Phase not found</div>;

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
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:text-blue-700 text-sm mb-2">
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {version.name} &gt; {phase.phaseName}
        </h1>
        <p className="text-gray-600">
          {phase.testRuns.length > 0 && (
            <>TestRun: {phase.testRuns.map((tr) => `${tr.testRunName} (${tr.testCaseCount} TC)`).join(', ')} — </>
          )}
          총 {phase.totalTestCaseCount} TC
        </p>
      </div>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>}

      {/* Progress */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
        <h3 className="font-semibold text-gray-800 mb-3">Phase Progress</h3>
        <ProgressStatsComponent stats={liveStats} showDetailed={true} />
      </div>

      {/* Test Execution — Grouped by Segment */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Test Execution ({results.length})
        </h2>

        {groupedResults.length === 0 ? (
          <p className="text-gray-500">No test results for this phase.</p>
        ) : (
          <div className="space-y-6">
            {groupedResults.map(([pathKey, group]) => (
              <div key={pathKey}>
                {/* Segment Header */}
                <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-300">
                  <span className="text-sm font-semibold text-indigo-700">
                    {group.pathName}
                  </span>
                  <span className="text-xs text-gray-500">({group.results.length})</span>
                </div>

                {/* Results in this segment */}
                <div className="space-y-2">
                  {group.results.map((result) => {
                    const tc = getTestCaseDetail(result.testCaseId);
                    const isExpanded = expandedResultId === result.id;
                    const resultTickets = tickets[result.id] || [];
                    const ticketCount = resultTickets.length;

                    return (
                      <div key={result.id} className={`border rounded-lg transition ${statusColors[result.status]}`}>
                        {/* Row */}
                        <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => toggleExpand(result.id)}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-xs font-mono text-gray-500 shrink-0">T{result.testCaseId}</span>
                            <span className="font-medium text-gray-800 truncate">{result.testCaseTitle}</span>
                            <ResultStatusBadge status={result.status} size="sm" />
                            {ticketCount > 0 && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                {ticketCount} ticket{ticketCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <StatusButtonGroup current={result.status} onChange={(s) => handleStatusChange(result.id, s)} />
                            <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {/* Expanded */}
                        {isExpanded && tc && (
                          <div className="border-t border-gray-200 p-4 bg-white rounded-b-lg">
                            <div className="grid grid-cols-1 gap-4">
                              {tc.preconditions && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Preconditions</h4>
                                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{tc.preconditions}</p>
                                </div>
                              )}

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

                              {tc.expectedResult && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Expected Result</h4>
                                  <p className="text-sm text-gray-600 whitespace-pre-wrap"><ImageRefText text={tc.expectedResult} images={tc.images} /></p>
                                </div>
                              )}

                              {/* Tickets */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-sm font-semibold text-gray-700">Tickets</h4>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTicketSummary(`FAIL: ${result.testCaseTitle}`);
                                      setTicketDescription(`Phase: ${phase.phaseName}\nVersion: ${version.name}`);
                                      setTicketDialogResultId(result.id);
                                      setTicketError(null);
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-700"
                                  >
                                    + 티켓 추가
                                  </button>
                                </div>
                                {resultTickets.length === 0 ? (
                                  <p className="text-xs text-gray-400">티켓 없음</p>
                                ) : (
                                  <div className="space-y-1">
                                    {resultTickets.map((t) => (
                                      <div key={t.id} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                                        <span className="font-mono text-xs text-purple-700">{t.jiraKey}</span>
                                        <span className="flex-1 truncate text-gray-700">{t.summary}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${getTicketStatusColor(t.status)}`}>
                                          {t.status}
                                        </span>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleRefreshTicket(result.id, t.id); }}
                                          className="text-xs text-gray-400 hover:text-blue-600" title="상태 새로고침"
                                        >
                                          &#x21bb;
                                        </button>
                                        <a href={t.jiraUrl} target="_blank" rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-xs text-blue-500 hover:text-blue-700" title="Jira에서 보기"
                                        >
                                          &#x2197;
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Comments */}
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Creation Dialog */}
      {ticketDialogResultId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Jira 티켓 발행</h3>
            <p className="text-sm text-gray-500 mb-4">테스트 결과가 Fail로 변경되었습니다.</p>

            {ticketError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {ticketError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input
                  type="text"
                  value={ticketSummary}
                  onChange={(e) => setTicketSummary(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
                <textarea
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm h-20"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-4 pt-3 border-t">
              <button
                onClick={() => { setTicketDialogResultId(null); setTicketError(null); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                건너뛰기
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={isCreatingTicket || !ticketSummary.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isCreatingTicket ? '발행 중...' : '티켓 발행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
