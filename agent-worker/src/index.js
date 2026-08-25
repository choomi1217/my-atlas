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
import { runTestCase, createWebOps, CancelledError, TargetMismatchError } from './agent.js';
import { createMobileOps } from './drivers/mobile.js';

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
  // 대상 종류. 실행 프로파일 마이그레이션 전까지는 env로 지정한다 (v24 §8 이연 항목).
  const targetKind = env('TARGET_KIND', 'WEB').toUpperCase();
  return {
    // 8085는 worktree 슬롯 시절 포트였다. worktree 폐기(ops_v34) 후 개발 스택은 8080이다.
    backendUrl: env('BACKEND_URL', 'http://localhost:8080'),
    username: env('AGENT_WORKER_USERNAME', 'admin'),
    password: env('AGENT_WORKER_PASSWORD', 'admin'),
    apiKey,
    model: env('AGENT_MODEL', 'claude-haiku-4-5-20251001'),
    headless: env('HEADLESS', 'true') !== 'false',
    // 모바일은 select 미지원 오류가 예산을 1회 소모하므로 여유를 둔다 (v24 §3)
    maxStepActions: parseInt(env('MAX_STEP_ACTIONS', targetKind === 'ANDROID' ? '6' : '4'), 10),
    pollIntervalMs: parseInt(env('POLL_INTERVAL_MS', '3000'), 10),
    // 중단 확인 캐시 TTL. step마다 백엔드를 때리지 않기 위한 값.
    cancelCheckMs: parseInt(env('CANCEL_CHECK_MS', '2500'), 10),
    targetKind,
    appium: {
      appiumUrl: env('APPIUM_URL', 'http://127.0.0.1:4723'),
      deviceName: env('ANDROID_DEVICE', 'emulator-5554'),
      appPackage: env('ANDROID_APP_PACKAGE'),
      snapshotMaxDepth: parseInt(env('SNAPSHOT_MAX_DEPTH', '25'), 10),
    },
  };
}

/**
 * 중단 여부 확인기. step마다 백엔드를 때리면 지연·부하가 커지므로 결과를 짧게 캐시한다.
 * 조회 실패는 "중단 아님"으로 본다 — 일시적 네트워크 오류로 실행을 죽이지 않기 위함.
 */
