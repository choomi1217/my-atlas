import { useCallback } from 'react';
import { kbApi } from '@/api/senior';

export const useImageUpload = () => {
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const url = await kbApi.uploadImage(file);
      return url;
    } catch {
      alert('이미지 업로드에 실패했습니다.');
      return null;
    }
  }, []);

  const handleEditorPaste = useCallback(
    async (
      e: React.ClipboardEvent,
      setContent: (updater: (prev: string) => string) => void
    ) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const url = await uploadImage(file);
          if (url) {
            setContent((prev) => prev + `\n![image](${url})\n`);
          }
          break;
        }
      }
    },
    [uploadImage]
  );

  const handleEditorDrop = useCallback(
    async (
      e: React.DragEvent,
      setContent: (updater: (prev: string) => string) => void
    ) => {
      const files = e.dataTransfer?.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          const url = await uploadImage(file);
          if (url) {
            setContent((prev) => prev + `\n![image](${url})\n`);
          }
        }
      }
    },
    [uploadImage]
  );

  return { uploadImage, handleEditorPaste, handleEditorDrop };
};
