import { useState, useCallback, useRef } from 'react';
import { ChatMessage, FaqContext, KbItem } from '@/types/senior';
import { chatApi, sessionApi } from '@/api/senior';

export const useSeniorChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faqContext, setFaqContext] = useState<KbItem | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;

    setError(null);

    // Capture current faqContext before clearing
    const currentFaqContext: FaqContext | null = faqContext
      ? { title: faqContext.title, content: faqContext.content }
      : null;

    // Add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    // Add empty assistant message placeholder
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    // Clear faqContext after capturing it
    setFaqContext(null);

    const assistantId = assistantMsg.id;

    abortRef.current = chatApi.streamChat(
      text,
      (chunk) => {
        // Append chunk to assistant message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      },
      (returnedSessionId) => {
        setIsStreaming(false);
        // Update sessionId from server response
        if (returnedSessionId) {
          setSessionId(returnedSessionId);
        }
      },
      (err) => {
        setIsStreaming(false);
        setError(err.message);
      },
      currentFaqContext,
      sessionId
    );
  }, [isStreaming, faqContext, sessionId]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearChat = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setError(null);
    setFaqContext(null);
    setSessionId(null);
  }, [stopStreaming]);

  const loadSession = useCallback(async (id: number) => {
    try {
      const detail = await sessionApi.getById(id);
      setSessionId(id);
      setMessages(
        detail.messages.map((m) => ({
          id: String(m.id),
          role: m.role,
          content: m.content,
          timestamp: new Date(m.createdAt),
        }))
      );
      setError(null);
      setFaqContext(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }, []);

  return {
    messages,
    isStreaming,
    error,
    faqContext,
    sessionId,
    setFaqContext,
    sendMessage,
    stopStreaming,
    clearChat,
    loadSession,
  };
};
