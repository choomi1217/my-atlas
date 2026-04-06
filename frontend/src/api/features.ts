import apiClient from './client';
import {
  ApiResponse,
  Company,
  Product,
  Segment,
  Platform,
  TestCase,
  TestCasePriority,
  TestCaseType,
  TestCaseStatus,
  TestStep,
  TestRun,
  Version,
  VersionPhase,
  RunResultStatus,
} from '@/types/features';
// ProgressStats is used indirectly via Version/VersionPhase types

/**
 * Company API endpoints.
 */
export const companyApi = {
  getAll: async (): Promise<Company[]> => {
    const response = await apiClient.get<ApiResponse<Company[]>>(
      '/api/companies'
    );
    return response.data.data;
  },

  create: async (name: string): Promise<Company> => {
    const response = await apiClient.post<ApiResponse<Company>>(
      '/api/companies',
      { name }
    );
    return response.data.data;
  },

  setActive: async (id: number): Promise<Company> => {
    const response = await apiClient.patch<ApiResponse<Company>>(
      `/api/companies/${id}/activate`
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/companies/${id}`);
  },
};

/**
 * Product API endpoints.
 */
export const productApi = {
  getByCompanyId: async (companyId: number): Promise<Product[]> => {
    const response = await apiClient.get<ApiResponse<Product[]>>(
      '/api/products',
      {
        params: { companyId },
      }
    );
    return response.data.data;
  },

  create: async (
    companyId: number,
    name: string,
    platform: Platform,
    description?: string
  ): Promise<Product> => {
    const response = await apiClient.post<ApiResponse<Product>>(
      '/api/products',
      {
        companyId,
        name,
        platform,
        description,
      }
    );
    return response.data.data;
  },

  update: async (
    id: number,
    name: string,
    platform: Platform,
    description?: string
  ): Promise<Product> => {
    const response = await apiClient.put<ApiResponse<Product>>(
      `/api/products/${id}`,
      {
        companyId: 0,
        name,
        platform,
        description,
      }
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/products/${id}`);
  },
};

/**
 * Segment API endpoints.
 */
export const segmentApi = {
  getByProductId: async (productId: number): Promise<Segment[]> => {
    const response = await apiClient.get<ApiResponse<Segment[]>>(
      '/api/segments',
      {
        params: { productId },
      }
    );
    return response.data.data;
  },

  create: async (
    productId: number,
    name: string,
    parentId?: number
  ): Promise<Segment> => {
    const response = await apiClient.post<ApiResponse<Segment>>(
      '/api/segments',
      {
        productId,
        name,
        parentId: parentId ?? null,
      }
    );
    return response.data.data;
  },

  update: async (id: number, name: string): Promise<Segment> => {
    const response = await apiClient.put<ApiResponse<Segment>>(
      `/api/segments/${id}`,
      { name }
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/segments/${id}`);
  },

  reparent: async (id: number, parentId: number | null): Promise<Segment> => {
    const response = await apiClient.patch<ApiResponse<Segment>>(
      `/api/segments/${id}/parent`,
      { parentId }
    );
    return response.data.data;
  },
};

/**
 * Test Case API endpoints.
 */
export const testCaseApi = {
  getByProductId: async (productId: number): Promise<TestCase[]> => {
    const response = await apiClient.get<ApiResponse<TestCase[]>>(
      '/api/test-cases',
      {
        params: { productId },
      }
    );
    return response.data.data;
  },

  create: async (
    productId: number,
    title: string,
    path: number[] = [],
    description?: string,
    promptText?: string,
    priority: TestCasePriority = TestCasePriority.MEDIUM,
    testType: TestCaseType = TestCaseType.FUNCTIONAL,
    status: TestCaseStatus = TestCaseStatus.DRAFT,
    preconditions?: string,
    steps?: TestStep[],
    expectedResult?: string
  ): Promise<TestCase> => {
    const response = await apiClient.post<ApiResponse<TestCase>>(
      '/api/test-cases',
      {
        productId,
        path,
        title,
        description,
        promptText,
        preconditions,
        steps: steps || [],
        expectedResult,
        priority,
        testType,
        status,
      }
    );
    return response.data.data;
  },

  update: async (
    id: number,
    productId: number,
    title: string,
    path: number[] = [],
    description?: string,
    promptText?: string,
    priority: TestCasePriority = TestCasePriority.MEDIUM,
    testType: TestCaseType = TestCaseType.FUNCTIONAL,
    status: TestCaseStatus = TestCaseStatus.DRAFT,
    preconditions?: string,
    steps?: TestStep[],
    expectedResult?: string
  ): Promise<TestCase> => {
    const response = await apiClient.put<ApiResponse<TestCase>>(
      `/api/test-cases/${id}`,
      {
        productId,
        path,
        title,
        description,
        promptText,
        preconditions,
        steps: steps || [],
        expectedResult,
        priority,
        testType,
        status,
      }
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/test-cases/${id}`);
  },

  generateDraft: async (
    productId: number,
    path: number[] = []
  ): Promise<TestCase[]> => {
    const response = await apiClient.post<ApiResponse<TestCase[]>>(
      '/api/test-cases/generate-draft',
      {
        productId,
        path,
      }
    );
    return response.data.data;
  },
};

