import { apiClient } from './client';
import { ConventionItem, ConventionRequest } from '../types/convention';
import { CategoryItem } from '../types/common';

export const conventionApi = {
  getAll: async (): Promise<ConventionItem[]> => {
    const res = await apiClient.get('/api/conventions');
    return res.data.data;
  },

  getById: async (id: number): Promise<ConventionItem> => {
    const res = await apiClient.get(`/api/conventions/${id}`);
    return res.data.data;
  },

  create: async (data: ConventionRequest): Promise<ConventionItem> => {
    const res = await apiClient.post('/api/conventions', data);
    return res.data.data;
  },

  update: async (id: number, data: ConventionRequest): Promise<ConventionItem> => {
    const res = await apiClient.put(`/api/conventions/${id}`, data);
    return res.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/conventions/${id}`);
  },

  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/api/convention-images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.url;
  },
};

export const conventionCategoryApi = {
  getAll: async (): Promise<CategoryItem[]> => {
    const res = await apiClient.get('/api/conventions/categories');
    return res.data.data;
  },

  search: async (query: string): Promise<CategoryItem[]> => {
    const res = await apiClient.get('/api/conventions/categories/search', {
      params: { q: query },
    });
    return res.data.data;
  },

  create: async (name: string): Promise<CategoryItem> => {
    const res = await apiClient.post('/api/conventions/categories', { name });
    return res.data.data;
  },
};
