/**
 * 브라우저 에이전트 루프.
 * Playwright로 페이지를 관측하고, Claude가 각 TC step에 대해
 * (액션 결정 → 실행 → expected 대조 판정)을 수행한다.
 * Phase 0 PoC에서 사람이 수동으로 돌린 루프의 제품화.
 */

/**
 * 현재 페이지의 상호작용 가능한 요소를 추출하고 data-agent-ref를 주입한다.
 * 같은 이름(name)의 요소가 여러 개 있을 때(예: 네비게이션 링크와 소개 카드가 같은
 * 문구를 쓰는 경우), testId/href/type 중 하나라도 있으면 그걸로 서로 구분할 수 있다.
 * @returns {Promise<Array<{ref:string, role:string, name:string, tag:string, value:string, testId?:string, href?:string, type?:string}>>}
 */
async function snapshotInteractive(page) {
  return page.evaluate(() => {
    const SELECTOR = 'button, a[href], input, select, textarea, [role="button"], [contenteditable="true"]';
    // React 등은 onClick을 DOM 속성이 아니라 합성 이벤트로 붙이기 때문에 셀렉터로 감지 불가.
    // 대신 개발자가 클릭 가능함을 알리려고 넣는 커서 스타일(pointer/move/grab 등)을 단서로 삼는다.
    const CURSOR_CANDIDATE_SELECTOR = 'div, span, li, tr, td, label';
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const hasInteractiveCursor = (el) => {
      const cursor = window.getComputedStyle(el).cursor;
      return !!cursor && cursor !== 'auto' && cursor !== 'default' && cursor !== 'text';
    };
    // 카드처럼 안에 버튼(Test Runs/Edit/Delete 등)을 품은 컨테이너의 textContent를 그대로 쓰면
    // 안쪽 버튼 글자까지 다 이어붙어 이름이 지저분해지고, 그 버튼 자체와 헷갈리게 된다.
    // 이미 별도 후보로 잡히는 중첩 요소(SELECTOR 매치)의 텍스트는 빼고 "자기 자신의" 텍스트만 남긴다.
    const ownTextContent = (el) => {
      const nested = el.querySelectorAll(SELECTOR);
      if (nested.length === 0) return el.textContent || '';
      const clone = el.cloneNode(true);
      clone.querySelectorAll(SELECTOR).forEach((n) => n.remove());
      return clone.textContent || '';
    };
    const nameOf = (el) =>
      (el.getAttribute('aria-label') ||
        el.getAttribute('placeholder') ||
        el.value ||
        ownTextContent(el) ||
        el.textContent ||
        el.getAttribute('title') ||
        '').trim().replace(/\s+/g, ' ').slice(0, 120);
    const explicit = [...document.querySelectorAll(SELECTOR)].filter(isVisible);
    const explicitSet = new Set(explicit);
    const cursorCandidatesRaw = [...document.querySelectorAll(CURSOR_CANDIDATE_SELECTOR)]
      .filter((el) => !explicitSet.has(el) && isVisible(el) && hasInteractiveCursor(el));
    // cursor는 CSS 상속 속성이라, 클릭 가능한 컨테이너의 자손(예: 이름 표시용 span)도
    // 부모의 cursor 스타일을 그냥 물려받아 똑같이 후보로 잡히곤 한다. 그러면 같은 대상이
    // 서로 다른 이름(컨테이너 전체 텍스트 vs 자손만의 텍스트)으로 중복 등장해 헷갈린다.
    // 단, 자손이 자기만의 명시적 cursor 스타일을 갖고 있으면(부모와 값이 다르면) 그건
    // 정말 별개의 상호작용 대상(예: 펼치기/접기 화살표)일 수 있으니 남겨둔다.
    const cursorCandidateSet = new Set(cursorCandidatesRaw);
    const cursorCandidates = cursorCandidatesRaw.filter((el) => {
      const ownCursor = window.getComputedStyle(el).cursor;
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (cursorCandidateSet.has(p)) {
          return ownCursor !== window.getComputedStyle(p).cursor;
        }
      }
      return true;
    });
    const els = [...explicit, ...cursorCandidates];
    return els.map((el, i) => {
      const ref = `a${i}`;
      el.setAttribute('data-agent-ref', ref);
      return {
        ref,
        role: el.getAttribute('role') || el.tagName.toLowerCase(),
        name: nameOf(el),
        tag: el.tagName.toLowerCase(),
        value: (el.value || '').slice(0, 60),
        testId: el.getAttribute('data-testid') || undefined,
        href: el.tagName === 'A' ? (el.getAttribute('href') || undefined) : undefined,
        type: el.getAttribute('type') || undefined,
      };
    });
  });
}

