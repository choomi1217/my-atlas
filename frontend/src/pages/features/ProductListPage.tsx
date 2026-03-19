import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Company, Product, Platform } from '@/types/features';
import { companyApi, productApi } from '@/api/features';
import { Breadcrumb } from '@/components/features/Breadcrumb';

export default function ProductListPage() {
  const navigate = useNavigate();
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [newProductData, setNewProductData] = useState({
    name: '',
    platform: Platform.WEB,
    description: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load company and products
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

  const handleAddProduct = async () => {
    if (!company || !newProductData.name.trim()) return;
    try {
      const product = await productApi.create(
        company.id,
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

  const handleSelectProduct = (product: Product) => {
    navigate(`/features/companies/${company!.id}/products/${product.id}`);
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await productApi.delete(id);
      setProducts(products.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Failed to delete product:', error);
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
          </div>

          {/* Add Product Form */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h3 className="font-bold mb-3">Add Product</h3>
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
                className="w-full px-3 py-2 border rounded"
              />
              <select
                value={newProductData.platform}
                onChange={(e) =>
                  setNewProductData({
                    ...newProductData,
                    platform: e.target.value as Platform,
                  })
                }
                className="w-full px-3 py-2 border rounded"
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
                className="w-full px-3 py-2 border rounded"
              />
              <button
                onClick={handleAddProduct}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add Product
              </button>
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProduct(product.id);
                  }}
                  className="w-full px-3 py-1 text-sm bg-red-100 text-red-600 hover:bg-red-200 rounded transition"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          {products.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No products yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
