import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TestRun, TestCase, Segment } from '@/types/features';
import { testRunApi, testCaseApi, productApi, segmentApi } from '@/api/features';
import TestRunFormModal from '@/components/features/TestRunFormModal';

export default function TestRunListPage() {
  const { companyId, productId } = useParams<{
    companyId: string;
    productId: string;
  }>();
  const navigate = useNavigate();

  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [productName, setProductName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!productId) return;
      try {
        setIsLoading(true);
        setError(null);

        const [products, runs, cases, segs] = await Promise.all([
          productApi.getByCompanyId(Number(companyId)),
          testRunApi.getByProductId(Number(productId)),
          testCaseApi.getByProductId(Number(productId)),
          segmentApi.getByProductId(Number(productId)),
        ]);

        const product = products.find((p) => p.id === Number(productId));
        if (product) setProductName(product.name);

        setTestRuns(runs);
        setTestCases(cases);
        setSegments(segs);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load test runs'
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [productId, companyId]);

  const handleCreate = async (data: {
    name: string;
    description: string;
    testCaseIds: number[];
  }) => {
    if (!productId) return;
    try {
      await testRunApi.create(
        Number(productId),
        data.name,
        data.description,
        data.testCaseIds
      );
      const runs = await testRunApi.getByProductId(Number(productId));
      setTestRuns(runs);
    } catch (err) {
      console.error('Failed to create test run:', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Delete this test run?')) return;
    try {
      await testRunApi.delete(id);
      setTestRuns(testRuns.filter((tr) => tr.id !== id));
    } catch (err) {
      console.error('Failed to delete test run:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-600">Loading test runs...</div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 hover:text-blue-700 text-sm mb-2"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-800">Test Runs</h1>
        <p className="text-gray-600 mt-1">Product: {productName}</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      <button
        onClick={() => setIsModalOpen(true)}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        + New Test Run
      </button>

      <div className="grid gap-4">
        {testRuns.length === 0 ? (
          <p className="text-gray-500">No test runs yet.</p>
        ) : (
          testRuns.map((tr) => (
            <div
              key={tr.id}
              onClick={() =>
                navigate(
                  `/features/companies/${companyId}/products/${productId}/test-runs/${tr.id}`
                )
              }
              className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {tr.name}
                  </h3>
                  {tr.description && (
                    <p className="text-gray-600 text-sm mt-1">
                      {tr.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    TC {tr.testCaseCount} selected
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, tr.id)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <TestRunFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
        availableTestCases={testCases}
        segments={segments}
      />
    </div>
  );
}
