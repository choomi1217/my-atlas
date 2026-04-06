import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Company, Product, Platform } from '@/types/features';
import { companyApi, productApi } from '@/api/features';
import { Breadcrumb } from '@/components/features/Breadcrumb';
import ProductFormModal from '@/components/features/ProductFormModal';
import ConfirmDialog from '@/components/features/ConfirmDialog';

type SortOption = 'name' | 'newest';

export default function ProductListPage() {
  const navigate = useNavigate();
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const companies = await companyApi.getAll();
        const found = companies.find((c) => c.id === Number(companyId));
        setCompany(found || null);

        if (companyId) {
          const prods = await productApi.getByCompanyId(Number(companyId));
          setProducts(prods);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [companyId]);

  const filteredAndSorted = useMemo(() => {
    let result = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [products, searchQuery, sortBy]);

  const handleAddProduct = async (data: {
    name: string;
    platform: Platform;
    description: string;
  }) => {
    if (!company) return;
    const product = await productApi.create(
      company.id,
      data.name,
      data.platform,
      data.description
    );
    setProducts([...products, product]);
  };

  const handleSelectProduct = (product: Product) => {
    navigate(`/features/companies/${company!.id}/products/${product.id}`);
  };

  const handleSelectTestRuns = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    navigate(`/features/companies/${company!.id}/products/${product.id}/test-runs`);
  };

  const handleSelectVersions = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    navigate(`/features/companies/${company!.id}/products/${product.id}/versions`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await productApi.delete(deleteTarget.id);
      setProducts(products.filter((p) => p.id !== deleteTarget.id));
    } catch (error) {
      console.error('Failed to delete product:', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!company) {
    return <div className="p-6">Company not found.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Breadcrumb company={{ id: company.id, name: company.name }} />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">{company.name}</h1>
            <p className="text-gray-600 mb-4">Products</p>

            {/* Search + Sort bar */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  &#128269;
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="name">Sort: Name</option>
                <option value="newest">Sort: Newest</option>
              </select>
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Add New Card */}
            <div
              onClick={() => setShowAddModal(true)}
              className="p-4 bg-white border-2 border-dashed border-gray-300 rounded-lg
                         hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition
                         flex flex-col items-center justify-center min-h-[120px]"
            >
              <span className="text-3xl text-gray-400 mb-1">+</span>
              <span className="text-sm text-gray-500">Add New</span>
            </div>

            {/* Product Cards */}
            {filteredAndSorted.map((product) => (
              <div
                key={product.id}
                onClick={() => handleSelectProduct(product)}
                className="p-4 bg-white border rounded-lg shadow hover:shadow-lg cursor-pointer transition"
              >
                <h3 className="text-lg font-bold mb-2">{product.name}</h3>
                <div className="mb-3">
                  <span className="inline-block bg-gray-200 text-sm px-2 py-1 rounded">
                    {product.platform}
                  </span>
                </div>
                {product.description && (
                  <p className="text-sm text-gray-600 mb-3">{product.description}</p>
                )}
                <div className="space-y-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSelectProduct(product); }}
                    className="w-full px-3 py-1 text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 rounded transition"
                  >
                    Test Cases
                  </button>
                  <button
                    onClick={(e) => handleSelectTestRuns(e, product)}
                    className="w-full px-3 py-1 text-sm bg-green-100 text-green-600 hover:bg-green-200 rounded transition"
                  >
                    Test Runs
                  </button>
                  <button
                    onClick={(e) => handleSelectVersions(e, product)}
                    className="w-full px-3 py-1 text-sm bg-purple-100 text-purple-600 hover:bg-purple-200 rounded transition"
                  >
                    Versions
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ id: product.id, name: product.name });
                    }}
                    className="w-full px-3 py-1 text-sm bg-red-100 text-red-600 hover:bg-red-200 rounded transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredAndSorted.length === 0 && products.length > 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No products match your search.</p>
            </div>
          )}

          {products.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No products yet. Click "+" to create one.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      <ProductFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddProduct}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All test cases under this product will also be deleted.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
