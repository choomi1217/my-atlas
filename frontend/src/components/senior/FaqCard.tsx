import { useState } from 'react';
import { FaqItem } from '@/types/senior';

interface FaqCardProps {
  faq: FaqItem;
  onSendToChat: (faq: FaqItem) => void;
  onEdit: (faq: FaqItem) => void;
  onDelete: (id: number) => void;
}

export default function FaqCard({ faq, onSendToChat, onEdit, onDelete }: FaqCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleSendToChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSendToChat(faq);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(faq);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(faq.id);
  };

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Tags */}
      {faq.tags && (
        <div className="flex flex-wrap gap-1 mb-2">
          {faq.tags.split(',').map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-600 rounded-full"
            >
              #{tag.trim()}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h3 className={`font-semibold text-gray-800 ${expanded ? '' : 'truncate'}`}>
        {faq.title}
      </h3>

      {/* Expanded content */}
      {expanded && (
        <>
          <hr className="my-3 border-gray-200" />
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{faq.content}</p>

          {/* Edit/Delete buttons */}
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={handleEdit}
              className="text-xs text-indigo-600 hover:underline"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="text-xs text-red-500 hover:underline"
            >
              Delete
            </button>
          </div>

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
