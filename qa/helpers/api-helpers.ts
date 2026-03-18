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

export interface FeatureData {
  id: number;
  name: string;
  path: string;
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
 * Create a test feature
 */
export async function createTestFeature(
  productId: number,
  name = 'E2E Test Feature',
  path = 'Main › Test',
): Promise<FeatureData> {
  try {
    const response = await client.post('/api/features', {
      productId,
      name,
      path,
      description: 'Test feature for E2E testing',
      promptText: 'How to test this feature?',
    });
    return response.data.data as FeatureData;
  } catch (error) {
    console.error('Failed to create test feature:', error);
    throw error;
  }
}

/**
 * Get features by product ID
 */
export async function getFeaturesByProductId(productId: number): Promise<FeatureData[]> {
  try {
    const response = await client.get(`/api/features?productId=${productId}`);
    return response.data.data as FeatureData[];
  } catch (error) {
    console.error(`Failed to fetch features for product ${productId}:`, error);
    return [];
  }
}

/**
 * Delete a feature
 */
export async function deleteFeature(featureId: number): Promise<void> {
  try {
    await client.delete(`/api/features/${featureId}`);
  } catch (error) {
    console.error(`Failed to delete feature ${featureId}:`, error);
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
