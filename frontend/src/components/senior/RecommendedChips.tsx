import { KbItem } from '@/types/senior';

interface RecommendedChipsProps {
  items: KbItem[];
  onChipClick: (item: KbItem) => void;
  maxItems?: number;
}

/**
 * Resolve chip label per requirement ④:
 *   - PDF KB → source (book title)
 *   - Manual KB → category (fallback to title if no category)
 */
function resolveChipLabel(item: KbItem): string {
  if (item.source && item.source.trim()) return item.source;
  if (item.category && item.category.trim()) return item.category;
  return item.title;
}

export default function RecommendedChips({ items, onChipClick, maxItems = 6 }: RecommendedChipsProps) {
  const visible = items.slice(0, maxItems);
  if (visible.length === 0) return null;

  return (
    <div data-testid="senior-recommended-chips" className="mt-6">
      <p className="text-xs text-gray-500 mb-2">추천 질문</p>
      <div className="flex flex-wrap gap-2 sm:flex-wrap overflow-x-auto sm:overflow-visible scrollbar-hide">
        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChipClick(item)}
            data-testid={`senior-chip-${item.id}`}
            className="shrink-0 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md
                       hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            {resolveChipLabel(item)}
          </button>
        ))}
      </div>
    </div>
  );
}
