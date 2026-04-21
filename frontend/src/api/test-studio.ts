import apiClient from './client';
import { ApiResponse } from '@/types/features';
import { TestStudioJob } from '@/types/test-studio';

/**
 * Test Studio API endpoints.
 *
 * Job lifecycle:
 *   createJob → PENDING → PROCESSING → DONE | FAILED
 */
export const testStudioApi = {
  /**
   * Create a new job using multipart/form-data.
   * Required fields in form: productId, sourceType, title
   * Conditional fields:
   *   - content (when sourceType=MARKDOWN)
   *   - file    (when sourceType=PDF)
   */
  createJob: async (form: FormData): Promise<{ jobId: number }> => {
    const response = await apiClient.post<ApiResponse<{ jobId: number }>>(
      '/api/test-studio/jobs',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },

  /**
   * List all jobs for a product (newest first).
   */
  listJobs: async (productId: number): Promise<TestStudioJob[]> => {
    const response = await apiClient.get<ApiResponse<TestStudioJob[]>>(
      '/api/test-studio/jobs',
      { params: { productId } }
    );
    return response.data.data;
  },

  /**
   * List all jobs across every Product within a Company (newest first).
   * Used by the Company-level Test Studio dashboard.
   */
  listJobsByCompany: async (companyId: number): Promise<TestStudioJob[]> => {
    const response = await apiClient.get<ApiResponse<TestStudioJob[]>>(
      '/api/test-studio/jobs',
      { params: { companyId } }
    );
    return response.data.data;
  },

  /**
   * Get a single job by id.
   */
  getJob: async (id: number): Promise<TestStudioJob> => {
    const response = await apiClient.get<ApiResponse<TestStudioJob>>(
      `/api/test-studio/jobs/${id}`
    );
    return response.data.data;
  },

  /**
   * Delete a job. DRAFT TCs created by this job are preserved on the backend.
   */
  deleteJob: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/test-studio/jobs/${id}`);
  },
};
