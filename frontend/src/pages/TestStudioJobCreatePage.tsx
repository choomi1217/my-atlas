import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Company, Product } from '@/types/features';
import { companyApi, productApi } from '@/api/features';
import TestStudioJobForm from '@/components/test-studio/TestStudioJobForm';
import { useTestStudio } from '@/hooks/useTestStudio';

/**
 * Dedicated page for creating a Test Studio job.
 *
 * Entered from the Home dashboard via the "+ TestCase 생성 요청" button.
 * Route: /test-studio/new?companyId={id}
 *
 * On successful submit we navigate back to /test-studio?companyId={id} so the user
 * immediately sees the new PENDING job appear in the live dashboard.
 */
export default function TestStudioJobCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyIdParam = searchParams.get('companyId');
  const companyId = companyIdParam ? Number(companyIdParam) : null;

  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const { isSubmitting, error, createJob } = useTestStudio(productId ?? undefined);

  // Load the selected company and its products
  useEffect(() => {
    const load = async () => {
      if (!companyId) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const companies = await companyApi.getAll();
        const found = companies.find((c) => c.id === companyId) ?? null;
        setCompany(found);
        if (found) {
          const ps = await productApi.getByCompanyId(companyId);
          setProducts(ps);
          if (ps.length === 1) {
            // Convenience: preselect if there's only one product
            setProductId(ps[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to load company/products', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [companyId]);

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  }

  if (!companyId || !company) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">Company가 지정되지 않았습니다.</p>
        <Link to="/test-studio" className="text-indigo-600 hover:underline text-sm">
          Test Studio로 돌아가기
        </Link>
      </div>
    );
  }

  const handleSubmit = async (form: FormData): Promise<number> => {
    if (!productId) {
      throw new Error('Product를 선택하세요.');
    }
    // TestStudioJobForm already appends its own productId; overwrite to ensure consistency.
    form.set('productId', String(productId));
    const jobId = await createJob(form);
    setToast(`Job #${jobId} 생성됨 — Test Studio로 돌아갑니다…`);
    // Brief delay so the user sees the confirmation before navigation.
    setTimeout(() => {
      navigate(`/test-studio?companyId=${companyId}`);
    }, 700);
    return jobId;
  };

  return (
    <div className="space-y-6">
      {/* Back link + title */}
      <div>
        <Link
          to={`/test-studio?companyId=${companyId}`}
          className="text-sm text-indigo-600 hover:underline"
          data-testid="test-studio-new-back"
        >
          ← Test Studio로 돌아가기
        </Link>
        <h1 className="text-3xl font-bold mt-2">TestCase 생성 요청</h1>
        <p className="text-gray-600 text-sm mt-1">
          Company: <span className="font-medium">{company.name}</span>
        </p>
      </div>

      {/* Product selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Product <span className="text-red-500">*</span>
        </label>
        <select
          className="w-full max-w-sm border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={productId ?? ''}
          onChange={(e) =>
            setProductId(e.target.value ? Number(e.target.value) : null)
          }
          data-testid="test-studio-new-product-select"
        >
          <option value="">
            {products.length === 0 ? '이 Company에 Product가 없습니다' : '— 선택 —'}
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Job form (only when a product is chosen) */}
      {productId ? (
        <>
          <TestStudioJobForm
            productId={productId}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {toast && (
            <div className="rounded-md bg-indigo-50 border border-indigo-200 p-3 text-sm text-indigo-700">
              {toast}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-md border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Product를 선택하면 문서 입력 폼이 나타납니다.
        </div>
      )}
    </div>
  );
}
