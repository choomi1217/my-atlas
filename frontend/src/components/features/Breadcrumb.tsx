import { Link, useParams } from 'react-router-dom';
import { companyApi, productApi, featureApi } from '@/api/features';
import { useEffect, useState } from 'react';
import { Company, Product, Feature } from '@/types/features';

interface BreadcrumbProps {
  showCompanyName?: boolean;
  showProductName?: boolean;
  showFeatureName?: boolean;
}

/**
 * Breadcrumb navigation component for feature drill-down.
 * Dynamically renders breadcrumb items based on URL parameters.
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  showCompanyName = true,
  showProductName = true,
  showFeatureName = true,
}) => {
  const { companyId, productId, featureId } = useParams<{
    companyId?: string;
    productId?: string;
    featureId?: string;
  }>();

  const [company, setCompany] = useState<Company | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [feature, setFeature] = useState<Feature | null>(null);

  useEffect(() => {
    if (companyId) {
      // Note: API doesn't have getById for company, would need to fetch from context or props
      // For now, we'll rely on the page component to pass company info
    }
  }, [companyId]);

  useEffect(() => {
    if (productId && companyId) {
      // Similarly, product ID would need to be fetched
    }
  }, [productId, companyId]);

  useEffect(() => {
    if (featureId && productId) {
      // Feature ID would need to be fetched
    }
  }, [featureId, productId]);

  return (
    <nav className="bg-gray-100 px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <Link to="/features" className="text-blue-600 hover:underline">
          Company Features
        </Link>

        {companyId && (
          <>
            <span className="text-gray-500">›</span>
            <Link
              to={`/features/companies/${companyId}`}
              className="text-blue-600 hover:underline"
            >
              {showCompanyName ? company?.name || `Company ${companyId}` : `Company ${companyId}`}
            </Link>
          </>
        )}

        {productId && companyId && (
          <>
            <span className="text-gray-500">›</span>
            <Link
              to={`/features/companies/${companyId}/products/${productId}`}
              className="text-blue-600 hover:underline"
            >
              {showProductName && product ? `${product.name} (${product.platform})` : `Product ${productId}`}
            </Link>
          </>
        )}

        {featureId && productId && companyId && (
          <>
            <span className="text-gray-500">›</span>
            <Link
              to={`/features/companies/${companyId}/products/${productId}/features/${featureId}`}
              className="text-blue-600 hover:underline"
            >
              {showFeatureName ? feature?.name || `Feature ${featureId}` : `Feature ${featureId}`}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};
