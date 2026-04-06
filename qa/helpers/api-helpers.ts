import axios, { AxiosInstance } from 'axios';

const apiBaseUrl = process.env.API_URL || 'http://localhost:8080';
const client: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface CompanyData {
  id: number;
  name: string;
  isActive: boolean;
}

export interface ProductData {
  id: number;
  name: string;
  platform: string;
  description?: string;
}

export interface SegmentData {
  id: number;
  name: string;
  productId: number;
  parentId: number | null;
}

export interface TestCaseData {
  id: number;
  title: string;
  productId: number;
  path: number[];
  description?: string;
}

/**
 * Create a test company via API
 */
export async function createTestCompany(name = 'E2E Test Company'): Promise<CompanyData> {
  try {
    const response = await client.post('/api/companies', { name });
    return response.data.data as CompanyData;
  } catch (error) {
    console.error('Failed to create test company:', error);
    throw error;
  }
}

/**
 * Get all companies
 */
export async function getAllCompanies(): Promise<CompanyData[]> {
  try {
    const response = await client.get('/api/companies');
    return response.data.data as CompanyData[];
  } catch (error) {
    console.error('Failed to fetch companies:', error);
    return [];
  }
}

/**
 * Activate a company
 */
export async function activateCompany(companyId: number): Promise<CompanyData> {
  try {
    const response = await client.patch(`/api/companies/${companyId}/activate`);
    return response.data.data as CompanyData;
  } catch (error) {
    console.error(`Failed to activate company ${companyId}:`, error);
    throw error;
  }
}

/**
 * Delete a company
 */
export async function deleteCompany(companyId: number): Promise<void> {
  try {
    await client.delete(`/api/companies/${companyId}`);
  } catch (error) {
    console.error(`Failed to delete company ${companyId}:`, error);
  }
}

/**
 * Create a test product
 */
export async function createTestProduct(
  companyId: number,
  name = 'E2E Test Product',
  platform = 'WEB',
): Promise<ProductData> {
  try {
    const response = await client.post('/api/products', {
      companyId,
      name,
      platform,
      description: 'Test product for E2E testing',
    });
    return response.data.data as ProductData;
  } catch (error) {
    console.error('Failed to create test product:', error);
    throw error;
  }
}

/**
 * Get products by company ID
 */
export async function getProductsByCompanyId(companyId: number): Promise<ProductData[]> {
  try {
    const response = await client.get(`/api/products?companyId=${companyId}`);
    return response.data.data as ProductData[];
  } catch (error) {
    console.error(`Failed to fetch products for company ${companyId}:`, error);
    return [];
  }
}

/**
 * Delete a product
 */
export async function deleteProduct(productId: number): Promise<void> {
  try {
    await client.delete(`/api/products/${productId}`);
  } catch (error) {
    console.error(`Failed to delete product ${productId}:`, error);
  }
}

/**
 * Create a test segment
 */
export async function createTestSegment(
  productId: number,
  name = 'E2E Test Segment',
  parentId?: number,
): Promise<SegmentData> {
  try {
    const response = await client.post('/api/segments', {
      productId,
      name,
      parentId: parentId ?? null,
    });
    return response.data.data as SegmentData;
  } catch (error) {
    console.error('Failed to create test segment:', error);
    throw error;
  }
}

/**
 * Create a test test case
 */
export async function createTestTestCase(
  productId: number,
  title = 'E2E Test Case',
  path: number[] = [],
): Promise<TestCaseData> {
  try {
    const response = await client.post('/api/test-cases', {
      productId,
      title,
      path,
      description: 'Test case for E2E testing',
      priority: 'MEDIUM',
      testType: 'FUNCTIONAL',
      status: 'DRAFT',
    });
    return response.data.data as TestCaseData;
  } catch (error) {
    console.error('Failed to create test case:', error);
    throw error;
  }
}

export interface VersionData {
  id: number;
  name: string;
  releaseDate?: string;
  description?: string;
  productId: number;
  phases: PhaseData[];
  isReleaseDatePassed: boolean;
  warningMessage?: string;
}

export interface PhaseData {
  id: number;
  phaseName: string;
  testRunId: number;
  orderIndex: number;
  versionId: number;
}

/**
 * Create a test version with phases
 */
export async function createTestVersion(
  productId: number,
  name: string = 'E2E Test Version',
  releaseDate?: string,
  phases: Array<{ phaseName: string; testRunId: number; orderIndex: number }> = [],
): Promise<VersionData> {
  try {
    const response = await client.post(`/api/products/${productId}/versions`, {
      productId,
      name,
      releaseDate: releaseDate ?? null,
      description: `Test version ${name}`,
      phases,
    });
    return response.data.data as VersionData;
  } catch (error) {
    console.error('Failed to create test version:', error);
    throw error;
  }
}

/**
 * Get all versions for a product
 */
export async function getVersionsByProductId(productId: number): Promise<VersionData[]> {
  try {
    const response = await client.get(`/api/products/${productId}/versions`);
    return response.data.data as VersionData[];
  } catch (error) {
    console.error(`Failed to fetch versions for product ${productId}:`, error);
    return [];
  }
}

/**
 * Clean up all test data (cascade delete company)
 */
export async function cleanupAllTestData(): Promise<void> {
  try {
    const companies = await getAllCompanies();
    for (const company of companies) {
      if (company.name.includes('E2E') || company.name.includes('Test')) {
        await deleteCompany(company.id);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup test data:', error);
  }
}