function makeCancelChecker(backend, jobId, ttlMs) {
  let checkedAt = 0;
  let cancelled = false;
  /** @param {boolean} [force] 캐시를 무시하고 즉시 조회 (보고 실패 직후 등) */
  return async (force = false) => {
    if (cancelled) return true;
    if (!force && Date.now() - checkedAt < ttlMs) return false;
    checkedAt = Date.now();
    try {
      const job = await backend.getJob(jobId);
      cancelled = job?.status === 'CANCELLED';
    } catch {
      /* 조회 실패 시 계속 진행 */
    }
    return cancelled;
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

  const isMobile = cfg.targetKind === 'ANDROID';
  let browser;
  let ops;
  try {
    // 단건 모드에서 대상 종류가 안 맞으면 조용히 넘기지 않고 명확히 실패시킨다.
    // (웹 전용 제품을 에뮬레이터에서 돌리는 식의 오배치를 막는다 — v24 Step 8)
    const declared = (await backend.getJob(jobId))?.execTargetKind;
    if (declared && declared !== cfg.targetKind) {
      throw new TargetMismatchError(
        `이 워커는 ${cfg.targetKind} 전용인데 Job의 대상은 ${declared}입니다. ` +
          `TARGET_KIND를 맞추거나 해당 종류의 워커를 띄우세요.`
      );
    }

    await backend.claim(jobId);
    const ctx = await backend.getContext(jobId);
    console.log(`[worker] job=${jobId} scope=${ctx.scope} target=${ctx.execTargetKind || cfg.targetKind} testCases=${ctx.testCases.length}`);

    if (isMobile) {
      if (!cfg.appium.appPackage) {
        throw new Error('ANDROID_APP_PACKAGE 환경변수가 필요합니다');
      }
      ops = await createMobileOps(cfg.appium);
    } else {
      // baseUrl은 웹에서만 필수다 (모바일 Product에는 없다)
      if (!ctx.baseUrl) {
        throw new Error('Product 실행 프로파일에 baseUrl이 없습니다 (exec_base_url 설정 필요)');
      }
      browser = await chromium.launch({ headless: cfg.headless });
      const page = await browser.newContext().then((c) => c.newPage());
      ops = createWebOps(page);
    }

    const target = { baseUrl: ctx.baseUrl, seedNote: ctx.seedNote };
    const shouldStop = makeCancelChecker(backend, jobId, cfg.cancelCheckMs);

    for (const tc of ctx.testCases) {
      if (await shouldStop()) throw new CancelledError();
      console.log(`[worker] TC ${tc.id} "${tc.title}" 실행 시작`);
      const result = await runTestCase(ops, agent, tc, target, cfg.maxStepActions, shouldStop);
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
    // 중단은 실패가 아니다. cancelJob이 이미 종료 상태로 만들었으므로 아무것도 보고하지 않는다.
    // complete(CANCELLED)는 허용되지 않아 예외가 나고, 그게 아래 complete(FAILED)로 흘러가
    // CANCELLED를 FAILED로 덮어쓴다.
    if (err instanceof CancelledError) {
      console.log(`[worker] job=${jobId} 중단됨 — 보고 없이 종료`);
      return;
    }
    // 워커 오배치는 Job의 실패가 아니다. PENDING 그대로 두어 올바른 워커가 집을 수 있게 한다.
    if (err instanceof TargetMismatchError) {
      console.error(`[worker] job=${jobId} 실행 불가 — ${err.message}`);
      process.exitCode = 1;
      return;
    }
    // 취소는 여러 진입점에서 예외로 드러난다 — claim(점유 불가), recordResult(RUNNING 아님) 등.
    // 호출부마다 막으면 반드시 하나를 놓치므로(실측으로 두 번 놓쳤다) 여기서 일괄 판정한다.
    try {
      const job = await backend.getJob(jobId);
      if (job?.status === 'CANCELLED') {
        console.log(`[worker] job=${jobId} 중단됨 — 보고 없이 종료 (${err.message})`);
        return;
      }
    } catch {
      /* 조회 실패 시 아래 정상 실패 처리로 */
    }
    console.error(`[worker] job=${jobId} 실패: ${err.message}`);
    try {
      await backend.complete(jobId, 'FAILED', err.message);
    } catch (e2) {
      console.error(`[worker] complete(FAILED) 보고 실패: ${e2.message}`);
    }
    throw err;
  } finally {
    if (ops) await ops.close().catch(() => {});
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
  console.log(
    `[worker] 폴링 시작 — productId=${productId}, target=${cfg.targetKind}, interval=${cfg.pollIntervalMs}ms`
  );
  // 건너뛴 Job은 매 폴링마다 로그를 반복하지 않도록 기억해 둔다
  const skipped = new Set();
  for (;;) {
    try {
      const jobs = await backend.listByProduct(productId);
      const pending = (jobs || [])
        .filter((j) => j.status === 'PENDING')
        .sort((a, b) => a.id - b.id);
      for (const job of pending) {
        // 자기가 구동할 수 없는 종류면 집지 않는다. 그래야 워커 2종을 동시에 띄워도
        // 서로 남의 Job을 가져가지 않는다 (claimJob이 idempotent라 중복 점유가 가능하다).
        if (job.execTargetKind && job.execTargetKind !== cfg.targetKind) {
          if (!skipped.has(job.id)) {
            skipped.add(job.id);
            console.log(
              `[worker] job=${job.id} 건너뜀 — 대상이 ${job.execTargetKind}, 이 워커는 ${cfg.targetKind}`
            );
          }
          continue;
        }
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
