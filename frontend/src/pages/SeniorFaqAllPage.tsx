import { useNavigate } from 'react-router-dom';
import { KbItem } from '@/types/senior';
import FaqView from '@/components/senior/FaqView';

export default function SeniorFaqAllPage() {
  const navigate = useNavigate();

  const handleSendToChat = (item: KbItem) => {
    const query = encodeURIComponent(item.title);
    navigate(`/senior/chat?q=${query}`);
  };

  const handleGoToChat = () => {
    navigate('/senior/chat');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">자주 묻는 질문</h2>
        <button
          type="button"
          onClick={() => navigate('/senior')}
          data-testid="senior-faq-all-back"
          className="px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-300
                     rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← 메인으로
        </button>
      </div>
      <FaqView onSendToChat={handleSendToChat} onGoToChat={handleGoToChat} />
    </div>
  );
}
