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

/**
 * 잘린 JSON 복구 — maxTokens를 낮추면 응답이 중간에 끊길 수 있다.
 * 알려진 스칼라 필드만 정규식으로 건진다 (끊긴 문자열 값은 끊긴 지점까지).
 * 판단에 필수인 type/verdict를 못 건지면 null.
 */
function recoverJson(text) {
  const out = {};
  for (const key of ['thought', 'type', 'ref', 'value', 'verdict', 'reasoning']) {
    const m = new RegExp(`"${key}"\\s*:\\s*(?:null|"((?:[^"\\\\]|\\\\.)*))`).exec(text);
    if (!m) continue;
    if (m[1] === undefined) {
      out[key] = null;
      continue;
    }
    try {
      out[key] = JSON.parse(`"${m[1]}"`);
    } catch {
      out[key] = m[1];
    }
  }
  return out.verdict || out.type ? out : null;
}

/**
 * 5.x 모델은 thinking이 기본으로 켜져 짧은 max_tokens(300/700)를 thinking이 먹는다.
 * Haiku 4.5와 같은 조건(thinking 없음)으로 비교하려고 끈다 (registry_v30). 끄는 값이 모델마다 다르다.
 */
const THINKING_OFF = {
  'claude-haiku-5-5': { type: 'disabled' },
  'claude-sonnet-5-5': { type: 'between_tools' },
};

/**
 * Claude에 JSON 응답을 요청하고 파싱한다. usage를 누적한다.
 * maxTokens는 호출별로 줄 수 있고(속도), 줄였을 때 잘림에 대비한 복구 파서가 항상 함께 간다.
 */
async function askJson(agent, system, userContent, { maxTokens = 1024, retried = false } = {}) {
  const msg = await agent.anthropic.messages.create({
    model: agent.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userContent }],
    ...(THINKING_OFF[agent.model] ? { thinking: THINKING_OFF[agent.model] } : {}),
  });
  agent.tokenCost += (msg.usage?.input_tokens || 0) + (msg.usage?.output_tokens || 0);
  const text = (msg.content || []).map((b) => b.text || '').join('');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1) {
    // 간헐적으로 JSON 없이 서술만 온다("현재 화면을 분석하겠습니다.") — 1회 재요청 (registry_v29, Job 25).
    // prefill("{")은 최신 모델에서 400이라 AGENT_MODEL을 바꾸는 순간 전 호출이 깨진다.
    if (!retried) return askJson(agent, system, userContent, { maxTokens, retried: true });
    throw new Error(`LLM 응답에서 JSON을 찾을 수 없음: ${text.slice(0, 200)}`);
  }
  if (end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* 잘렸을 수 있다 — 아래에서 복구 시도 */
    }
  }
  const recovered = recoverJson(text.slice(start));
  if (!recovered) throw new Error(`LLM 응답 JSON 파싱 실패(복구 불가): ${text.slice(0, 200)}`);
  console.log(`[worker] LLM 응답이 잘려 필드만 복구 (stop_reason=${msg.stop_reason})`);
  return recovered;
}

const ACTION_MAX_TOKENS = 300;
const JUDGE_MAX_TOKENS = 700;

