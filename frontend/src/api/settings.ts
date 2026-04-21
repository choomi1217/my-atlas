import { apiClient } from './client';
import {
  SystemSettings,
  UserWithCompanies,
  RegisterUserRequest,
  UpdateSettingsRequest,
  UpdateCompaniesRequest,
} from '@/types/settings';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const settingsApi = {
  getSettings: async (): Promise<SystemSettings> => {
    const response = await apiClient.get<ApiResponse<SystemSettings>>('/api/settings');
    return response.data.data;
  },

  updateSettings: async (request: UpdateSettingsRequest): Promise<SystemSettings> => {
    const response = await apiClient.patch<ApiResponse<SystemSettings>>('/api/settings', request);
    return response.data.data;
  },

  getUsers: async (): Promise<UserWithCompanies[]> => {
    const response = await apiClient.get<ApiResponse<UserWithCompanies[]>>('/api/settings/users');
    return response.data.data;
  },

  registerUser: async (request: RegisterUserRequest): Promise<UserWithCompanies> => {
    const response = await apiClient.post<ApiResponse<UserWithCompanies>>('/api/settings/users', request);
    return response.data.data;
  },

  updateUserCompanies: async (userId: number, request: UpdateCompaniesRequest): Promise<UserWithCompanies> => {
    const response = await apiClient.put<ApiResponse<UserWithCompanies>>(
      `/api/settings/users/${userId}/companies`,
      request,
    );
    return response.data.data;
  },

  deleteUser: async (userId: number): Promise<void> => {
    await apiClient.delete(`/api/settings/users/${userId}`);
  },
};
