/**
 * Android(UiAutomator2) 드라이버 — registry_v24.
 *
 * 웹 드라이버(Playwright)가 만들던 것과 **같은 모양의 JSON**을 네이티브 UI 트리에서 만든다.
 * 그래야 액션 결정·판정 프롬프트를 손대지 않고 그대로 쓸 수 있다 (v24 §0).
 *
 * 관측: Appium `getPageSource()`(XML) → `{ref, role, name, tag, value, testId, clickable, ...}`
 * 액션: ref → locator(resource-id > accessibility id > xpath) → 실패 시 좌표 탭 폴백
 */
import { remote } from 'webdriverio';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  allowBooleanAttributes: true,
  preserveOrder: true,
});

const isTrue = (v) => v === 'true' || v === true;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 입력 가능한 위젯 (fill 대상) */
const EDITABLE = /edittext|autocompletetextview|searchview/;

/** android.widget.Button → button */
function shortRole(cls = '') {
  return (cls.split('.').pop() || cls).toLowerCase();
}

/** bounds="[x1,y1][x2,y2]" 파싱 */
function parseBounds(b = '') {
  const m = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(b);
  if (!m) return null;
  const [, x1, y1, x2, y2] = m.map(Number);
  return { x1, y1, x2, y2, area: Math.max(0, x2 - x1) * Math.max(0, y2 - y1) };
}

/**
 * preserveOrder 포맷을 {tag, xpathTag, xpathIdx, attrs, children}로 정규화.
 * xpath 색인은 "같은 태그 이름을 가진 형제 중 몇 번째"다 — `index` 속성(전체 형제 기준)을
 * 그대로 쓰면 Appium xpath와 어긋난다. 형제 단위로 태그별 카운트를 매긴다.
 */
function normalize(nodes) {
  const out = [];
  const seenTag = new Map();
  for (const n of nodes) {
    const tag = Object.keys(n).find((k) => k !== ':@');
    if (!tag || tag === '#text') continue;
    const attrs = n[':@'] || {};
    // raw `uiautomator dump`는 모든 태그가 <node>라 class를 xpath 태그로 쓴다
    const xpathTag = tag === 'node' ? attrs['@class'] || '*' : tag;
    const idx = (seenTag.get(xpathTag) || 0) + 1;
    seenTag.set(xpathTag, idx);
    out.push({
      tag,
      xpathTag,
      xpathIdx: idx,
      attrs,
      children: normalize(Array.isArray(n[tag]) ? n[tag] : []),
    });
  }
  return out;
}

/**
 * 이름 패턴 2 — 클릭 가능한 컨테이너의 text가 비고 라벨이 자식에 있는 경우.
 * 자식이 그 자체로 clickable이면 가져오지 않는다 (대상이 섞인다).
 */
function descendantText(node, depth = 0) {
  if (depth > 6) return [];
  const out = [];
  for (const child of node.children) {
    const t = (child.attrs['@text'] || '').trim();
    const d = (child.attrs['@content-desc'] || '').trim();
    if (t) out.push(t);
    else if (d) out.push(d);
    if (!isTrue(child.attrs['@clickable'])) out.push(...descendantText(child, depth + 1));
  }
  return out;
}

/**
 * page source(XML)를 웹 스냅샷과 동일한 요소 목록으로 변환한다.
 * @returns {{elements: Array, locators: Record<string, object>}}
 */
