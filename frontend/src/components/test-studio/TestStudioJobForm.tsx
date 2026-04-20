import { useRef, useState } from 'react';
import { SourceType } from '@/types/test-studio';

interface TestStudioJobFormProps {
  productId: number;
  isSubmitting: boolean;
  onSubmit: (form: FormData) => Promise<number>;
}

const MAX_TITLE = 200;
const MAX_CONTENT = 100_000;

/**
 * Test Studio — new Job creation form.
 *
 * Accepts either Markdown text or a PDF file. Submits multipart/form-data
 * matching the backend controller's @RequestParam / @RequestPart signature.
 */
export default function TestStudioJobForm({
  productId,
  isSubmitting,
  onSubmit,
}: TestStudioJobFormProps) {
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('MARKDOWN');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contentTooLong = content.length > MAX_CONTENT;
  const titleTooLong = title.length > MAX_TITLE;

  const resetForm = () => {
    setTitle('');
    setContent('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('제목을 입력하세요.');
      return;
    }
    if (titleTooLong) {
      setFormError(`제목이 너무 깁니다 (최대 ${MAX_TITLE}자).`);
      return;
    }
    if (sourceType === 'MARKDOWN') {
      if (!content.trim()) {
        setFormError('Markdown 내용을 입력하세요.');
        return;
      }
      if (contentTooLong) {
        setFormError(`문서 길이가 ${MAX_CONTENT.toLocaleString()}자를 초과했습니다.`);
        return;
      }
    } else {
      if (!file) {
        setFormError('PDF 파일을 선택하세요.');
        return;
      }
    }

    const form = new FormData();
    form.append('productId', String(productId));
    form.append('sourceType', sourceType);
    form.append('title', title.trim());
    if (sourceType === 'MARKDOWN') {
      form.append('content', content);
    } else if (file) {
      form.append('file', file);
    }

    try {
      await onSubmit(form);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border rounded-lg shadow p-5 space-y-4"
    >
      <h2 className="text-lg font-bold text-gray-800">새 Job 생성</h2>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          제목
        </label>
        <input
          data-testid="test-studio-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSubmitting}
          maxLength={MAX_TITLE + 1}
          placeholder="예: v2.1 NFC 결제 PRD"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500
                     disabled:bg-gray-100"
        />
        <div className="text-xs text-gray-400 text-right mt-1">
          {title.length} / {MAX_TITLE}
        </div>
      </div>

      {/* Source type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          소스 타입
        </label>
        <div className="flex gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              data-testid="test-studio-source-markdown"
              type="radio"
              name="sourceType"
              value="MARKDOWN"
              checked={sourceType === 'MARKDOWN'}
              onChange={() => setSourceType('MARKDOWN')}
              disabled={isSubmitting}
            />
            Markdown
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              data-testid="test-studio-source-pdf"
              type="radio"
              name="sourceType"
              value="PDF"
              checked={sourceType === 'PDF'}
              onChange={() => setSourceType('PDF')}
              disabled={isSubmitting}
            />
            PDF 파일
          </label>
        </div>
      </div>

      {/* Markdown content */}
      {sourceType === 'MARKDOWN' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Markdown 내용
          </label>
          <textarea
            data-testid="test-studio-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSubmitting}
            rows={10}
            placeholder="PRD / 스펙 본문을 붙여넣으세요."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono
                       focus:outline-none focus:ring-2 focus:ring-indigo-500
                       disabled:bg-gray-100"
          />
          <div
            className={`text-xs text-right mt-1 ${
              contentTooLong ? 'text-red-600 font-medium' : 'text-gray-400'
            }`}
          >
            {content.length.toLocaleString()} / {MAX_CONTENT.toLocaleString()}
          </div>
        </div>
      )}

      {/* PDF file */}
      {sourceType === 'PDF' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PDF 파일
          </label>
          <input
            data-testid="test-studio-pdf-file"
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={isSubmitting}
            className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3
                       file:rounded file:border-0 file:bg-indigo-50 file:text-indigo-700
                       hover:file:bg-indigo-100 disabled:opacity-50"
          />
          {file && (
            <p className="text-xs text-gray-500 mt-1">
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>
      )}

      {formError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-2 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          data-testid="test-studio-submit"
          type="submit"
          disabled={isSubmitting || contentTooLong || titleTooLong}
          className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md
                     hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? '제출 중…' : '생성 요청'}
        </button>
      </div>
    </form>
  );
}
