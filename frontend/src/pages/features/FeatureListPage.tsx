import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Company, Product, Feature } from '@/types/features';
import { companyApi, productApi, featureApi } from '@/api/features';
import { Breadcrumb } from '@/components/features/Breadcrumb';
import { useActiveCompany } from '@/context/ActiveCompanyContext';

export default function FeatureListPage() {
  const navigate = useNavigate();
  const { companyId, productId } = useParams<{
    companyId: string;
    productId: string;
  }>();
  const { setIsLoading } = useActiveCompany();

  const [company, setCompany] = useState<Company | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [newFeatureData, setNewFeatureData] = useState({
    path: '',
    name: '',
    description: '',
    promptText: '',
  });
  const [isLoading, setLocalIsLoading] = useState(true);

  // Load company, product, and features
  useEffect(() => {
    const load = async () => {
      try {
        setLocalIsLoading(true);
        const companies = await companyApi.getAll();
        const foundCompany = companies.find((c) => c.id === Number(companyId));
        setCompany(foundCompany || null);

        const products = await productApi.getByCompanyId(Number(companyId));
        const foundProduct = products.find((p) => p.id === Number(productId));
        setProduct(foundProduct || null);

        if (productId) {
          const feats = await featureApi.getByProductId(Number(productId));
          setFeatures(feats);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLocalIsLoading(false);
      }
    };
    load();
  }, [companyId, productId]);

  const handleAddFeature = async () => {
    if (!product || !newFeatureData.name.trim()) return;
    try {
      setIsLoading(true);
      const feature = await featureApi.create(
        product.id,
        newFeatureData.path,
        newFeatureData.name,
        newFeatureData.description,
        newFeatureData.promptText
      );
      setFeatures([...features, feature]);
      setNewFeatureData({
        path: '',
        name: '',
        description: '',
        promptText: '',
      });
    } catch (error) {
      console.error('Failed to create feature:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateFeature = async () => {
    if (!editingFeature) return;
    try {
      setIsLoading(true);
      const updated = await featureApi.update(
        editingFeature.id,
        editingFeature.path,
        editingFeature.name,
        editingFeature.description,
        editingFeature.promptText
      );
      setFeatures(features.map((f) => (f.id === updated.id ? updated : f)));
      setEditingFeature(null);
    } catch (error) {
      console.error('Failed to update feature:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFeature = async (id: number) => {
    if (!window.confirm('Delete this feature?')) return;
    try {
      await featureApi.delete(id);
      setFeatures(features.filter((f) => f.id !== id));
    } catch (error) {
      console.error('Failed to delete feature:', error);
    }
  };

  const handleSelectFeature = (feature: Feature) => {
    navigate(
      `/features/companies/${company!.id}/products/${product!.id}/features/${feature.id}`
    );
  };

  const renderPathDepth = (path: string) => {
    const parts = path.split('›').map((p) => p.trim());
    return parts.map((part, idx) => (
      <span key={idx} className="flex items-center">
        {idx > 0 && <span className="mx-1 text-gray-400">›</span>}
        <span className="px-2 py-1 bg-gray-100 rounded text-xs">{part}</span>
      </span>
    ));
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!company || !product) {
    return <div className="p-6">Company or product not found.</div>;
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
            <p className="text-gray-600 mb-4">Features</p>
          </div>

          {/* Add Feature Form */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h3 className="font-bold mb-3">Add Feature</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={newFeatureData.path}
                onChange={(e) =>
                  setNewFeatureData({
                    ...newFeatureData,
                    path: e.target.value,
                  })
                }
                placeholder="Path (e.g., Main › Login › Social)..."
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="text"
                value={newFeatureData.name}
                onChange={(e) =>
                  setNewFeatureData({
                    ...newFeatureData,
                    name: e.target.value,
                  })
                }
                placeholder="Feature name..."
                className="w-full px-3 py-2 border rounded"
              />
              <textarea
                value={newFeatureData.description}
                onChange={(e) =>
                  setNewFeatureData({
                    ...newFeatureData,
                    description: e.target.value,
                  })
                }
                placeholder="Description..."
                className="w-full px-3 py-2 border rounded"
                rows={2}
              />
              <textarea
                value={newFeatureData.promptText}
                onChange={(e) =>
                  setNewFeatureData({
                    ...newFeatureData,
                    promptText: e.target.value,
                  })
                }
                placeholder="Prompt text for AI..."
                className="w-full px-3 py-2 border rounded"
                rows={2}
              />
              <button
                onClick={handleAddFeature}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add Feature
              </button>
            </div>
          </div>

          {/* Edit Mode */}
          {editingFeature && (
            <div className="p-4 bg-white border-2 border-blue-500 rounded mb-6">
              <h4 className="font-bold mb-3">Edit Feature</h4>
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  value={editingFeature.path}
                  onChange={(e) =>
                    setEditingFeature({
                      ...editingFeature,
                      path: e.target.value,
                    })
                  }
                  placeholder="Path..."
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  type="text"
                  value={editingFeature.name}
                  onChange={(e) =>
                    setEditingFeature({
                      ...editingFeature,
                      name: e.target.value,
                    })
                  }
                  placeholder="Name..."
                  className="w-full px-3 py-2 border rounded"
                />
                <textarea
                  value={editingFeature.description || ''}
                  onChange={(e) =>
                    setEditingFeature({
                      ...editingFeature,
                      description: e.target.value,
                    })
                  }
                  placeholder="Description..."
                  className="w-full px-3 py-2 border rounded"
                  rows={2}
                />
                <textarea
                  value={editingFeature.promptText || ''}
                  onChange={(e) =>
                    setEditingFeature({
                      ...editingFeature,
                      promptText: e.target.value,
                    })
                  }
                  placeholder="Prompt text..."
                  className="w-full px-3 py-2 border rounded"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateFeature}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingFeature(null)}
                  className="flex-1 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Features Grid */}
          <div className="grid grid-cols-1 gap-4">
            {features.map((feature) => (
              <div
                key={feature.id}
                className="p-4 bg-white border rounded-lg shadow hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex gap-1 flex-wrap mb-2">
                      {renderPathDepth(feature.path)}
                    </div>
                    <h3 className="text-lg font-bold">{feature.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSelectFeature(feature)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 rounded transition"
                    >
                      View Test Cases
                    </button>
                    <button
                      onClick={() => setEditingFeature(feature)}
                      className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteFeature(feature.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-600 hover:bg-red-200 rounded transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {feature.description && (
                  <p className="text-sm text-gray-700 mb-2">{feature.description}</p>
                )}
                {feature.promptText && (
                  <p className="text-xs text-gray-600 italic mb-2">
                    Prompt: {feature.promptText}
                  </p>
                )}
                <div className="text-xs text-gray-400">
                  {new Date(feature.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>

          {features.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                No features yet. Create one to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
