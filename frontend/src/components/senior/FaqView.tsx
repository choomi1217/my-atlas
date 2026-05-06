import { useState, useMemo } from 'react';
import { useCuratedFaq } from '@/hooks/useCuratedFaq';
import { KbItem } from '@/types/senior';
import FaqCard from './FaqCard';

interface FaqViewProps {
  onSendToChat: (item: KbItem) => void;
  onGoToChat: () => void;
}

export default function FaqView({ onSendToChat, onGoToChat }: FaqViewProps) {
  const { faqs, isLoading, error } = useCuratedFaq();
  const [searchQuery, setSearchQuery] = useState('');

  // Client-side filtering on title + content
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const query = searchQuery.toLowerCase();
    return faqs.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query)
    );
  }, [faqs, searchQuery]);

  if (isLoading) {
    return <div className="text-gray-400 text-sm py-8 text-center">Loading FAQs...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-sm py-8 text-center">Error: {error}</div>;
  }

  return (
    <div>
      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="FAQ 검색 (제목, 내용)..."
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
            <p>KB에 고정된 항목이 여기에 표시됩니다.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFaqs.map((item) => (
            <FaqCard
              key={item.id}
              item={item}
              onSendToChat={onSendToChat}
            />
          ))}
        </div>
      )}
    </div>
  );
}
