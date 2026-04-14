import apiClient from './client';
import { ApiResponse } from '@/types/features';
import { ChatSession, ChatSessionDetail, FaqContext, KbCategory, KbItem, KbRequest, PdfUploadJob } from '@/types/senior';

// 상대 경로 사용 → Vite proxy 경유 (worktree별 포트 자동 대응)
const API_BASE_URL = '';

/**
 * Senior Chat API — uses fetch for SSE streaming (axios doesn't support streaming).
 */
export const chatApi = {
  streamChat: (
    message: string,
    onChunk: (text: string) => void,
    onDone: (sessionId?: number) => void,
    onError: (err: Error) => void,
    faqContext?: FaqContext | null,
    sessionId?: number | null
  ): AbortController => {
    const controller = new AbortController();

    fetch(`${API_BASE_URL}/api/senior/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        faqContext: faqContext || null,
        sessionId: sessionId || null,
      }),
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
        let returnedSessionId: number | undefined;

        function read() {
          reader!.read().then(({ done, value }) => {
            if (done) {
              onDone(returnedSessionId);
              return;
            }
            const text = decoder.decode(value, { stream: true });
            // Parse SSE format: data:chunk\n\n or event:sessionId\ndata:123\n\n
            const lines = text.split('\n');
            let currentEvent = '';
            for (const line of lines) {
              if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                const data = line.slice(5);
                if (currentEvent === 'sessionId') {
                  returnedSessionId = parseInt(data, 10);
                  currentEvent = '';
                } else {
                  onChunk(data);
                }
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
  getAll: async (params?: { search?: string; sort?: string }): Promise<KbItem[]> => {
    const response = await apiClient.get<ApiResponse<KbItem[]>>('/api/kb', { params });
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

  uploadPdf: async (file: File, bookTitle: string, category?: string): Promise<{ jobId: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bookTitle', bookTitle);
    if (category) formData.append('category', category);
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

/**
 * KB Category API endpoints.
 */
export const kbCategoryApi = {
  getAll: async (): Promise<KbCategory[]> => {
    const response = await apiClient.get<ApiResponse<KbCategory[]>>('/api/kb/categories');
    return response.data.data;
  },

  search: async (query: string): Promise<KbCategory[]> => {
    const response = await apiClient.get<ApiResponse<KbCategory[]>>('/api/kb/categories/search', {
      params: { q: query },
    });
    return response.data.data;
  },

  create: async (name: string): Promise<KbCategory> => {
    const response = await apiClient.post<ApiResponse<KbCategory>>('/api/kb/categories', { name });
    return response.data.data;
  },
};

/**
 * Chat Session API endpoints.
 */
export const sessionApi = {
  getAll: async (): Promise<ChatSession[]> => {
    const response = await apiClient.get<ApiResponse<ChatSession[]>>('/api/senior/sessions');
    return response.data.data;
  },

  getById: async (id: number): Promise<ChatSessionDetail> => {
    const response = await apiClient.get<ApiResponse<ChatSessionDetail>>(`/api/senior/sessions/${id}`);
    return response.data.data;
  },

  create: async (): Promise<ChatSession> => {
    const response = await apiClient.post<ApiResponse<ChatSession>>('/api/senior/sessions');
    return response.data.data;
  },

  updateTitle: async (id: number, title: string): Promise<ChatSession> => {
    const response = await apiClient.patch<ApiResponse<ChatSession>>(
      `/api/senior/sessions/${id}`,
      { title }
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/senior/sessions/${id}`);
  },
};
