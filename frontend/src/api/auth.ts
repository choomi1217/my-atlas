import { apiClient } from './client';
import { LoginRequest, LoginResponse } from '@/types/auth';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const authApi = {
  login: async (request: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<ApiResponse<LoginResponse>>(
      '/api/auth/login',
      request,
    );
    return response.data.data;
  },

  register: async (
    username: string,
    password: string,
    role: 'ADMIN' | 'USER' = 'USER',
  ): Promise<LoginResponse> => {
    const response = await apiClient.post<ApiResponse<LoginResponse>>(
      '/api/auth/register',
      { username, password, role },
    );
    return response.data.data;
  },
};