/** 페이지가 렌더·안정화될 때까지 대기 (SPA 비동기 렌더 대응) */
async function waitReady(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 4000 });
  } catch {
    // networkidle 타임아웃은 무시하고 진행
  }
  await page.waitForTimeout(400);
}

/**
 * 상호작용 요소가 실제로 나타날 때까지 스냅샷을 재시도한다.
 * SPA가 API로 콘텐츠를 렌더하기 전에 찍혀 빈 배열이 오는 문제를 방지.
 */
async function snapshotStable(page, tries = 4) {
  let els = [];
  for (let i = 0; i < tries; i++) {
    els = await snapshotInteractive(page);
    if (els.length > 0) return els;
    await page.waitForTimeout(700);
  }
  return els;
}

/** 판정용: 페이지의 보이는 텍스트 (카드 제목 등 비상호작용 콘텐츠 포함) */
async function pageText(page) {
  return page
    .evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 6000))
    .catch(() => '');
}

/**
 * name/role 없고 자식도 없는 노드(순수 레이아웃용 wrapper)는 노이즈이니 생략하고,
 * 너무 깊은 트리는 토큰 낭비이니 depth를 제한한다.
 */
function simplifyAxNode(node, depth = 0, maxDepth = 15) {
  if (!node || depth > maxDepth) return undefined;
  const children = (node.children || [])
    .map((c) => simplifyAxNode(c, depth + 1, maxDepth))
    .filter(Boolean);
  if (!node.name && children.length === 0) return undefined;
  return {
    role: node.role,
    ...(node.name ? { name: node.name } : {}),
    ...(children.length ? { children } : {}),
  };
}

/**
 * 판정용: 접근성 트리를 중첩 구조 그대로 캡처한다.
 * pageText는 화면을 한 줄로 펴버려서 "누가 누구 안에 있는지"(트리/메뉴 계층) 정보가 사라진다.
 * DOM의 실제 포함 관계는 이 트리에 살아있으므로, 계층을 물어보는 expected는 이걸로 판정한다.
 * 앱 소스 코드(role/aria-label 등) 수정 없이도 어떤 페이지든 통하는 브라우저 표준 API.
 */
async function accessibilityTree(page) {
  try {
    const tree = await page.accessibility.snapshot({ interestingOnly: false });
    return simplifyAxNode(tree) || null;
  } catch {
    return null;
  }
}

/**
 * 표준 로그인 폼이면 결정적으로 로그인한다 (env 자격증명).
 * 로그인은 정형 절차라 agentic 루프보다 안정적이고 토큰도 아낀다.
 * 대상 페이지에 password 입력이 없으면(로그인 불필요) 조용히 넘어간다.
 */
