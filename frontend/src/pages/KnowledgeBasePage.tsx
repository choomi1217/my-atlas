import { useState } from 'react';
import { useKnowledgeBase, SourceFilter } from '@/hooks/useKnowledgeBase';
import { KbItem } from '@/types/senior';
import KbFormModal from '@/components/senior/KbFormModal';
import PdfUploadModal from '@/components/kb/PdfUploadModal';

const filterTabs: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'manual', label: '직접 작성' },
  { key: 'pdf', label: 'PDF 도서' },
];

export default function KnowledgeBasePage() {
  const {
    kbItems,
    filteredItems,
    isLoading,
    error,
    sourceFilter,
    setSourceFilter,
    manualCount,
    pdfCount,
    fetchKbItems,
    createKbItem,
    updateKbItem,
    deleteKbItem,
    deleteBook,
  } = useKnowledgeBase();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<KbItem | null>(null);

  const handleCreate = () => {
    setEditItem(null);
    setIsFormModalOpen(true);
  };

  const handleEdit = (item: KbItem) => {
    setEditItem(item);
    setIsFormModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 KB 항목을 삭제하시겠습니까?')) return;
    await deleteKbItem(id);
  };

  const handleDeleteBook = async (source: string) => {
    if (!window.confirm(`"${source}"의 전체 청크를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    await deleteBook(source);
  };

  const handleFormSubmit = async (request: {
    title: string;
    content: string;
    category?: string;
    tags?: string;
  }) => {
    if (editItem) {
      await updateKbItem(editItem.id, request);
    } else {
      await createKbItem(request);
    }
  };

  const getCount = (key: SourceFilter) => {
    switch (key) {
      case 'all': return kbItems.length;
      case 'manual': return manualCount;
      case 'pdf': return pdfCount;
    }
  };

  // Group PDF items by source for book-level delete
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
            onClick={handleCreate}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md
                       hover:bg-indigo-700 transition-colors"
          >
            + 직접 작성
          </button>
          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="px-3 py-1.5 text-sm text-indigo-600 border border-indigo-300 rounded-md
                       hover:bg-indigo-50 transition-colors"
          >
            PDF 업로드
          </button>
        </div>
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
            {sourceFilter === 'all' && 'KB 항목이 없습니다. 직접 작성하거나 PDF를 업로드하세요.'}
            {sourceFilter === 'manual' && '직접 작성한 KB 항목이 없습니다.'}
            {sourceFilter === 'pdf' && '업로드된 PDF 도서가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
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
                {item.category && (
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full ml-2 shrink-0">
                    {item.category}
                  </span>
                )}
              </div>

              {item.source && (
                <p className="text-xs text-purple-600 mb-1">source: {item.source}</p>
              )}

              <p className="text-sm text-gray-600 line-clamp-3 mb-3">{item.content}</p>

              {item.tags && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {item.tags.split(',').map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions — only for manual items */}
              {!item.source && (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <KbFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        editItem={editItem}
      />

      <PdfUploadModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onUploadComplete={fetchKbItems}
      />
    </div>
  );
}