const ACTION_SYSTEM = `너는 웹 QA 테스트를 실행하는 에이전트다.
주어진 목표(action)를 달성하기 위해 페이지의 상호작용 요소 중 하나에 대해 다음 액션 하나를 결정한다.
반드시 아래 JSON만 출력한다(설명 금지):
{"thought": "한 문장 근거(60자 이내)", "type": "click|fill|select|navigate|key|back|scroll|done", "ref": "aN 또는 null", "value": "입력/선택/URL/키 값 또는 null"}
- click: ref 요소 클릭
- fill: ref 입력칸에 value 입력
- select: ref 셀렉트에서 value 옵션 선택
- navigate: value(URL 또는 경로)로 이동
- key: value 키를 누른다 (enter|search|back|tab|escape). **입력칸에 값을 넣는 것만으로 검색·제출이 실행되지 않는 화면에서는 fill 다음에 반드시 key=enter 를 해야 한다.**
- back: 뒤로 가기
- scroll: 화면을 value(down|up|left|right) 방향으로 스크롤. ref를 주면 그 요소(목록·캐러셀·지도) 영역에서 스크롤한다. 찾는 요소가 화면 밖에 있을 때 쓴다
- restart: 앱을 종료했다가 다시 실행한다. 목표가 앱 종료·재실행을 요구할 때만 쓴다
- impossible: 목표 동작을 할 수 없을 때만 — 필요한 요소가 화면에 없고 scroll로도 못 찾을 때, 또는 목표가 요구하는 상태(앱 신규 설치·권한 거부·다른 OS 등)를 앱 조작으로 만들 수 없을 때. value에 이유
- done: 목표 동작을 이미 수행 완료했을 때만
요소 목록에 없는 것은 조작할 수 없다.
입력의 availableActions 배열에 없는 type은 이 플랫폼에서 쓸 수 없으니 절대 쓰지 마라.
여러 요소의 name이 서로 같으면(예: 네비게이션 링크와 소개 카드가 같은 문구를 쓰는 경우) href/testId/type으로 구분하고, 목표(action)나 목적지 URL과 실제로 일치하는 요소를 선택하라. 구분할 근거가 전혀 없으면 ref가 더 작은(문서상 더 먼저 나오는) 요소를 우선한다.
중요: 목표가 "~를 클릭해서 …로 이동한다"처럼 동작+결과 상태로 적혀 있어도, 판단 기준은 그 결과 상태(url/화면)에 이미 도달했는지다. 현재 url/elements가 이미 그 결과 상태를 만족하면, 그 동작을 문자 그대로 다시 수행하지 말고 done 하라.
중요: 목표(action)에 클릭·입력이 필요하면 먼저 그 동작을 수행하라. 아직 안 했으면 절대 done 하지 마라.
중요: ref 번호는 스냅샷마다 다시 매겨지므로 같은 요소도 매번 다른 ref로 보일 수 있다. previousActions에 지금 클릭하려는 것과 같은 이름(name)의 click이 이미 성공적으로("[실패]" 표시 없이) 기록돼 있다면, 그 요소는 이미 클릭한 것이니 같은 이름을 다시 클릭하지 말고 done 하라(단, 클릭 후 나타난 새 입력 필드에 fill 등 다른 동작이 남아있으면 그것부터 하라).
"버튼 클릭" 목표면 그 버튼 ref를 click, "입력" 목표면 fill 하라.
중요: 목표가 "~ 확인"처럼 보는 것만 요구하고 터치·클릭·입력을 명시하지 않으면, 화면 상태를 바꾸는 동작(체크박스·토글·필터·드롭다운 클릭, 창 열기)을 하지 말고 done 하라 — 확인하려고 상태를 바꾸면 검증 대상이 바뀐다. 확인할 대상이 화면 밖에 있을 때의 scroll만 허용한다.
previousActions는 이 step에서 이미 시도한 액션이다. 같은 액션을 반복하지 말고, [실패] 표시가 있으면 다른 요소를 시도하라. 목표 동작을 완료했으면 done 하라.
중요: 목표(action/goal)에 적힌 동작을 모두 수행했으면 바로 done 하라. 결과가 화면에 보이는지 확인하는 것은 판정기의 일이다 — 확인하려고 scroll·클릭을 더 하지 마라. 목표에 없는 동작(다음 단계 진행, 삭제·초기화 버튼 등)은 하지 마라 — 목표를 넘어서 더 진행하지 마라.
목표에 적힌 요소가 화면에 없으면 다른 요소로 비슷한 화면을 찾아가지 말고 impossible 하라.`;

