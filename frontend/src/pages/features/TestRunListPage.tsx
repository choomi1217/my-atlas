import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TestRun, TestCase } from '@/types/features';
import { testRunApi, testCaseApi, productApi } from '@/api/features';
import TestRunFormModal from '@/components/features/TestRunFormModal';

export default function TestRunListPage() {
  const { companyId, productId } = useParams<{
    companyId: string;
    productId: string;
  }>();
  const navigate = useNavigate();

  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [productName, setProductName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTestRun, setSelectedTestRun] = useState<TestRun | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!productId) return;
      try {
        setIsLoading(true);
        setError(null);

        // Load product name
        const products = await productApi.getByCompanyId(Number(companyId));
        const product = products.find((p) => p.id === Number(productId));
        if (product) {
          setProductName(product.name);
        }

        // Load test runs
        const runs = await testRunApi.getByProductId(Number(productId));
        setTestRuns(runs);

        // Load test cases
        const cases = await testCaseApi.getByProductId(Number(productId));
        setTestCases(cases);
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

  const handleDelete = async (id: number) => {
    if (!confirm('이 테스트 실행을 삭제하시겠습니까?')) return;
    try {
      await testRunApi.delete(id);
      setTestRuns(testRuns.filter((tr) => tr.id !== id));
    } catch (err) {
      console.error('Failed to delete test run:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-600">테스트 실행 로드 중...</div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 hover:text-blue-700 text-sm mb-2"
        >
          ← 돌아가기
        </button>
        <h1 className="text-3xl font-bold text-gray-800">테스트 실행</h1>
        <p className="text-gray-600 mt-1">Product: {productName}</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      <button
        onClick={() => {
          setSelectedTestRun(null);
          setIsModalOpen(true);
        }}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        + 새 테스트 실행
      </button>

      <div className="grid gap-4">
        {testRuns.length === 0 ? (
          <p className="text-gray-500">테스트 실행이 없습니다.</p>
        ) : (
          testRuns.map((tr) => (
            <div
              key={tr.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition"
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
                    TC {tr.testCaseCount}개 선택됨
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedTestRun(tr);
                      setIsModalOpen(true);
                    }}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(tr.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <TestRunFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTestRun(null);
        }}
        onSubmit={handleCreate}
        initialData={selectedTestRun}
        availableTestCases={testCases}
      />
    </div>
  );
}
