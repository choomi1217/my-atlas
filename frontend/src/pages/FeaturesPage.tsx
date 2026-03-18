import { useState, useEffect } from 'react';
import { Company, Product, Feature, Platform } from '@/types/features';
import { companyApi, productApi, featureApi } from '@/api/features';
import { useActiveCompany } from '@/context/ActiveCompanyContext';

export default function FeaturesPage() {
  // State
  const { activeCompany, setActiveCompany, isLoading, setIsLoading } =
    useActiveCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);

  // Form states
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newProductData, setNewProductData] = useState({
    name: '',
    platform: Platform.WEB,
    description: '',
  });
  const [newFeatureData, setNewFeatureData] = useState({
    path: '',
    name: '',
    description: '',
    promptText: '',
  });

  // Load companies
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const data = await companyApi.getAll();
        setCompanies(data);
        // Set active or first company
        const active = data.find((c) => c.isActive);
        if (active) {
          setSelectedCompany(active);
          setActiveCompany(active);
        }
      } catch (error) {
        console.error('Failed to load companies:', error);
      }
    };
    loadCompanies();
  }, [setActiveCompany]);

  // Load products when selected company changes
  useEffect(() => {
    if (!selectedCompany) return;

    const loadProducts = async () => {
      try {
        const data = await productApi.getByCompanyId(selectedCompany.id);
        setProducts(data);
      } catch (error) {
        console.error('Failed to load products:', error);
      }
    };
    loadProducts();
  }, [selectedCompany]);

  // Load features when selected product changes
  useEffect(() => {
    if (!selectedProduct) {
      setFeatures([]);
      return;
    }

    const loadFeatures = async () => {
      try {
        const data = await featureApi.getByProductId(selectedProduct.id);
        setFeatures(data);
      } catch (error) {
        console.error('Failed to load features:', error);
      }
    };
    loadFeatures();
  }, [selectedProduct]);

  // Handlers
  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) return;
    try {
      const company = await companyApi.create(newCompanyName);
      setCompanies([...companies, company]);
      setNewCompanyName('');
    } catch (error) {
      console.error('Failed to create company:', error);
    }
  };

  const handleSetActiveCompany = async (company: Company) => {
    try {
      const updated = await companyApi.setActive(company.id);
      setCompanies(
        companies.map((c) => ({ ...c, isActive: c.id === updated.id }))
      );
      setSelectedCompany(updated);
      setActiveCompany(updated);
    } catch (error) {
      console.error('Failed to set active company:', error);
    }
  };

  const handleDeleteCompany = async (id: number) => {
    if (!window.confirm('Delete this company?')) return;
    try {
      await companyApi.delete(id);
      setCompanies(companies.filter((c) => c.id !== id));
      if (selectedCompany?.id === id) {
        setSelectedCompany(null);
        setProducts([]);
        setFeatures([]);
      }
    } catch (error) {
      console.error('Failed to delete company:', error);
    }
  };

  const handleAddProduct = async () => {
    if (!selectedCompany || !newProductData.name.trim()) return;
    try {
      const product = await productApi.create(
        selectedCompany.id,
        newProductData.name,
        newProductData.platform,
        newProductData.description
      );
      setProducts([...products, product]);
      setNewProductData({ name: '', platform: Platform.WEB, description: '' });
    } catch (error) {
      console.error('Failed to create product:', error);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await productApi.delete(id);
      setProducts(products.filter((p) => p.id !== id));
      if (selectedProduct?.id === id) {
        setSelectedProduct(null);
        setFeatures([]);
      }
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const handleAddFeature = async () => {
    if (!selectedProduct || !newFeatureData.name.trim()) return;
    try {
      setIsLoading(true);
      const feature = await featureApi.create(
        selectedProduct.id,
        newFeatureData.path,
        newFeatureData.name,
        newFeatureData.description,
        newFeatureData.promptText
      );
      setFeatures([...features, feature]);
      setNewFeatureData({ path: '', name: '', description: '', promptText: '' });
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

  // Render path hierarchy
  const renderPathDepth = (path: string) => {
    const parts = path.split('›').map((p) => p.trim());
    return parts.map((part, idx) => (
      <span key={idx} className="flex items-center">
        {idx > 0 && <span className="mx-1 text-gray-400">›</span>}
        <span className="px-1 py-0.5 bg-gray-100 rounded text-xs">
          {part}
        </span>
      </span>
    ));
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Companies */}
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h3 className="text-lg font-bold mb-2">Companies</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="New company..."
              className="flex-1 px-2 py-1 border rounded text-sm"
              onKeyPress={(e) => e.key === 'Enter' && handleAddCompany()}
            />
            <button
              onClick={handleAddCompany}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {companies.map((company) => (
            <div
              key={company.id}
              className={`p-3 border-b cursor-pointer transition ${
                selectedCompany?.id === company.id
                  ? 'bg-blue-100 border-l-4 border-blue-600'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div
                onClick={() => setSelectedCompany(company)}
                className="font-medium text-sm mb-1"
              >
                {company.name}
                {company.isActive && (
                  <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
                    Active
                  </span>
                )}
              </div>
              <div className="flex gap-1 text-xs">
                {!company.isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetActiveCompany(company);
                    }}
                    className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    Activate
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCompany(company.id);
                  }}
                  className="px-2 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Middle Panel - Products */}
      <div className="w-80 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h3 className="text-lg font-bold mb-2">Products</h3>
          {selectedCompany ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newProductData.name}
                onChange={(e) =>
                  setNewProductData({
                    ...newProductData,
                    name: e.target.value,
                  })
                }
                placeholder="Product name..."
                className="w-full px-2 py-1 border rounded text-sm"
              />
              <select
                value={newProductData.platform}
                onChange={(e) =>
                  setNewProductData({
                    ...newProductData,
                    platform: e.target.value as Platform,
                  })
                }
                className="w-full px-2 py-1 border rounded text-sm"
              >
                {Object.values(Platform).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newProductData.description}
                onChange={(e) =>
                  setNewProductData({
                    ...newProductData,
                    description: e.target.value,
                  })
                }
                placeholder="Description (optional)..."
                className="w-full px-2 py-1 border rounded text-sm"
              />
              <button
                onClick={handleAddProduct}
                className="w-full px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Add Product
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Select a company first</p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className={`p-3 border rounded cursor-pointer transition ${
                selectedProduct?.id === product.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-sm">{product.name}</div>
              <div className="text-xs text-gray-600 mt-1">
                <span className="inline-block bg-gray-200 px-2 py-0.5 rounded">
                  {product.platform}
                </span>
              </div>
              {product.description && (
                <div className="text-xs text-gray-500 mt-1">
                  {product.description}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProduct(product.id);
                }}
                className="mt-2 px-2 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Features */}
      <div className="flex-1 bg-gray-50 flex flex-col">
        <div className="p-4 border-b bg-white">
          <h3 className="text-lg font-bold mb-2">Features</h3>
          {selectedProduct ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newFeatureData.path}
                onChange={(e) =>
                  setNewFeatureData({ ...newFeatureData, path: e.target.value })
                }
                placeholder="Path (e.g., Main › Login › Social)..."
                className="w-full px-2 py-1 border rounded text-sm"
              />
              <input
                type="text"
                value={newFeatureData.name}
                onChange={(e) =>
                  setNewFeatureData({ ...newFeatureData, name: e.target.value })
                }
                placeholder="Feature name..."
                className="w-full px-2 py-1 border rounded text-sm"
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
                className="w-full px-2 py-1 border rounded text-sm"
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
                className="w-full px-2 py-1 border rounded text-sm"
                rows={2}
              />
              <button
                onClick={handleAddFeature}
                disabled={isLoading}
                className="w-full px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Creating (embedding...)' : 'Add Feature'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Select a product first</p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {editingFeature ? (
            // Edit mode
            <div className="p-4 bg-white border-2 border-blue-500 rounded">
              <h4 className="font-bold mb-3">Edit Feature</h4>
              <input
                type="text"
                value={editingFeature.path}
                onChange={(e) =>
                  setEditingFeature({ ...editingFeature, path: e.target.value })
                }
                placeholder="Path..."
                className="w-full px-2 py-1 border rounded text-sm mb-2"
              />
              <input
                type="text"
                value={editingFeature.name}
                onChange={(e) =>
                  setEditingFeature({ ...editingFeature, name: e.target.value })
                }
                placeholder="Name..."
                className="w-full px-2 py-1 border rounded text-sm mb-2"
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
                className="w-full px-2 py-1 border rounded text-sm mb-2"
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
                className="w-full px-2 py-1 border rounded text-sm mb-2"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateFeature}
                  disabled={isLoading}
                  className="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingFeature(null)}
                  className="flex-1 px-3 py-1 bg-gray-400 text-white rounded text-sm hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {features.map((feature) => (
            <div key={feature.id} className="p-4 bg-white border rounded">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex gap-1 flex-wrap mb-1">
                    {renderPathDepth(feature.path)}
                  </div>
                  <h4 className="font-bold text-base">{feature.name}</h4>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingFeature(feature)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteFeature(feature.id)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded"
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
                  {feature.promptText}
                </p>
              )}
              <div className="text-xs text-gray-400">
                {new Date(feature.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
