import apiClient from './client';
import { ApiResponse } from '@/types/features';
import { FaqContext, KbItem, KbRequest, PdfUploadJob } from '@/types/senior';

// 상대 경로 사용 → Vite proxy 경유 (worktree별 포트 자동 대응)
const API_BASE_URL = '';

/**
 * Senior Chat API — uses fetch for SSE streaming (axios doesn't support streaming).
 */
export const chatApi = {
  streamChat: (
    message: string,
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (err: Error) => void,
    faqContext?: FaqContext | null
  ): AbortController => {
    const controller = new AbortController();

    fetch(`${API_BASE_URL}/api/senior/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, faqContext: faqContext || null }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Chat request failed: ${response.status}`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();

        function read() {
          reader!.read().then(({ done, value }) => {
            if (done) {
              onDone();
              return;
            }
            const text = decoder.decode(value, { stream: true });
            // Parse SSE format: data:chunk\n\n
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data:')) {
                onChunk(line.slice(5));
              }
            }
            read();
          });
        }

        read();
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          onError(err);
        }
      });

    return controller;
  },
};

/**
 * Curated FAQ API — returns KB-based curated entries.
 */
export const faqApi = {
  getAll: async (): Promise<KbItem[]> => {
    const response =
      await apiClient.get<ApiResponse<KbItem[]>>('/api/senior/faq');
    return response.data.data;
  },
};

/**
 * Knowledge Base API endpoints.
 */
export const kbApi = {
  getAll: async (): Promise<KbItem[]> => {
    const response = await apiClient.get<ApiResponse<KbItem[]>>('/api/kb');
    return response.data.data;
  },

  getById: async (id: number): Promise<KbItem> => {
    const response =
      await apiClient.get<ApiResponse<KbItem>>(`/api/kb/${id}`);
    return response.data.data;
  },

  create: async (request: KbRequest): Promise<KbItem> => {
    const response = await apiClient.post<ApiResponse<KbItem>>(
      '/api/kb',
      request
    );
    return response.data.data;
  },

  update: async (id: number, request: KbRequest): Promise<KbItem> => {
    const response = await apiClient.put<ApiResponse<KbItem>>(
      `/api/kb/${id}`,
      request
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/kb/${id}`);
  },

  uploadPdf: async (file: File, bookTitle: string): Promise<{ jobId: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bookTitle', bookTitle);
    const response = await apiClient.post<ApiResponse<{ jobId: number }>>(
      '/api/kb/upload-pdf',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },

  getJob: async (jobId: number): Promise<PdfUploadJob> => {
    const response = await apiClient.get<ApiResponse<PdfUploadJob>>(
      `/api/kb/jobs/${jobId}`
    );
    return response.data.data;
  },

  getAllJobs: async (): Promise<PdfUploadJob[]> => {
    const response = await apiClient.get<ApiResponse<PdfUploadJob[]>>(
      '/api/kb/jobs'
    );
    return response.data.data;
  },

  deleteBook: async (source: string): Promise<void> => {
    await apiClient.delete(`/api/kb/books/${encodeURIComponent(source)}`);
  },

  pin: async (id: number): Promise<void> => {
    await apiClient.patch(`/api/kb/${id}/pin`);
  },

  unpin: async (id: number): Promise<void> => {
    await apiClient.patch(`/api/kb/${id}/unpin`);
  },

  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ApiResponse<{ url: string }>>(
      '/api/kb/images',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data.url;
  },
};
