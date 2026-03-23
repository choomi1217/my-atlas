import { Link, useParams } from 'react-router-dom';

interface BreadcrumbItem {
  id: number;
  name: string;
}

interface BreadcrumbProps {
  company?: BreadcrumbItem;
  product?: BreadcrumbItem;
}

/**
 * Breadcrumb navigation component for feature drill-down.
 * Shows: Product Test Suite > Company > Product
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  company,
  product,
}) => {
  const { companyId, productId } = useParams<{
    companyId?: string;
    productId?: string;
  }>();

  return (
    <nav className="bg-gray-100 px-4 py-2 text-sm border-b">
      <div className="flex items-center gap-2">
        <Link to="/features" className="text-blue-600 hover:underline">
          Product Test Suite
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
            <span className="text-gray-700">{product.name}</span>
          </>
        )}
      </div>
    </nav>
  );
};
