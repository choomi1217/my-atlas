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
} from '../helpers/api-helpers';

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
