import { useState, useMemo } from 'react';
import { useFaq } from '@/hooks/useFaq';
import { FaqItem } from '@/types/senior';
import FaqCard from './FaqCard';
import FaqFormModal from './FaqFormModal';

interface FaqViewProps {
  onSendToChat: (faq: FaqItem) => void;
  onGoToChat: () => void;
}

export default function FaqView({ onSendToChat, onGoToChat }: FaqViewProps) {
  const { faqs, isLoading, error, createFaq, updateFaq, deleteFaq } = useFaq();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<FaqItem | null>(null);

  // Client-side filtering on title + content + tags
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const query = searchQuery.toLowerCase();
    return faqs.filter(
      (faq) =>
        faq.title.toLowerCase().includes(query) ||
        faq.content.toLowerCase().includes(query) ||
        (faq.tags && faq.tags.toLowerCase().includes(query))
    );
  }, [faqs, searchQuery]);

  const handleCreate = () => {
    setEditItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (faq: FaqItem) => {
    setEditItem(faq);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    await deleteFaq(id);
  };

  const handleSubmit = async (request: { title: string; content: string; tags?: string }) => {
    if (editItem) {
      await updateFaq(editItem.id, request);
    } else {
      await createFaq(request);
    }
  };

  if (isLoading) {
    return <div className="text-gray-400 text-sm py-8 text-center">Loading FAQs...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-sm py-8 text-center">Error: {error}</div>;
  }

  return (
    <div>
      {/* Search bar + Add button */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="FAQ 검색 (제목, 내용, 태그)..."
            className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <button
          onClick={handleCreate}
          className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg
                     hover:bg-indigo-700 transition-colors whitespace-nowrap"
        >
          + 추가
        </button>
      </div>

      {/* FAQ card list */}
      {filteredFaqs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {searchQuery.trim() ? (
            <>
              <p className="mb-3">일치하는 FAQ가 없습니다. Chat에서 직접 질문해보세요.</p>
              <button
                onClick={onGoToChat}
                className="px-4 py-2 text-sm text-indigo-600 border border-indigo-300
                           rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Chat으로 이동
              </button>
            </>
          ) : (
            <p>No FAQs yet. Create your first one!</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFaqs.map((faq) => (
            <FaqCard
              key={faq.id}
              faq={faq}
              onSendToChat={onSendToChat}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <FaqFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        editItem={editItem}
      />
    </div>
  );
}