export function mapSource(xml, maxDepth = 25) {
  const roots = normalize(parser.parse(xml));

  // 1패스: 라벨 상자 수집.
  // 이름 패턴 3 — 보이지 않는 clickable View가 라벨 View 위에 겹쳐 있는 경우가 흔한데,
  // 이때 라벨은 자식도 조상도 아닌 **형제**라 트리 탐색으로는 못 찾는다. 좌표로 찾는다.
  const labelBoxes = [];
  (function collect(nodes) {
    for (const n of nodes) {
      const label = (n.attrs['@text'] || '').trim() || (n.attrs['@content-desc'] || '').trim();
      const box = parseBounds(n.attrs['@bounds']);
      if (label && box && box.area > 0) labelBoxes.push({ label, box });
      collect(n.children);
    }
  })(roots);

  const labelByOverlap = (box) => {
    if (!box || box.area <= 0) return '';
    const inside = labelBoxes.filter(({ box: b }) => {
      const ix = Math.max(0, Math.min(box.x2, b.x2) - Math.max(box.x1, b.x1));
      const iy = Math.max(0, Math.min(box.y2, b.y2) - Math.max(box.y1, b.y1));
      return b.area > 0 && (ix * iy) / b.area >= 0.8;
    });
    // 화면 대부분을 덮는 컨테이너면 라벨이 수십 개 붙어 노이즈가 된다
    if (inside.length === 0 || inside.length > 4) return '';
    inside.sort((p, q) => p.box.y1 - q.box.y1 || p.box.x1 - q.box.x1);
    return inside.map((p) => p.label).join(' ');
  };

  const elements = [];
  const locators = {};
  let refSeq = 0;

  (function walk(node, depth, ancestorPath) {
    if (depth > maxDepth) return;
    const a = node.attrs;
    const cls = a['@class'] || node.tag;
    const role = shortRole(cls);
    const path = depth < 0 ? '' : `${ancestorPath}/${node.xpathTag}[${node.xpathIdx}]`;

    const clickable =
      isTrue(a['@clickable']) || isTrue(a['@long-clickable']) || isTrue(a['@context-clickable']);
    const editable = EDITABLE.test(role);
    const scrollable = isTrue(a['@scrollable']);
    const box = parseBounds(a['@bounds']);
    // `displayed`는 Appium getPageSource에만 있고 raw uiautomator dump에는 없다 → 면적으로 폴백
    const displayed =
      a['@displayed'] === undefined ? !!box && box.area > 0 : isTrue(a['@displayed']);

    if (displayed && (clickable || editable || scrollable)) {
      const ownText = (a['@text'] || '').trim();
      const desc = (a['@content-desc'] || '').trim();
      // 스크롤 컨테이너는 클릭 대상이 아니다. 자손 텍스트를 모으면 화면의 모든 글자가 뭉친다.
      const collectDesc = !(scrollable && !clickable);
      const name =
        ownText ||
        desc ||
        (collectDesc ? descendantText(node).join(' ').trim() : '') ||
        (collectDesc ? labelByOverlap(box) : '');

      const resourceId = a['@resource-id'] || '';
      const ref = `a${refSeq++}`;
      locators[ref] = {
        resourceId: resourceId || undefined,
        accessibilityId: desc || undefined,
        xpath: path,
        // 최후 폴백. 네이티브에서는 좌표 탭이 신뢰할 만하다.
        center: box ? { x: Math.round((box.x1 + box.x2) / 2), y: Math.round((box.y1 + box.y2) / 2) } : null,
        name,
      };

      elements.push({
        ref,
        role,
        name: name.replace(/\s+/g, ' ').slice(0, 120),
        tag: cls,
        value: editable ? ownText : '',
        ...(resourceId ? { testId: resourceId } : {}),
        clickable,
        enabled: isTrue(a['@enabled']),
        ...(scrollable ? { scrollable: true } : {}),
      });
    }

    for (const c of node.children) walk(c, depth + 1, path);
  })({ tag: 'root', xpathTag: 'root', xpathIdx: 1, attrs: {}, children: roots }, -1, '');

  return { elements, locators };
}

/** 판정용: 화면에 보이는 텍스트를 위→아래 순으로 이어붙인다 (웹 pageText 대응물) */
export function screenText(xml, limit = 6000) {
  const roots = normalize(parser.parse(xml));
  const items = [];
  (function collect(nodes) {
    for (const n of nodes) {
      const t = (n.attrs['@text'] || '').trim() || (n.attrs['@content-desc'] || '').trim();
      const box = parseBounds(n.attrs['@bounds']);
      if (t && box) items.push({ t, y: box.y1, x: box.x1 });
      collect(n.children);
    }
  })(roots);
  items.sort((p, q) => p.y - q.y || p.x - q.x);
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (seen.has(it.t)) continue;
    seen.add(it.t);
    out.push(it.t);
  }
  return out.join(' ').slice(0, limit);
}

/**
 * Appium 세션을 열고 에이전트 루프가 쓰는 조작 객체(ops)를 반환한다.
 * 웹 ops와 같은 인터페이스를 갖는다: snapshot / text / tree / execute / location / close
 *
 * @param {object} cfg
 * @param {string} cfg.appiumUrl   Appium 서버 URL (예: http://127.0.0.1:4723)
 * @param {string} cfg.deviceName  예: emulator-5554
 * @param {string} cfg.appPackage  대상 앱 패키지
 * @param {number} cfg.snapshotMaxDepth
 */
