import { ConventionItem } from '@/types/convention';

interface ConventionCardProps {
  convention: ConventionItem;
  onClick: () => void;
  onDelete: () => void;
}

export default function ConventionCard({ convention, onClick, onDelete }: ConventionCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      onClick={onClick}
      className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col"
    >
      {/* Image area */}
      {convention.imageUrl ? (
        <div className="w-full h-40 bg-gray-50 flex items-center justify-center">
          <img
            src={convention.imageUrl}
            alt={convention.term}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      ) : (
        <div className="w-full h-40 bg-gray-100 flex flex-col items-center justify-center gap-1">
          <svg
            className="w-10 h-10 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
          <span className="text-xs text-gray-400">No Image</span>
        </div>
      )}

      {/* Content area */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold text-gray-800 truncate flex-1">{convention.term}</h3>
          <button
            onClick={handleDelete}
            className="ml-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
            title="삭제"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>

        {convention.category && (
          <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full mb-2 w-fit">
            {convention.category}
          </span>
        )}

        <p className="text-sm text-gray-600 line-clamp-2">{convention.definition}</p>
      </div>
    </div>
  );
}
