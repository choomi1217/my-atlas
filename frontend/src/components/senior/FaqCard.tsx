import { useState } from 'react';
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
      onClick={() => setExpanded(!expanded)}
      className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Tags + Pin/Source indicators */}
      <div className="flex flex-wrap gap-1 mb-2">
        {item.pinnedAt && (
          <span className="px-2 py-0.5 text-xs bg-amber-50 text-amber-600 rounded-full">
            Pinned
          </span>
        )}
        {item.source && (
          <span className="px-2 py-0.5 text-xs bg-green-50 text-green-600 rounded-full">
            PDF
          </span>
        )}
        {item.category && (
          <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded-full">
            {item.category}
          </span>
        )}
        {item.tags &&
          item.tags.split(',').map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-600 rounded-full"
            >
              #{tag.trim()}
            </span>
          ))}
      </div>

      {/* Title */}
      <h3 className={`font-semibold text-gray-800 ${expanded ? '' : 'truncate'}`}>
        {item.title}
      </h3>

      {/* Expanded content */}
      {expanded && (
        <>
          <hr className="my-3 border-gray-200" />
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{item.content}</p>

          <hr className="my-3 border-gray-200" />

          {/* Send to Chat button - full width */}
          <button
            onClick={handleSendToChat}
            className="w-full py-2.5 text-sm font-medium text-indigo-600 bg-indigo-50
                       rounded-lg hover:bg-indigo-100 transition-colors"
          >
            Chat에서 더 물어보기 &rarr;
          </button>
        </>
      )}
    </div>
  );
}
