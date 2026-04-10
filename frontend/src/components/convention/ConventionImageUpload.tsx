import { useState, useRef } from 'react';
import { conventionApi } from '@/api/convention';

interface ConventionImageUploadProps {
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
}

export default function ConventionImageUpload({ imageUrl, onImageChange }: ConventionImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await conventionApi.uploadImage(file);
      onImageChange(url);
    } catch {
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleRemove = () => {
    onImageChange(null);
  };

  return (
    <div>
      {imageUrl ? (
        <div className="relative inline-block">
          <img
            src={imageUrl}
            alt="Convention image"
            className="w-full max-h-60 object-contain rounded-lg border border-gray-200"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 w-6 h-6 bg-gray-800 bg-opacity-60 text-white rounded-full
                       flex items-center justify-center hover:bg-opacity-80 transition-opacity"
            title="이미지 제거"
          >
            &times;
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-8 h-8 text-indigo-400 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm text-gray-500">업로드 중...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 16v-8m0 0l-3 3m3-3l3 3M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
              <span className="text-sm text-gray-500">클릭하거나 이미지를 드래그하세요</span>
              <span className="text-xs text-gray-400">PNG, JPG, GIF, WebP (최대 10MB)</span>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
