import { useState } from 'react';
import { useFaq } from '@/hooks/useFaq';
import { FaqItem } from '@/types/senior';
import FaqFormModal from './FaqFormModal';

export default function FaqListView() {
  const { faqs, isLoading, error, createFaq, updateFaq, deleteFaq } = useFaq();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<FaqItem | null>(null);

  const handleCreate = () => {
    setEditItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (faq: FaqItem) => {
    setEditItem(faq);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this FAQ?')) return;
    await deleteFaq(id);
  };

  const handleSubmit = async (request: { title: string; content: string; tags?: string }) => {
    if (editItem) {
      await updateFaq(editItem.id, request);
    } else {
      await createFaq(request);
    }
  };

  if (isLoading) {
    return <div className="text-gray-400 text-sm">Loading FAQs...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-sm">Error: {error}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{faqs.length} FAQ(s)</p>
        <button
          onClick={handleCreate}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md
                     hover:bg-indigo-700 transition-colors"
        >
          + New FAQ
        </button>
      </div>

      {faqs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No FAQs yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-gray-800 mb-2">{faq.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-3 mb-3">{faq.content}</p>
              {faq.tags && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {faq.tags.split(',').map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => handleEdit(faq)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(faq.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FaqFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        editItem={editItem}
      />
    </div>
  );
}
