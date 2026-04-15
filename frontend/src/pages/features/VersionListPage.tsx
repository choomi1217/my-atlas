import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Version } from '@/types/features';
import { versionApi, productApi } from '@/api/features';
import VersionFormModal from '@/components/features/VersionFormModal';
import ProgressStats from '@/components/features/ProgressStats';

export default function VersionListPage() {
  const { companyId, productId } = useParams<{
    companyId: string;
    productId: string;
  }>();
  const navigate = useNavigate();

  const [versions, setVersions] = useState<Version[]>([]);
  const [productName, setProductName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!productId) return;
      try {
        setIsLoading(true);
        setError(null);

        // Load product name
        const products = await productApi.getByCompanyId(Number(companyId));
        const product = products.find((p) => p.id === Number(productId));
        if (product) {
          setProductName(product.name);
        }

        // Load versions
        const versions = await versionApi.getByProductId(Number(productId));
        setVersions(versions);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load versions'
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [productId, companyId]);

  const handleCreate = async (data: {
    name: string;
    description: string;
    releaseDate: string;
  }) => {
    if (!productId) return;
    try {
      const created = await versionApi.create(
        Number(productId),
        data.name,
        data.description,
        data.releaseDate || null
      );
      // Navigate to detail page for Phase addition
      navigate(
        `/features/companies/${companyId}/products/${productId}/versions/${created.id}`
      );
    } catch (err) {
      console.error('Failed to create version:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 버전을 삭제하시겠습니까?')) return;
    try {
      await versionApi.delete(id);
      setVersions(versions.filter((v) => v.id !== id));
    } catch (err) {
      console.error('Failed to delete version:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-600">버전 로드 중...</div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 hover:text-blue-700 text-sm mb-2"
        >
          ← 돌아가기
        </button>
        <h1 className="text-3xl font-bold text-gray-800">버전 관리</h1>
        <p className="text-gray-600 mt-1">Product: {productName}</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      <button
        data-testid="new-version-btn"
        onClick={() => {
          setSelectedVersion(null);
          setIsModalOpen(true);
        }}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        + 새 버전
      </button>

      <div className="grid gap-4">
        {versions.length === 0 ? (
          <p className="text-gray-500">버전이 없습니다.</p>
        ) : (
          versions.map((version) => (
            <div
              key={version.id}
              data-testid="version-card"
              onClick={() =>
                navigate(
                  `/features/companies/${companyId}/products/${productId}/versions/${version.id}`
                )
              }
              className={`border rounded-lg p-4 hover:shadow-lg transition cursor-pointer ${
                version.isReleaseDatePassed
                  ? 'border-orange-300 bg-orange-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {version.isReleaseDatePassed && (
                      <span className="text-xl">⚠️</span>
                    )}
                    <h3 className="text-lg font-semibold text-gray-800">
                      {version.name}
                    </h3>
                  </div>

                  {version.description && (
                    <p className="text-gray-600 text-sm mt-1">
                      {version.description}
                    </p>
                  )}

                  {version.releaseDate && (
                    <p className="text-xs text-gray-600 mt-1">
                      Release:{' '}
                      {new Date(version.releaseDate).toLocaleDateString()}
                    </p>
                  )}

                  <div className="mt-3">
                    <ProgressStats
                      stats={version.totalProgress}
                      showDetailed={true}
                    />
                  </div>

                  {version.warningMessage && (
                    <p className="text-xs text-orange-700 mt-2 font-medium">
                      {version.warningMessage}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(version.id);
                    }}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <VersionFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVersion(null);
        }}
        onSubmit={handleCreate}
        initialData={selectedVersion}
      />
    </div>
  );
}
