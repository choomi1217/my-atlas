import { test, expect, APIRequestContext } from '@playwright/test';
import {
  loginAsAdmin,
  createTestCompany,
  createTestProduct,
  createTestSegment,
  createTestTestCase,
  createTestVersion,
  createTestPhase,
  getPhaseResults,
  updateTestResultStatus,
  deleteCompany,
  kstToday,
  addDays,
  createAgentJob,
  claimAgentJob,
  recordAgentResult,
  completeAgentJob,
} from '../helpers/api-helpers';
import type { ResultPriority } from '../helpers/api-helpers';

const API_URL = process.env.API_URL || 'http://localhost:8080';

interface DailyReport {
  phaseId: number;
  snapshotDate: string;
  totalTc: number;
  passCount: number;
  untestedCount: number;
  passRate: number;
  progressRate: number;
}

interface TrendData {
  phaseId: number;
  from: string;
  to: string;
  dailyReports: DailyReport[];
}

test.describe('Statistics Trend API', () => {
  let request: APIRequestContext;
  let companyId: number;
  let productId: number;
  let tcIds: number[];
  let versionId: number;
  let phaseId: number;
  const today = kstToday();
  const releaseDate = addDays(today, 3);

  test.beforeAll(async ({ playwright }) => {
    const token = await loginAsAdmin();
    request = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    companyId = (await createTestCompany('E2E Statistics Trend Company')).id;
    productId = (await createTestProduct(companyId, 'E2E Statistics Trend Product')).id;
    const segmentId = (await createTestSegment(productId, 'E2E Trend Segment')).id;
    tcIds = [
      (await createTestTestCase(productId, 'E2E Trend TC 1', [segmentId])).id,
      (await createTestTestCase(productId, 'E2E Trend TC 2', [segmentId])).id,
    ];

    versionId = (await createTestVersion(productId, 'E2E Trend Version', releaseDate)).id;
    phaseId = await createTestPhase(productId, versionId, 'E2E Trend Phase', tcIds);
    const results = await getPhaseResults(versionId, phaseId);
    await updateTestResultStatus(versionId, results[0].id, 'PASS');
  });

  test.afterAll(async () => {
    await deleteCompany(companyId);
    await request.dispose();
  });

  async function getTrend(vid: number, pid: number): Promise<TrendData> {
    const response = await request.get(`/api/versions/${vid}/dashboard`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    const trend = (body.data.phaseTrends as TrendData[]).find(t => t.phaseId === pid);
    expect(trend).toBeDefined();
    return trend!;
  }

  test('GET /api/versions/{id}/dashboard - 범위는 Phase 시작일~releaseDate, 마지막 점은 오늘 실시간 값', async () => {
    const trend = await getTrend(versionId, phaseId);

    expect(trend.from).toBe(today);
    expect(trend.to).toBe(releaseDate);

    const last = trend.dailyReports[trend.dailyReports.length - 1];
    expect(last.snapshotDate).toBe(today);
    expect(last.totalTc).toBe(2);
    expect(last.passCount).toBe(1);
    expect(last.untestedCount).toBe(1);
    expect(last.passRate).toBe(100);
    expect(last.progressRate).toBe(50);
  });

  test('GET /api/versions/{id}/dashboard - 릴리즈일이 지난 버전은 오늘 점 없음', async () => {
    const pastVersionId = (await createTestVersion(productId, 'E2E Trend Released Version', addDays(today, -1))).id;
    const pastPhaseId = await createTestPhase(productId, pastVersionId, 'E2E Trend Released Phase', tcIds);

    const trend = await getTrend(pastVersionId, pastPhaseId);

    expect(trend.dailyReports).toEqual([]);
  });

  test('GET /api/phases/{id}/reports/daily - 오늘 날짜는 실시간 값', async () => {
    const response = await request.get(`/api/phases/${phaseId}/reports/daily?date=${today}`);
    expect(response.status()).toBe(200);
    const report = (await response.json()).data as DailyReport;

    expect(report.snapshotDate).toBe(today);
    expect(report.passCount).toBe(1);
  });

  test('GET /api/phases/{id}/reports/trend - 마지막 점은 오늘 실시간 값', async () => {
    const response = await request.get(
      `/api/phases/${phaseId}/reports/trend?from=${addDays(today, -2)}&to=${addDays(today, 1)}`,
    );
    expect(response.status()).toBe(200);
    const trend = (await response.json()).data as TrendData;

    const last = trend.dailyReports[trend.dailyReports.length - 1];
    expect(last.snapshotDate).toBe(today);
    expect(last.passCount).toBe(1);
  });
});

interface ReadinessCriterion {
  name: string;
  threshold: string;
  actual: string;
  passed: boolean;
}

interface ReleaseReadiness {
  ready: boolean;
  verdict: 'GO' | 'NO_GO';
  criteria: ReadinessCriterion[];
  progress: { openFail: number };
}

interface FailedTc {
  testResultId: number;
  testCaseId: number;
  phaseId: number;
  phaseName: string;
  priority: ResultPriority | null;
  comment: string | null;
}

test.describe('Release Readiness by FAIL results', () => {
  // 각 테스트가 앞 테스트의 결과 상태를 이어받는다 (retry 시 describe 전체 재실행)
  test.describe.configure({ mode: 'serial' });

  const AI_REASON = '[AI FAIL] #1 FAIL: E2E 사유';

  let request: APIRequestContext;
  let companyId: number;
  let productId: number;
  let versionId: number;
  let phaseId: number;
  let tc1: number;
  let tc2: number;

  test.beforeAll(async ({ playwright }) => {
    const token = await loginAsAdmin();
    request = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    companyId = (await createTestCompany('E2E Readiness Fail Company')).id;
    productId = (await createTestProduct(companyId, 'E2E Readiness Fail Product')).id;
    const segmentId = (await createTestSegment(productId, 'E2E Readiness Segment')).id;
    tc1 = (await createTestTestCase(productId, 'E2E Readiness TC 1', [segmentId])).id;
    tc2 = (await createTestTestCase(productId, 'E2E Readiness TC 2', [segmentId], 'LOW')).id;

    versionId = (await createTestVersion(productId, 'E2E Readiness Version', addDays(kstToday(), 3))).id;
    phaseId = await createTestPhase(productId, versionId, 'E2E Readiness Phase 1', [tc1, tc2]);
  });

  test.afterAll(async () => {
    await deleteCompany(companyId);
    await request.dispose();
  });

  async function resultOf(pid: number, tcId: number) {
    const result = (await getPhaseResults(versionId, pid)).find(r => r.testCaseId === tcId);
    expect(result).toBeDefined();
    return result!;
  }

  async function getDashboard(): Promise<{ releaseReadiness: ReleaseReadiness; failedTcs: FailedTc[] }> {
    const response = await request.get(`/api/versions/${versionId}/dashboard`);
    expect(response.status()).toBe(200);
    return (await response.json()).data;
  }

  function criterion(readiness: ReleaseReadiness, name: string): ReadinessCriterion {
    const c = readiness.criteria.find(x => x.name === name);
    expect(c).toBeDefined();
    return c!;
  }

  test('AI FAIL - priority null·AGENT·AI 사유 comment, 판정 NO_GO (Priority 확인 필요 1건)', async () => {
    const jobId = await createAgentJob({ scope: 'PHASE_SELECTED', productId, phaseId, testCaseIds: [tc1] });
    await claimAgentJob(jobId, `e2e-readiness-${Date.now()}`);
    await recordAgentResult(jobId, tc1, 'FAIL', [], AI_REASON);
    await completeAgentJob(jobId);

    const result = await resultOf(phaseId, tc1);
    expect(result.status).toBe('FAIL');
    expect(result.priority).toBeNull();
    expect(result.executedBy).toBe('AGENT');
    expect(result.comment).toBe(AI_REASON);

    const { releaseReadiness, failedTcs } = await getDashboard();
    expect(releaseReadiness.verdict).toBe('NO_GO');
    const unconfirmed = criterion(releaseReadiness, 'Priority 확인 필요');
    expect(unconfirmed.actual).toBe('1건');
    expect(unconfirmed.passed).toBe(false);
    expect(releaseReadiness.progress.openFail).toBe(1);

    expect(failedTcs).toHaveLength(1);
    expect(failedTcs[0].testResultId).toBe(result.id);
    expect(failedTcs[0].testCaseId).toBe(tc1);
    expect(failedTcs[0].phaseId).toBe(phaseId);
    expect(failedTcs[0].priority).toBeNull();
    expect(failedTcs[0].comment).toBe(AI_REASON);
  });

  test('PATCH /api/versions/{id}/results/{id} - priority만 LOW 지정 → AGENT 유지, 확인 필요 해소, GO', async () => {
    const result = await resultOf(phaseId, tc1);
    const updated = await updateTestResultStatus(versionId, result.id, 'FAIL', { priority: 'LOW' });

    expect(updated.priority).toBe('LOW');
    expect(updated.executedBy).toBe('AGENT');
    expect(updated.comment).toBe(AI_REASON);

    const { releaseReadiness, failedTcs } = await getDashboard();
    expect(criterion(releaseReadiness, 'Priority 확인 필요').passed).toBe(true);
    expect(releaseReadiness.verdict).toBe('GO');
    expect(failedTcs[0].priority).toBe('LOW');
  });

  test('GET /api/versions/{id}/release-readiness - HIGHEST 미해결 FAIL 1건 → NO_GO', async () => {
    const result = await resultOf(phaseId, tc1);
    await updateTestResultStatus(versionId, result.id, 'FAIL', { priority: 'HIGHEST' });

    const response = await request.get(`/api/versions/${versionId}/release-readiness`);
    expect(response.status()).toBe(200);
    const readiness = (await response.json()).data as ReleaseReadiness;

    const highest = criterion(readiness, 'Highest 미해결 버그');
    expect(highest.actual).toBe('1건');
    expect(highest.passed).toBe(false);
    expect(readiness.verdict).toBe('NO_GO');
  });

  test('재테스트 Phase에서 PASS → 미해결 해소 (openFail 0, failedTcs 비움, GO)', async () => {
    const retestPhaseId = await createTestPhase(productId, versionId, 'E2E Readiness Phase 2', [tc1]);
    const retest = await resultOf(retestPhaseId, tc1);
    await updateTestResultStatus(versionId, retest.id, 'PASS');

    const { releaseReadiness, failedTcs } = await getDashboard();
    expect(releaseReadiness.progress.openFail).toBe(0);
    expect(failedTcs).toEqual([]);
    expect(criterion(releaseReadiness, 'Highest 미해결 버그').actual).toBe('0건');
    expect(releaseReadiness.verdict).toBe('GO');
  });

  test('PATCH /api/versions/{id}/results/{id} - 사람 FAIL은 TC priority로 자동 입력, HUMAN', async () => {
    const result = await resultOf(phaseId, tc2);
    const updated = await updateTestResultStatus(versionId, result.id, 'FAIL');

    expect(updated.priority).toBe('LOW');
    expect(updated.executedBy).toBe('HUMAN');

    const { releaseReadiness, failedTcs } = await getDashboard();
    expect(releaseReadiness.progress.openFail).toBe(1);
    expect(failedTcs.map(f => f.testCaseId)).toEqual([tc2]);
    expect(failedTcs[0].priority).toBe('LOW');
  });

  test('PATCH /api/versions/{id}/results/{id} - 수동 상태 변경은 AI comment를 지우지 않고 HUMAN 전환', async () => {
    const result = await resultOf(phaseId, tc1);
    expect(result.comment).toBe(AI_REASON);

    const updated = await updateTestResultStatus(versionId, result.id, 'RETEST');

    expect(updated.status).toBe('RETEST');
    expect(updated.executedBy).toBe('HUMAN');
    expect(updated.comment).toBe(AI_REASON);
  });
});
