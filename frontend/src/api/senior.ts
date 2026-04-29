import apiClient from './client';
import { ApiResponse } from '@/types/features';
import { ChatSession, ChatSessionDetail, FaqContext, KbCategory, KbItem, KbRequest, PdfUploadJob } from '@/types/senior';

// 프로덕션: VITE_API_BASE_URL 환경변수 사용, 로컬: 빈 문자열 → Vite proxy 경유
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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

    const token = localStorage.getItem('my-atlas-token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    fetch(`${API_BASE_URL}/api/senior/chat`, {
      method: 'POST',
      headers,
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

        // SSE event accumulator state. Per the SSE spec, an event ends on a blank
        // line and multi-line `data:` fields are joined by `\n`. The previous
        // implementation called onChunk per `data:` line and dropped those
        // newlines, collapsing markdown headings/lists/code blocks onto a single
        // line. This implementation buffers across chunk boundaries and joins
        // multi-line data with `\n` so streaming markdown renders identically to
        // the persisted DB content.
        let buffer = '';
        let currentEventName = '';
        let currentDataLines: string[] = [];

        function dispatchEvent() {
          if (currentDataLines.length === 0 && currentEventName === '') return;
          const data = currentDataLines.join('\n');
          if (currentEventName === 'sessionId') {
            const parsed = parseInt(data, 10);
            if (!Number.isNaN(parsed)) returnedSessionId = parsed;
          } else if (currentDataLines.length > 0) {
            onChunk(data);
          }
          currentEventName = '';
          currentDataLines = [];
        }

        function processLine(line: string) {
          if (line === '') {
            dispatchEvent();
            return;
          }
          if (line.startsWith(':')) return; // SSE comment
          const colonIdx = line.indexOf(':');
          const field = colonIdx === -1 ? line : line.slice(0, colonIdx);
          let value = colonIdx === -1 ? '' : line.slice(colonIdx + 1);
          // SSE: a single leading space after the colon is removed
          if (value.startsWith(' ')) value = value.slice(1);
          if (field === 'event') {
            currentEventName = value;
          } else if (field === 'data') {
            currentDataLines.push(value);
          }
          // ignore id/retry fields
        }

        function read() {
          reader!.read().then(({ done, value }) => {
            if (done) {
              if (buffer.length > 0) {
                const trailing = buffer.replace(/\r$/, '');
                processLine(trailing);
                buffer = '';
              }
              dispatchEvent();
              onDone(returnedSessionId);
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            // Normalize CRLF to LF, then split line-by-line
            buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            let newlineIdx: number;
            while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, newlineIdx);
              buffer = buffer.slice(newlineIdx + 1);
              processLine(line);
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