const JUDGE_SYSTEM = `너는 웹 QA 판정자다.
직전 액션 수행 후의 페이지 상태가 기대(expected)를 충족하는지 판정한다.
입력의 action·actionsTaken은 이 step에서 이미 수행한 동작이다. 지금 페이지 상태는 그 동작을 모두 마친 **뒤**의 상태이니, "스크롤 후", "검색 후", "터치 후" 같은 기대는 현재 상태로 판정하라. 단, 동작을 했다는 사실만으로 PASS 하지 말고 pageText/elements에 기대의 근거가 있는지로 판정하라.
입력의 pageText는 페이지에 보이는 텍스트(카드 제목·목록 항목 등)이니, "X가 목록에 추가됨" 같은 기대는 pageText에 X가 있는지로 확인하라.
select/input의 현재 값 확인은 elements 배열의 value 필드만으로 충분한 근거다 — pageText에 그 값이 별도로 또 나타나지 않아도 된다.
accessibilityTree는 페이지의 실제 포함(부모-자식) 구조를 중첩된 형태로 담고 있다. "X가 Y의 자식으로 표시됨", "X가 Y 아래에 있음"처럼 계층/포함 관계를 묻는 기대는 pageText의 순서로 추측하지 말고, accessibilityTree에서 Y에 해당하는 노드의 children 안에 X가 있는지로 판정하라.
중요: url에 "(대상 앱 밖)"이 붙어 있으면 테스트 대상이 아닌 화면(런처·다른 앱)을 보고 있는 것이다.
그 화면에 기대와 비슷한 요소가 있어도 절대 PASS 하지 마라 — INCONCLUSIVE로 판정하고 앱을 벗어났음을 근거에 적어라.
중요: url에 "(앱 응답 없음/크래시 다이얼로그)"가 붙어 있으면 앱이 멈췄거나 죽은 것이다.
화면 이름이 목표와 같아도 기대가 충족된 것이 아니다 — 반드시 FAIL로 판정하고 앱이 응답하지 않았음을 근거에 적어라.
중요: action이 터치·입력·선택·스크롤 같은 조작을 요구하는데 actionsTaken에 그 조작이 없으면, 화면이 그 결과처럼 보여도 PASS 하지 말고 INCONCLUSIVE로 판정하라 — 동작을 하지 못한 것이다.
중요: actionsTaken이 action에 적힌 요소가 아닌 다른 요소를 눌러 기대 화면에 도달했다면 PASS 하지 마라(INCONCLUSIVE) — 다른 경로로 도달한 것은 검증이 아니다.
중요: 기대가 "닫힘·사라짐·삭제됨"처럼 상태 변화를 말할 때, 대상이 안 보인다는 것만으로 PASS 하지 마라 — actionsTaken에 그 변화를 일으킨 동작(닫기·삭제 등)이 있어야 한다.
반드시 아래 JSON만 출력한다(설명 금지). reasoning을 먼저 쓰고 그 결론을 verdict에 옮겨라:
{"reasoning": "핵심 관측 근거 2~3문장", "verdict": "PASS|FAIL|INCONCLUSIVE"}
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
    /** 라이브 뷰용 현재 화면 캡처 */
    async frame() {
      return { data: await page.screenshot({ type: 'jpeg', quality: 60 }), contentType: 'image/jpeg' };
    },
    async close() {
      /* 브라우저 수명은 호출부(index.js)가 관리한다 */
    },
  };
}

/**
 * 판정기에 넘기는 동작 목록 — ref 번호는 스냅샷마다 다시 매겨져 판정 시점 elements의 같은 번호와 다른 요소다.
 * 번호를 주면 "a4는 다른 요소라 잘못 눌렀다"며 보류했다 (registry_v30, Job 36 T3500). 이름만 남긴다.
 */
const forJudge = (history) => history.map((h) => h.replace(/\(a\d+=/g, '(').replace(/\(a\d+\)/g, '(이름 없는 요소)'));

/** previousActions에 남기는 액션 문구 — 대상 요소 이름을 넣어야 ref가 바뀌어도 반복 클릭을 알아본다 */
function describeAction(action, elements) {
  const el = action.ref ? elements.find((e) => e.ref === action.ref) : null;
  const label = el ? `"${el.name}"${el.href ? `→${el.href}` : ''}` : null;
  return `${action.type}${action.ref ? `(${action.ref}${label ? `=${label}` : ''})` : ''}${action.value ? `=${action.value}` : ''}`;
}

/**
 * "입력 후 검색"인데 마지막 동작이 입력(fill)이면 제출(enter)까지 한다. 행동 LLM이 자동완성 목록을 검색 결과로 보고
 * 엔터 없이 done 했고, 전제조건 확인 판정도 이를 통과시켰다 (registry_v30, Job 33 T3500·T3502·T3503, Job 34).
 * ponytail: 문구 휴리스틱 — "입력 후 검색" 표현만 잡는다. 다른 표현이 나오면 패턴에 추가.
 */
const SUBMIT_AFTER_FILL = /입력\s*후\s*,?\s*검색/;
async function submitIfNeeded(ops, goalText, history) {
  const last = history[history.length - 1] || '';
  if (!ops.availableActions.includes('key') || !SUBMIT_AFTER_FILL.test(goalText)) return;
  if (!last.startsWith('fill') || last.includes('[실패')) return;
  await ops.execute({ type: 'key', value: 'enter' }, {});
  history.push('key=enter [자동 제출]');
}

/**
 * 대상이 하나뿐인 터치 step(예: "`인기도 순` 터치", "검색 결과의 `삼성역 2호선` 터치")의 대상 이름.
 * 그 이름이 든 요소를 한 번 눌렀으면 step은 끝난 것이다 — 행동 LLM은 같은 글자의 다른 요소(옵션 바)를
 * 또 눌러 닫힌 정렬 창을 다시 열었다 (registry_v30, Job 33 T3501, Job 35 T3500).
 */
function singleTapTarget(action = '') {
  const text = String(action).trim();
  const targets = text.match(/`[^`]+`/g) || [];
  if (targets.length !== 1 || !/`\s*(을|를)?\s*(터치|클릭)$/.test(text)) return null;
  return targets[0].slice(1, -1);
}

/**
 * 자유 서술 목표를 향해 대상을 구동 (seed 네비게이션 등, 판정 없음)
 * @returns {Promise<{reached:boolean, history:string[], reason?:string}>}
 */
export async function agenticGoal(ops, agent, goalText, maxActions) {
  const t0 = agent.now();
  let acted = 0;
  // 이전 액션을 모르면 같은 검색창을 5번 연달아 누르다 시도를 소진한다 (registry_v29, Job 22 T3417)
  const history = [];
  const summary = (reached) =>
    console.log(`[worker] precondition ${reached ? '도달' : '미도달'} — actions=${acted} total ${((agent.now() - t0) / 1000).toFixed(1)}s`);
  for (let i = 0; i < maxActions; i++) {
    const { elements, locators } = await ops.snapshot();
    const url = await ops.location();
    const action = await askJson(agent, ACTION_SYSTEM, JSON.stringify({
      goal: goalText,
      url,
      elements,
      previousActions: history,
      availableActions: [...ops.availableActions, 'impossible'],
    }), { maxTokens: ACTION_MAX_TOKENS });
    console.log(`[worker] seed[${i}] url=${url} → ${action.type}${action.ref ? `(${action.ref})` : ''}${action.value ? `=${action.value}` : ''} :: ${action.thought || ''}`);
    if (action.type === 'done') {
      await submitIfNeeded(ops, goalText, history);
      summary(true);
      return { reached: true, history };
    }
    if (action.type === 'impossible') {
      summary(false);
      return { reached: false, history, reason: `이동 불가 — ${action.value || action.thought || ''}` };
    }
    const desc = describeAction(action, elements);
    acted++;
    try {
      await ops.execute(action, locators);
      history.push(desc);
    } catch (e) {
      // Step 루프처럼 실패를 남기고 다른 요소를 시도하게 한다 — 예외로 전제조건 전체를 끊지 않는다 (registry_v30, Job 33 T3485)
      history.push(`${desc} [실패:${e.message.slice(0, 40)}]`);
    }
  }
  console.log(`[worker] seed 목표 미완료 — maxActions(${maxActions}) 소진`);
  summary(false);
  return { reached: false, history, reason: `동작 ${maxActions}회 안에 도달 못 함` };
}

/**
 * 전제조건 도달을 판정기로 확인한다. 행동 LLM의 done은 자기 선언이라
 * 자동완성 목록을 검색 결과로, 홈을 온보딩으로 착각한 채 "도달"했다 (registry_v30, Job 33 T3500·T3514).
 */
async function verifyPrecondition(ops, agent, preText, history) {
  ops.refresh?.();
  const { elements } = await ops.snapshot();
  return askJson(agent, JUDGE_SYSTEM, JSON.stringify({
    action: `전제조건으로 이동: ${preText}`,
    actionsTaken: forJudge(history),
    expected: `전제조건 상태에 도착해 있다: ${preText}`,
    url: await ops.location(),
    elements,
    pageText: await ops.text(),
    accessibilityTree: await ops.tree(),
  }), { maxTokens: JUDGE_MAX_TOKENS });
}

/**
 * "~ 확인"처럼 보기만 하는 step인지. 따옴표 안 문구(요소 이름)는 빼고 조작 동사를 찾는다 — `주소 검색` 화면 확인.
 * 애매하면 조작 step으로 본다 (관찰로 잘못 보면 필요한 동작이 막힌다).
 * ponytail: 동사 목록 휴리스틱. 놓치는 표현이 나오면 목록에 추가.
 */
const ACTION_VERB = /터치|클릭|입력|검색|스크롤|내림|내려|올림|올려|선택|누르|눌러|삭제|지우|닫기|닫고|닫아|열기|열고|열어|스와이프|뒤로|실행|이동/;
export function isObserveOnly(action = '') {
  const bare = String(action).replace(/`[^`]*`|'[^']*'|"[^"]*"/g, '').trim();
  return /확인$/.test(bare) && !ACTION_VERB.test(bare);
}

