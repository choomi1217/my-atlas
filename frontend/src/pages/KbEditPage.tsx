import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import { kbApi } from '@/api/senior';
import { useImageUpload } from '@/hooks/useImageUpload';
import CategoryAutocomplete from '@/components/common/CategoryAutocomplete';
import { kbCategoryApi } from '@/api/senior';

export default function KbEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { uploadImage } = useImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    kbApi
      .getById(Number(id))
      .then((item) => {
        setTitle(item.title);
        setContent(item.content);
        setCategory(item.category || '');
        setSource(item.source);
      })
      .catch(() => setError('KB 항목을 불러올 수 없습니다.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    if (!id || !title.trim() || !content.trim()) return;
    setIsSubmitting(true);
    try {
      await kbApi.update(Number(id), {
        title,
        content,
        category: category || undefined,
      });
      navigate(`/kb/${id}`);
    } catch {
      alert('수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="text-gray-400 text-sm p-4">Loading...</div>;
  if (error) return <div className="text-red-500 text-sm p-4">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto" data-color-mode="light">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-800">글 수정</h2>
          {source && (
            <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
              도서: {source}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/kb/${id}`)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md
                       hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !content.trim()}
            className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md
                       hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        className="w-full px-4 py-3 text-xl font-semibold border border-gray-300 rounded-md mb-4
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {/* Category */}
      <div className="mb-4">
        <CategoryAutocomplete value={category} onChange={setCategory} fetchAll={kbCategoryApi.getAll} placeholder="카테고리 (예: Test Design, Automation)" />
      </div>

      {/* Image Upload Button */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md
                     hover:bg-gray-50 transition-colors"
        >
          이미지 첨부
        </button>
        <span className="text-xs text-gray-400">또는 에디터에 이미지를 붙여넣기/드래그하세요</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = await uploadImage(file);
            if (url) setContent((prev) => prev + `\n![image](${url})\n`);
            e.target.value = '';
          }}
        />
      </div>

      {/* Markdown Editor */}
      <div
        onPaste={async (e) => {
          const items = e.clipboardData?.items;
          if (!items) return;
          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              e.preventDefault();
              const file = item.getAsFile();
              if (!file) continue;
              const url = await uploadImage(file);
              if (url) setContent((prev) => prev + `\n![image](${url})\n`);
              break;
            }
          }
        }}
        onDrop={async (e) => {
          const files = e.dataTransfer?.files;
          if (!files) return;
          for (const file of Array.from(files)) {
            if (file.type.startsWith('image/')) {
              e.preventDefault();
              const url = await uploadImage(file);
              if (url) setContent((prev) => prev + `\n![image](${url})\n`);
            }
          }
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        <MDEditor
          value={content}
          onChange={(val) => setContent(val || '')}
          height={500}
          preview="live"
        />
      </div>
    </div>
  );
}
