import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Company, Product } from '@/types/features';
import { companyApi, productApi } from '@/api/features';
import { Breadcrumb } from '@/components/features/Breadcrumb';
import TestStudioJobForm from '@/components/test-studio/TestStudioJobForm';
import TestStudioJobList from '@/components/test-studio/TestStudioJobList';
import { useTestStudio } from '@/hooks/useTestStudio';

/**
 * Test Studio page — document-based DRAFT TC generation.
 *
 * Drilldown layout (single-view per CLAUDE.md rule):
 *   Breadcrumb → new-Job form (top) → Job history list (below).
 */
export default function TestStudioPage() {
  const { companyId, productId } = useParams<{
    companyId: string;
    productId: string;
  }>();

  const [company, setCompany] = useState<Company | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const productIdNum = productId ? Number(productId) : undefined;
  const { jobs, isLoading: jobsLoading, isSubmitting, error, createJob, deleteJob } =
    useTestStudio(productIdNum);

  useEffect(() => {
    const load = async () => {
      if (!companyId || !productId) return;
      try {
        setIsLoading(true);
        const companies = await companyApi.getAll();
        setCompany(companies.find((c) => c.id === Number(companyId)) || null);

        const products = await productApi.getByCompanyId(Number(companyId));
        setProduct(products.find((p) => p.id === Number(productId)) || null);
      } catch (e) {
        console.error('Failed to load company/product:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [companyId, productId]);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!company || !product) {
    return <div className="p-6">Product not found.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Breadcrumb
        company={{ id: company.id, name: company.name }}
        product={{ id: product.id, name: product.name }}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-1">Test Studio</h1>
            <p className="text-gray-600 text-sm">
              문서(MD / PDF)를 입력하면 RAG 컨텍스트를 바탕으로 DRAFT TestCase를 자동 생성합니다.
            </p>
          </div>

          {/* New Job form */}
          <TestStudioJobForm
            productId={product.id}
            isSubmitting={isSubmitting}
            onSubmit={createJob}
          />

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Job history */}
          <TestStudioJobList
            jobs={jobs}
            isLoading={jobsLoading}
            onDelete={deleteJob}
          />
        </div>
      </div>
    </div>
  );
}
