import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Company,
  Product,
  Segment,
  TestCase,
  TestCasePriority,
  TestCaseType,
  TestCaseStatus,
} from '@/types/features';
import {
  companyApi,
  productApi,
  segmentApi,
  testCaseApi,
} from '@/api/features';
import { Breadcrumb } from '@/components/features/Breadcrumb';
import { SegmentTreeView } from '@/components/features/SegmentTreeView';
import TestCaseFormModal from '@/components/features/TestCaseFormModal';
import ConfirmDialog from '@/components/features/ConfirmDialog';
import ImageRefText from '@/components/features/ImageRefText';
import { TC_DND_MIME } from '@/utils/tcDnd';

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

function PathTreeGroup({
  node,
  depth,
  expandedId,
  setExpandedId,
  setSelectedPath,
  handleOpenEditModal,
  setDeleteTarget,
}: {
  node: PathTreeNode;
  depth: number;
  expandedId: number | null;
  setExpandedId: (id: number | null) => void;
  setSelectedPath: (path: number[]) => void;
  handleOpenEditModal: (tc: TestCase) => void;
  setDeleteTarget: (t: { id: number; title: string } | null) => void;
}) {
  const displayName = node.segmentNames.join(' > ');
  const tcCount = countTreeTcs(node);

  return (
    <div className={depth > 0 ? 'mt-4' : ''}>
      {/* Segment header */}
      <div
        className={`flex items-center gap-2 pb-1 ${
          depth === 0
            ? 'border-b border-gray-300 mb-2'
            : 'mb-1'
        }`}
      >
        <span className="text-gray-400 text-sm flex-shrink-0">
          {depth === 0 ? '📁' : '📂'}
        </span>
        <span
          className={`text-sm font-semibold ${
            depth === 0 ? 'text-gray-800' : 'text-gray-600'
          }`}
        >
          {displayName}
        </span>
        <span className="text-xs text-gray-400">({tcCount})</span>
      </div>

      {/* Content with vertical guideline */}
      <div className="ml-3 pl-4 border-l-2 border-gray-200">
        {/* TC cards at this path level */}
        {node.testCases.length > 0 && (
          <div
            id={`section-${node.fullPath.join('-')}`}
            className="space-y-3 mb-3"
          >
            {node.testCases.map((tc) => (
              <div
                key={tc.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(TC_DND_MIME, String(tc.id));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className={`group bg-white border rounded-lg shadow border-l-4 ${
                  tc.priority === 'HIGH'
                    ? 'border-l-red-400'
                    : tc.priority === 'MEDIUM'
                    ? 'border-l-yellow-400'
                    : 'border-l-gray-300'
                }`}
                data-testid="tc-card"
                data-tc-id={tc.id}
              >
                <div
                  onClick={() => {
                    const next = expandedId === tc.id ? null : tc.id;
                    setExpandedId(next);
                    if (next !== null) setSelectedPath(tc.path);
                  }}
                  className="p-4 cursor-pointer hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold">{tc.title}</h4>
                      <div className="flex gap-2 mt-2">
                        <span
                          className={`text-xs px-2 py-1 rounded font-medium ${
                            tc.priority === 'HIGH'
                              ? 'bg-red-100 text-red-700'
                              : tc.priority === 'MEDIUM'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {tc.priority}
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          {tc.testType}
                        </span>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          {tc.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(tc);
                        }}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: tc.id, title: tc.title });
                        }}
                        className="px-3 py-1 text-sm bg-red-100 text-red-600 hover:bg-red-200 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === tc.id && (
                  <div className="p-4 bg-gray-50 border-t text-sm">
                    {tc.description && (
                      <div className="mb-3">
                        <label className="font-bold">Description:</label>
                        <p className="mt-1 text-gray-700">{tc.description}</p>
                      </div>
                    )}

                    {tc.preconditions && (
                      <div className="mb-3">
                        <label className="font-bold">Preconditions:</label>
                        <p className="mt-1 text-gray-700">{tc.preconditions}</p>
                      </div>
                    )}

                    {tc.steps && tc.steps.length > 0 && (
                      <div className="mb-3">
                        <label className="font-bold">Steps:</label>
                        <ol className="mt-1 ml-4 list-decimal space-y-1">
                          {tc.steps.map((step, idx) => (
                            <li key={idx}>
                              <span className="font-semibold">
                                <ImageRefText text={step.action} images={tc.images} />
                              </span>
                              <br />
                              <span className="text-gray-600">
                                Expected: <ImageRefText text={step.expected} images={tc.images} />
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {tc.expectedResult && (
                      <div>
                        <label className="font-bold">Expected Result:</label>
                        <p className="mt-1 text-gray-700">
                          <ImageRefText text={tc.expectedResult} images={tc.images} />
                        </p>
                      </div>
                    )}

                    <div className="mt-3 text-xs text-gray-500">
                      Created: {new Date(tc.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Child nodes */}
        {node.children.map((child) => (
          <PathTreeGroup
            key={child.fullPath.join('-')}
            node={child}
            depth={depth + 1}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            setSelectedPath={setSelectedPath}
            handleOpenEditModal={handleOpenEditModal}
            setDeleteTarget={setDeleteTarget}
          />
        ))}
      </div>
    </div>
  );
}

export default function TestCasePage() {
  const { companyId, productId } = useParams<{
    companyId: string;
    productId: string;
  }>();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  const jobIdFilterRaw = searchParams.get('jobId');
  const jobIdFilter = jobIdFilterRaw ? Number(jobIdFilterRaw) : null;

  const [company, setCompany] = useState<Company | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [allTestCases, setTestCases] = useState<TestCase[]>([]);

  // Apply URL filters (?status=DRAFT&jobId=42); downstream UI reads `testCases`.
  const testCases = useMemo(() => {
    let filtered = allTestCases;
    if (statusFilter) {
      filtered = filtered.filter((tc) => tc.status === statusFilter);
    }
    if (jobIdFilter !== null && !Number.isNaN(jobIdFilter)) {
      filtered = filtered.filter((tc) => tc.testStudioJobId === jobIdFilter);
    }
    return filtered;
  }, [allTestCases, statusFilter, jobIdFilter]);
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEditData, setModalEditData] = useState<TestCase | null>(null);
  const [modalEditPath, setModalEditPath] = useState<number[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const companies = await companyApi.getAll();
        const foundCompany = companies.find((c) => c.id === Number(companyId));
        setCompany(foundCompany || null);

        const products = await productApi.getByCompanyId(Number(companyId));
        const foundProduct = products.find((p) => p.id === Number(productId));
        setProduct(foundProduct || null);

        if (productId) {
          const [segs, tcs] = await Promise.all([
            segmentApi.getByProductId(Number(productId)),
            testCaseApi.getByProductId(Number(productId)),
          ]);
          setSegments(segs);
          setTestCases(tcs);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [companyId, productId]);

  // Build childrenMap for DFS ordering
  const childrenMap = useMemo(() => {
    const map = new Map<number | null, Segment[]>();
    segments.forEach((seg) => {
      const key = seg.parentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(seg);
    });
    return map;
  }, [segments]);

  // DFS order of all paths in the segment tree
  const dfsPathOrder = useMemo(() => {
    const order: string[] = [];
    const dfs = (parentId: number | null, path: number[]) => {
      const children = childrenMap.get(parentId) || [];
      for (const child of children) {
        const currentPath = [...path, child.id];
        order.push(currentPath.join(','));
        dfs(child.id, currentPath);
      }
    };
    dfs(null, []);
    return order;
  }, [childrenMap]);

  // TCs without a Segment path assigned — typically Test Studio DRAFTs
  // waiting for the reviewer to pick a Segment. These are rendered separately
  // because the path tree view requires a non-empty path.
  const unassignedTestCases = useMemo(
    () => testCases.filter((tc) => !tc.path || tc.path.length === 0),
    [testCases]
  );

  // Group test cases by their exact path, sorted by DFS tree order
  const groupedTestCases = useMemo(() => {
    const groups = new Map<string, TestCase[]>();
    testCases.forEach((tc) => {
      if (!tc.path || tc.path.length === 0) return;
      const key = tc.path.join(',');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tc);
    });

    const sortedKeys = [...groups.keys()].sort((a, b) => {
      const idxA = dfsPathOrder.indexOf(a);
      const idxB = dfsPathOrder.indexOf(b);
      return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB);
    });

    return sortedKeys.map((key) => ({
      path: key.split(',').map(Number),
      testCases: groups.get(key)!,
    }));
  }, [testCases, dfsPathOrder]);

  const resolvePathNames = (path: number[]): string => {
    if (!path || path.length === 0) return '';
    return path
      .map((id) => segments.find((s) => s.id === id)?.name || '?')
      .join(' > ');
  };

  const segmentMap = useMemo(() => {
    const map = new Map<number, string>();
    segments.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [segments]);

  // Build path tree with common prefix compression
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

  // Scroll spy: suppress observer updates during programmatic scroll
  const isScrollingToRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSelectPath = (path: number[]) => {
    setSelectedPath(path);
    isScrollingToRef.current = true;
    clearTimeout(scrollTimeoutRef.current);
    const sectionId = `section-${path.join('-')}`;
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingToRef.current = false;
    }, 800);
  };

  // Scroll Spy: observe path group sections and auto-update selectedPath
  const handleScrollSpy = useCallback((path: number[]) => {
    if (isScrollingToRef.current) return;
    setSelectedPath(path);
  }, []);

  useEffect(() => {
    if (groupedTestCases.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id; // "section-3-7"
            const pathStr = id.replace('section-', '');
            const path = pathStr.split('-').map(Number);
            if (path.length > 0 && path.every((n) => !isNaN(n))) {
              handleScrollSpy(path);
            }
            break;
          }
        }
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    );

    const sectionIds = groupedTestCases.map(
      (g) => `section-${g.path.join('-')}`
    );
    const elements: Element[] = [];
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        elements.push(el);
      }
    }

    return () => observer.disconnect();
  }, [groupedTestCases, handleScrollSpy]);

  const handleSegmentCreated = (segment: Segment) => {
    setSegments((prev) => [...prev, segment]);
  };

  const handleSegmentDeleted = (deletedId: number) => {
    const idsToRemove = new Set<number>();
    const collectDescendants = (id: number) => {
      idsToRemove.add(id);
      segments
        .filter((s) => s.parentId === id)
        .forEach((child) => collectDescendants(child.id));
    };
    collectDescendants(deletedId);
    setSegments((prev) => prev.filter((s) => !idsToRemove.has(s.id)));

    if (selectedPath.some((id) => idsToRemove.has(id))) {
      setSelectedPath([]);
    }
  };

  const handleOpenAddModal = () => {
    setModalEditData(null);
    setModalEditPath(selectedPath);
    setModalOpen(true);
  };

  const handleAddTestCaseFromTree = (path: number[]) => {
    setSelectedPath(path);
    setModalEditData(null);
    setModalEditPath(path);
    setModalOpen(true);
  };

  const handleOpenEditModal = (tc: TestCase) => {
    setModalEditData(tc);
    setModalEditPath(tc.path ?? []);
    setModalOpen(true);
  };

  /** Handles TC Card drop on a Segment tree node — user-triggered Path reassignment. */
  const handleTcDroppedOnSegment = useCallback(
    async (testCaseId: number, path: number[]) => {
      try {
        const updated = await testCaseApi.updatePath(testCaseId, path);
        setTestCases(
          allTestCases.map((tc) => (tc.id === updated.id ? updated : tc))
        );
      } catch (err) {
        console.error('Failed to update TC path via DnD:', err);
        throw err;
      }
    },
    [allTestCases]
  );

  const handleModalSubmit = async (data: {
    title: string;
    description: string;
    promptText: string;
    priority: TestCasePriority;
    testType: TestCaseType;
    status: TestCaseStatus;
    preconditions: string;
    steps: { order: number; action: string; expected: string }[];
    expectedResult: string;
  }): Promise<TestCase | void> => {
    if (!product) return;

    if (modalEditData) {
      // Edit — use the user-selected path from the modal picker.
      const updated = await testCaseApi.update(
        modalEditData.id,
        product.id,
        data.title,
        modalEditPath,
        data.description || undefined,
        data.promptText || undefined,
        data.priority,
        data.testType,
        data.status,
        data.preconditions || undefined,
        data.steps.some((s) => s.action) ? data.steps : undefined,
        data.expectedResult || undefined
      );
      setTestCases(allTestCases.map((tc) => (tc.id === modalEditData.id ? updated : tc)));
    } else {
      // Create — path comes from the modal picker (defaults to selectedPath).
      const tc = await testCaseApi.create(
        product.id,
        data.title,
        modalEditPath,
        data.description || undefined,
        data.promptText || undefined,
        data.priority,
        data.testType,
        data.status,
        data.preconditions || undefined,
        data.steps.some((s) => s.action) ? data.steps : undefined,
        data.expectedResult || undefined
      );
      setTestCases([...allTestCases, tc]);
      setModalEditData(tc); // Switch modal to edit mode for image upload
      setModalEditPath(tc.path ?? []);
      return tc;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await testCaseApi.delete(deleteTarget.id);
      setTestCases(allTestCases.filter((tc) => tc.id !== deleteTarget.id));
    } catch (error) {
      console.error('Failed to delete test case:', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!company || !product) {
    return <div className="p-6">Product not found.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Breadcrumb
        company={{ id: company.id, name: company.name }}
        product={{ id: product.id, name: product.name }}
      />

      <div className="flex-1 overflow-auto p-6" data-testid="tc-page-container">
        <div className="max-w-7xl mx-auto w-full">
          {(statusFilter || jobIdFilter !== null) && (
            <div className="mb-4 flex items-center gap-2 text-xs text-gray-600">
              <span>필터 적용:</span>
              {statusFilter && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                  status={statusFilter}
                </span>
              )}
              {jobIdFilter !== null && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                  jobId={jobIdFilter}
                </span>
              )}
              <Link
                to={`/features/companies/${companyId}/products/${productId}`}
                className="text-blue-600 hover:underline"
              >
                필터 해제
              </Link>
            </div>
          )}

          {/* Two-column layout: Path tree (left) + TestCase list (right) */}
          <div className="flex gap-6 items-start">
            {/* Left: Path Tree (sticky) */}
            <div className="w-72 flex-shrink-0">
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-bold text-sm text-gray-700 mb-3">Path</h3>
                <SegmentTreeView
                  segments={segments}
                  testCases={testCases}
                  selectedPath={selectedPath}
                  onSelectPath={handleSelectPath}
                  productId={product.id}
                  onSegmentCreated={handleSegmentCreated}
                  onSegmentDeleted={handleSegmentDeleted}
                  onSegmentsUpdated={setSegments}
                  onAddTestCase={handleAddTestCaseFromTree}
                  onTestCaseDroppedOnSegment={handleTcDroppedOnSegment}
                />
              </div>
            </div>

            {/* Right: TestCase List */}
            <div className="flex-1 min-w-0 max-w-4xl">
              {/* Path Breadcrumb + Add button */}
              <div className="flex items-center justify-between mb-4 bg-white border rounded-lg px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  {selectedPath.length > 0 ? (
                    <>
                      <span className="text-gray-400 flex-shrink-0">Path:</span>
                      <span className="font-medium text-indigo-700 truncate">
                        {resolvePathNames(selectedPath)}
                      </span>
                      <button
                        onClick={() => setSelectedPath([])}
                        className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0 ml-1"
                        title="Clear selection"
                      >
                        &times;
                      </button>
                    </>
                  ) : (
                    <span className="text-gray-400 italic">
                      Select a path from the tree
                    </span>
                  )}
                </div>
                <button
                  onClick={handleOpenAddModal}
                  disabled={selectedPath.length === 0}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 flex-shrink-0 ml-4"
                >
                  + Add Test Case
                </button>
              </div>

              {/* Unassigned TCs (Test Studio DRAFT without Segment) */}
              {unassignedTestCases.length > 0 && (
                <div
                  data-testid="unassigned-tc-section"
                  className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold text-amber-800">
                      📦 Segment 미지정 ({unassignedTestCases.length})
                    </span>
                    <span className="text-xs text-amber-700">
                      TestCase 를 열어 Segment 경로를 지정해주세요.
                    </span>
                  </div>
                  <div className="space-y-2">
                    {unassignedTestCases.map((tc) => (
                      <div
                        key={tc.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(TC_DND_MIME, String(tc.id));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        data-testid="unassigned-tc-card"
                        data-tc-id={tc.id}
                        className={`group bg-white border rounded-lg shadow-sm border-l-4 ${
                          tc.priority === 'HIGH'
                            ? 'border-l-red-400'
                            : tc.priority === 'MEDIUM'
                            ? 'border-l-yellow-400'
                            : 'border-l-gray-300'
                        }`}
                      >
                        <div
                          onClick={() => handleOpenEditModal(tc)}
                          className="p-3 cursor-pointer hover:bg-gray-50 transition flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{tc.title}</h4>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {tc.status}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {tc.priority}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {tc.testType}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ id: tc.id, title: tc.title });
                            }}
                            className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700 px-2 py-1 flex-shrink-0"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grouped test cases by path — hierarchical tree */}
              {pathTree.length > 0 ? (
                <div className="space-y-6">
                  {pathTree.map((node) => (
                    <PathTreeGroup
                      key={node.fullPath.join('-')}
                      node={node}
                      depth={0}
                      expandedId={expandedId}
                      setExpandedId={setExpandedId}
                      setSelectedPath={setSelectedPath}
                      handleOpenEditModal={handleOpenEditModal}
                      setDeleteTarget={setDeleteTarget}
                    />
                  ))}
                </div>
              ) : unassignedTestCases.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">
                    No test cases yet. Create one to get started.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* TestCase Form Modal */}
      <TestCaseFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalEditData(null);
        }}
        onSubmit={handleModalSubmit}
        initialData={modalEditData}
        pathDisplay={resolvePathNames(modalEditPath)}
        pathEdit={{
          segments,
          selectedPath: modalEditPath,
          onChange: setModalEditPath,
        }}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Test Case"
        message={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
