import axios, { AxiosInstance } from 'axios';
import { deflateSync } from 'node:zlib';

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

export interface TestStepData {
  order: number;
  action: string;
  expected: string;
}

/**
 * Create a test test case
 */
export async function createTestTestCase(
  productId: number,
  title = 'E2E Test Case',
  path: number[] = [],
  priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM',
  steps?: TestStepData[],
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
      steps,
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
  testRuns: { testRunId: number; testRunName: string; testCaseCount: number }[];
  totalTestCaseCount: number;
  orderIndex: number;
  versionId: number;
}

/**
 * Create a test version (simplified: no phases in creation, add via Phase API)
 */
export async function createTestVersion(
  productId: number,
  name: string = 'E2E Test Version',
  releaseDate?: string,
): Promise<VersionData> {
  try {
    await ensureAuthenticated();
    const response = await client.post(`/api/products/${productId}/versions`, {
      productId,
      name,
      releaseDate: releaseDate ?? null,
      description: `Test version ${name}`,
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
 * Create a TestRun with the given TCs and a Version Phase on top of it.
 * Phase creation materializes one UNTESTED test_result per TC.
 * @returns phaseId
 */
export async function createTestPhase(
  productId: number,
  versionId: number,
  phaseName: string,
  testCaseIds: number[],
): Promise<number> {
  await ensureAuthenticated();
  const run = await client.post(`/api/products/${productId}/test-runs`, {
    name: `${phaseName} Run`,
    description: 'E2E test run',
    testCaseIds,
  });
  const phase = await client.post(`/api/versions/${versionId}/phases`, {
    phaseName,
    testRunIds: [run.data.data.id],
    testCaseIds: [],
  });
  return phase.data.data.id as number;
}

/** 결과·티켓 Priority (null = Unknown, `확인 필요`) */
export type ResultPriority = 'HIGHEST' | 'HIGH' | 'MEDIUM' | 'LOW' | 'LOWEST';

export interface TestResultData {
  id: number;
  versionPhaseId: number;
  testCaseId: number;
  status: string;
  priority: ResultPriority | null;
  comment: string | null;
  executedBy: 'HUMAN' | 'AGENT' | 'CI' | null;
}

/** Phase의 TC 결과 목록 */
export async function getPhaseResults(versionId: number, phaseId: number): Promise<TestResultData[]> {
  await ensureAuthenticated();
  const response = await client.get(`/api/versions/${versionId}/phases/${phaseId}/results`);
  return response.data.data as TestResultData[];
}

/** 결과 상태 변경 (comment·priority는 보낼 때만 바뀐다). @returns 변경된 결과 */
export async function updateTestResultStatus(
  versionId: number,
  resultId: number,
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' | 'RETEST' | 'UNTESTED',
  extra: { comment?: string; priority?: ResultPriority } = {},
): Promise<TestResultData> {
  await ensureAuthenticated();
  const response = await client.patch(`/api/versions/${versionId}/results/${resultId}`, { status, ...extra });
  return response.data.data as TestResultData;
}

/** 서버(KST) 기준 오늘 'YYYY-MM-DD' */
export function kstToday(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
}

/** 'YYYY-MM-DD' + n일 (UTC 계산, 타임존 무관) */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// --- Agent execution: 워커 역할을 API로 대신한다 (E2E에는 실제 워커/LLM이 없다) ---

export type AgentScope = 'SINGLE' | 'PHASE_ALL' | 'PHASE_UNTESTED' | 'PHASE_PREV_FAIL' | 'PHASE_SELECTED';
export type AgentVerdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export interface AgentStepLogData {
  order: number;
  actionTaken: string;
  observed: string;
  judgment: string;
}

const AGENT_API = '/api/agent-executions';

/** Job 생성 (PENDING). @returns jobId */
export async function createAgentJob(body: {
  scope: AgentScope;
  productId: number;
  phaseId?: number;
  targetTestCaseId?: number;
  testCaseIds?: number[];
}): Promise<number> {
  await ensureAuthenticated();
  const response = await client.post(AGENT_API, body);
  return response.data.data.jobId as number;
}

/** 워커 claim: PENDING → RUNNING, workerId·startedAt 기록 */
export async function claimAgentJob(jobId: number, workerId: string): Promise<void> {
  await ensureAuthenticated();
  await client.post(`${AGENT_API}/${jobId}/claim`, { workerId });
}

/**
 * TC 1건 결과 보고. Phase Job이면 Phase 결과에도 반영된다
 * (aiFailureAnalysis → 결과 comment, priority는 항상 Unknown). @returns 에이전트 결과 id
 */
export async function recordAgentResult(
  jobId: number,
  testCaseId: number,
  verdict: AgentVerdict,
  stepLogs: AgentStepLogData[] = [],
  aiFailureAnalysis?: string,
): Promise<number> {
  await ensureAuthenticated();
  const response = await client.post(`${AGENT_API}/${jobId}/results`, {
    testCaseId,
    verdict,
    stepLogs,
    aiFailureAnalysis,
    durationMs: 1000,
    tokenCost: 10,
  });
  return response.data.data.id as number;
}

export async function completeAgentJob(jobId: number, status: 'DONE' | 'FAILED' = 'DONE'): Promise<void> {
  await ensureAuthenticated();
  await client.post(`${AGENT_API}/${jobId}/complete`, { status });
}

export async function cancelAgentJob(jobId: number): Promise<void> {
  await ensureAuthenticated();
  await client.post(`${AGENT_API}/${jobId}/cancel`);
}

/** 라이브 진행 상황 업로드 (RUNNING Job만) */
export async function putAgentProgress(jobId: number, progress: unknown): Promise<void> {
  await ensureAuthenticated();
  await client.put(`${AGENT_API}/${jobId}/progress`, progress);
}

/** 라이브 프레임 업로드 (RUNNING Job만) */
export async function putAgentFrame(jobId: number, png: Buffer): Promise<void> {
  await ensureAuthenticated();
  await client.put(`${AGENT_API}/${jobId}/frame`, png, { headers: { 'Content-Type': 'image/png' } });
}

/** Step 스크린샷 업로드 (Job 상태 무관) */
export async function putAgentScreenshot(
  jobId: number,
  testCaseId: number,
  stepOrder: number,
  png: Buffer,
): Promise<void> {
  await ensureAuthenticated();
  await client.put(`${AGENT_API}/${jobId}/screenshots`, png, {
    params: { testCaseId, stepOrder },
    headers: { 'Content-Type': 'image/png' },
  });
}

/**
 * 워커 heartbeat. 백엔드 메모리에 15초간 남는다 —
 * 다른 테스트에 영향이 없도록 항상 그 테스트가 만든 productId로 보낸다 (productId null은 모든 제품에 매칭된다).
 */
export async function sendWorkerHeartbeat(
  workerId: string,
  productId: number,
  targetKind: 'WEB' | 'ANDROID' = 'WEB',
): Promise<void> {
  await ensureAuthenticated();
  await client.put(`${AGENT_API}/workers`, {
    workerId,
    targetKind,
    productId,
    deviceName: null,
    currentJobId: null,
  });
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typed.copy(out, 4);
  out.writeUInt32BE(crc32(typed), 8 + data.length);
  return out;
}

/**
 * 알파 채널이 있는 RGBA PNG를 의존성 없이 만든다 (node:zlib).
 * 가로 그라데이션, 왼쪽 절반은 반투명.
 */
export function buildRgbaPng(width: number, height: number): Buffer {
  const row = Buffer.alloc(1 + width * 4); // 첫 바이트 0 = 필터 없음
  for (let x = 0; x < width; x++) {
    const p = 1 + x * 4;
    row[p] = Math.floor((x * 255) / width);
    row[p + 1] = 120;
    row[p + 2] = 200;
    row[p + 3] = x < width / 2 ? 128 : 255;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(new Array<Buffer>(height).fill(row)))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
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
