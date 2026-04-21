import { useEffect, useState } from 'react';
import { Company, Product } from '@/types/features';
import { companyApi, productApi } from '@/api/features';

interface CompanyProductSelectorProps {
  companyId: number | null;
  productId: number | null;
  onCompanyChange: (id: number | null) => void;
  onProductChange: (id: number | null) => void;
}

/**
 * Dropdown pair for Test Studio Home: Company → Product (Product is scoped to Company).
 *
 * - Only active Companies (or all Companies — we show everything here so the user can explore).
 * - Product dropdown is disabled until a Company is selected.
 * - When Company changes, selected Product resets.
 */
export default function CompanyProductSelector({
  companyId,
  productId,
  onCompanyChange,
  onProductChange,
}: CompanyProductSelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Load companies on mount
  useEffect(() => {
    const load = async () => {
      setIsLoadingCompanies(true);
      try {
        const list = await companyApi.getAll();
        setCompanies(list);
      } catch (e) {
        console.error('Failed to load companies', e);
      } finally {
        setIsLoadingCompanies(false);
      }
    };
    load();
  }, []);

  // Load products when company changes
  useEffect(() => {
    if (!companyId) {
      setProducts([]);
      return;
    }
    const load = async () => {
      setIsLoadingProducts(true);
      try {
        const list = await productApi.getByCompanyId(companyId);
        setProducts(list);
      } catch (e) {
        console.error('Failed to load products', e);
        setProducts([]);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    load();
  }, [companyId]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Company dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Company</label>
        <select
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white min-w-[200px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={companyId ?? ''}
          onChange={(e) => {
            const value = e.target.value ? Number(e.target.value) : null;
            onCompanyChange(value);
            onProductChange(null); // reset product on company change
          }}
          data-testid="test-studio-company-select"
          disabled={isLoadingCompanies}
        >
          <option value="">{isLoadingCompanies ? 'Loading...' : '— 선택 —'}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.isActive ? ' (활성)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Product dropdown — scoped to Company */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Product</label>
        <select
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white min-w-[200px] focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
          value={productId ?? ''}
          onChange={(e) =>
            onProductChange(e.target.value ? Number(e.target.value) : null)
          }
          disabled={!companyId || isLoadingProducts}
          data-testid="test-studio-product-select"
        >
          <option value="">
            {!companyId
              ? 'Company 먼저 선택'
              : isLoadingProducts
              ? 'Loading...'
              : products.length === 0
              ? '제품 없음'
              : '— 선택 —'}
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
