// runTestCase 제어 흐름 검증 (registry_v30). 실제 앱·LLM 없이 응답을 순서대로 흘려 넣는다.
// 실행: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTestCase, isObserveOnly } from './agent.js';

/** ACTION/JUDGE 응답을 각자 순서대로 내주는 가짜 Claude + 실행된 동작을 기록하는 가짜 화면 */
function fixture({ actions = [], judges = [], availableActions = ['click', 'scroll', 'done'] }) {
  const calls = { action: 0, judge: 0, executed: [] };
  const agent = {
    model: 'test',
    tokenCost: 0,
    now: () => 0,
    anthropic: {
      messages: {
        create: async ({ system }) => {
          const isJudge = system.startsWith('너는 웹 QA 판정자다');
          const next = isJudge ? judges[calls.judge++] : actions[calls.action++];
          if (!next) throw new Error(`${isJudge ? 'judge' : 'action'} 응답 소진`);
          return { content: [{ text: JSON.stringify(next) }], usage: { input_tokens: 1, output_tokens: 1 } };
        },
      },
    },
  };
  const ops = {
    availableActions,
    enter: async () => {},
    snapshot: async () => ({ elements: [{ ref: 'a0', name: '버튼' }], locators: {} }),
    location: async () => 'app://test/Main',
    text: async () => '',
    tree: async () => null,
    refresh() {},
    execute: async (a) => calls.executed.push(a.type),
  };
  return { agent, ops, calls };
}

const run = (f, tc) => runTestCase(f.ops, f.agent, tc, { seedNote: '' }, 6);
const step = (order, action) => ({ order, action, expected: '기대' });

test('관찰 step 판별 — 따옴표 안 요소 이름은 동사로 보지 않는다', () => {
  assert.equal(isObserveOnly('옵션 바, `전화매장` 필터 확인'), true);
  assert.equal(isObserveOnly('`주소 검색` 화면 확인'), true);
  assert.equal(isObserveOnly('영업 종료 시간대에 `나와 가까운 매장` 목록의 매장 썸네일 확인'), true);
  assert.equal(isObserveOnly('검색창에 `휘낭시에` 입력 후, 검색'), false);
  assert.equal(isObserveOnly('뒤로 가기 후, 검색창을 터치 해 `최근 검색어` 이력 확인'), false);
  assert.equal(isObserveOnly('`인기도 순` 터치'), false);
});

test('Step 0개 → INCONCLUSIVE (0 토큰 PASS 금지)', async () => {
  const r = await run(fixture({}), { steps: [] });
  assert.equal(r.verdict, 'INCONCLUSIVE');
});

test('전제조건 확인 실패 → Step 미실행, INCONCLUSIVE', async () => {
  const f = fixture({ actions: [{ type: 'done' }], judges: [{ reasoning: '검색 결과가 아님', verdict: 'FAIL' }] });
  const r = await run(f, { preconditions: '검색창에 `휘낭시에` 입력 후 검색', steps: [step(1, '`인기도 순` 터치'), step(2, '`가까운 순` 터치')] });
  assert.equal(r.verdict, 'INCONCLUSIVE');
  assert.equal(f.calls.action, 1); // 전제조건 이동 1회뿐, step 동작 결정 없음
  assert.match(r.stepLogs[0].judgment, /^INCONCLUSIVE: 전제조건 미도달/);
  assert.match(r.stepLogs[1].judgment, /^SKIPPED/);
});

test('"입력 후 검색"에서 입력만 하고 done 하면 엔터를 대신 누른다', async () => {
  const f = fixture({
    availableActions: ['click', 'fill', 'key', 'done'],
    actions: [{ type: 'fill', ref: 'a0', value: '휘낭시에' }, { type: 'done' }, { type: 'done' }],
    judges: [{ reasoning: '결과 목록', verdict: 'PASS' }, { reasoning: '보임', verdict: 'PASS' }],
  });
  await run(f, { preconditions: '검색창에 `휘낭시에` 입력 후 검색', steps: [step(1, '옵션 바의 정렬 확인')] });
  assert.deepEqual(f.calls.executed, ['fill', 'key']);
});

test('대상 하나뿐인 터치 step은 그 대상을 한 번 누르면 끝 (다시 누르지 않는다)', async () => {
  const f = fixture({
    actions: [{ type: 'click', ref: 'a0' }, { type: 'click', ref: 'a0' }],
    judges: [{ reasoning: '정렬 창 닫힘', verdict: 'PASS' }],
  });
  f.ops.snapshot = async () => ({ elements: [{ ref: 'a0', name: '인기도 순 아이콘' }], locators: {} });
  const r = await run(f, { steps: [step(1, '`인기도 순` 터치')] });
  assert.equal(r.verdict, 'PASS');
  assert.deepEqual(f.calls.executed, ['click']);
  assert.equal(f.calls.action, 1);
});

test('판정기에는 ref 번호 없이 요소 이름만 넘긴다', async () => {
  let judgeInput = null;
  const f = fixture({ actions: [{ type: 'click', ref: 'a0' }], judges: [{ reasoning: '닫힘', verdict: 'PASS' }] });
  const create = f.agent.anthropic.messages.create;
  f.agent.anthropic.messages.create = async (req) => {
    if (req.system.startsWith('너는 웹 QA 판정자다')) judgeInput = JSON.parse(req.messages[0].content);
    return create(req);
  };
  await run(f, { steps: [step(1, '`버튼` 터치')] });
  assert.deepEqual(judgeInput.actionsTaken, ['click("버튼")']);
});

test('첫 FAIL에서 중단 — 남은 step은 SKIPPED', async () => {
  const f = fixture({ actions: [{ type: 'click', ref: 'a0' }, { type: 'done' }], judges: [{ reasoning: '없음', verdict: 'FAIL' }] });
  const r = await run(f, { steps: [step(1, '`버튼` 터치'), step(2, '`다음` 터치')] });
  assert.equal(r.verdict, 'FAIL');
  assert.equal(f.calls.judge, 1);
  assert.match(r.stepLogs[1].judgment, /^SKIPPED: 앞 step 실패/);
});

test('관찰 step에서 클릭은 실행하지 않는다', async () => {
  const f = fixture({ actions: [{ type: 'click', ref: 'a0' }], judges: [{ reasoning: '보임', verdict: 'PASS' }] });
  const r = await run(f, { steps: [step(1, '옵션 바, 정렬 옵션 확인')] });
  assert.equal(r.verdict, 'PASS');
  assert.deepEqual(f.calls.executed, []);
});

test('동작 불가 → 판정 없이 INCONCLUSIVE, 남은 step SKIPPED', async () => {
  const f = fixture({ actions: [{ type: 'impossible', value: '버튼 없음' }] });
  const r = await run(f, { steps: [step(1, '`패스오더 시작하기` 터치'), step(2, '`다음` 터치')] });
  assert.equal(r.verdict, 'INCONCLUSIVE');
  assert.equal(f.calls.judge, 0);
  assert.match(r.stepLogs[0].judgment, /동작 불가 — 버튼 없음/);
  assert.match(r.stepLogs[1].judgment, /^SKIPPED: 앞 step 동작 불가/);
});