/**
 * TC 1건을 실행하고 판정한다.
 * @returns {Promise<{verdict:string, stepLogs:Array, durationMs:number, tokenCost:number}>}
 */
export async function runTestCase(ops, agent, tc, target, maxStepActions, shouldStop, onProgress) {
  const started = agent.now();
  const startTokens = agent.tokenCost;
  const stepLogs = [];

  const steps = (tc.steps || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  // Step이 없으면 판정할 것이 없다 — PASS로 두면 0 토큰 PASS가 기록된다 (registry_v30, Job 32 T3416)
  if (steps.length === 0) {
    return {
      verdict: 'INCONCLUSIVE',
      stepLogs: [{ order: 0, actionTaken: '', observed: '', judgment: 'INCONCLUSIVE: Step이 없어 판정할 수 없음', screenshotKey: null }],
      durationMs: agent.now() - started,
      tokenCost: 0,
    };
  }

  // 라이브 진행 상태 (UI 스텝 플로우용). 보고 실패가 실행을 깨면 안 되므로 emit은 예외를 삼킨다.
  const clip = (s, n) => String(s ?? '').slice(0, n);
  const prog = {
    phase: 'PRECONDITION',
    precondition: null,
    currentStep: null,
    steps: steps.slice(0, 200).map((s) => ({
      order: s.order,
      action: clip(s.action, 5000),
      expected: clip(s.expected, 5000),
      status: 'PENDING',
      judgment: null,
    })),
  };
  const emit = () => {
    try {
      onProgress?.(structuredClone(prog)); // 복제본: 리포터가 보관하는 동안 원본이 바뀐다
    } catch {
      /* 진행 보고는 실행에 영향을 주지 않는다 */
    }
  };
  const mark = (idx, status, judgment) => {
    if (!prog.steps[idx]) return; // 200개 초과분은 보고 대상 아님
    prog.steps[idx].status = status;
    if (judgment !== undefined) prog.steps[idx].judgment = clip(judgment, 5000);
  };

  // 1) 대상 진입 (웹: goto + 결정적 로그인 / 모바일: 앱은 세션이 이미 띄웠다)
  await ops.enter(target, agent);

  // 2) 전제조건 네비게이션 — TC 전제조건 필드에 적힌 경우에만 (registry_v29). 없으면 Product seedNote.
  //    Segment Path로 미리 가지 않는다(v24 §4 폐기): Step이 홈에서 출발하도록 쓰인 TC가 그 이동과 충돌한다.
  //    TC는 매번 앱 재시작 직후 첫 화면에서 출발한다(registry_v28 #3). "이미 그 화면이면 done"만 주면
  //    첫 화면(홈)에 비슷한 목록이 보이는 것만으로 중간 단계(검색창 등)를 건너뛴다.
  const preText = (tc.preconditions || '').trim();
  //    예시 문구("예: 검색창 터치")를 넣으면 그 예시를 전제조건으로 오인한다 (registry_v30, Job 33 T3511).
  const seedGoal = preText
    ? `전제조건 상태까지 이동한다: ${preText}. TC는 앱을 막 시작한 첫 화면에서 출발한다. 첫 화면에 비슷한 요소가 보여도 전제조건에 적힌 단계를 실제로 모두 거쳐, 그 상태에 도착했을 때만 done 하라.`
    : (target.seedNote || '').trim();
  let blocked = null; // TC 전제조건 미도달 사유 — 있으면 Step을 실행하지 않는다
  if (seedGoal) {
    prog.precondition = { text: clip(preText || (target.seedNote || '').trim(), 300), status: 'RUNNING' };
    emit();
    let goal = { reached: false, history: [], reason: '' };
    try {
      goal = await agenticGoal(ops, agent, seedGoal, maxStepActions);
      if (goal.reached && preText) {
        const v = await verifyPrecondition(ops, agent, preText, goal.history);
        console.log(`[worker] precondition 확인 ${v.verdict} — ${clip(v.reasoning, 120)}`);
        if (v.verdict !== 'PASS') goal = { ...goal, reached: false, reason: `확인 ${v.verdict}: ${v.reasoning}` };
      }
    } catch (e) {
      // 전제조건 오류가 Job 전체를 FAILED로 만들면 남은 TC도 못 돈다 — 미도달로 처리 (registry_v29)
      console.log(`[worker] precondition 오류 — ${e.message.slice(0, 120)}`);
      goal = { ...goal, reached: false, reason: `오류: ${e.message}` };
    }
    // 도달 못 했는데 '완료'로 보이면 거짓 초록이다 — 미도달을 그대로 드러낸다
    prog.precondition.status = goal.reached ? 'DONE' : 'INCOMPLETE';
    emit();
    // Product seedNote는 힌트라 미도달이어도 진행한다
    if (!goal.reached && preText) blocked = goal.reason || '전제조건 미도달';
  }

  // 미실행 step도 이유를 남긴다. 판정 문구에 FAIL/INCONCLUSIVE를 넣지 않는다 — 실패 분석 필터(index.js)가 집어 간다
  const skipFrom = (from, why) => {
    for (const s of steps.slice(from)) {
      stepLogs.push({ order: s.order, actionTaken: '', observed: '', judgment: `SKIPPED: ${why}`, screenshotKey: null });
    }
  };

  // 전제조건 미도달이면 Step을 돌리지 않는다 — 엉뚱한 화면의 비슷한 UI로 거짓 PASS가 났다 (registry_v30, Job 33 T3516)
  if (blocked) {
    stepLogs.push({
      order: steps[0].order,
      actionTaken: '',
      observed: await ops.location().catch(() => ''),
      judgment: `INCONCLUSIVE: 전제조건 미도달로 실행하지 않음 — ${clip(blocked, 500)}`,
      screenshotKey: null,
    });
    mark(0, 'INCONCLUSIVE', `전제조건 미도달 — ${blocked}`);
    skipFrom(1, '전제조건 미도달');
    emit();
    return { verdict: 'INCONCLUSIVE', stepLogs, durationMs: agent.now() - started, tokenCost: agent.tokenCost - startTokens };
  }

  // 3) TC step 순차 실행·판정
  let verdict = 'PASS';
  for (const [idx, step] of steps.entries()) {
    // 상용 서비스를 조작하는 중이므로 step 단위로 중단 요청을 확인한다.
    // CancelledError는 아래 catch가 아니라 호출부까지 올라가야 하므로 try 밖에서 던진다.
    if (shouldStop && (await shouldStop())) {
      throw new CancelledError();
    }
    prog.phase = 'ACTING';
    prog.currentStep = step.order;
    mark(idx, 'ACTING');
    emit();
    const history = []; // step 내 이미 시도한 액션 (반복 방지). 성공/실패 모두 여기 남기고, 로그는 이걸 그대로 쓴다.
    // 구간별 소요(ms) — 느린 구간을 로그로 특정하기 위함 (registry_v28 #4)
    const tm = { snap: 0, llm: 0, exec: 0, judge: 0 };
    const stepStart = agent.now();
    let acted = 0;
    let stepVerdict = 'ERROR';
    // 관찰 step은 상태를 바꾸는 동작을 코드로 막는다 — 프롬프트 규칙만으로는 정렬 창을 열어 다음 step을 가렸다 (registry_v30, Job 33 T3499)
    const observeOnly = isObserveOnly(step.action);
    const allowed = observeOnly ? ['scroll', 'done'] : [...ops.availableActions, 'impossible'];
    const tapTarget = singleTapTarget(step.action);
    let impossible = null;
    try {
      // 액션 결정·실행 (step당 최대 maxStepActions)
      for (let i = 0; i < maxStepActions; i++) {
        let t = agent.now();
        const { elements, locators } = await ops.snapshot();
        const url = await ops.location();
        tm.snap += agent.now() - t;
        t = agent.now();
        // expected는 주지 않는다 — 주면 동작을 끝낸 뒤에도 기대 화면을 찾아 scroll·클릭을 더 한다 (registry_v30, Job 33 T3471·T3487)
        const action = await askJson(agent, ACTION_SYSTEM, JSON.stringify({
          action: step.action,
          url,
          elements,
          previousActions: history,
          availableActions: allowed,
        }), { maxTokens: ACTION_MAX_TOKENS });
        tm.llm += agent.now() - t;
        const desc = describeAction(action, elements);
        if (action.type === 'done') {
          await submitIfNeeded(ops, step.action, history);
          history.push(desc);
          break;
        }
        if (observeOnly && !allowed.includes(action.type)) {
          history.push(`${desc} [관찰 step — 실행 안 함]`);
          break;
        }
        if (action.type === 'impossible') {
          history.push(desc);
          impossible = action.value || action.thought || '동작 불가';
          break;
        }
        const te = agent.now();
        acted++;
        let tapped = false;
        try {
          await ops.execute(action, locators);
          history.push(desc);
          const el = elements.find((e) => e.ref === action.ref);
          tapped = !!(tapTarget && action.type === 'click' && el && `${el.name} ${el.testId ?? ''}`.includes(tapTarget));
        } catch (e) {
          // 실패한 액션도 히스토리에 남겨 다음엔 다른 요소를 시도하게 한다
          history.push(`${desc} [실패:${e.message.slice(0, 40)}]`);
        }
        tm.exec += agent.now() - te;
        if (tapped) break;
      }
      if (impossible) {
        // 동작을 못 했으니 판정할 결과가 없다 — 판정 LLM을 부르지 않는다
        stepVerdict = 'INCONCLUSIVE';
        stepLogs.push({
          order: step.order,
          actionTaken: history.join(' → '),
          observed: await ops.location().catch(() => ''),
          judgment: `INCONCLUSIVE: 동작 불가 — ${clip(impossible, 500)}`,
          screenshotKey: null,
        });
        if (verdict !== 'FAIL') verdict = 'INCONCLUSIVE';
        mark(idx, 'INCONCLUSIVE', `동작 불가 — ${impossible}`);
        emit();
      } else {
        // expected 대조 판정 (상호작용 요소 + 보이는 텍스트 + 접근성 트리로 결과 확인)
        const tj = agent.now(); // judge = 관측 + 판정 LLM
        // 판정은 최신 화면으로: 마지막 settle 이후 액션 결정 LLM이 도는 동안 늦게 뜬 콘텐츠를 놓치면
        // 낡은 화면으로 판정하게 된다. 1회만 새로 덤프하고 아래 text/location은 그 덤프를 재사용한다.
        ops.refresh?.();
        const { elements: observed } = await ops.snapshot();
        const text = await ops.text();
        const axTree = await ops.tree();
        const where = await ops.location();
        prog.phase = 'JUDGING';
        mark(idx, 'JUDGING');
        emit();
        // 수행한 동작을 모르면 "스크롤 후" 기대에 "스크롤 전 화면인지 알 수 없다"며 INCONCLUSIVE (registry_v29, Job 29 T3411)
        const judged = await askJson(agent, JUDGE_SYSTEM, JSON.stringify({
          action: step.action,
          actionsTaken: forJudge(history),
          expected: step.expected,
          url: where,
          elements: observed,
          pageText: text,
          accessibilityTree: axTree,
        }), { maxTokens: JUDGE_MAX_TOKENS });
        tm.judge += agent.now() - tj;
        stepVerdict = judged.verdict;
        stepLogs.push({
          order: step.order,
          actionTaken: history.join(' → '),
          observed: where,
          judgment: `${judged.verdict}: ${judged.reasoning}`,
          screenshotKey: null,
        });
        if (judged.verdict === 'FAIL') verdict = 'FAIL';
        else if (judged.verdict === 'INCONCLUSIVE' && verdict !== 'FAIL') verdict = 'INCONCLUSIVE';
        mark(idx, ['PASS', 'FAIL', 'INCONCLUSIVE'].includes(judged.verdict) ? judged.verdict : 'INCONCLUSIVE', judged.reasoning);
        emit();
      }
    } catch (err) {
      stepLogs.push({
        order: step.order,
        actionTaken: history.join(' → '),
        observed: await ops.location().catch(() => ''),
        judgment: `INCONCLUSIVE: 실행 오류 — ${err.message}`,
        screenshotKey: null,
      });
      if (verdict !== 'FAIL') verdict = 'INCONCLUSIVE';
      mark(idx, 'INCONCLUSIVE', err.message);
      emit();
    }
    const sec = (ms) => `${(ms / 1000).toFixed(1)}s`;
    console.log(`[worker] step ${step.order} ${stepVerdict}${observeOnly ? '(관찰)' : ''} — actions=${acted} snap ${sec(tm.snap)} · llm ${sec(tm.llm)} · exec ${sec(tm.exec)} · judge ${sec(tm.judge)} · total ${sec(agent.now() - stepStart)}`);
    // 실패·동작 불가 뒤 step은 엉뚱한 화면에서 돈다 — 시간만 쓰고 거짓 PASS까지 났다 (registry_v30, Job 33 T3471)
    if (stepVerdict === 'FAIL' || impossible) {
      skipFrom(idx + 1, impossible ? '앞 step 동작 불가' : '앞 step 실패');
      break;
    }
  }

  return {
    verdict,
    stepLogs,
    durationMs: agent.now() - started,
    tokenCost: agent.tokenCost - startTokens,
  };
}
