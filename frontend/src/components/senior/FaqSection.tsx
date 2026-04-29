import { useState, useMemo } from 'react';
import { KbItem } from '@/types/senior';
import FaqCard from './FaqCard';

interface FaqSectionProps {
  items: KbItem[];
  onSendToChat: (item: KbItem) => void;
  onShowAll?: () => void;
  maxVisible?: number;
}

export default function FaqSection({
  items,
  onSendToChat,
  onShowAll,
  maxVisible = 6,
}: FaqSectionProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q)
    );
  }, [items, search]);

  const visible = filtered.slice(0, maxVisible);

  return (
    <section data-testid="senior-faq-section" className="mt-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-[15px] font-medium text-gray-900">자주 묻는 질문</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
            >
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="FAQ 검색..."
              data-testid="senior-faq-search"
              className="w-full sm:w-[200px] pl-7 pr-3 py-1.5 text-sm border border-gray-300 rounded-md
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {onShowAll && (
            <button
              type="button"
              onClick={onShowAll}
              data-testid="senior-faq-show-all"
              className="text-sm text-indigo-600 hover:underline shrink-0"
            >
              전체보기 →
            </button>
          )}
        </div>
      </div>

      {/* Cards */}
      {visible.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {search ? '검색 결과가 없습니다.' : '고정된 FAQ가 없습니다. KB에서 항목을 고정해주세요.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map((item) => (
            <FaqCard key={item.id} item={item} onSendToChat={onSendToChat} />
          ))}
        </div>
      )}
    </section>
  );
}
