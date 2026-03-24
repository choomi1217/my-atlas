import { useState, useCallback, useRef, useEffect } from 'react';
import { useSeniorChat } from '@/hooks/useSeniorChat';
import { FaqItem } from '@/types/senior';
import ChatView from '@/components/senior/ChatView';
import FaqView from '@/components/senior/FaqView';
import KbManagementView from '@/components/senior/KbManagementView';

type SeniorView = 'faq' | 'chat' | 'kb';

export default function SeniorPage() {
  const [activeView, setActiveView] = useState<SeniorView>('faq');
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chat = useSeniorChat();

  const handleSendToChat = useCallback((faq: FaqItem) => {
    chat.setFaqContext(faq);
    setActiveView('chat');
  }, [chat]);

  const handleGoToChat = useCallback(() => {
    setActiveView('chat');
  }, []);

  // Auto-focus chat input when switching to chat with faqContext
  useEffect(() => {
    if (activeView === 'chat') {
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }, [activeView]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">My Senior</h2>
        <div className="flex gap-2">
          {activeView !== 'kb' && (
            <button
              onClick={() => setActiveView(activeView === 'faq' ? 'chat' : 'faq')}
              className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600
                         rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {activeView === 'faq' ? 'Chat \u2192' : '\u2190 FAQ'}
            </button>
          )}
          <button
            onClick={() => setActiveView(activeView === 'kb' ? 'faq' : 'kb')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeView === 'kb'
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {activeView === 'kb' ? '\u2190 Back' : 'KB'}
          </button>
        </div>
      </div>

      {/* Views */}
      {activeView === 'faq' && (
        <FaqView onSendToChat={handleSendToChat} onGoToChat={handleGoToChat} />
      )}
      {activeView === 'chat' && (
        <ChatView
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          error={chat.error}
          faqContext={chat.faqContext}
          onSendMessage={chat.sendMessage}
          onClearChat={chat.clearChat}
          inputRef={chatInputRef}
        />
      )}
      {activeView === 'kb' && <KbManagementView />}
    </div>
  );
}
