import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { KbItem } from '@/types/senior';

interface FaqCardProps {
  item: KbItem;
  onSendToChat: (item: KbItem) => void;
}

export default function FaqCard({ item, onSendToChat }: FaqCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleSendToChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSendToChat(item);
  };

  return (
    <div
      data-testid={`faq-card-${item.id}`}
      onClick={() => setExpanded(!expanded)}
      className="border border-gray-200 rounded-lg p-4 cursor-pointer transition-all
                 hover:border-indigo-400 hover:shadow-sm"
    >
      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-2">
        {item.source && (
          <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-600 rounded">
            PDF
          </span>
        )}
        {item.category && (
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded">
            {item.category}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-800 text-sm mb-1">
        {item.title}
      </h3>

      {/* Snippet (collapsed only) */}
      {!expanded && item.snippet && (
        <p
          data-testid={`faq-snippet-${item.id}`}
          className="text-sm text-gray-500 line-clamp-2"
        >
          {item.snippet}
        </p>
      )}

      {/* Expanded content (inline expand) */}
      {expanded && (
        <>
          <div
            data-testid={`faq-content-${item.id}`}
            className="mt-3 prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2
                       prose-ul:my-1 prose-ol:my-1 prose-pre:my-2
                       prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1
                       prose-code:py-0.5 prose-code:rounded
                       prose-code:before:content-none prose-code:after:content-none"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {item.content}
            </ReactMarkdown>
          </div>

          <button
            onClick={handleSendToChat}
            data-testid={`faq-send-to-chat-${item.id}`}
            className="mt-4 w-full py-2 text-sm font-medium text-indigo-600 bg-indigo-50
                       rounded-md hover:bg-indigo-100 transition-colors"
          >
            Chat에서 더 물어보기 &rarr;
          </button>
        </>
      )}
    </div>
  );
}
