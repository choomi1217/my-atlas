import apiClient from './client';
import {
  ApiResponse,
  Company,
  Product,
  Feature,
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
  /**
   * Get all companies.
   */
  getAll: async (): Promise<Company[]> => {
    const response = await apiClient.get<ApiResponse<Company[]>>(
      '/api/companies'
    );
    return response.data.data;
  },

  /**
   * Create a new company.
   */
  create: async (name: string): Promise<Company> => {
    const response = await apiClient.post<ApiResponse<Company>>(
      '/api/companies',
      { name }
    );
    return response.data.data;
  },

  /**
   * Set company as active.
   */
  setActive: async (id: number): Promise<Company> => {
    const response = await apiClient.patch<ApiResponse<Company>>(
      `/api/companies/${id}/activate`
    );
    return response.data.data;
  },

  /**
   * Delete a company.
   */
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/companies/${id}`);
  },
};

/**
 * Product API endpoints.
 */
export const productApi = {
  /**
   * Get products by company ID.
   */
  getByCompanyId: async (companyId: number): Promise<Product[]> => {
    const response = await apiClient.get<ApiResponse<Product[]>>(
      '/api/products',
      {
        params: { companyId },
      }
    );
    return response.data.data;
  },

  /**
   * Create a new product.
   */
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

  /**
   * Update a product.
   */
  update: async (
    id: number,
    name: string,
    platform: Platform,
    description?: string
  ): Promise<Product> => {
    const response = await apiClient.put<ApiResponse<Product>>(
      `/api/products/${id}`,
      {
        companyId: 0, // Not used in update, but required by API
        name,
        platform,
        description,
      }
    );
    return response.data.data;
  },

  /**
   * Delete a product.
   */
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/products/${id}`);
  },
};

/**
 * Feature API endpoints.
 */
export const featureApi = {
  /**
   * Get features by product ID.
   */
  getByProductId: async (productId: number): Promise<Feature[]> => {
    const response = await apiClient.get<ApiResponse<Feature[]>>(
      '/api/features',
      {
        params: { productId },
      }
    );
    return response.data.data;
  },

  /**
   * Create a new feature.
   */
  create: async (
    productId: number,
    path: string,
    name: string,
    description?: string,
    promptText?: string
  ): Promise<Feature> => {
    const response = await apiClient.post<ApiResponse<Feature>>(
      '/api/features',
      {
        productId,
        path,
        name,
        description,
        promptText,
      }
    );
    return response.data.data;
  },

  /**
   * Update a feature.
   */
  update: async (
    id: number,
    path: string,
    name: string,
    description?: string,
    promptText?: string
  ): Promise<Feature> => {
    const response = await apiClient.put<ApiResponse<Feature>>(
      `/api/features/${id}`,
      {
        productId: 0, // Not used in update, but required by API
        path,
        name,
        description,
        promptText,
      }
    );
    return response.data.data;
  },

  /**
   * Delete a feature.
   */
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/features/${id}`);
  },

  /**
   * Search similar features.
   */
  search: async (query: string, topK: number = 5): Promise<Feature[]> => {
    const response = await apiClient.post<ApiResponse<Feature[]>>(
      '/api/features/search',
      {
        query,
        topK,
      }
    );
    return response.data.data;
  },
};

/**
 * Test Case API endpoints.
 */
export const testCaseApi = {
  /**
   * Get test cases by feature ID.
   */
  getByFeatureId: async (featureId: number): Promise<TestCase[]> => {
    const response = await apiClient.get<ApiResponse<TestCase[]>>(
      '/api/test-cases',
      {
        params: { featureId },
      }
    );
    return response.data.data;
  },

  /**
   * Create a new test case.
   */
  create: async (
    featureId: number,
    title: string,
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
        featureId,
        title,
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

  /**
   * Update a test case.
   */
  update: async (
    id: number,
    featureId: number,
    title: string,
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
        featureId,
        title,
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

  /**
   * Delete a test case.
   */
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/test-cases/${id}`);
  },

  /**
   * Generate AI draft test cases for a feature.
   */
  generateDraft: async (featureId: number): Promise<TestCase[]> => {
    const response = await apiClient.post<ApiResponse<TestCase[]>>(
      '/api/test-cases/generate-draft',
      {},
      {
        params: { featureId },
      }
    );
    return response.data.data;
  },
};