export async function createMobileOps(cfg) {
  const url = new URL(cfg.appiumUrl || 'http://127.0.0.1:4723');
  const driver = await remote({
    hostname: url.hostname,
    port: Number(url.port || 4723),
    path: url.pathname === '/' ? '/' : url.pathname,
    logLevel: 'error',
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': cfg.deviceName || 'emulator-5554',
      'appium:appPackage': cfg.appPackage,
      'appium:noReset': true,
      'appium:newCommandTimeout': 300,
      // 권한 다이얼로그도 TC 대상이다 — 자동 허용하면 검증 대상이 사라진다 (v24 §7)
      'appium:autoGrantPermissions': false,
    },
  });

  /**
   * ANR("isn't responding")·크래시("has stopped") 시스템 다이얼로그 감지.
   *
   * 이 다이얼로그가 떠도 `getCurrentActivity()`는 여전히 대상 화면을 가리키므로,
   * 액티비티 이름만 보면 "정상 도달"로 오인한다 — 실제로 그렇게 거짓 PASS가 났다.
   * 프롬프트 지침만으로는 놓치므로 드라이버에서 사실로 감지한다.
   */
  const ALERT_PATTERNS = [
    /isn'?t responding/i,
    /has stopped/i,
    /keeps stopping/i,
    /응답하지 않습니다/,
    /중지되었습니다/,
    /계속 중단됩니다/,
  ];
  async function detectSystemAlert() {
    try {
      const xml = await driver.getPageSource();
      return ALERT_PATTERNS.some((re) => re.test(xml));
    } catch {
      return false;
    }
  }

  /** locator 우선순위대로 찾고, 전부 실패하면 null (호출부가 좌표로 폴백) */
  async function resolve(loc) {
    const attempts = [];
    if (loc.resourceId) {
      attempts.push(`android=new UiSelector().resourceId("${loc.resourceId}")`);
    }
    if (loc.accessibilityId) attempts.push(`~${loc.accessibilityId}`);
    if (loc.xpath) attempts.push(loc.xpath);
    // xpath가 깨져도 이름으로 되찾을 수 있게 한 번 더 시도 (v24 §2 — 실제 화면의 절반이 xpath뿐)
    if (loc.name) attempts.push(`android=new UiSelector().text("${loc.name.slice(0, 60)}")`);
    for (const sel of attempts) {
      try {
        const el = await driver.$(sel);
        if (await el.isExisting()) return el;
      } catch {
        /* 다음 후보 */
      }
    }
    return null;
  }

  return {
    kind: 'ANDROID',
    // 네이티브에는 URL 이동(navigate)과 셀렉트(select)가 없다. 대신 키·뒤로·스크롤이 있다.
    availableActions: ['click', 'fill', 'key', 'back', 'scroll', 'done'],

    /**
     * 대상 진입 — 대상 앱을 명시적으로 전면에 올린다.
     * 세션 생성만 믿으면 앱이 스플래시나 백그라운드인 상태에서 시작해
     * 에이전트가 엉뚱한 화면(런처 등)에서 헤맬 수 있다 (실측).
     * 로그인은 사람이 미리 끝내둔 상태(AVD 스냅샷)를 전제로 하며,
     * 에이전트가 재로그인을 시도하면 액션 예산만 소진된다 (v20 B2-1).
     */
    async enter() {
      await driver.activateApp(cfg.appPackage).catch(() => {});
      await sleep(1500);
    },

    async snapshot(tries = 3) {
      // 에이전트가 앱을 벗어나면(런처·타 앱) 그 화면의 요소를 대상 앱 것으로 오인한다.
      // 관측 전에 되돌려 놓는다. 되돌리지 못하면 location()이 '대상 앱 밖'을 알려 준다.
      const pkg = await driver.getCurrentPackage().catch(() => cfg.appPackage);
      if (pkg && pkg !== cfg.appPackage) {
        console.log(`[worker] 대상 앱 밖(${pkg}) — ${cfg.appPackage}로 복귀`);
        await driver.activateApp(cfg.appPackage).catch(() => {});
        await sleep(1500);
      }
      let mapped = { elements: [], locators: {} };
      for (let i = 0; i < tries; i++) {
        const xml = await driver.getPageSource();
        mapped = { ...mapSource(xml, cfg.snapshotMaxDepth ?? 25), xml };
        if (mapped.elements.length > 0) return mapped;
        await sleep(600);
      }
      return mapped;
    },

    async text() {
      const xml = await driver.getPageSource();
      return screenText(xml);
    },

    /** 네이티브에는 웹의 접근성 트리 대응물을 따로 만들지 않는다 (elements+text로 판정) */
    async tree() {
      return null;
    },

    /**
     * 웹의 page.url() 대응 — 현재 위치를 한 줄로.
     *
     * 패키지를 대상 앱으로 **고정하면 안 된다.** 에이전트가 앱을 벗어나 런처로 나가도
     * `app://<대상앱>/<런처액티비티>` 같은 거짓 문자열이 만들어져, 에이전트도 판정기도
     * "아직 앱 안"이라고 착각한다. 실제로 이 때문에 런처 검색창을 앱 검색창으로 오인해
     * 거짓 PASS가 발생했다 — 반드시 실제 패키지를 읽는다.
     */
    async location() {
      try {
        const [pkg, act] = await Promise.all([
          driver.getCurrentPackage().catch(() => cfg.appPackage),
          driver.getCurrentActivity().catch(() => ''),
        ]);
        const outside = pkg && pkg !== cfg.appPackage ? ' (대상 앱 밖)' : '';
        // ANR/크래시 다이얼로그가 떠 있으면 액티비티 이름은 여전히 목표 화면을 가리킨다.
        // 그것만 보고 "도달했다"고 판단해 거짓 PASS가 난 적이 있어, 위치 문자열에 직접 실어 알린다.
        const anr = (await detectSystemAlert()) ? ' (앱 응답 없음/크래시 다이얼로그)' : '';
        return `app://${pkg}${act ? (act.startsWith('.') ? act : `/${act}`) : ''}${outside}${anr}`;
      } catch {
        return `app://${cfg.appPackage}`;
      }
    },

    async execute(action, locators) {
      const loc = action.ref ? locators[action.ref] : null;
      switch (action.type) {
        case 'click': {
          if (!loc) throw new Error('ref 없음');
          const el = await resolve(loc);
          if (el) await el.click();
          else if (loc.center) await driver.execute('mobile: clickGesture', loc.center);
          else throw new Error('요소를 찾을 수 없음');
          await sleep(1200);
          return;
        }
        case 'fill': {
          if (!loc) throw new Error('ref 없음');
          const text = String(action.value ?? '');
          const el = await resolve(loc);
          if (el) {
            await el.clearValue().catch(() => {});
            await el.setValue(text);
          } else {
            // 좌표 폴백이 없으면 locator 실패 시 곧바로 죽는다 (Phase 0에서 전수 실패한 원인)
            if (!loc.center) throw new Error('입력 요소를 찾을 수 없음');
            await driver.execute('mobile: clickGesture', loc.center);
            await sleep(800);
            await driver
              .execute('mobile: type', { text })
              .catch(async () => driver.keys(text.split('')));
          }
          await sleep(1200);
          return;
        }
        case 'key': {
          // fill만으로는 검색이 제출되지 않는다 — 키 입력이 별도 액션으로 필요하다 (v24 §3)
          const KEYCODES = { enter: 66, search: 84, back: 4, tab: 61, escape: 111 };
          const name = String(action.value ?? 'enter').toLowerCase();
          const code = KEYCODES[name];
          if (!code) throw new Error(`지원하지 않는 키: ${action.value}`);
          await driver.pressKeyCode(code);
          await sleep(1200);
          return;
        }
        case 'back':
          await driver.back();
          await sleep(1200);
          return;
        case 'scroll':
          await driver.execute('mobile: scrollGesture', {
            left: 100,
            top: 400,
            width: 880,
            height: 1400,
            direction: String(action.value || 'down'),
            percent: 0.8,
          });
          await sleep(900);
          return;
        case 'select':
          throw new Error('이 플랫폼에는 select가 없다. 목록을 클릭으로 열고 항목을 클릭하라');
        case 'navigate':
          throw new Error('네이티브 앱에는 URL 이동이 없다. 화면의 요소를 클릭해 이동하라');
        case 'done':
          return;
        default:
          throw new Error(`알 수 없는 액션 타입: ${action.type}`);
      }
    },

    async close() {
      await driver.deleteSession().catch(() => {});
    },
  };
}
