import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, KbItem, KbRequest, ChatSession } from '@/types/senior';
import CategoryAutocomplete from '@/components/kb/CategoryAutocomplete';

interface ChatViewProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  faqContext: KbItem | null;
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  onSaveToKb?: (request: KbRequest) => Promise<void>;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  sessions?: ChatSession[];
  activeSessionId?: number | null;
  onSelectSession?: (id: number) => void;
  onNewSession?: () => void;
  onDeleteSession?: (id: number) => void;
  onRenameSession?: (id: number, title: string) => void;
}

export default function ChatView({
  messages,
  isStreaming,
  error,
  faqContext,
  onSendMessage,
  onClearChat,
  onSaveToKb,
  inputRef,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: ChatViewProps) {
  const [input, setInput] = useState('');
  const [kbSaveIndex, setKbSaveIndex] = useState<number | null>(null);
  const [kbSaveSuccess, setKbSaveSuccess] = useState<string | null>(null);
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

  // Find the user message right before this assistant message
  const getUserQuestionForAssistant = (index: number): string => {
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i].content.slice(0, 100);
      }
    }
    return '';
  };

  const handleKbSave = async (request: KbRequest) => {
    if (!onSaveToKb) return;
    await onSaveToKb(request);
    setKbSaveIndex(null);
    setKbSaveSuccess('Knowledge Base에 저장되었습니다');
    setTimeout(() => setKbSaveSuccess(null), 3000);
  };

  return (
    <div className="flex h-[calc(100vh-180px)]">
      {/* Session sidebar */}
      {sessions && (
        <div className="w-56 flex-shrink-0 border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <button
              onClick={onNewSession}
              className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600
                         rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + 새 채팅
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-1 px-3 py-2 cursor-pointer text-sm border-b border-gray-100
                           ${activeSessionId === session.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
                onClick={() => onSelectSession?.(session.id)}
              >
                <span className="flex-1 truncate">{session.title || 'New Chat'}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteSession?.(session.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs px-1"
                  title="Delete session"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* FAQ context banner */}
        {faqContext && (
          <div className="px-3 py-2 mb-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
            <span className="font-medium">FAQ 참고:</span> {faqContext.title}
          </div>
        )}

        {/* Success toast */}
        {kbSaveSuccess && (
          <div className="px-3 py-2 mb-2 text-sm text-green-700 bg-green-50 rounded-lg border border-green-200">
            {kbSaveSuccess}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4 px-2">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>
                {faqContext
                  ? `"${faqContext.title}" 관련 추가 질문을 입력하세요.`
                  : 'Ask your Senior QA any question...'}
              </p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[75%] group relative">
                {msg.role === 'assistant' ? (
                  <div className="px-4 py-3 rounded-lg bg-gray-100">
                    <div
                      data-testid={`chat-message-content-${msg.id}`}
                      className="prose prose-sm max-w-none
                                 prose-p:my-1 prose-p:text-gray-800
                                 prose-headings:my-2 prose-headings:text-gray-900 prose-headings:font-semibold
                                 prose-strong:text-gray-900 prose-strong:font-bold
                                 prose-em:text-gray-800
                                 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                                 prose-pre:my-2 prose-pre:bg-gray-900 prose-pre:text-gray-100
                                 prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                                 prose-a:text-indigo-600 prose-a:underline
                                 prose-table:my-2 prose-th:bg-gray-50 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-td:border prose-th:border"
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content || (isStreaming && idx === messages.length - 1 ? '...' : '')}
                      </ReactMarkdown>
                    </div>
                    {/* KB save button — only on completed assistant messages */}
                    {onSaveToKb && msg.content && !(isStreaming && idx === messages.length - 1) && (
                      <button
                        onClick={() => setKbSaveIndex(idx)}
                        className="mt-2 text-xs text-gray-400 hover:text-indigo-600 transition-colors
                                   opacity-0 group-hover:opacity-100"
                      >
                        KB에 저장
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-3 rounded-lg bg-indigo-600 text-white whitespace-pre-wrap text-sm">
                    {msg.content || ''}
                  </div>
                )}

                {/* KB save inline form */}
                {kbSaveIndex === idx && (
                  <KbSaveForm
                    defaultTitle={getUserQuestionForAssistant(idx)}
                    defaultContent={msg.content}
                    onSave={(req) => handleKbSave(req)}
                    onCancel={() => setKbSaveIndex(null)}
                  />
                )}
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
        <div className="border-t border-gray-200 pt-3 px-2 flex gap-2">
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
    </div>
  );
}

/** Inline form for saving an assistant message to KB */
function KbSaveForm({
  defaultTitle,
  defaultContent,
  onSave,
  onCancel,
}: {
  defaultTitle: string;
  defaultContent: string;
  onSave: (req: KbRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [category, setCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        title,
        content: defaultContent,
        category: category || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="kb-save-form"
      className="mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm space-y-2"
    >
      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          data-testid="kb-save-title"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div data-testid="kb-save-category">
        <CategoryAutocomplete value={category} onChange={setCategory} />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          data-testid="kb-save-cancel"
          className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || !title.trim()}
          data-testid="kb-save-submit"
          className="px-3 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save to KB'}
        </button>
      </div>
    </form>
  );
}
