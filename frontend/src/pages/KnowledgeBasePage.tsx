import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKnowledgeBase, SourceFilter, SortOption } from '@/hooks/useKnowledgeBase';
import { useAuth } from '@/context/AuthContext';
import PdfUploadModal from '@/components/kb/PdfUploadModal';

const filterTabs: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'manual', label: '직접 작성' },
  { key: 'pdf', label: 'PDF 도서' },
];

const sortOptions: { key: SortOption; label: string }[] = [
  { key: 'newest', label: '최신순' },
  { key: 'oldest', label: '오래된순' },
  { key: 'title', label: '제목순' },
];

export default function KnowledgeBasePage() {
  const {
    kbItems,
    filteredItems,
    isLoading,
    error,
    sourceFilter,
    setSourceFilter,
    search,
    setSearch,
    sort,
    setSort,
    manualCount,
    pdfCount,
    fetchKbItems,
    deleteBook,
    pinKbItem,
    unpinKbItem,
  } = useKnowledgeBase();

  const navigate = useNavigate();
  const { user } = useAuth();
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showLoginRequiredToast = useCallback(() => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast('PDF 업로드는 로그인이 필요합니다.');
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  }, []);

  const handlePdfUploadClick = () => {
    if (!user) {
      showLoginRequiredToast();
      return;
    }
    setIsPdfModalOpen(true);
  };

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, setSearch]);

  const handleDeleteBook = async (source: string) => {
    if (!window.confirm(`"${source}"의 전체 청크를 삭제하시겠습니까?`)) return;
    await deleteBook(source);
  };

  const handleTogglePin = async (id: number, isPinned: boolean) => {
    setPinError(null);
    try {
      if (isPinned) {
        await unpinKbItem(id);
      } else {
        await pinKbItem(id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pin operation failed';
      if (msg.includes('Maximum') || msg.includes('10')) {
        setPinError('최대 10건까지 고정할 수 있습니다.');
      } else {
        setPinError(msg);
      }
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setPinError(null), 3000);
    }
  };

  const getCount = (key: SourceFilter) => {
    switch (key) {
      case 'all': return kbItems.length;
      case 'manual': return manualCount;
      case 'pdf': return pdfCount;
    }
  };

  const uniqueSources = [...new Set(
    filteredItems.filter((item) => item.source !== null).map((item) => item.source!)
  )];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Knowledge Base</h2>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/kb/write')}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md
                       hover:bg-indigo-700 transition-colors"
          >
            + 직접 작성
          </button>
          <button
            onClick={handlePdfUploadClick}
            className="px-3 py-1.5 text-sm text-indigo-600 border border-indigo-300 rounded-md
                       hover:bg-indigo-50 transition-colors"
          >
            PDF 업로드
          </button>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="제목 또는 내용 검색..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {sortOptions.map(({ key, label }) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Source Filter Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {filterTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSourceFilter(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              sourceFilter === key
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label} ({getCount(key)})
          </button>
        ))}
      </div>

      {/* Book-level delete buttons for PDF filter */}
      {sourceFilter === 'pdf' && uniqueSources.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {uniqueSources.map((source) => {
            const count = filteredItems.filter((item) => item.source === source).length;
            return (
              <div
                key={source}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md"
              >
                <span className="text-sm text-purple-700">{source} ({count})</span>
                <button
                  onClick={() => handleDeleteBook(source)}
                  className="text-xs text-red-500 hover:text-red-700"
                  title="책 전체 삭제"
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : error ? (
        <div className="text-red-500 text-sm">Error: {error}</div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>
            {sourceFilter === 'all' && (search
              ? '검색 결과가 없습니다.'
              : 'KB 항목이 없습니다. 직접 작성하거나 PDF를 업로드하세요.')}
            {sourceFilter === 'manual' && '직접 작성한 KB 항목이 없습니다.'}
            {sourceFilter === 'pdf' && '업로드된 PDF 도서가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              data-testid="kb-card"
              className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                item.pinnedAt
                  ? 'border-amber-300 bg-amber-50/30'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div
                  onClick={() => navigate(`/kb/${item.id}`)}
                  className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                >
                  {item.source ? (
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full shrink-0">
                      도서
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full shrink-0">
                      직접 작성
                    </span>
                  )}
                  <h3 className="font-semibold text-gray-800 truncate">{item.title}</h3>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePin(item.id, !!item.pinnedAt);
                    }}
                    title={item.pinnedAt ? 'FAQ에서 고정 해제' : 'FAQ에 고정'}
                    aria-label={item.pinnedAt ? 'Unpin' : 'Pin'}
                    data-testid={`kb-pin-toggle-${item.id}`}
                    className={`p-1 rounded transition-colors ${
                      item.pinnedAt
                        ? 'text-amber-500 hover:text-amber-700'
                        : 'text-gray-300 hover:text-amber-500'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                  {item.category && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                      {item.category}
                    </span>
                  )}
                </div>
              </div>

              {item.source && (
                <p className="text-xs text-purple-600 mb-1">source: {item.source}</p>
              )}
              {item.pinnedAt && (
                <p className="text-xs text-amber-600 mb-1">📌 FAQ 고정됨</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <PdfUploadModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onUploadComplete={fetchKbItems}
      />

      {/* Toast — 비로그인 PDF 업로드 안내 */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 px-4 py-3 rounded shadow-lg text-white text-sm z-50 bg-red-500"
        >
          {toast}
        </div>
      )}

      {/* Pin error toast */}
      {pinError && (
        <div
          role="alert"
          data-testid="kb-pin-error"
          className="fixed bottom-4 right-4 px-4 py-3 rounded shadow-lg text-white text-sm z-50 bg-red-500"
        >
          {pinError}
        </div>
      )}
    </div>
  );
}
