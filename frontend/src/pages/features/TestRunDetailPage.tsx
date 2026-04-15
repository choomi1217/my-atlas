import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TestRun, TestCase, Segment } from '@/types/features';
import { testRunApi, testCaseApi, segmentApi, companyApi, productApi } from '@/api/features';
import { Breadcrumb } from '@/components/features/Breadcrumb';
import ConfirmDialog from '@/components/features/ConfirmDialog';
import TestCaseGroupSelector from '@/components/features/TestCaseGroupSelector';
import ImageRefText from '@/components/features/ImageRefText';

export default function TestRunDetailPage() {
  const { companyId, productId, testRunId } = useParams<{
    companyId: string;
    productId: string;
    testRunId: string;
  }>();
  const navigate = useNavigate();

  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [company, setCompany] = useState<{ id: number; name: string } | undefined>();
  const [product, setProduct] = useState<{ id: number; name: string } | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSelectedIds, setEditSelectedIds] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Delete
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // TC expand
  const [expandedTcId, setExpandedTcId] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!testRunId || !productId || !companyId) return;
      try {
        setIsLoading(true);
        setError(null);

        const [run, cases, segs, companies, products] = await Promise.all([
          testRunApi.getById(Number(testRunId)),
          testCaseApi.getByProductId(Number(productId)),
          segmentApi.getByProductId(Number(productId)),
          companyApi.getAll(),
          productApi.getByCompanyId(Number(companyId)),
        ]);

        setTestRun(run);
        setAllTestCases(cases);
        setSegments(segs);

        const comp = companies.find((c) => c.id === Number(companyId));
        if (comp) setCompany({ id: comp.id, name: comp.name });

        const prod = products.find((p) => p.id === Number(productId));
        if (prod) setProduct({ id: prod.id, name: prod.name });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load test run');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [testRunId, productId, companyId]);

  // Segment name resolver
  const segmentMap = useMemo(() => {
    const map = new Map<number, string>();
    segments.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [segments]);

  const resolvePath = (path: number[]): string => {
    return path.map((id) => segmentMap.get(id) || `#${id}`).join(' > ');
  };

  // Group included test cases by path for display
  const groupedTestCases = useMemo(() => {
    if (!testRun?.testCases) return [];

    const includedIds = new Set(testRun.testCases.map((tc) => tc.id));
    const included = allTestCases.filter((tc) => includedIds.has(tc.id));

    const groups = new Map<string, TestCase[]>();
    included.forEach((tc) => {
      const key = tc.path && tc.path.length > 0 ? resolvePath(tc.path) : 'Unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tc);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testRun, allTestCases, segmentMap]);

  const enterEditMode = () => {
    if (!testRun) return;
    setEditName(testRun.name);
    setEditDescription(testRun.description || '');
    const ids = testRun.testCases
      ? new Set(testRun.testCases.map((tc) => tc.id))
      : new Set<number>();
    setEditSelectedIds(ids);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!testRunId || !editName.trim()) return;
    if (editSelectedIds.size === 0) {
      alert('Select at least 1 test case.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await testRunApi.update(
        Number(testRunId),
        editName.trim(),
        editDescription.trim(),
        Array.from(editSelectedIds)
      );
      setTestRun(updated);

      // Reload to get fresh testCases list
      const refreshed = await testRunApi.getById(Number(testRunId));
      setTestRun(refreshed);

      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update test run:', err);
      alert('Failed to update test run.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!testRunId) return;
    try {
      await testRunApi.delete(Number(testRunId));
      navigate(-1);
    } catch (err) {
      console.error('Failed to delete test run:', err);
      alert('Failed to delete test run.');
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center text-gray-600">Loading...</div>;
  }

  if (error || !testRun) {
    return (
      <div className="p-6 text-center text-red-600">
        {error || 'Test run not found.'}
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb company={company} product={product} />

      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-700 text-sm mb-2"
          >
            ← Back to Test Runs
          </button>

          {!isEditing ? (
            /* Read Mode */
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">
                    {testRun.name}
                  </h1>
                  {testRun.description && (
                    <p className="text-gray-600 mt-2">{testRun.description}</p>
                  )}
                  <div className="flex gap-4 mt-3 text-xs text-gray-400">
                    <span>
                      Created: {new Date(testRun.createdAt).toLocaleDateString()}
                    </span>
                    <span>
                      Updated: {new Date(testRun.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={enterEditMode}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setShowDeleteDialog(true)}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Test Case Count */}
              <div className="mt-4 px-4 py-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">
                  Test Cases: {testRun.testCases?.length ?? testRun.testCaseCount}
                </span>
              </div>

              {/* Grouped Test Cases */}
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">
                  Included Test Cases
                </h2>
                {groupedTestCases.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No test cases included.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {groupedTestCases.map(([pathName, tcs]) => (
                      <div
                        key={pathName}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                          <span className="text-sm font-medium text-gray-600">
                            {pathName}
                          </span>
                          <span className="text-xs text-gray-400 ml-2">
                            ({tcs.length})
                          </span>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {tcs.map((tc) => (
                            <div
                              key={tc.id}
                              className={`border-l-4 ${
                                tc.priority === 'HIGH'
                                  ? 'border-l-red-400'
                                  : tc.priority === 'MEDIUM'
                                  ? 'border-l-yellow-400'
                                  : 'border-l-gray-300'
                              }`}
                            >
                              <div
                                onClick={() =>
                                  setExpandedTcId(
                                    expandedTcId === tc.id ? null : tc.id
                                  )
                                }
                                className="px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition"
                              >
                                <span className="text-xs text-gray-400 flex-shrink-0 w-10">
                                  T{tc.id}
                                </span>
                                <span className="text-sm text-gray-800 font-medium">
                                  {tc.title}
                                </span>
                                <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
                                  {tc.priority} / {tc.testType}
                                </span>
                                <span className="text-gray-400 text-xs flex-shrink-0">
                                  {expandedTcId === tc.id ? '▲' : '▼'}
                                </span>
                              </div>

                              {/* Expanded Details */}
                              {expandedTcId === tc.id && (
                                <div className="px-4 py-3 bg-gray-50 border-t text-sm space-y-2">
                                  {tc.description && (
                                    <div>
                                      <span className="font-semibold text-gray-700">
                                        Description:
                                      </span>
                                      <p className="mt-0.5 text-gray-600">
                                        {tc.description}
                                      </p>
                                    </div>
                                  )}

                                  {tc.preconditions && (
                                    <div>
                                      <span className="font-semibold text-gray-700">
                                        Preconditions:
                                      </span>
                                      <p className="mt-0.5 text-gray-600">
                                        {tc.preconditions}
                                      </p>
                                    </div>
                                  )}

                                  {tc.steps && tc.steps.length > 0 && (
                                    <div>
                                      <span className="font-semibold text-gray-700">
                                        Steps:
                                      </span>
                                      <ol className="mt-0.5 ml-4 list-decimal space-y-1">
                                        {tc.steps.map((step, idx) => (
                                          <li key={idx}>
                                            <span className="font-medium">
                                              <ImageRefText text={step.action} images={tc.images} />
                                            </span>
                                            {step.expected && (
                                              <>
                                                <br />
                                                <span className="text-gray-500">
                                                  Expected: <ImageRefText text={step.expected} images={tc.images} />
                                                </span>
                                              </>
                                            )}
                                          </li>
                                        ))}
                                      </ol>
                                    </div>
                                  )}

                                  {tc.expectedResult && (
                                    <div>
                                      <span className="font-semibold text-gray-700">
                                        Expected Result:
                                      </span>
                                      <p className="mt-0.5 text-gray-600">
                                        <ImageRefText text={tc.expectedResult} images={tc.images} />
                                      </p>
                                    </div>
                                  )}

                                  {tc.images && tc.images.length > 0 && (
                                    <div>
                                      <span className="font-semibold text-gray-700">
                                        Images:
                                      </span>
                                      <div className="flex flex-wrap gap-2 mt-0.5">
                                        {tc.images.map((img) => (
                                          <span
                                            key={img.id}
                                            className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded"
                                          >
                                            image #{img.orderIndex}{' '}
                                            <span className="text-gray-400">
                                              {img.originalName}
                                            </span>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="text-xs text-gray-400 pt-1">
                                    Created:{' '}
                                    {new Date(
                                      tc.createdAt
                                    ).toLocaleDateString()}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Edit Mode */
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-gray-800">
                Edit Test Run
              </h1>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
                  placeholder="Optional description"
                />
              </div>

              {/* Test Case Selection */}
              <TestCaseGroupSelector
                segments={segments}
                testCases={allTestCases}
                selectedIds={editSelectedIds}
                onChange={setEditSelectedIds}
              />

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Test Run"
        message={`Delete "${testRun.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
