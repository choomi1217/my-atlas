import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useImageUpload } from '../useImageUpload';

vi.mock('@/api/senior', () => ({
  kbApi: {
    uploadImage: vi.fn(),
  },
}));

import { kbApi } from '@/api/senior';

describe('useImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  describe('uploadImage', () => {
    it('returns relative URL from API (not absolute)', async () => {
      const relativeUrl = '/api/kb/images/test-uuid.png';
      vi.mocked(kbApi.uploadImage).mockResolvedValue(relativeUrl);

      const { result } = renderHook(() => useImageUpload());
      const file = new File(['test'], 'test.png', { type: 'image/png' });

      let url: string | null = null;
      await act(async () => {
        url = await result.current.uploadImage(file);
      });

      expect(url).toBe(relativeUrl);
      expect(url).not.toMatch(/^http/);
    });

    it('returns null on upload failure', async () => {
      vi.mocked(kbApi.uploadImage).mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useImageUpload());
      const file = new File(['test'], 'test.png', { type: 'image/png' });

      let url: string | null = 'not-null';
      await act(async () => {
        url = await result.current.uploadImage(file);
      });

      expect(url).toBeNull();
      expect(window.alert).toHaveBeenCalledWith('이미지 업로드에 실패했습니다.');
    });
  });

  describe('handleEditorPaste', () => {
    it('inserts markdown image with relative URL on paste', async () => {
      const relativeUrl = '/api/kb/images/pasted-uuid.png';
      vi.mocked(kbApi.uploadImage).mockResolvedValue(relativeUrl);

      const { result } = renderHook(() => useImageUpload());
      const setContent = vi.fn((updater: (prev: string) => string) => updater('existing'));

      const file = new File(['img'], 'paste.png', { type: 'image/png' });
      const item = {
        type: 'image/png',
        getAsFile: () => file,
      } as DataTransferItem;

      const event = {
        clipboardData: { items: [item] },
        preventDefault: vi.fn(),
      } as unknown as React.ClipboardEvent;

      await act(async () => {
        await result.current.handleEditorPaste(event, setContent);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(setContent).toHaveBeenCalled();
      const updater = setContent.mock.calls[0][0];
      const newContent = updater('existing');
      expect(newContent).toBe(`existing\n![image](${relativeUrl})\n`);
      expect(newContent).not.toContain('http://');
    });
  });
});
