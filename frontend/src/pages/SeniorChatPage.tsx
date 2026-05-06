import { useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSeniorChat } from '@/hooks/useSeniorChat';
import { useChatSessions } from '@/hooks/useChatSessions';
import { kbApi } from '@/api/senior';
import { KbRequest } from '@/types/senior';
import ChatView from '@/components/senior/ChatView';

export default function SeniorChatPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const chat = useSeniorChat();
  const { sessions, fetchSessions, deleteSession, renameSession } = useChatSessions();
  const initialQuerySent = useRef(false);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-send first message from ?q= query param
  useEffect(() => {
    const q = params.get('q');
    if (q && !initialQuerySent.current) {
      initialQuerySent.current = true;
      chat.sendMessage(q);
      // Remove ?q= from URL after sending
      params.delete('q');
      setParams(params, { replace: true });
    }
  }, [params, setParams, chat]);

  // Refresh sessions when streaming completes
  useEffect(() => {
    if (!chat.isStreaming && chat.sessionId) {
      fetchSessions();
    }
  }, [chat.isStreaming, chat.sessionId, fetchSessions]);

  const handleSelectSession = useCallback(
    async (id: number) => {
      await chat.loadSession(id);
    },
    [chat]
  );

  const handleNewSession = useCallback(() => {
    chat.clearChat();
  }, [chat]);

  const handleDeleteSession = useCallback(
    async (id: number) => {
      await deleteSession(id);
      if (chat.sessionId === id) {
        chat.clearChat();
      }
    },
    [deleteSession, chat]
  );

  const handleSaveToKb = useCallback(async (request: KbRequest) => {
    await kbApi.create(request);
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">My Senior — Chat</h2>
        <button
          type="button"
          onClick={() => navigate('/senior')}
          data-testid="senior-chat-back"
          className="px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-300
                     rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← 메인으로
        </button>
      </div>

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
    </div>
  );
}
