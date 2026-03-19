import { Link, useParams } from 'react-router-dom';

interface BreadcrumbItem {
  id: number;
  name: string;
}

interface BreadcrumbProps {
  company?: BreadcrumbItem;
  product?: BreadcrumbItem;
  feature?: BreadcrumbItem;
}

/**
 * Breadcrumb navigation component for feature drill-down.
 * Props-based: parent pages pass name/id info to ensure breadcrumb shows current names.
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  company,
  product,
  feature,
}) => {
  const { companyId, productId, featureId } = useParams<{
    companyId?: string;
    productId?: string;
    featureId?: string;
  }>();

  return (
    <nav className="bg-gray-100 px-4 py-2 text-sm border-b">
      <div className="flex items-center gap-2">
        <Link to="/features" className="text-blue-600 hover:underline">
          Company Features
        </Link>

        {company && companyId && (
          <>
            <span className="text-gray-500">›</span>
            <Link
              to={`/features/companies/${company.id}`}
              className="text-blue-600 hover:underline"
            >
              {company.name}
            </Link>
          </>
        )}

        {product && productId && company && companyId && (
          <>
            <span className="text-gray-500">›</span>
            <Link
              to={`/features/companies/${company.id}/products/${product.id}`}
              className="text-blue-600 hover:underline"
            >
              {product.name}
            </Link>
          </>
        )}

        {feature && featureId && product && productId && company && companyId && (
          <>
            <span className="text-gray-500">›</span>
            <span className="text-gray-700">{feature.name}</span>
          </>
        )}
      </div>
    </nav>
  );
};