/**
 * Test Run API endpoints.
 */
export const testRunApi = {
  getByProductId: async (productId: number): Promise<TestRun[]> => {
    const response = await apiClient.get<ApiResponse<TestRun[]>>(
      `/api/products/${productId}/test-runs`
    );
    return response.data.data;
  },

  getById: async (id: number): Promise<TestRun> => {
    const response = await apiClient.get<ApiResponse<TestRun>>(
      `/api/test-runs/${id}`
    );
    return response.data.data;
  },

  create: async (
    productId: number,
    name: string,
    description: string,
    testCaseIds: number[]
  ): Promise<TestRun> => {
    const response = await apiClient.post<ApiResponse<TestRun>>(
      `/api/products/${productId}/test-runs`,
      {
        productId,
        name,
        description,
        testCaseIds,
      }
    );
    return response.data.data;
  },

  update: async (
    id: number,
    name?: string,
    description?: string,
    testCaseIds?: number[]
  ): Promise<TestRun> => {
    const response = await apiClient.patch<ApiResponse<TestRun>>(
      `/api/test-runs/${id}`,
      {
        name,
        description,
        testCaseIds,
      }
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/test-runs/${id}`);
  },
};

/**
 * Version API endpoints.
 */
export const versionApi = {
  getByProductId: async (productId: number): Promise<Version[]> => {
    const response = await apiClient.get<ApiResponse<Version[]>>(
      `/api/products/${productId}/versions`
    );
    return response.data.data;
  },

  getById: async (id: number): Promise<Version> => {
    const response = await apiClient.get<ApiResponse<Version>>(
      `/api/versions/${id}`
    );
    return response.data.data;
  },

  create: async (
    productId: number,
    name: string,
    description: string,
    releaseDate: string | null,
    phases: Array<{ phaseName: string; testRunId: number }>
  ): Promise<Version> => {
    const response = await apiClient.post<ApiResponse<Version>>(
      `/api/products/${productId}/versions`,
      {
        productId,
        name,
        description,
        releaseDate,
        phases,
      }
    );
    return response.data.data;
  },

  update: async (
    id: number,
    name?: string,
    description?: string,
    releaseDate?: string | null
  ): Promise<Version> => {
    const response = await apiClient.patch<ApiResponse<Version>>(
      `/api/versions/${id}`,
      {
        name,
        description,
        releaseDate,
      }
    );
    return response.data.data;
  },

  copy: async (
    id: number,
    newName: string,
    newReleaseDate: string | null
  ): Promise<Version> => {
    const response = await apiClient.post<ApiResponse<Version>>(
      `/api/versions/${id}/copy`,
      {
        newName,
        newReleaseDate,
      }
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/versions/${id}`);
  },
};

/**
 * Version Phase API endpoints.
 */
export const versionPhaseApi = {
  getByVersionId: async (versionId: number): Promise<VersionPhase[]> => {
    const response = await apiClient.get<ApiResponse<VersionPhase[]>>(
      `/api/versions/${versionId}/phases`
    );
    return response.data.data;
  },

  addPhase: async (
    versionId: number,
    phaseName: string,
    testRunId: number
  ): Promise<VersionPhase> => {
    const response = await apiClient.post<ApiResponse<VersionPhase>>(
      `/api/versions/${versionId}/phases`,
      {
        phaseName,
        testRunId,
      }
    );
    return response.data.data;
  },

  updatePhase: async (
    versionId: number,
    phaseId: number,
    phaseName?: string,
    testRunId?: number
  ): Promise<VersionPhase> => {
    const response = await apiClient.patch<ApiResponse<VersionPhase>>(
      `/api/versions/${versionId}/phases/${phaseId}`,
      {
        phaseName,
        testRunId,
      }
    );
    return response.data.data;
  },

  deletePhase: async (versionId: number, phaseId: number): Promise<void> => {
    await apiClient.delete(`/api/versions/${versionId}/phases/${phaseId}`);
  },

  reorderPhase: async (
    versionId: number,
    phaseId: number,
    newOrderIndex: number
  ): Promise<void> => {
    await apiClient.post(
      `/api/versions/${versionId}/phases/${phaseId}/reorder`,
      {
        newOrderIndex,
      }
    );
  },
};

/**
 * Test Result API endpoints.
 */
export const testResultApi = {
  getByVersionId: async (versionId: number): Promise<unknown[]> => {
    const response = await apiClient.get<ApiResponse<unknown[]>>(
      `/api/versions/${versionId}/results`
    );
    return response.data.data;
  },

  getByVersionPhaseId: async (
    versionId: number,
    phaseId: number
  ): Promise<unknown[]> => {
    const response = await apiClient.get<ApiResponse<unknown[]>>(
      `/api/versions/${versionId}/phases/${phaseId}/results`
    );
    return response.data.data;
  },

  updateResult: async (
    versionId: number,
    resultId: number,
    status: RunResultStatus,
    comment?: string
  ): Promise<unknown> => {
    const response = await apiClient.patch<ApiResponse<unknown>>(
      `/api/versions/${versionId}/results/${resultId}`,
      {
        status,
        comment,
      }
    );
    return response.data.data;
  },
};
