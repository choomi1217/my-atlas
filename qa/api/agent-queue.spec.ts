import { test, expect, APIRequestContext } from '@playwright/test';
import {
  buildRgbaPng,
  claimAgentJob,
  completeAgentJob,
  createAgentJob,
  createTestCompany,
  createTestPhase,
  createTestProduct,
  createTestSegment,
  createTestTestCase,
  createTestVersion,
  deleteCompany,
  loginAsAdmin,
} from '../helpers/api-helpers';

/**
 * registry_v31 Step 1 — Test Automation 페이지용 API E2E.
 * /queue, PHASE_SELECTED, Phase 내 TC 중복 409, 재실행의 Phase 결과 반영, claim workerId, 워커 heartbeat,
 * Step 스크린샷(도커 백엔드의 JDK ImageIO JPEG 변환)을 검증한다. 워커 역할은 테스트가 API로 대신한다.
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';
const BASE = '/api/agent-executions';

interface JobData {
  id: number;
  scope: string;
  status: string;
  phaseId: number | null;
  totalCount: number;
  execTargetKind: string | null;
  createdAt: string;
  startedAt: string | null;
  workerId: string | null;
}

interface QueueItem {
  job: JobData;
  productName: string | null;
  companyId: number | null;
  phaseName: string | null;
  versionId: number | null;
  versionName: string | null;
  testCaseTitle: string | null;
}

interface QueuePage {
  items: QueueItem[];
  totalElements: number;
  page: number;
  totalPages: number;
}

interface PhaseResult {
  id: number;
  testCaseId: number;
  status: string;
  executedBy: string | null;
  agentExecutionResultId: number | null;
}

/** JPEG SOF 마커에서 크기를 읽는다 */
function jpegSize(jpeg: Buffer): { width: number; height: number } {
  let i = 2; // SOI 다음
  while (i + 9 < jpeg.length) {
    const marker = jpeg[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: jpeg.readUInt16BE(i + 5), width: jpeg.readUInt16BE(i + 7) };
    }
    i += 2 + jpeg.readUInt16BE(i + 2);
  }
  throw new Error('JPEG SOF marker not found');
}

let request: APIRequestContext;
let companyId: number;
let productId: number;
let productName: string;
let versionId: number;
let versionName: string;
const tcIds: number[] = [];
let phaseSeq = 0;

test.beforeAll(async ({ playwright }) => {
  const token = await loginAsAdmin();
  request = await playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  companyId = (await createTestCompany()).id;
  const product = await createTestProduct(companyId);
  productId = product.id;
  productName = product.name;
  const segmentId = (await createTestSegment(productId)).id;
  for (let i = 1; i <= 3; i++) {
    tcIds.push((await createTestTestCase(productId, `E2E Queue TC ${i}`, [segmentId])).id);
  }
  const version = await createTestVersion(productId);
  versionId = version.id;
  versionName = version.name;
});

test.afterAll(async () => {
  // 이 spec이 만든 회사만 삭제 (product/phase/job/screenshot은 cascade)
  if (companyId) await deleteCompany(companyId);
  if (request) await request.dispose();
});

/** 테스트마다 새 Phase — 같은 Phase의 활성 Job이 다음 테스트를 409로 막지 않게 한다 */
async function newPhase(testCaseIds: number[]): Promise<{ id: number; name: string }> {
  const name = `E2E Queue Phase ${++phaseSeq}`;
  return { id: await createTestPhase(productId, versionId, name, testCaseIds), name };
}

const singleJob = (tcId = tcIds[0]) =>
  createAgentJob({ scope: 'SINGLE', productId, targetTestCaseId: tcId });

const postJob = (data: Record<string, unknown>) => request.post(BASE, { data });

async function jobIdOf(res: Awaited<ReturnType<typeof postJob>>): Promise<number> {
  expect(res.status()).toBe(201);
  return ((await res.json()) as { data: { jobId: number } }).data.jobId;
}

async function getJob(jobId: number): Promise<JobData> {
  const res = await request.get(`${BASE}/${jobId}`);
  expect(res.status()).toBe(200);
  return ((await res.json()) as { data: JobData }).data;
}

async function getQueue(query: string): Promise<QueuePage> {
  const res = await request.get(`${BASE}/queue?${query}`);
  expect(res.status()).toBe(200);
  return ((await res.json()) as { data: QueuePage }).data;
}

async function phaseResults(phaseId: number): Promise<PhaseResult[]> {
  const res = await request.get(`/api/versions/${versionId}/phases/${phaseId}/results`);
  expect(res.status()).toBe(200);
  return ((await res.json()) as { data: PhaseResult[] }).data;
}

