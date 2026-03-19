import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Company,
  Product,
  Feature,
  TestCase,
  TestCasePriority,
  TestCaseType,
  TestCaseStatus,
} from '@/types/features';
import {
  companyApi,
  productApi,
  featureApi,
  testCaseApi,
} from '@/api/features';
import { Breadcrumb } from '@/components/features/Breadcrumb';

export default function TestCasePage() {
  const { companyId, productId, featureId } = useParams<{
    companyId: string;
    productId: string;
    featureId: string;
  }>();

  const [company, setCompany] = useState<Company | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [feature, setFeature] = useState<Feature | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<Partial<TestCase> | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const [newTestCaseData, setNewTestCaseData] = useState({
    title: '',
    priority: TestCasePriority.MEDIUM,
    testType: TestCaseType.FUNCTIONAL,
    status: TestCaseStatus.DRAFT,
    preconditions: '',
    steps: [{ order: 1, action: '', expected: '' }],
    expectedResult: '',
  });

  // Load all data
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

        const features = await featureApi.getByProductId(Number(productId));
        const foundFeature = features.find((f) => f.id === Number(featureId));
        setFeature(foundFeature || null);

        if (featureId) {
          const testCases = await testCaseApi.getByFeatureId(Number(featureId));
          setTestCases(testCases);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [companyId, productId, featureId]);

  const handleAddTestCase = async () => {
    if (!feature || !newTestCaseData.title.trim()) return;
    try {
      const testCase = await testCaseApi.create(
        feature.id,
        newTestCaseData.title,
        newTestCaseData.priority,
        newTestCaseData.testType,
        newTestCaseData.status,
        newTestCaseData.preconditions || undefined,
        newTestCaseData.steps.some((s) => s.action) ? newTestCaseData.steps : undefined,
        newTestCaseData.expectedResult || undefined
      );
      setTestCases([...testCases, testCase]);
      setNewTestCaseData({
        title: '',
        priority: TestCasePriority.MEDIUM,
        testType: TestCaseType.FUNCTIONAL,
        status: TestCaseStatus.DRAFT,
        preconditions: '',
        steps: [{ order: 1, action: '', expected: '' }],
        expectedResult: '',
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to create test case:', error);
    }
  };

  const handleGenerateDraft = async () => {
    if (!feature) return;
    try {
      setIsGenerating(true);
      const draftTestCases = await testCaseApi.generateDraft(feature.id);
      setTestCases([...testCases, ...draftTestCases]);
    } catch (error) {
      console.error('Failed to generate draft:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateTestCase = async () => {
    if (!editingId || !editingData || !feature) return;
    try {
      const updated = await testCaseApi.update(
        editingId,
        feature.id,
        editingData.title || '',
        editingData.priority || TestCasePriority.MEDIUM,
        editingData.testType || TestCaseType.FUNCTIONAL,
        editingData.status || TestCaseStatus.DRAFT,
        editingData.preconditions,
        editingData.steps,
        editingData.expectedResult
      );
      setTestCases(testCases.map((tc) => (tc.id === editingId ? updated : tc)));
      setEditingId(null);
      setEditingData(null);
    } catch (error) {
      console.error('Failed to update test case:', error);
    }
  };

  const handleDeleteTestCase = async (id: number) => {
    if (!window.confirm('Delete this test case?')) return;
    try {
      await testCaseApi.delete(id);
      setTestCases(testCases.filter((tc) => tc.id !== id));
    } catch (error) {
      console.error('Failed to delete test case:', error);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!company || !product || !feature) {
    return <div className="p-6">Feature not found.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Breadcrumb
        company={{ id: company.id, name: company.name }}
        product={{ id: product.id, name: product.name }}
        feature={{ id: feature.id, name: feature.name }}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">{feature.name}</h1>
            <p className="text-gray-600 mb-4">Test Cases</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {showAddForm ? 'Cancel' : 'Add Test Case'}
            </button>
            <button
              onClick={handleGenerateDraft}
              disabled={isGenerating}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {isGenerating ? 'Generating...' : 'AI Generate Draft'}
            </button>
          </div>

          {/* Add Test Case Form */}
          {showAddForm && (
            <div className="bg-white p-4 rounded-lg shadow mb-6">
              <h3 className="font-bold mb-3">New Test Case</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={newTestCaseData.title}
                  onChange={(e) =>
                    setNewTestCaseData({
                      ...newTestCaseData,
                      title: e.target.value,
                    })
                  }
                  placeholder="Test case title..."
                  className="w-full px-3 py-2 border rounded"
                />

                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={newTestCaseData.priority}
                    onChange={(e) =>
                      setNewTestCaseData({
                        ...newTestCaseData,
                        priority: e.target.value as TestCasePriority,
                      })
                    }
                    className="px-3 py-2 border rounded"
                  >
                    {Object.values(TestCasePriority).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <select
                    value={newTestCaseData.testType}
                    onChange={(e) =>
                      setNewTestCaseData({
                        ...newTestCaseData,
                        testType: e.target.value as TestCaseType,
                      })
                    }
                    className="px-3 py-2 border rounded"
                  >
                    {Object.values(TestCaseType).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  <select
                    value={newTestCaseData.status}
                    onChange={(e) =>
                      setNewTestCaseData({
                        ...newTestCaseData,
                        status: e.target.value as TestCaseStatus,
                      })
                    }
                    className="px-3 py-2 border rounded"
                  >
                    {Object.values(TestCaseStatus).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  value={newTestCaseData.preconditions}
                  onChange={(e) =>
                    setNewTestCaseData({
                      ...newTestCaseData,
                      preconditions: e.target.value,
                    })
                  }
                  placeholder="Preconditions..."
                  className="w-full px-3 py-2 border rounded"
                  rows={2}
                />

                <div className="bg-gray-50 p-2 rounded">
                  <label className="block text-sm font-bold mb-2">Steps</label>
                  {newTestCaseData.steps.map((step, idx) => (
                    <div key={idx} className="mb-2 p-2 bg-white rounded border">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={step.action}
                          onChange={(e) => {
                            const updated = [...newTestCaseData.steps];
                            updated[idx].action = e.target.value;
                            setNewTestCaseData({
                              ...newTestCaseData,
                              steps: updated,
                            });
                          }}
                          placeholder="Action..."
                          className="px-2 py-1 border rounded text-sm"
                        />
                        <input
                          type="text"
                          value={step.expected}
                          onChange={(e) => {
                            const updated = [...newTestCaseData.steps];
                            updated[idx].expected = e.target.value;
                            setNewTestCaseData({
                              ...newTestCaseData,
                              steps: updated,
                            });
                          }}
                          placeholder="Expected result..."
                          className="px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const updated = [
                        ...newTestCaseData.steps,
                        {
                          order: newTestCaseData.steps.length + 1,
                          action: '',
                          expected: '',
                        },
                      ];
                      setNewTestCaseData({
                        ...newTestCaseData,
                        steps: updated,
                      });
                    }}
                    className="text-sm px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    + Add Step
                  </button>
                </div>

                <textarea
                  value={newTestCaseData.expectedResult}
                  onChange={(e) =>
                    setNewTestCaseData({
                      ...newTestCaseData,
                      expectedResult: e.target.value,
                    })
                  }
                  placeholder="Expected result..."
                  className="w-full px-3 py-2 border rounded"
                  rows={2}
                />

                <button
                  onClick={handleAddTestCase}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Test Case
                </button>
              </div>
            </div>
          )}

          {/* Test Cases List */}
          <div className="space-y-3">
            {testCases.map((tc) => (
              <div
                key={tc.id}
                className="bg-white border rounded-lg shadow"
              >
                {editingId === tc.id ? (
                  // Edit Mode
                  <div className="p-4 border-t-2 border-blue-500">
                    <h4 className="font-bold mb-3">Edit Test Case</h4>
                    <div className="space-y-2 mb-3">
                      <input
                        type="text"
                        value={editingData?.title || ''}
                        onChange={(e) =>
                          setEditingData({ ...editingData, title: e.target.value })
                        }
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={editingData?.priority || ''}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              priority: e.target.value as TestCasePriority,
                            })
                          }
                          className="px-3 py-2 border rounded text-sm"
                        >
                          {Object.values(TestCasePriority).map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editingData?.testType || ''}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              testType: e.target.value as TestCaseType,
                            })
                          }
                          className="px-3 py-2 border rounded text-sm"
                        >
                          {Object.values(TestCaseType).map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editingData?.status || ''}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              status: e.target.value as TestCaseStatus,
                            })
                          }
                          className="px-3 py-2 border rounded text-sm"
                        >
                          {Object.values(TestCaseStatus).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateTestCase}
                        className="flex-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditingData(null);
                        }}
                        className="flex-1 px-3 py-1 text-sm bg-gray-400 text-white rounded hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div
                      onClick={() =>
                        setExpandedId(expandedId === tc.id ? null : tc.id)
                      }
                      className="p-4 cursor-pointer hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
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
                              setEditingId(tc.id);
                              setEditingData(tc);
                            }}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTestCase(tc.id);
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
                                  <span className="font-semibold">{step.action}</span>
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
                            <label className="font-bold">Expected Result:</label>
                            <p className="mt-1 text-gray-700">{tc.expectedResult}</p>
                          </div>
                        )}

                        <div className="mt-3 text-xs text-gray-500">
                          Created: {new Date(tc.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {testCases.length === 0 && !showAddForm && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                No test cases yet. Create one or generate AI draft to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
