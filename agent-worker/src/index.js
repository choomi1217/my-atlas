/**
 * 에이전트 워커 진입점.
 *
 * 두 가지 모드:
 *   - 단건:  node src/index.js <jobId>
 *   - 폴링:  node src/index.js --poll   (POLL_PRODUCT_ID 환경변수 필요)
 *            → 해당 Product의 PENDING Job을 주기적으로 집어 실행 (사용자가 [AI 시험 실행] 클릭 시 자동 처리)
 *
 * 흐름: login → claim → context → (TC별 runTestCase → recordResult) → complete.
 * 워커는 수동 트리거 전용이다 (비용 보호). 폴링 모드도 사용자 클릭으로 생긴 Job만 실행한다.
 */
import Anthropic from '@anthropic-ai/sdk';
import { chromium } from 'playwright';
import { BackendClient } from './backend.js';
import { runTestCase } from './agent.js';

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

/**
 * 실패/판정불가 시 실패 이유를 요약해 반환 (LLM 추가 호출 없음).
 * 실패한 step들의 판정(judgment)을 이어붙여 TestResult.comment에 기록되게 한다.
 * PASS면 null (comment 미기록).
 */
function buildFailureAnalysis(result) {
  if (!result || result.verdict === 'PASS') return null;
  const problems = (result.stepLogs || [])
    .filter((s) => /FAIL|INCONCLUSIVE/i.test(s.judgment || ''))
    .map((s) => `#${s.order} ${s.judgment}`);
  const body = problems.length > 0 ? problems.join('\n') : '실패 원인 상세 없음';
  return `[AI ${result.verdict}] ${body}`.slice(0, 1500);
}

function makeConfig() {
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY가 필요합니다 (.env)');
    process.exit(1);
  }
  return {
    backendUrl: env('BACKEND_URL', 'http://localhost:8085'),
    username: env('AGENT_WORKER_USERNAME', 'admin'),
    password: env('AGENT_WORKER_PASSWORD', 'admin'),
    apiKey,
    model: env('AGENT_MODEL', 'claude-haiku-4-5-20251001'),
    headless: env('HEADLESS', 'true') !== 'false',
    maxStepActions: parseInt(env('MAX_STEP_ACTIONS', '4'), 10),
    pollIntervalMs: parseInt(env('POLL_INTERVAL_MS', '3000'), 10),
  };
}

/** 단일 Job 하나를 처음부터 끝까지 실행 */
async function runJob(jobId, cfg, backend) {
  const agent = {
    anthropic: new Anthropic({ apiKey: cfg.apiKey }),
    model: cfg.model,
    tokenCost: 0,
    now: () => Date.now(),
    // 대상 앱 로그인용 (my-atlas 자기 테스트는 백엔드 시드 계정과 동일)
    username: cfg.username,
    password: cfg.password,
  };

  let browser;
  try {
    await backend.claim(jobId);
    const ctx = await backend.getContext(jobId);
    console.log(`[worker] job=${jobId} scope=${ctx.scope} baseUrl=${ctx.baseUrl} testCases=${ctx.testCases.length}`);
    if (!ctx.baseUrl) {
      throw new Error('Product 실행 프로파일에 baseUrl이 없습니다 (exec_base_url 설정 필요)');
    }

    browser = await chromium.launch({ headless: cfg.headless });
    const page = await browser.newContext().then((c) => c.newPage());

    for (const tc of ctx.testCases) {
      console.log(`[worker] TC ${tc.id} "${tc.title}" 실행 시작`);
      const result = await runTestCase(page, agent, tc, ctx.baseUrl, ctx.seedNote, cfg.maxStepActions);
      console.log(`[worker] TC ${tc.id} → ${result.verdict} (${result.durationMs}ms, ${result.tokenCost} tokens)`);
      await backend.recordResult(jobId, {
        testCaseId: tc.id,
        verdict: result.verdict,
        stepLogs: result.stepLogs,
        aiFailureAnalysis: buildFailureAnalysis(result),
        durationMs: result.durationMs,
        tokenCost: result.tokenCost,
      });
    }

    await backend.complete(jobId, 'DONE', null);
    console.log(`[worker] job=${jobId} DONE`);
  } catch (err) {
    console.error(`[worker] job=${jobId} 실패: ${err.message}`);
    try {
      await backend.complete(jobId, 'FAILED', err.message);
    } catch (e2) {
      console.error(`[worker] complete(FAILED) 보고 실패: ${e2.message}`);
    }
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 폴링 모드: PENDING Job을 주기적으로 집어 실행 */
async function pollLoop(cfg, backend) {
  const productId = env('POLL_PRODUCT_ID');
  if (!productId) {
    console.error('폴링 모드는 POLL_PRODUCT_ID 환경변수가 필요합니다');
    process.exit(1);
  }
  console.log(`[worker] 폴링 시작 — productId=${productId}, interval=${cfg.pollIntervalMs}ms`);
  for (;;) {
    try {
      const jobs = await backend.listByProduct(productId);
      const pending = (jobs || [])
        .filter((j) => j.status === 'PENDING')
        .sort((a, b) => a.id - b.id);
      for (const job of pending) {
        console.log(`[worker] PENDING job=${job.id} 발견 — 실행`);
        await runJob(job.id, cfg, backend).catch(() => {});
      }
    } catch (err) {
      console.error(`[worker] 폴링 오류: ${err.message}`);
    }
    await sleep(cfg.pollIntervalMs);
  }
}

async function main() {
  const cfg = makeConfig();
  const backend = new BackendClient(cfg.backendUrl);
  await backend.login(cfg.username, cfg.password);

  const arg = process.argv[2];
  if (arg === '--poll') {
    await pollLoop(cfg, backend);
    return;
  }
  if (!arg) {
    console.error('사용법: node src/index.js <jobId>  |  node src/index.js --poll');
    process.exit(1);
  }
  await runJob(arg, cfg, backend).catch(() => {
    process.exitCode = 1;
  });
}

main();