async function autoLogin(page, username, password) {
  // 폼 구동은 React controlled-input 갱신이 불안정하다.
  // 로그인 API를 in-page fetch로 호출해 토큰+유저를 localStorage에 주입 → 100% 안정적 (토큰도 안 씀).
  try {
    const r = await page.evaluate(
      async ({ u, p }) => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p }),
          });
          const text = await res.text();
          let d = null;
          try {
            d = JSON.parse(text).data;
          } catch {
            /* not json */
          }
          if (res.ok && d && d.token) {
            localStorage.setItem('my-atlas-token', d.token);
            localStorage.setItem(
              'my-atlas-user',
              JSON.stringify({ username: d.username, role: d.role })
            );
            if (d.sessionTimeoutSeconds) {
              localStorage.setItem('my-atlas-session-timeout', String(d.sessionTimeoutSeconds));
            }
            return { ok: true };
          }
          return { ok: false, status: res.status, body: text.slice(0, 120) };
        } catch (e) {
          return { ok: false, status: 'fetch-throw', body: String(e).slice(0, 120) };
        }
      },
      { u: username, p: password }
    );
    if (r.ok) {
      // 인증 상태로 루트 진입 (AuthContext가 token+user 를 읽어 로그인 처리)
      const origin = new URL(page.url()).origin;
      await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
      await waitReady(page);
      return true;
    }
    console.log(`[worker] autoLogin 실패: status=${r.status} body=${r.body}`);
  } catch (e) {
    console.log(`[worker] autoLogin 오류: ${e.message}`);
  }
  return false;
}

