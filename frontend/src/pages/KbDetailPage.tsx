import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import { KbItem } from '@/types/senior';
import { kbApi } from '@/api/senior';

export default function KbDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<KbItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    kbApi
      .getById(Number(id))
      .then(setItem)
      .catch(() => setError('KB 항목을 불러올 수 없습니다.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!item) return;
    if (!window.confirm('이 KB 항목을 삭제하시겠습니까?')) return;
    await kbApi.delete(item.id);
    navigate('/kb');
  };

  if (isLoading) return <div className="text-gray-400 text-sm p-4">Loading...</div>;
  if (error || !item) return <div className="text-red-500 text-sm p-4">{error || '항목을 찾을 수 없습니다.'}</div>;

  return (
    <div className="max-w-4xl mx-auto" data-color-mode="light">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/kb')}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; 목록으로
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/kb/edit/${item.id}`)}
            className="px-4 py-2 text-sm text-indigo-600 border border-indigo-300 rounded-md
                       hover:bg-indigo-50 transition-colors"
          >
            수정
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-md
                       hover:bg-red-50 transition-colors"
          >
            삭제
          </button>
        </div>
      </div>

      {/* Title & Meta */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          {item.source ? (
            <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">도서</span>
          ) : (
            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">직접 작성</span>
          )}
          {item.category && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">{item.category}</span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{item.title}</h1>
        {item.source && (
          <p className="text-sm text-purple-600 mb-1">source: {item.source}</p>
        )}
        <p className="text-xs text-gray-400">
          {new Date(item.createdAt).toLocaleDateString('ko-KR')} 작성
          {item.updatedAt !== item.createdAt && (
            <> &middot; {new Date(item.updatedAt).toLocaleDateString('ko-KR')} 수정</>
          )}
        </p>
      </div>

      {/* Content — Markdown Rendered */}
      <div className="border border-gray-200 rounded-lg p-6 bg-white">
        <MDEditor.Markdown source={item.content} />
      </div>
    </div>
  );
}
