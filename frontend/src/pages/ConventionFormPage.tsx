import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { conventionApi } from '@/api/convention';
import { ConventionItem } from '@/types/convention';
import ConventionImageUpload from '@/components/convention/ConventionImageUpload';

export default function ConventionFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = id !== undefined;

  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ term?: string; definition?: string }>({});

  // Load existing data in edit mode
  useEffect(() => {
    if (!isEditMode) return;

    const fetchConvention = async () => {
      setIsLoading(true);
      try {
        const data: ConventionItem = await conventionApi.getById(Number(id));
        setTerm(data.term);
        setDefinition(data.definition);
        setCategory(data.category || '');
        setImageUrl(data.imageUrl);
      } catch {
        alert('용어를 불러올 수 없습니다.');
        navigate('/conventions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchConvention();
  }, [id, isEditMode, navigate]);

  const validate = (): boolean => {
    const newErrors: { term?: string; definition?: string } = {};
    if (!term.trim()) newErrors.term = 'Term is required';
    if (!definition.trim()) newErrors.definition = 'Definition is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const request = {
        term: term.trim(),
        definition: definition.trim(),
        category: category.trim() || undefined,
        imageUrl,
      };

      if (isEditMode) {
        await conventionApi.update(Number(id), request);
      } else {
        await conventionApi.create(request);
      }
      navigate('/conventions');
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('이 용어를 삭제하시겠습니까?')) return;
    try {
      await conventionApi.delete(Number(id));
      navigate('/conventions');
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  if (isLoading) {
    return <div className="text-gray-400 text-sm">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/conventions')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Word Conventions
        </button>

        {isEditMode && (
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* Form */}
      <div className="space-y-5">
        {/* Term */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Term <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              if (errors.term) setErrors((prev) => ({ ...prev, term: undefined }));
            }}
            placeholder="용어를 입력하세요"
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
              errors.term ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.term && <p className="mt-1 text-xs text-red-500">{errors.term}</p>}
        </div>

        {/* Definition */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Definition <span className="text-red-500">*</span>
          </label>
          <textarea
            value={definition}
            onChange={(e) => {
              setDefinition(e.target.value);
              if (errors.definition) setErrors((prev) => ({ ...prev, definition: undefined }));
            }}
            placeholder="정의를 입력하세요"
            rows={5}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y ${
              errors.definition ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.definition && <p className="mt-1 text-xs text-red-500">{errors.definition}</p>}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="카테고리 (선택)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
          <ConventionImageUpload imageUrl={imageUrl} onImageChange={setImageUrl} />
        </div>

        {/* Save button */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
