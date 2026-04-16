import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TestRun, TestCase, Segment } from '@/types/features';
import { testRunApi, testCaseApi, segmentApi, companyApi, productApi } from '@/api/features';
import { Breadcrumb } from '@/components/features/Breadcrumb';
import ConfirmDialog from '@/components/features/ConfirmDialog';
import TestCaseGroupSelector from '@/components/features/TestCaseGroupSelector';
import ImageRefText from '@/components/features/ImageRefText';

interface PathTreeNode {
  segmentIds: number[];
  segmentNames: string[];
  children: PathTreeNode[];
  testCases: TestCase[];
  fullPath: number[];
}

function countTreeTcs(node: PathTreeNode): number {
  return node.testCases.length + node.children.reduce((sum, c) => sum + countTreeTcs(c), 0);
}

function RunTcRow({
  tc,
  expandedTcId,
  setExpandedTcId,
}: {
  tc: TestCase;
  expandedTcId: number | null;
  setExpandedTcId: (id: number | null) => void;
}) {
  return (
    <div
      className={`border-l-4 ${
        tc.priority === 'HIGH'
          ? 'border-l-red-400'
          : tc.priority === 'MEDIUM'
          ? 'border-l-yellow-400'
          : 'border-l-gray-300'
      }`}
    >
      <div
        onClick={() => setExpandedTcId(expandedTcId === tc.id ? null : tc.id)}
        className="px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition"
      >
        <span className="text-xs text-gray-400 flex-shrink-0 w-10">T{tc.id}</span>
        <span className="text-sm text-gray-800 font-medium">{tc.title}</span>
        <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
          {tc.priority} / {tc.testType}
        </span>
        <span className="text-gray-400 text-xs flex-shrink-0">
          {expandedTcId === tc.id ? '▲' : '▼'}
        </span>
      </div>

      {expandedTcId === tc.id && (
        <div className="px-4 py-3 bg-gray-50 border-t text-sm space-y-2">
          {tc.description && (
            <div>
              <span className="font-semibold text-gray-700">Description:</span>
              <p className="mt-0.5 text-gray-600">{tc.description}</p>
            </div>
          )}
          {tc.preconditions && (
            <div>
              <span className="font-semibold text-gray-700">Preconditions:</span>
              <p className="mt-0.5 text-gray-600">{tc.preconditions}</p>
            </div>
          )}
          {tc.steps && tc.steps.length > 0 && (
            <div>
              <span className="font-semibold text-gray-700">Steps:</span>
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
              <span className="font-semibold text-gray-700">Expected Result:</span>
              <p className="mt-0.5 text-gray-600">
                <ImageRefText text={tc.expectedResult} images={tc.images} />
              </p>
            </div>
          )}
          {tc.images && tc.images.length > 0 && (
            <div>
              <span className="font-semibold text-gray-700">Images:</span>
              <div className="flex flex-wrap gap-2 mt-0.5">
                {tc.images.map((img) => (
                  <span key={img.id} className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    image #{img.orderIndex} <span className="text-gray-400">{img.originalName}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs text-gray-400 pt-1">
            Created: {new Date(tc.createdAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}

function RunPathTreeGroup({
  node,
  depth,
  expandedTcId,
  setExpandedTcId,
}: {
  node: PathTreeNode;
  depth: number;
  expandedTcId: number | null;
  setExpandedTcId: (id: number | null) => void;
}) {
  const displayName = node.segmentNames.join(' > ');
  const tcCount = countTreeTcs(node);

  return (
    <div className={depth > 0 ? 'mt-4' : ''}>
      <div
        className={`flex items-center gap-2 pb-1 ${
          depth === 0 ? 'border-b border-gray-300 mb-2' : 'mb-1'
        }`}
      >
        <span className="text-gray-400 text-sm flex-shrink-0">
          {depth === 0 ? '📁' : '📂'}
        </span>
        <span
          className={`text-sm font-semibold ${
            depth === 0 ? 'text-indigo-800' : 'text-indigo-600'
          }`}
        >
          {displayName}
        </span>
        <span className="text-xs text-gray-400">({tcCount})</span>
      </div>

      <div className="ml-3 pl-4 border-l-2 border-indigo-200">
        {node.testCases.length > 0 && (
          <div className="divide-y divide-gray-100 mb-3">
            {node.testCases.map((tc) => (
              <RunTcRow key={tc.id} tc={tc} expandedTcId={expandedTcId} setExpandedTcId={setExpandedTcId} />
            ))}
          </div>
        )}
        {node.children.map((child) => (
          <RunPathTreeGroup
            key={child.fullPath.join('-')}
            node={child}
            depth={depth + 1}
            expandedTcId={expandedTcId}
            setExpandedTcId={setExpandedTcId}
          />
        ))}
      </div>
    </div>
  );
}

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

  // Group included test cases by numeric path, then build tree
  const groupedTestCases = useMemo(() => {
    if (!testRun?.testCases) return [];

    const includedIds = new Set(testRun.testCases.map((tc) => tc.id));
    const included = allTestCases.filter((tc) => includedIds.has(tc.id));

    const groups = new Map<string, TestCase[]>();
    included.forEach((tc) => {
      const key = tc.path && tc.path.length > 0 ? tc.path.join(',') : '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tc);
    });

    const sortedKeys = [...groups.keys()].filter((k) => k !== '').sort();
    return sortedKeys.map((key) => ({
      path: key.split(',').map(Number),
      testCases: groups.get(key)!,
    }));
  }, [testRun, allTestCases]);

  const noPathTestCases = useMemo(() => {
    if (!testRun?.testCases) return [];
    const includedIds = new Set(testRun.testCases.map((tc) => tc.id));
    return allTestCases.filter(
      (tc) => includedIds.has(tc.id) && (!tc.path || tc.path.length === 0)
    );
  }, [testRun, allTestCases]);

  // Build path tree with compression
  const pathTree = useMemo((): PathTreeNode[] => {
    if (groupedTestCases.length === 0) return [];

    interface TrieNode {
      segmentId: number;
      children: Map<number, TrieNode>;
      testCases: TestCase[];
    }
    const rootChildren = new Map<number, TrieNode>();

    for (const group of groupedTestCases) {
      let children = rootChildren;
      let node: TrieNode | undefined;
      for (const segId of group.path) {
        if (!children.has(segId)) {
          children.set(segId, { segmentId: segId, children: new Map(), testCases: [] });
        }
        node = children.get(segId)!;
        children = node.children;
      }
      if (node) node.testCases = group.testCases;
    }

    function toNodes(trieChildren: Map<number, TrieNode>, parentPath: number[]): PathTreeNode[] {
      const result: PathTreeNode[] = [];
      for (const [segId, trie] of trieChildren) {
        const fp = [...parentPath, segId];
        let ptn: PathTreeNode = {
          segmentIds: [segId],
          segmentNames: [segmentMap.get(segId) || '?'],
          children: toNodes(trie.children, fp),
          testCases: trie.testCases,
          fullPath: fp,
        };
        while (ptn.children.length === 1 && ptn.testCases.length === 0) {
          const child = ptn.children[0];
          ptn = {
            segmentIds: [...ptn.segmentIds, ...child.segmentIds],
            segmentNames: [...ptn.segmentNames, ...child.segmentNames],
            children: child.children,
            testCases: child.testCases,
            fullPath: child.fullPath,
          };
        }
        result.push(ptn);
      }
      return result;
    }

    return toNodes(rootChildren, []);
  }, [groupedTestCases, segmentMap]);

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

              {/* Grouped Test Cases — hierarchical tree */}
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">
                  Included Test Cases
                </h2>
                {pathTree.length === 0 && noPathTestCases.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No test cases included.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {pathTree.map((node) => (
                      <RunPathTreeGroup
                        key={node.fullPath.join('-')}
                        node={node}
                        depth={0}
                        expandedTcId={expandedTcId}
                        setExpandedTcId={setExpandedTcId}
                      />
                    ))}
                    {noPathTestCases.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 pb-1 border-b border-gray-300 mb-2">
                          <span className="text-gray-400 text-sm">📁</span>
                          <span className="text-sm font-semibold text-gray-800">Unassigned</span>
                          <span className="text-xs text-gray-400">({noPathTestCases.length})</span>
                        </div>
                        <div className="ml-3 pl-4 border-l-2 border-gray-200 divide-y divide-gray-100">
                          {noPathTestCases.map((tc) => (
                            <RunTcRow key={tc.id} tc={tc} expandedTcId={expandedTcId} setExpandedTcId={setExpandedTcId} />
                          ))}
                        </div>
                      </div>
                    )}
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
