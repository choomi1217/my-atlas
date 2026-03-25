import { useState, useRef, useEffect } from 'react';
import { ChatMessage, FaqItem } from '@/types/senior';

interface ChatViewProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  faqContext: FaqItem | null;
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

export default function ChatView({
  messages,
  isStreaming,
  error,
  faqContext,
  onSendMessage,
  onClearChat,
  inputRef,
}: ChatViewProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fallbackInputRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef || fallbackInputRef;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus when faqContext is set
  useEffect(() => {
    if (faqContext) {
      textareaRef.current?.focus();
    }
  }, [faqContext, textareaRef]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* FAQ context banner */}
      {faqContext && (
        <div className="px-3 py-2 mb-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
          <span className="font-medium">FAQ 참고:</span> {faqContext.title}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>
              {faqContext
                ? `"${faqContext.title}" 관련 추가 질문을 입력하세요.`
                : 'Ask your Senior QA any question...'}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] px-4 py-3 rounded-lg whitespace-pre-wrap text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.content || (isStreaming ? '...' : '')}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 mb-2 text-sm text-red-600 bg-red-50 rounded">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-200 pt-3 flex gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={faqContext ? `"${faqContext.title}" 관련 질문을 입력하세요...` : 'Type your question...'}
            rows={1}
            disabled={isStreaming}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       disabled:opacity-50 text-sm"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg
                     hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {isStreaming ? 'Sending...' : 'Send'}
        </button>
        {messages.length > 0 && (
          <button
            onClick={onClearChat}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300
                       rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
