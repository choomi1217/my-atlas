import { useState, useRef } from 'react';
import { PdfUploadJob } from '@/types/senior';
import { usePdfUpload } from '@/hooks/usePdfUpload';

interface PdfUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

export default function PdfUploadModal({ isOpen, onClose, onUploadComplete }: PdfUploadModalProps) {
  const [bookTitle, setBookTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isUploading, currentJob, error, uploadPdf, reset } = usePdfUpload({
    onComplete: (_job: PdfUploadJob) => {
      onUploadComplete();
      setTimeout(() => {
        handleClose();
      }, 2000);
    },
  });

  if (!isOpen) return null;

  const handleClose = () => {
    if (isUploading) return;
    setBookTitle('');
    setSelectedFile(null);
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !bookTitle.trim()) return;
    await uploadPdf(selectedFile, bookTitle.trim());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">PDF 업로드</h3>
          </div>

          <div className="px-6 py-4 space-y-4">
            {/* Book Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                책 제목
              </label>
              <input
                type="text"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                required
                disabled={isUploading}
                placeholder="예: 소프트웨어 테스팅"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500
                           disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>

            {/* File Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PDF 파일
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={isUploading}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm
                           text-gray-500 hover:border-indigo-400 hover:text-indigo-600
                           transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedFile ? selectedFile.name : '파일 선택 (.pdf)'}
              </button>
            </div>

            {/* Progress / Status */}
            {isUploading && currentJob && (
              <div className="rounded-md bg-blue-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-blue-700">
                    {currentJob.status === 'PENDING' ? '대기 중...' : '처리 중...'}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-1.5 rounded-full animate-pulse w-full" />
                </div>
              </div>
            )}

            {/* Done */}
            {currentJob?.status === 'DONE' && (
              <div className="rounded-md bg-green-50 p-3">
                <p className="text-sm font-medium text-green-700">
                  {currentJob.totalChunks}개 청크 생성 완료
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isUploading}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md
                         hover:bg-gray-50 disabled:opacity-50"
            >
              {currentJob?.status === 'DONE' ? '닫기' : '취소'}
            </button>
            {!currentJob && (
              <button
                type="submit"
                disabled={isUploading || !bookTitle.trim() || !selectedFile}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md
                           hover:bg-indigo-700 disabled:opacity-50"
              >
                업로드
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