/** Claude에 JSON 응답을 요청하고 파싱한다. usage를 누적한다. */
async function askJson(agent, system, userContent) {
  const msg = await agent.anthropic.messages.create({
    model: agent.model,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: userContent }],
  });
  agent.tokenCost += (msg.usage?.input_tokens || 0) + (msg.usage?.output_tokens || 0);
  const text = (msg.content || []).map((b) => b.text || '').join('');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`LLM 응답에서 JSON을 찾을 수 없음: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

const ACTION_SYSTEM = `너는 웹 QA 테스트를 실행하는 에이전트다.
주어진 목표(action)를 달성하기 위해 페이지의 상호작용 요소 중 하나에 대해 다음 액션 하나를 결정한다.
반드시 아래 JSON만 출력한다(설명 금지):
{"thought": "간단한 근거", "type": "click|fill|select|navigate|key|back|scroll|done", "ref": "aN 또는 null", "value": "입력/선택/URL/키 값 또는 null"}
- click: ref 요소 클릭
- fill: ref 입력칸에 value 입력
- select: ref 셀렉트에서 value 옵션 선택
- navigate: value(URL 또는 경로)로 이동
- key: value 키를 누른다 (enter|search|back|tab|escape). **입력칸에 값을 넣는 것만으로 검색·제출이 실행되지 않는 화면에서는 fill 다음에 반드시 key=enter 를 해야 한다.**
- back: 뒤로 가기
- scroll: 화면을 value(down|up) 방향으로 스크롤. 찾는 요소가 화면 밖에 있을 때 쓴다
- done: 목표 동작을 이미 수행 완료했을 때만
요소 목록에 없는 것은 조작할 수 없다.
입력의 availableActions 배열에 없는 type은 이 플랫폼에서 쓸 수 없으니 절대 쓰지 마라.
여러 요소의 name이 서로 같으면(예: 네비게이션 링크와 소개 카드가 같은 문구를 쓰는 경우) href/testId/type으로 구분하고, 목표(action)나 목적지 URL과 실제로 일치하는 요소를 선택하라. 구분할 근거가 전혀 없으면 ref가 더 작은(문서상 더 먼저 나오는) 요소를 우선한다.
중요: 목표가 "~를 클릭해서 …로 이동한다"처럼 동작+결과 상태로 적혀 있어도, 판단 기준은 그 결과 상태(url/화면)에 이미 도달했는지다. 현재 url/elements가 이미 그 결과 상태를 만족하면, 그 동작을 문자 그대로 다시 수행하지 말고 done 하라.
중요: 목표(action)에 클릭·입력이 필요하면 먼저 그 동작을 수행하라. 아직 안 했으면 절대 done 하지 마라.
중요: ref 번호는 스냅샷마다 다시 매겨지므로 같은 요소도 매번 다른 ref로 보일 수 있다. previousActions에 지금 클릭하려는 것과 같은 이름(name)의 click이 이미 성공적으로("[실패]" 표시 없이) 기록돼 있다면, 그 요소는 이미 클릭한 것이니 같은 이름을 다시 클릭하지 말고 done 하라(단, 클릭 후 나타난 새 입력 필드에 fill 등 다른 동작이 남아있으면 그것부터 하라).
"버튼 클릭" 목표면 그 버튼 ref를 click, "입력" 목표면 fill 하라.
previousActions는 이 step에서 이미 시도한 액션이다. 같은 액션을 반복하지 말고, [실패] 표시가 있으면 다른 요소를 시도하라. 목표 동작을 완료했으면 done 하라.
중요: 입력에 expectedState(이 액션 완료 후 도달해야 할 상태)가 있으면, 그 상태에 이미 도달했는지를 기준으로 done 여부를 판단하라. 목표(action) 문구에 없는 추가 동작(예: 한 단계 더 들어가서 다른 걸 또 클릭하는 것)은 expectedState 달성에 필요하지 않으면 하지 마라 — 목표를 넘어서 더 진행하지 마라.`;

const JUDGE_SYSTEM = `너는 웹 QA 판정자다.
직전 액션 수행 후의 페이지 상태가 기대(expected)를 충족하는지 판정한다.
입력의 pageText는 페이지에 보이는 텍스트(카드 제목·목록 항목 등)이니, "X가 목록에 추가됨" 같은 기대는 pageText에 X가 있는지로 확인하라.
select/input의 현재 값 확인은 elements 배열의 value 필드만으로 충분한 근거다 — pageText에 그 값이 별도로 또 나타나지 않아도 된다.
accessibilityTree는 페이지의 실제 포함(부모-자식) 구조를 중첩된 형태로 담고 있다. "X가 Y의 자식으로 표시됨", "X가 Y 아래에 있음"처럼 계층/포함 관계를 묻는 기대는 pageText의 순서로 추측하지 말고, accessibilityTree에서 Y에 해당하는 노드의 children 안에 X가 있는지로 판정하라.
중요: url에 "(대상 앱 밖)"이 붙어 있으면 테스트 대상이 아닌 화면(런처·다른 앱)을 보고 있는 것이다.
그 화면에 기대와 비슷한 요소가 있어도 절대 PASS 하지 마라 — INCONCLUSIVE로 판정하고 앱을 벗어났음을 근거에 적어라.
중요: url에 "(앱 응답 없음/크래시 다이얼로그)"가 붙어 있으면 앱이 멈췄거나 죽은 것이다.
화면 이름이 목표와 같아도 기대가 충족된 것이 아니다 — 반드시 FAIL로 판정하고 앱이 응답하지 않았음을 근거에 적어라.
반드시 아래 JSON만 출력한다(설명 금지):
{"verdict": "PASS|FAIL|INCONCLUSIVE", "reasoning": "관측 근거"}
- PASS: 기대가 명확히 충족됨 (pageText/elements에 근거 있음)
- FAIL: 기대가 명확히 불충족됨
- INCONCLUSIVE: 기대가 모호하거나 판정 근거를 찾을 수 없음`;

/** Playwright 액션 실행 */
async function executeAction(page, action) {
  const loc = action.ref ? page.locator(`[data-agent-ref="${action.ref}"]`) : null;
  switch (action.type) {
    case 'click':
      await loc.click({ timeout: 5000 });
      break;
    case 'fill':
      await loc.fill(String(action.value ?? ''), { timeout: 5000 });
      break;
    case 'select':
      await loc.selectOption(String(action.value ?? ''), { timeout: 5000 });
      break;
    case 'navigate': {
      // 상대 경로(/login 등)를 현재 origin 기준 절대 URL로 해석
      const url = new URL(String(action.value ?? ''), page.url()).href;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      break;
    }
    case 'done':
      break;
    default:
      throw new Error(`알 수 없는 액션 타입: ${action.type}`);
  }
  await waitReady(page); // 액션 후 SPA 렌더·네트워크 안정화 대기
}

/**
 * 사용자가 중단을 요청했을 때 던진다.
 *
 * 이 예외를 만나면 워커는 **아무 보고도 하지 않고** 조용히 끝내야 한다.
 * `cancelJob`이 이미 status·completedAt을 종료 상태로 만들었고,
 * `completeJob`은 DONE/FAILED만 허용하므로 `complete(CANCELLED)`를 부르면
 * 예외가 나고 그게 catch로 흘러가 **CANCELLED를 FAILED로 덮어쓴다**.
 */
export class CancelledError extends Error {
  constructor(message = '사용자가 실행을 중단했습니다') {
    super(message);
    this.name = 'CancelledError';
  }
}

/**
 * 이 워커가 구동할 수 없는 대상의 Job일 때 던진다.
 *
 * **Job을 FAILED로 만들면 안 된다.** 워커를 잘못 붙인 것은 운영자의 실수이지
 * Job의 실패가 아니며, FAILED로 표시해 버리면 올바른 종류의 워커가 와도
 * 그 Job을 다시 실행할 수 없다. PENDING 그대로 두고 운영자에게만 알린다.
 */
export class TargetMismatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TargetMismatchError';
  }
}

/** 웹(Playwright) 조작 객체 — 기존 함수를 그대로 위임한다. 동작 변화 없음. */
export function createWebOps(page) {
  return {
    kind: 'WEB',
    availableActions: ['click', 'fill', 'select', 'navigate', 'done'],
    /** 대상 진입 — baseUrl 이동 후 결정적 로그인 (기존 runTestCase 도입부와 동일) */
    async enter(target, agent) {
      await page.goto(target.baseUrl, { waitUntil: 'domcontentloaded' });
      await waitReady(page);
      await autoLogin(page, agent.username, agent.password);
    },
    async snapshot() {
      const elements = await snapshotStable(page);
      // 웹은 ref가 곧 셀렉터(data-agent-ref)라 별도 locator 맵이 필요 없다
      return { elements, locators: null };
    },
    text: () => pageText(page),
    tree: () => accessibilityTree(page),
    location: async () => page.url(),
    execute: (action) => executeAction(page, action),
    async close() {
      /* 브라우저 수명은 호출부(index.js)가 관리한다 */
    },
  };
}

/** 자유 서술 목표를 향해 대상을 구동 (seed 네비게이션 등, 판정 없음) */
export async function agenticGoal(ops, agent, goalText, maxActions) {
  for (let i = 0; i < maxActions; i++) {
    const { elements, locators } = await ops.snapshot();
    const url = await ops.location();
    const action = await askJson(agent, ACTION_SYSTEM, JSON.stringify({
      goal: goalText,
      url,
      elements,
      availableActions: ops.availableActions,
    }));
    console.log(`[worker] seed[${i}] url=${url} → ${action.type}${action.ref ? `(${action.ref})` : ''}${action.value ? `=${action.value}` : ''} :: ${action.thought || ''}`);
    if (action.type === 'done') return;
    await ops.execute(action, locators);
  }
  console.log(`[worker] seed 목표 미완료 — maxActions(${maxActions}) 소진`);
}

/**
 * TC 1건을 실행하고 판정한다.
 * @returns {Promise<{verdict:string, stepLogs:Array, durationMs:number, tokenCost:number}>}
 */
export async function runTestCase(ops, agent, tc, target, maxStepActions, shouldStop) {
  const started = agent.now();
  const startTokens = agent.tokenCost;
  const stepLogs = [];

  // 1) 대상 진입 (웹: goto + 결정적 로그인 / 모바일: 앱은 세션이 이미 띄웠다)
  await ops.enter(target, agent);

  // 2) 전제조건 네비게이션.
  //    TC의 Segment Path가 있으면 그것이 전제조건이다 (v24 §4) — Product 단위 seedNote보다 우선.
  const pathGoal = (tc.segmentPath || []).filter(Boolean).join(' > ');
  const seedGoal = pathGoal
    ? `아래 경로가 가리키는 화면까지 이동한다: ${pathGoal}. 이미 그 화면이면 done 하라.`
    : (target.seedNote || '').trim();
  if (seedGoal) {
    await agenticGoal(ops, agent, seedGoal, maxStepActions);
  }

  // 3) TC step 순차 실행·판정
  const steps = (tc.steps || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  let verdict = 'PASS';
  for (const step of steps) {
    // 상용 서비스를 조작하는 중이므로 step 단위로 중단 요청을 확인한다.
    // CancelledError는 아래 catch가 아니라 호출부까지 올라가야 하므로 try 밖에서 던진다.
    if (shouldStop && (await shouldStop())) {
      throw new CancelledError();
    }
    const history = []; // step 내 이미 시도한 액션 (반복 방지). 성공/실패 모두 여기 남기고, 로그는 이걸 그대로 쓴다.
    try {
      // 액션 결정·실행 (step당 최대 maxStepActions)
      for (let i = 0; i < maxStepActions; i++) {
        const { elements, locators } = await ops.snapshot();
        const action = await askJson(agent, ACTION_SYSTEM, JSON.stringify({
          action: step.action,
          expectedState: step.expected,
          url: await ops.location(),
          elements,
          previousActions: history,
          availableActions: ops.availableActions,
        }));
        const targetEl = action.ref ? elements.find((e) => e.ref === action.ref) : null;
        const targetLabel = targetEl ? `"${targetEl.name}"${targetEl.href ? `→${targetEl.href}` : ''}` : null;
        const desc = `${action.type}${action.ref ? `(${action.ref}${targetLabel ? `=${targetLabel}` : ''})` : ''}${action.value ? `=${action.value}` : ''}`;
        if (action.type === 'done') {
          history.push(desc);
          break;
        }
        try {
          await ops.execute(action, locators);
          history.push(desc);
        } catch (e) {
          // 실패한 액션도 히스토리에 남겨 다음엔 다른 요소를 시도하게 한다
          history.push(`${desc} [실패:${e.message.slice(0, 40)}]`);
        }
      }
      // expected 대조 판정 (상호작용 요소 + 보이는 텍스트 + 접근성 트리로 결과 확인)
      const { elements: observed } = await ops.snapshot();
      const text = await ops.text();
      const axTree = await ops.tree();
      const where = await ops.location();
      const judged = await askJson(agent, JUDGE_SYSTEM, JSON.stringify({
        expected: step.expected,
        url: where,
        elements: observed,
        pageText: text,
        accessibilityTree: axTree,
      }));
      stepLogs.push({
        order: step.order,
        actionTaken: history.join(' → '),
        observed: where,
        judgment: `${judged.verdict}: ${judged.reasoning}`,
        screenshotKey: null,
      });
      if (judged.verdict === 'FAIL') verdict = 'FAIL';
      else if (judged.verdict === 'INCONCLUSIVE' && verdict !== 'FAIL') verdict = 'INCONCLUSIVE';
    } catch (err) {
      stepLogs.push({
        order: step.order,
        actionTaken: history.join(' → '),
        observed: await ops.location().catch(() => ''),
        judgment: `INCONCLUSIVE: 실행 오류 — ${err.message}`,
        screenshotKey: null,
      });
      if (verdict !== 'FAIL') verdict = 'INCONCLUSIVE';
    }
  }

  return {
    verdict,
    stepLogs,
    durationMs: agent.now() - started,
    tokenCost: agent.tokenCost - startTokens,
  };
}
