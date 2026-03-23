import { useState } from 'react';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { KbItem } from '@/types/senior';
import KbFormModal from './KbFormModal';
import CompanyFeaturesView from './CompanyFeaturesView';

type KbSubView = 'list' | 'features';

export default function KbManagementView() {
  const { kbItems, isLoading, error, createKbItem, updateKbItem, deleteKbItem } =
    useKnowledgeBase();
  const [subView, setSubView] = useState<KbSubView>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<KbItem | null>(null);

  const handleCreate = () => {
    setEditItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: KbItem) => {
    setEditItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this KB entry?')) return;
    await deleteKbItem(id);
  };

  const handleSubmit = async (request: {
    title: string;
    content: string;
    category?: string;
    tags?: string;
  }) => {
    if (editItem) {
      await updateKbItem(editItem.id, request);
    } else {
      await createKbItem(request);
    }
  };

  return (
    <div>
      {/* Sub-view toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSubView('list')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            subView === 'list'
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          KB Articles
        </button>
        <button
          onClick={() => setSubView('features')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            subView === 'features'
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Company Features
        </button>
      </div>

      {subView === 'features' ? (
        <CompanyFeaturesView />
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">{kbItems.length} article(s)</p>
            <button
              onClick={handleCreate}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md
                         hover:bg-indigo-700 transition-colors"
            >
              + New Article
            </button>
          </div>

          {isLoading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : error ? (
            <div className="text-red-500 text-sm">Error: {error}</div>
          ) : kbItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No KB articles yet. Register QA book prompts!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kbItems.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">{item.title}</h3>
                    {item.category && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full ml-2 shrink-0">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3 mb-3">{item.content}</p>
                  {item.tags && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.tags.split(',').map((tag, idx) => (
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
                      onClick={() => handleEdit(item)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <KbFormModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSubmit={handleSubmit}
            editItem={editItem}
          />
        </>
      )}
    </div>
  );
}
