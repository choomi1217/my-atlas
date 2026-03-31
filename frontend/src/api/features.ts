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
} from '@/types/features';

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
