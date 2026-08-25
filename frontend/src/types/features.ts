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
  productCount: number;
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
  execBaseUrl?: string | null;
  execSeedNote?: string | null;
  /** 에이전트 실행 대상 종류. 워커는 자기가 구동 가능한 종류의 Job만 집는다. */
  execTargetKind?: ExecTargetKind;
  createdAt: string;
}

/** 에이전트 실행 대상 종류 (registry_v24 Step 8). 제품 분류인 Platform과 별개다. */
export type ExecTargetKind = 'WEB' | 'ANDROID' | 'IOS';

/**
 * Agentic Test Execution (registry_v20).
 */
export type AgentExecutionScope =
  | 'SINGLE'
  | 'PHASE_ALL'
  | 'PHASE_UNTESTED'
  | 'PHASE_PREV_FAIL';
export type AgentExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'DONE'
  | 'FAILED'
  | 'CANCELLED';
export type AgentVerdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export interface AgentStepLog {
  order: number;
  actionTaken: string;
  observed: string;
  judgment: string;
  screenshotKey?: string | null;
}

export interface AgentExecutionJob {
  id: number;
  productId: number;
  phaseId?: number | null;
  targetTestCaseId?: number | null;
  scope: AgentExecutionScope;
  status: AgentExecutionStatus;
  requestedBy?: string | null;
  totalCount: number;
  doneCount: number;
  passCount: number;
  failCount: number;
  inconclusiveCount: number;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface AgentExecutionResult {
  id: number;
  jobId: number;
  testCaseId: number;
  verdict: AgentVerdict;
  stepLogs?: AgentStepLog[] | null;
  aiFailureAnalysis?: string | null;
  durationMs?: number | null;
  tokenCost?: number | null;
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
  orderIndex: number;
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
/**
 * Test case image interface.
 */
export interface TestCaseImage {
  id: number;
  filename: string;
  originalName: string;
  orderIndex: number;
  url: string;
}

export interface TestCase {
  id: number;
  productId: number;
  path: number[];
  suggestedSegmentPath?: string[] | null;
  title: string;
  description?: string;
  promptText?: string;
  preconditions?: string;
  steps: TestStep[];
  expectedResults?: string[];
  priority: TestCasePriority;
  testType: TestCaseType;
  status: TestCaseStatus;
  images?: TestCaseImage[];
  createdAt: string;
  updatedAt: string;
  testStudioJobId?: number;
}

/**
 * Response from POST /api/test-cases/{id}/apply-suggested-path
 * and POST /api/test-cases/bulk-apply-suggested-path.
 */
export interface ApplySuggestedPathResult {
  testCaseId: number;
  resolvedPath: number[];
  resolvedLength: number;
  fullMatch: boolean;
  suggestedLength: number;
  createdSegmentCount: number;
  error: string | null;
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
  executedBy?: ExecutedBy;
  agentExecutionResultId?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** TestResult 실행 주체 (registry_v20). */
export type ExecutedBy = 'HUMAN' | 'AGENT' | 'CI';

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
 * TestRun reference within a phase (1:N).
 */
export interface TestRunRef {
  testRunId: number;
  testRunName: string;
  testCaseCount: number;
}

/**
 * Version phase interface (Phase:TestRun = 1:N).
 */
export interface VersionPhase {
  id: number;
  phaseName: string;
  testRuns: TestRunRef[];
  totalTestCaseCount: number;
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

/**
 * Ticket (Jira issue reference).
 */
export interface Ticket {
  id: number;
  testResultId: number;
  jiraKey: string;
  jiraUrl: string;
  summary: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Failed test case info (for "add failed TCs to phase").
 */
export interface FailedTestCaseInfo {
  testCaseId: number;
  testCaseTitle: string;
  testCasePath: number[];
  failedInPhaseName: string;
  ticketCount: number;
}

/**
 * Priority levels for bug tickets (aligned with Jira).
 */
export enum TicketPriority {
  HIGHEST = 'HIGHEST',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  LOWEST = 'LOWEST',
}

/**
 * Phase type classification.
 */
export enum PhaseType {
  FIRST = 'FIRST',
  SECOND = 'SECOND',
  REGRESSION = 'REGRESSION',
}

/**
 * Daily report for a specific phase on a specific date.
 */
export interface DailyReport {
  phaseId: number;
  phaseName: string;
  snapshotDate: string;
  totalTc: number;
  passCount: number;
  failCount: number;
  blockedCount: number;
  skippedCount: number;
  retestCount: number;
  untestedCount: number;
  newBugCritical: number;
  newBugMajor: number;
  newBugMinor: number;
  newBugTrivial: number;
  closedBugCount: number;
  openBugCount: number;
  agingBugCount: number;
  passRate: number;
  progressRate: number;
}

/**
 * Trend data for a phase over a date range.
 */
export interface TrendData {
  phaseId: number;
  phaseName: string;
  from: string;
  to: string;
  dailyReports: DailyReport[];
}

/**
 * Release readiness evaluation result.
 */
export interface ReleaseReadiness {
  ready: boolean;
  verdict: 'GO' | 'NO_GO';
  criteria: ReadinessCriterion[];
  progress: VersionProgressSummary;
}

export interface ReadinessCriterion {
  name: string;
  threshold: string;
  actual: string;
  passed: boolean;
}

export interface VersionProgressSummary {
  totalTc: number;
  completed: number;
  pass: number;
  fail: number;
  blocked: number;
  overallPassRate: number;
  overallProgressRate: number;
}

/**
 * Dashboard data for a version.
 */
export interface Dashboard {
  releaseReadiness: ReleaseReadiness;
  phaseTrends: TrendData[];
  agingBugs: AgingBugInfo[];
  blockedTcs: BlockedTcInfo[];
}

export interface AgingBugInfo {
  ticketId: number;
  jiraKey: string;
  jiraUrl: string;
  summary: string;
  priority: TicketPriority;
  phaseName: string;
  testCaseTitle: string;
  createdAt: string;
  agingDays: number;
}

export interface BlockedTcInfo {
  testResultId: number;
  testCaseId: number;
  testCaseTitle: string;
  testCasePath: number[];
  phaseName: string;
}

/**
 * Test result comment interface (threaded).
 */
export interface TestResultComment {
  id: number;
  testResultId: number;
  parentId: number | null;
  author: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  children: TestResultComment[];
}
