import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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

export default function TestCasePage() {
  const { companyId, productId } = useParams<{
    companyId: string;
    productId: string;
  }>();

  const [company, setCompany] = useState<Company | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEditData, setModalEditData] = useState<TestCase | null>(null);
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

  const filteredTestCases =
    selectedPath.length === 0
      ? testCases
      : testCases.filter(
          (tc) =>
            tc.path &&
            selectedPath.length <= tc.path.length &&
            selectedPath.every((id, i) => tc.path[i] === id)
        );

  const resolvePathNames = (path: number[]): string => {
    if (!path || path.length === 0) return '';
    return path
      .map((id) => segments.find((s) => s.id === id)?.name || '?')
      .join(' > ');
  };

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
    setModalOpen(true);
  };

  const handleOpenEditModal = (tc: TestCase) => {
    setModalEditData(tc);
    setModalOpen(true);
  };

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
  }) => {
    if (!product) return;

    if (modalEditData) {
      // Edit
      const updated = await testCaseApi.update(
        modalEditData.id,
        product.id,
        data.title,
        modalEditData.path,
        data.description || undefined,
        data.promptText || undefined,
        data.priority,
        data.testType,
        data.status,
        data.preconditions || undefined,
        data.steps.some((s) => s.action) ? data.steps : undefined,
        data.expectedResult || undefined
      );
      setTestCases(testCases.map((tc) => (tc.id === modalEditData.id ? updated : tc)));
    } else {
      // Create
      const tc = await testCaseApi.create(
        product.id,
        data.title,
        selectedPath,
        data.description || undefined,
        data.promptText || undefined,
        data.priority,
        data.testType,
        data.status,
        data.preconditions || undefined,
        data.steps.some((s) => s.action) ? data.steps : undefined,
        data.expectedResult || undefined
      );
      setTestCases([...testCases, tc]);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await testCaseApi.delete(deleteTarget.id);
      setTestCases(testCases.filter((tc) => tc.id !== deleteTarget.id));
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

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
            <p className="text-gray-600">Test Cases</p>
          </div>

          {/* Path Section */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-gray-700">Path</h3>
            </div>

            <SegmentTreeView
              segments={segments}
              testCases={testCases}
              selectedPath={selectedPath}
              onSelectPath={setSelectedPath}
              productId={product.id}
              onSegmentCreated={handleSegmentCreated}
              onSegmentDeleted={handleSegmentDeleted}
              onSegmentsUpdated={setSegments}
            />

            {selectedPath.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  Selected: {resolvePathNames(selectedPath)}
                </span>
                <button
                  onClick={() => setSelectedPath([])}
                  className="text-xs text-red-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={handleOpenAddModal}
              disabled={selectedPath.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Add Test Case
            </button>
          </div>

          {/* Test Cases List */}
          <div className="space-y-3">
            {filteredTestCases.map((tc) => (
              <div key={tc.id} className="bg-white border rounded-lg shadow">
                <div
                  onClick={() =>
                    setExpandedId(expandedId === tc.id ? null : tc.id)
                  }
                  className="p-4 cursor-pointer hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {tc.path && tc.path.length > 0 && (
                        <div className="text-xs text-gray-400 mb-1">
                          {resolvePathNames(tc.path)}
                        </div>
                      )}
                      <h4 className="font-bold">{tc.title}</h4>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
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
                    <div className="flex gap-2">
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
                        <p className="mt-1 text-gray-700">
                          {tc.description}
                        </p>
                      </div>
                    )}

                    {tc.preconditions && (
                      <div className="mb-3">
                        <label className="font-bold">Preconditions:</label>
                        <p className="mt-1 text-gray-700">
                          {tc.preconditions}
                        </p>
                      </div>
                    )}

                    {tc.steps && tc.steps.length > 0 && (
                      <div className="mb-3">
                        <label className="font-bold">Steps:</label>
                        <ol className="mt-1 ml-4 list-decimal space-y-1">
                          {tc.steps.map((step, idx) => (
                            <li key={idx}>
                              <span className="font-semibold">
                                {step.action}
                              </span>
                              <br />
                              <span className="text-gray-600">
                                Expected: {step.expected}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {tc.expectedResult && (
                      <div>
                        <label className="font-bold">
                          Expected Result:
                        </label>
                        <p className="mt-1 text-gray-700">
                          {tc.expectedResult}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 text-xs text-gray-500">
                      Created:{' '}
                      {new Date(tc.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredTestCases.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {selectedPath.length > 0
                  ? 'No test cases for this path. Create one or clear the filter.'
                  : 'No test cases yet. Create one to get started.'}
              </p>
            </div>
          )}
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
        pathDisplay={resolvePathNames(modalEditData?.path || selectedPath)}
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
