import { useState, useCallback, useRef, useEffect } from 'react';
import { useSeniorChat } from '@/hooks/useSeniorChat';
import { useChatSessions } from '@/hooks/useChatSessions';
import { KbItem, KbRequest } from '@/types/senior';
import { kbApi } from '@/api/senior';
import ChatView from '@/components/senior/ChatView';
import FaqView from '@/components/senior/FaqView';

type SeniorView = 'faq' | 'chat';

export default function SeniorPage() {
  const [activeView, setActiveView] = useState<SeniorView>('faq');
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chat = useSeniorChat();
  const { sessions, fetchSessions, deleteSession, renameSession } = useChatSessions();

  const handleSendToChat = useCallback((item: KbItem) => {
    chat.setFaqContext(item);
    setActiveView('chat');
  }, [chat]);

  const handleGoToChat = useCallback(() => {
    setActiveView('chat');
  }, []);

  const handleSelectSession = useCallback(async (id: number) => {
    await chat.loadSession(id);
    setActiveView('chat');
  }, [chat]);

  const handleNewSession = useCallback(() => {
    chat.clearChat();
    setActiveView('chat');
  }, [chat]);

  const handleDeleteSession = useCallback(async (id: number) => {
    await deleteSession(id);
    // If deleted session is the active one, clear chat
    if (chat.sessionId === id) {
      chat.clearChat();
    }
  }, [deleteSession, chat]);

  const handleSaveToKb = useCallback(async (request: KbRequest) => {
    await kbApi.create(request);
  }, []);

  // Refresh sessions when streaming completes (new session may have been created)
  useEffect(() => {
    if (!chat.isStreaming && chat.sessionId) {
      fetchSessions();
    }
  }, [chat.isStreaming, chat.sessionId, fetchSessions]);

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
        <button
          onClick={() => setActiveView(activeView === 'faq' ? 'chat' : 'faq')}
          className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600
                     rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {activeView === 'faq' ? 'Chat \u2192' : '\u2190 FAQ'}
        </button>
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
          onClearChat={handleNewSession}
          onSaveToKb={handleSaveToKb}
          inputRef={chatInputRef}
          sessions={sessions}
          activeSessionId={chat.sessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={renameSession}
        />
      )}
    </div>
  );
}
