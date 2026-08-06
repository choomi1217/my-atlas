import apiClient from './client';
import { ApiResponse } from '@/types/features';
import {
  StyleProfile,
  StyleExample,
  StyleExampleInput,
  TestStudioConfig,
} from '@/types/test-studio';

/**
 * Test Studio v2.5 — 스타일 세트/예시/보조 설정 API.
 *
 * 스타일 세트(프로필) CRUD + 세트 내 예시 TC CRUD + Company 보조 설정(활성 세트 선택 포함).
 * 예시 TC는 verbatim으로 저장되어 생성 시 few-shot으로 주입된다.
 */
export const testStudioStyleApi = {
  // --- 스타일 세트 ---

  listProfiles: async (companyId: number): Promise<StyleProfile[]> => {
    const response = await apiClient.get<ApiResponse<StyleProfile[]>>(
      '/api/test-studio/style-profiles',
      { params: { companyId } }
    );
    return response.data.data;
  },

  createProfile: async (companyId: number, name: string): Promise<StyleProfile> => {
    const response = await apiClient.post<ApiResponse<StyleProfile>>(
      '/api/test-studio/style-profiles',
      { companyId, name }
    );
    return response.data.data;
  },

  renameProfile: async (id: number, name: string): Promise<StyleProfile> => {
    const response = await apiClient.put<ApiResponse<StyleProfile>>(
      `/api/test-studio/style-profiles/${id}`,
      { name }
    );
    return response.data.data;
  },

  deleteProfile: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/test-studio/style-profiles/${id}`);
  },

  // --- 세트 내 예시 TC ---

  listExamples: async (profileId: number): Promise<StyleExample[]> => {
    const response = await apiClient.get<ApiResponse<StyleExample[]>>(
      `/api/test-studio/style-profiles/${profileId}/examples`
    );
    return response.data.data;
  },

  addExample: async (
    profileId: number,
    input: StyleExampleInput
  ): Promise<StyleExample> => {
    const response = await apiClient.post<ApiResponse<StyleExample>>(
      `/api/test-studio/style-profiles/${profileId}/examples`,
      input
    );
    return response.data.data;
  },

  updateExample: async (
    id: number,
    input: StyleExampleInput
  ): Promise<StyleExample> => {
    const response = await apiClient.put<ApiResponse<StyleExample>>(
      `/api/test-studio/style-examples/${id}`,
      input
    );
    return response.data.data;
  },

  deleteExample: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/test-studio/style-examples/${id}`);
  },

  // --- 보조 설정 + 활성 세트 ---

  getConfig: async (companyId: number): Promise<TestStudioConfig> => {
    const response = await apiClient.get<ApiResponse<TestStudioConfig>>(
      '/api/test-studio/config',
      { params: { companyId } }
    );
    return response.data.data;
  },

  upsertConfig: async (config: TestStudioConfig): Promise<TestStudioConfig> => {
    const response = await apiClient.put<ApiResponse<TestStudioConfig>>(
      '/api/test-studio/config',
      config
    );
    return response.data.data;
  },
};
