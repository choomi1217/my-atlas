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
 * Segment interface for hierarchical path nodes.
 */
export interface Segment {
  id: number;
  name: string;
  productId: number;
  parentId: number | null;
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
  productId: number;
  path: number[];
  title: string;
  description?: string;
  promptText?: string;
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

/**
 * Test result response from API.
 */
export interface TestResult {
  id: number;
  versionId: number;
  versionPhaseId: number;
  testCaseId: number;
  testCaseTitle: string;
  status: RunResultStatus;
  comment: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Test run result status enum.
 */
export enum RunResultStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  BLOCKED = 'BLOCKED',
  SKIPPED = 'SKIPPED',
  RETEST = 'RETEST',
  UNTESTED = 'UNTESTED',
}

/**
 * Test case summary (lightweight, used in TestRun detail).
 */
export interface TestCaseSummary {
  id: number;
  title: string;
}

/**
 * Test run interface.
 */
export interface TestRun {
  id: number;
  productId: number;
  name: string;
  description?: string;
  testCaseCount: number;
  testCases?: TestCaseSummary[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Progress stats interface.
 */
export interface ProgressStats {
  total: number;
  completed: number;
  pass: number;
  fail: number;
  blocked: number;
  skipped: number;
  retest: number;
  untested: number;
}

/**
 * Version phase interface.
 */
export interface VersionPhase {
  id: number;
  phaseName: string;
  testRunId: number;
  testRunName: string;
  testRunTestCaseCount: number;
  orderIndex: number;
  phaseProgress: ProgressStats;
}

/**
 * Version interface.
 */
export interface Version {
  id: number;
  productId: number;
  name: string;
  description?: string;
  releaseDate?: string;
  copiedFrom?: number;
  phases: VersionPhase[];
  totalProgress: ProgressStats;
  isReleaseDatePassed: boolean;
  warningMessage?: string;
  createdAt: string;
  updatedAt: string;
}
