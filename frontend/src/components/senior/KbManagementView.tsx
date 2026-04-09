import { useState } from 'react';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { KbItem } from '@/types/senior';
import KbFormModal from './KbFormModal';
import CompanyFeaturesView from './CompanyFeaturesView';

type KbSubView = 'list' | 'features';

export default function KbManagementView() {
  const {
    kbItems, isLoading, error,
    createKbItem, updateKbItem, deleteKbItem,
    pinKbItem, unpinKbItem,
  } = useKnowledgeBase();
  const [subView, setSubView] = useState<KbSubView>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<KbItem | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

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

  const handleTogglePin = async (item: KbItem) => {
    setPinError(null);
    try {
      if (item.pinnedAt) {
        await unpinKbItem(item.id);
      } else {
        await pinKbItem(item.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pin operation failed';
      if (msg.includes('Maximum') || msg.includes('15')) {
        setPinError('최대 15건까지 고정할 수 있습니다.');
      } else {
        setPinError(msg);
      }
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

          {pinError && (
            <div className="mb-3 px-3 py-2 text-sm text-red-700 bg-red-50 rounded-lg">
              {pinError}
            </div>
          )}

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
                  className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                    item.pinnedAt
                      ? 'border-amber-300 bg-amber-50/30'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">{item.title}</h3>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      {item.hitCount > 0 && (
                        <span className="text-xs text-gray-400">{item.hitCount}회</span>
                      )}
                      <button
                        onClick={() => handleTogglePin(item)}
                        title={item.pinnedAt ? 'Unpin from FAQ' : 'Pin to FAQ'}
                        className={`p-1 rounded transition-colors ${
                          item.pinnedAt
                            ? 'text-amber-500 hover:text-amber-700'
                            : 'text-gray-300 hover:text-amber-500'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                      {item.category && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                          {item.category}
                        </span>
                      )}
                    </div>
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
