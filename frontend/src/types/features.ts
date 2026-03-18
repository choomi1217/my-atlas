/**
 * Platform types for products.
 */
export enum Platform {
  WEB = 'WEB',
  DESKTOP = 'DESKTOP',
  MOBILE = 'MOBILE',
  ETC = 'ETC',
}

/**
 * Company interface.
 */
export interface Company {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Product interface.
 */
export interface Product {
  id: number;
  companyId: number;
  name: string;
  platform: Platform;
  description?: string;
  createdAt: string;
}

/**
 * Feature interface.
 */
export interface Feature {
  id: number;
  productId: number;
  path: string;
  name: string;
  description?: string;
  promptText?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Test step interface (part of JSONB steps array).
 */
export interface TestStep {
  order: number;
  action: string;
  expected: string;
}

/**
 * Test case priority enum.
 */
export enum TestCasePriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/**
 * Test case type enum.
 */
export enum TestCaseType {
  SMOKE = 'SMOKE',
  FUNCTIONAL = 'FUNCTIONAL',
  REGRESSION = 'REGRESSION',
  E2E = 'E2E',
}

/**
 * Test case status enum.
 */
export enum TestCaseStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
}

/**
 * Test case interface.
 */
export interface TestCase {
  id: number;
  featureId: number;
  title: string;
  preconditions?: string;
  steps: TestStep[];
  expectedResult?: string;
  priority: TestCasePriority;
  testType: TestCaseType;
  status: TestCaseStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * API Response wrapper.
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
