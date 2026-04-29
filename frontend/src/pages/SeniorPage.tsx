import { useNavigate } from 'react-router-dom';
import { useCuratedFaq } from '@/hooks/useCuratedFaq';
import { KbItem } from '@/types/senior';
import HeroSection from '@/components/senior/HeroSection';
import RecommendedChips from '@/components/senior/RecommendedChips';
import FaqSection from '@/components/senior/FaqSection';

/**
 * Resolve chip query string per requirement ④:
 *   - PDF KB → source (book title)
 *   - Manual KB → category (fallback to title)
 */
function resolveChipQuery(item: KbItem): string {
  if (item.source && item.source.trim()) return item.source;
  if (item.category && item.category.trim()) return item.category;
  return item.title;
}

export default function SeniorPage() {
  const navigate = useNavigate();
  const { faqs, isLoading, error } = useCuratedFaq();

  const navigateToChat = (message: string) => {
    const query = encodeURIComponent(message);
    navigate(`/senior/chat?q=${query}`);
  };

  const handleHeroSubmit = (message: string) => {
    navigateToChat(message);
  };

  const handleChipClick = (item: KbItem) => {
    navigateToChat(resolveChipQuery(item));
  };

  const handleFaqSendToChat = (item: KbItem) => {
    navigateToChat(item.title);
  };

  const handleShowAll = () => {
    navigate('/senior/faq');
  };

  return (
    <div>
      {/* Hero Section + Chips */}
      <HeroSection onSubmit={handleHeroSubmit} />
      {!isLoading && !error && (
        <div className="mt-2 px-2">
          <RecommendedChips items={faqs} onChipClick={handleChipClick} maxItems={6} />
        </div>
      )}

      {/* FAQ Section */}
      {error ? (
        <div className="mt-10 text-red-500 text-sm text-center">
          FAQ 로딩 실패: {error}
        </div>
      ) : (
        <FaqSection
          items={faqs}
          onSendToChat={handleFaqSendToChat}
          onShowAll={handleShowAll}
          maxVisible={6}
        />
      )}
    </div>
  );
}
