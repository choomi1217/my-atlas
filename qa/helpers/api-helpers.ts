import axios, { AxiosInstance } from 'axios';

const apiBaseUrl = process.env.API_URL || 'http://localhost:8080';
const client: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isAuthenticated = false;

/**
 * Ensure the shared axios client has a valid admin token.
 * Automatically called by helper functions that need auth.
 */
async function ensureAuthenticated(): Promise<void> {
  if (isAuthenticated) return;
  await loginAsAdmin();
}

/**
 * Login as admin and set the Authorization header on the shared axios client.
 */
export async function loginAsAdmin(): Promise<string> {
  const response = await client.post('/api/auth/login', {
    username: 'admin',
    password: 'admin',
  });
  const token: string = response.data.data.token;
  client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  isAuthenticated = true;
  return token;
}

/**
 * Login with arbitrary credentials and return the token.
 * Does NOT set the token on the shared client.
 */
export async function loginAs(
  username: string,
  password: string,
): Promise<{ token: string; username: string; role: string }> {
  const response = await client.post('/api/auth/login', {
    username,
    password,
  });
  return response.data.data as { token: string; username: string; role: string };
}

/**
 * Register a new user (requires ADMIN token on the shared client).
 */
export async function registerUser(
  username: string,
  password: string,
  role: 'ADMIN' | 'USER' = 'USER',
): Promise<void> {
  await client.post('/api/auth/register', { username, password, role });
}

/**
 * Clear the Authorization header from the shared axios client.
 */
export function clearAuthToken(): void {
  delete client.defaults.headers.common['Authorization'];
}

/**
 * Inject admin auth into browser localStorage before navigating.
 * Use in UI tests: await loginAsAdminInBrowser(page);
 */
export async function loginAsAdminInBrowser(page: import('@playwright/test').Page): Promise<void> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
  // Navigate to login page first to set localStorage on the correct origin
  await page.goto(`${baseUrl}/login`);
  const token = await loginAsAdmin();
  await page.evaluate(({ t }) => {
    localStorage.setItem('my-atlas-token', t);
    localStorage.setItem('my-atlas-user', JSON.stringify({ username: 'admin', role: 'ADMIN' }));
  }, { t: token });
}

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
    await ensureAuthenticated();
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
    await ensureAuthenticated();
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
    await ensureAuthenticated();
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
    await ensureAuthenticated();
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
    await ensureAuthenticated();
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
    await ensureAuthenticated();
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
    await ensureAuthenticated();
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
    await ensureAuthenticated();
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
  priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM',
): Promise<TestCaseData> {
  try {
    await ensureAuthenticated();
    const response = await client.post('/api/test-cases', {
      productId,
      title,
      path,
      description: 'Test case for E2E testing',
      priority,
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
    await ensureAuthenticated();
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
    await ensureAuthenticated();
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