const times = (p: QueuePage) => p.items.map((i) => new Date(i.job.createdAt).getTime());

test.describe('Agent Queue API - GET /queue', () => {
  test('GET /api/agent-executions/queue - repeated status filter returns only those statuses', async () => {
    const pending = await singleJob();
    const running = await singleJob();
    await claimAgentJob(running, 'e2e-queue-worker');
    const done = await singleJob();
    await claimAgentJob(done, 'e2e-queue-worker');
    await completeAgentJob(done);

    const active = await getQueue('status=PENDING&status=RUNNING&size=100&direction=DESC');
    expect(active.items.every((i) => ['PENDING', 'RUNNING'].includes(i.job.status))).toBe(true);
    const activeIds = active.items.map((i) => i.job.id);
    expect(activeIds).toEqual(expect.arrayContaining([pending, running]));
    expect(activeIds).not.toContain(done);

    const finished = await getQueue('status=DONE&size=100&direction=DESC');
    expect(finished.items.every((i) => i.job.status === 'DONE')).toBe(true);
    const finishedIds = finished.items.map((i) => i.job.id);
    expect(finishedIds).toContain(done);
    expect(finishedIds).not.toContain(pending);
  });

  test('GET /api/agent-executions/queue - direction orders by createdAt', async () => {
    const older = await singleJob();
    const newer = await singleJob();

    const desc = await getQueue('size=100&direction=DESC');
    const descTimes = times(desc);
    expect(descTimes).toEqual([...descTimes].sort((a, b) => b - a));
    const ids = desc.items.map((i) => i.job.id);
    expect(ids.indexOf(newer)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older));

    const ascTimes = times(await getQueue('size=100&direction=ASC'));
    expect(ascTimes).toEqual([...ascTimes].sort((a, b) => a - b));
  });

  test('GET /api/agent-executions/queue - paging fields', async () => {
    await singleJob();
    await singleJob();

    const first = await getQueue('size=1&page=0');
    expect(first.items).toHaveLength(1);
    expect(first.page).toBe(0);
    expect(first.totalElements).toBeGreaterThanOrEqual(2);
    expect(first.totalPages).toBe(first.totalElements);

    const second = await getQueue('size=1&page=1');
    expect(second.page).toBe(1);
    expect(second.items).toHaveLength(1);
    expect(second.items[0].job.id).not.toBe(first.items[0].job.id);
  });

  test('GET /api/agent-executions/queue - items carry product, version, phase names and link ids', async () => {
    const phase = await newPhase([tcIds[0]]);
    const phaseJob = await createAgentJob({ scope: 'PHASE_ALL', productId, phaseId: phase.id });
    const single = await singleJob(tcIds[1]);

    const { items } = await getQueue('size=100&direction=DESC');
    const p = items.find((i) => i.job.id === phaseJob);
    expect(p).toMatchObject({
      productName,
      companyId,
      phaseName: phase.name,
      versionId,
      versionName,
      testCaseTitle: null,
    });
    expect(p?.job.execTargetKind).toBe('WEB');

    const s = items.find((i) => i.job.id === single);
    expect(s).toMatchObject({
      productName,
      companyId,
      phaseName: null,
      versionId: null,
      testCaseTitle: 'E2E Queue TC 2',
    });
  });

  test('GET /api/agent-executions/queue - invalid direction or status → 400', async () => {
    expect((await request.get(`${BASE}/queue?direction=SIDEWAYS`)).status()).toBe(400);
    expect((await request.get(`${BASE}/queue?status=NOPE`)).status()).toBe(400);
  });
});

