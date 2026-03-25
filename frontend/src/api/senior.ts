import apiClient from './client';
import { ApiResponse } from '@/types/features';
import { FaqContext, FaqItem, FaqRequest, KbItem, KbRequest, PdfUploadJob } from '@/types/senior';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

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
 * FAQ API endpoints.
 */
export const faqApi = {
  getAll: async (): Promise<FaqItem[]> => {
    const response =
      await apiClient.get<ApiResponse<FaqItem[]>>('/api/senior/faq');
    return response.data.data;
  },

  getById: async (id: number): Promise<FaqItem> => {
    const response =
      await apiClient.get<ApiResponse<FaqItem>>(`/api/senior/faq/${id}`);
    return response.data.data;
  },

  create: async (request: FaqRequest): Promise<FaqItem> => {
    const response = await apiClient.post<ApiResponse<FaqItem>>(
      '/api/senior/faq',
      request
    );
    return response.data.data;
  },

  update: async (id: number, request: FaqRequest): Promise<FaqItem> => {
    const response = await apiClient.put<ApiResponse<FaqItem>>(
      `/api/senior/faq/${id}`,
      request
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/senior/faq/${id}`);
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
};
