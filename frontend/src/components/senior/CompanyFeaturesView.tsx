import { useState, useEffect } from 'react';
import { companyApi, productApi } from '@/api/features';
import { Company, Product } from '@/types/features';

export default function CompanyFeaturesView() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Record<number, Product[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const companyList = await companyApi.getAll();
        setCompanies(companyList);

        const productMap: Record<number, Product[]> = {};
        for (const company of companyList) {
          const prods = await productApi.getByCompanyId(company.id);
          productMap[company.id] = prods;
        }
        setProducts(productMap);
      } catch {
        // Silently handle — this is a read-only reference view
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return <div className="text-gray-400 text-sm">Loading company features...</div>;
  }

  if (companies.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No companies registered yet. Add companies in Product Test Suite.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {companies.map((company) => (
        <div key={company.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-gray-800">{company.name}</h4>
            {company.isActive && (
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                Active
              </span>
            )}
          </div>
          {products[company.id]?.length ? (
            <div className="ml-4 space-y-1">
              {products[company.id].map((product) => (
                <div key={product.id} className="text-sm text-gray-600">
                  <span className="font-medium">{product.name}</span>
                  <span className="text-gray-400 ml-1">({product.platform})</span>
                  {product.description && (
                    <span className="text-gray-400 ml-1">— {product.description}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="ml-4 text-sm text-gray-400">No products</p>
          )}
        </div>
      ))}
    </div>
  );
}