test.describe('Agent Queue API - PHASE_SELECTED', () => {
  test('POST /api/agent-executions - PHASE_SELECTED runs only the given TCs', async () => {
    const phase = await newPhase([tcIds[0], tcIds[1]]);
    const jobId = await jobIdOf(
      await postJob({ scope: 'PHASE_SELECTED', productId, phaseId: phase.id, testCaseIds: [tcIds[1]] }),
    );

    expect(await getJob(jobId)).toMatchObject({
      scope: 'PHASE_SELECTED',
      status: 'PENDING',
      phaseId: phase.id,
      totalCount: 1,
    });

    const ctx = await request.get(`${BASE}/${jobId}/context`);
    expect(ctx.status()).toBe(200);
    const testCases = ((await ctx.json()) as { data: { testCases: { id: number }[] } }).data.testCases;
    expect(testCases.map((t) => t.id)).toEqual([tcIds[1]]);
  });

  test('POST /api/agent-executions - PHASE_SELECTED with a TC outside the phase → 400', async () => {
    const phase = await newPhase([tcIds[0]]);
    const res = await postJob({
      scope: 'PHASE_SELECTED',
      productId,
      phaseId: phase.id,
      testCaseIds: [tcIds[0], tcIds[2]],
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/agent-executions - PHASE_SELECTED with empty testCaseIds → 400', async () => {
    const phase = await newPhase([tcIds[0]]);
    const res = await postJob({ scope: 'PHASE_SELECTED', productId, phaseId: phase.id, testCaseIds: [] });
    expect(res.status()).toBe(400);
  });
});

test.describe('Agent Queue API - TC overlap within a phase', () => {
  test('POST /api/agent-executions - overlapping TCs with an active job → 409', async () => {
    const phase = await newPhase([tcIds[0], tcIds[1], tcIds[2]]);
    const first = await jobIdOf(
      await postJob({ scope: 'PHASE_SELECTED', productId, phaseId: phase.id, testCaseIds: [tcIds[0], tcIds[1]] }),
    );

    const overlap = await postJob({
      scope: 'PHASE_SELECTED',
      productId,
      phaseId: phase.id,
      testCaseIds: [tcIds[1], tcIds[2]],
    });
    expect(overlap.status()).toBe(409);
    expect(((await overlap.json()) as { message: string }).message).toContain(`Job(#${first})`);

    // 전체 범위도 같은 TC를 포함하므로 막힌다
    expect((await postJob({ scope: 'PHASE_ALL', productId, phaseId: phase.id })).status()).toBe(409);
  });

  test('POST /api/agent-executions - disjoint TCs in the same phase → 201', async () => {
    const phase = await newPhase([tcIds[0], tcIds[1]]);
    await jobIdOf(await postJob({ scope: 'PHASE_SELECTED', productId, phaseId: phase.id, testCaseIds: [tcIds[0]] }));
    await jobIdOf(await postJob({ scope: 'PHASE_SELECTED', productId, phaseId: phase.id, testCaseIds: [tcIds[1]] }));
  });

  test('POST /api/agent-executions - same TCs are accepted again after the first job is cancelled', async () => {
    const phase = await newPhase([tcIds[0]]);
    const body = { scope: 'PHASE_SELECTED', productId, phaseId: phase.id, testCaseIds: [tcIds[0]] };
    const first = await jobIdOf(await postJob(body));
    expect((await postJob(body)).status()).toBe(409);

    const cancel = await request.post(`${BASE}/${first}/cancel`);
    expect(cancel.status()).toBe(200);

    await jobIdOf(await postJob(body));
  });
});

test.describe('Agent Queue API - rerun result reflected in the phase', () => {
  test('POST /api/agent-executions/{id}/results - PHASE_SELECTED verdict overwrites the phase result', async () => {
    const phase = await newPhase([tcIds[0], tcIds[1]]);
    const target = (await phaseResults(phase.id)).find((r) => r.testCaseId === tcIds[0]);
    expect(target).toBeDefined();

    // 사람이 먼저 FAIL로 기록 — 재실행 결과가 덮어써야 한다 (registry_v31 결정 1)
    const manual = await request.patch(`/api/versions/${versionId}/results/${target!.id}`, {
      data: { status: 'FAIL', comment: 'E2E manual result' },
    });
    expect(manual.status()).toBe(200);

    const jobId = await createAgentJob({
      scope: 'PHASE_SELECTED',
      productId,
      phaseId: phase.id,
      testCaseIds: [tcIds[0]],
    });
    await claimAgentJob(jobId, 'e2e-queue-worker');
    const recorded = await request.post(`${BASE}/${jobId}/results`, {
      data: { testCaseId: tcIds[0], verdict: 'PASS', stepLogs: [], durationMs: 1000, tokenCost: 10 },
    });
    expect(recorded.status()).toBe(201);
    const resultId = ((await recorded.json()) as { data: { id: number } }).data.id;

    const after = await phaseResults(phase.id);
    expect(after.find((r) => r.testCaseId === tcIds[0])).toMatchObject({
      status: 'PASS',
      executedBy: 'AGENT',
      agentExecutionResultId: resultId,
    });
    // 선택하지 않은 TC는 그대로
    expect(after.find((r) => r.testCaseId === tcIds[1])).toMatchObject({ status: 'UNTESTED' });
  });
});

test.describe('Agent Queue API - claim and workers', () => {
  test('POST /api/agent-executions/{id}/claim - records startedAt and workerId', async () => {
    const jobId = await singleJob();
    const before = await getJob(jobId);
    expect(before.startedAt).toBeNull();
    expect(before.workerId).toBeNull();

    const workerId = `e2e-claim-${Date.now()}`;
    const res = await request.post(`${BASE}/${jobId}/claim`, { data: { workerId } });
    expect(res.status()).toBe(200);
    const claimed = ((await res.json()) as { data: JobData }).data;
    expect(claimed.status).toBe('RUNNING');
    expect(claimed.workerId).toBe(workerId);
    expect(claimed.startedAt).toBeTruthy();

    const after = await getJob(jobId);
    expect(after.workerId).toBe(workerId);
    expect(after.startedAt).toBeTruthy();
  });

  test('POST /api/agent-executions/{id}/claim - without body still claims (older workers)', async () => {
    const jobId = await singleJob();
    const res = await request.post(`${BASE}/${jobId}/claim`);
    expect(res.status()).toBe(200);
    const claimed = ((await res.json()) as { data: JobData }).data;
    expect(claimed.status).toBe('RUNNING');
    expect(claimed.startedAt).toBeTruthy();
    expect(claimed.workerId).toBeNull();
  });

  test('PUT /api/agent-executions/workers - heartbeat is listed by GET /workers', async () => {
    // 이 spec의 제품으로만 보낸다 — UI spec의 "연결된 워커 없음" 검증에 섞이지 않는다
    const workerId = `e2e-heartbeat-${Date.now()}`;
    const put = await request.put(`${BASE}/workers`, {
      data: { workerId, targetKind: 'WEB', productId, deviceName: null, currentJobId: null },
    });
    expect(put.status()).toBe(204);

    const list = await request.get(`${BASE}/workers`);
    expect(list.status()).toBe(200);
    const workers = ((await list.json()) as { data: Record<string, unknown>[] }).data;
    expect(Array.isArray(workers)).toBe(true);
    const mine = workers.find((w) => w.workerId === workerId);
    expect(mine).toMatchObject({ targetKind: 'WEB', productId, currentJobId: null });
    expect(mine?.lastSeenAt).toBeTruthy();
  });

  test('PUT /api/agent-executions/workers - body without workerId → 400', async () => {
    const res = await request.put(`${BASE}/workers`, { data: { targetKind: 'WEB', productId } });
    expect(res.status()).toBe(400);
  });
});

test.describe('Agent Queue API - step screenshots', () => {
  const shotUrl = (jobId: number, tcId: number, stepOrder: number) =>
    `${BASE}/${jobId}/screenshots?testCaseId=${tcId}&stepOrder=${stepOrder}`;

  test('PUT/GET /api/agent-executions/{id}/screenshots - 2000x1000 RGBA PNG is stored as 1280px JPEG', async () => {
    const jobId = await singleJob();
    const put = await request.put(shotUrl(jobId, tcIds[0], 1), {
      headers: { 'Content-Type': 'image/png' },
      data: buildRgbaPng(2000, 1000),
    });
    expect(put.status()).toBe(204);

    const get = await request.get(shotUrl(jobId, tcIds[0], 1));
    expect(get.status()).toBe(200);
    // ImageIO 변환이 실패하면 원본 PNG가 조용히 저장된다 — 그 경우를 실패로 잡기 위해 정확히 비교한다
    expect(get.headers()['content-type']).toBe('image/jpeg');
    const body = await get.body();
    expect([...body.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect(jpegSize(body)).toEqual({ width: 1280, height: 640 });
  });

  test('GET /api/agent-executions/{id}/screenshots - step without a screenshot → 204', async () => {
    const jobId = await singleJob();
    const res = await request.get(shotUrl(jobId, tcIds[0], 99));
    expect(res.status()).toBe(204);
  });

  test('PUT /api/agent-executions/{id}/screenshots - missing stepOrder → 400', async () => {
    const jobId = await singleJob();
    const res = await request.put(`${BASE}/${jobId}/screenshots?testCaseId=${tcIds[0]}`, {
      headers: { 'Content-Type': 'image/png' },
      data: buildRgbaPng(8, 8),
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/agent-executions/{id}/screenshots - text/plain → 415', async () => {
    const jobId = await singleJob();
    const res = await request.put(shotUrl(jobId, tcIds[0], 1), {
      headers: { 'Content-Type': 'text/plain' },
      data: 'not an image',
    });
    expect(res.status()).toBe(415);
  });
});
