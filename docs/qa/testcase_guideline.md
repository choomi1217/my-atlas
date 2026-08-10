# TestCase 작성 가이드라인 (Agentic Test Execution 대상)

> 작성일: 2026-07-29 / 최종 갱신: 2026-07-30
> 배경: DB 복원 후 `companies/1440/products/1119/versions/764/phases/768`에 Automation 실행 → 7건 전부 FAIL (`agent_execution_job` id=59). 이후 TC992~1009를 하나씩 실제로 Pass할 때까지 라이브로 고치면서 진짜 원인을 규명함 (`agent_execution_job` id=60~79).

이 문서는 추측이 아니라 **TC992/999/1006/1007/1009 전부 실제 PASS를 확인할 때까지 라이브 디버깅한 결과**를 정리한 것이다. 중간에 "이게 원인이겠다" 싶었던 가설 중 상당수가 틀렸고, 실제 병목은 훨씬 단순한 곳에 있었다. 그 과정 그대로 남긴다 — 다음에 비슷한 실패를 보면 여기서부터 의심할 것.

---

## 1. Failed된 TC 원본 내용 (7건, job#59) → 최종 결과

| TC ID | 제목 | 처음 관측된 실제 동작 | 최종 판명된 원인 | 최종 결과 |
|---|---|---|---|---|
| 992 | Company 신규 등록 | 로그인 → 엉뚱한 페이지/설정 화면 등으로 헤맴 | seed_note의 중복 로그인 지시 (2장) | **PASS** (job#65) |
| 995 | Company 이름 검색 — 일치 | `/features` 도달했으나 "TestCo" 없음 | CompanyListPage에 검색 기능 자체가 없음 | **폐기 결정** (User) |
| 997 | Company 이름순 정렬 | 정렬 결과 불일치 | CompanyListPage에 정렬 기능 자체가 없음 + expected stale | **폐기 결정** (User) |
| 999 | Product 신규 등록 | 992와 동일 패턴으로 이탈 | 992와 동일 원인(seed_note) + 카드 안 버튼 텍스트 섞임(B2-5) | **PASS** (job#72) |
| 1006 | Root Segment 추가 | `/settings`로 새서 헤맴 | 진입 경로 미기술 + 같은 버튼 반복 클릭(B2-6) | **PASS** (job#74) |
| 1007 | Child Segment 추가 | SegmentTreeView 근처도 못 감 | 진입 경로 미기술 | **PASS** (job#75) |
| 1009 | TestCase 신규 생성 | `/test-studio`로 오진입 | 진입 경로 미기술 + cursor 상속 중복(B2-7) + 판정 불가능한 expected | **PASS** (job#79) |

---

## 2. 실제로 확인된 원인 — 라이브 디버깅 순서 그대로

### 처음 세운 가설 (부분적으로만 맞음): 링크 텍스트 중복

`exec_seed_note`가 "상단 네비게이션의 **Product Test Suite** 링크를 클릭"이라고 지시하는데, 같은 문구가 두 곳에 있었다.
- `Layout.tsx:9` — 상단 네비 → `/features` (맞는 곳)
- `FeaturesSection.tsx:32,70` — Overview 페이지 카드 → `/feature/test-suite` (다른 곳)

→ **이건 사실이었지만, 실제 실패의 주범은 아니었다.** 아래 진짜 원인 때문에 에이전트가 이 두 링크 중 어느 쪽도 시도해볼 기회조차 없었다.

### 진짜 원인 — seed_note가 이미 끝난 로그인을 또 시키고 있었다

`agent-worker`의 실행 순서는 이렇다 (`agent.js` `runTestCase()`):
```js
await autoLogin(page, agent.username, agent.password);  // 코드가 결정적으로 로그인 완료
if (seedNote && seedNote.trim()) {
  await agenticGoal(page, agent, seedNote, maxStepActions);  // 그 다음 LLM이 seedNote 목표 수행
}
```
그런데 당시 `exec_seed_note`는 "먼저 `/login` 페이지로 이동해 username에 admin, password에 admin을 입력하고 Login 버튼을 클릭해 로그인한다. 로그인 후 ..." 였다. **이미 로그인된 상태인데도 에이전트는 이 문구를 그대로 따라 `/login`으로 다시 이동해서 username 칸에 "admin"을 반복 입력하다가(다음 칸으로 못 넘어가고 제자리걸음), 허용된 액션 4번(`maxStepActions`)을 전부 로그인 재시도에 써버렸다.**

```
seed[0] url=/ → navigate=/login
seed[1] url=/login → fill(a0)=admin
seed[2] url=/login → fill(a0)=admin   (제자리걸음)
seed[3] url=/login → fill(a0)=admin
seed 목표 미완료 — maxActions(4) 소진
```

→ **"Product Test Suite 링크 클릭"은 시도조차 못 해보고 액션이 끝났다.** 이게 그동안 결과가 매번 `/feature/test-suite`, `/settings`, `/` 등 제각각이었던 진짜 이유다 — 액션을 다 써버린 어중간한 상태에서 TC 스텝이 시작되니 매번 다른 곳에서 멈춘 것.

**수정**: `exec_seed_note`에서 로그인 지시 부분을 완전히 삭제. `"로그인 후 상단 네비게이션의 Product Test Suite 링크를 클릭해 회사 목록(/features)으로 이동한다."`만 남김. (로그인은 코드가 이미 보장하므로 "로그인 후"는 상태 서술이지 지시가 아니다.)

이 수정만으로 에이전트가 처음으로 `/features`에 정상 도착했다. 다만 여전히 액션을 낭비했다 — 이미 `/features`에 도착한 뒤에도 같은 링크를 3번 더 클릭했다(`done`을 선언하지 못함). 결과에 영향은 없었지만 액션 예산 낭비이므로 주시할 것.

### 처음 가설도 완전히 무의미하진 않았다 — href 캡처 추가

`agent-worker/src/agent.js`의 스냅샷 함수(`snapshotInteractive`)는 원래 `{ref, role, name, tag, value}`만 캡처했다. 이름이 같은 두 요소를 구분할 근거가 전혀 없었던 것도 사실이라, **`href`/`testId`/`type`를 추가로 캡처하도록 코드를 고쳤다** (이미 적용됨, 재빌드 완료). 이제 이름이 같아도 목적지(href)나 `data-testid`로 구분 가능하고, `ACTION_SYSTEM` 프롬프트에도 "name이 같으면 href/testId/type으로 구분하라"는 지침을 추가했다.

### TC 콘텐츠 자체의 문제 — "예시" 표기와 빈 expected

TC992를 실제로 통과시키는 과정에서 두 가지가 더 나왔다.

1. **`expected`가 빈 문자열("")** → 판정기가 "판정 기준이 없다"며 INCONCLUSIVE.
2. **action에 "예: ..."(예시) 표기** → `Company 이름 입력 (예: "QA-AutoTest-Co")`처럼 쓰면, 에이전트가 "예시일 뿐이니 아무 값이나 넣어도 된다"고 해석해서 스텝마다 다른 이름("Test Company" 등)을 즉석에서 지어냈다. **action과 expected 둘 다 같은 확정값을 명시**해야 한다:
```json
{"action": "Company 이름 입력란에 \"QA-AutoTest-Co\" 입력",
 "expected": "입력란에 \"QA-AutoTest-Co\"라는 값이 표시됨"}
```

---

## 3. 그 이후 추가로 밝혀진 원인들 (TC999/1006/1007/1009 검증 과정)

### `<div onClick>` 카드는 스냅샷에서 원래 안 잡힘 → cursor 휴리스틱으로 확장
Company/Product 카드, Segment 트리 행이 전부 `<div onClick={...}>`라 원래 스냅샷 셀렉터(`button, a[href], input, select, textarea, [role="button"]`)에 안 잡혔다. `role="button"`을 붙이는 건 자기 코드에만 가능해 서드파티 앱엔 못 쓴다는 지적에 따라, **소스 수정 없이도 통하는 대안**으로 `cursor` 스타일(pointer/move/grab 등)이 있는 요소도 후보에 포함시켰다.

### 카드 컨테이너 이름에 안쪽 버튼 텍스트가 섞임 → 자기 텍스트만 추출
카드 안에 "Test Runs"/"Edit"/"Delete" 같은 진짜 버튼이 있으면, 카드(컨테이너)의 이름을 `textContent`로 뽑을 때 그 버튼들 텍스트까지 다 이어붙어(`"WebApp-QAMOBILETest RunsVersionsEditDelete"`) 카드 자신과 안쪽 버튼이 헷갈렸다. 이미 별도 후보로 잡히는 중첩 요소의 텍스트는 빼고 계산하도록 수정.

### cursor는 CSS 상속 속성이라 자손도 같이 후보로 잡힘 → 값 비교로 정교화
클릭 가능한 컨테이너(예: Segment 행, cursor:move)의 자식 span(세그먼트 이름)이 부모의 커서 스타일을 그냥 물려받아 **똑같은 대상이 두 개의 다른 이름으로 중복 등장**했다. "조상이 후보면 자손은 무조건 제외"는 자기만의 명시적 스타일을 가진 진짜 별개 동작(펼치기/접기 화살표)까지 지워버리는 부작용이 있어서, **커서 값이 조상과 같을 때만**(=순수 상속) 제외하도록 정교화했다.

### ref 번호는 스냅샷마다 새로 매겨짐 → 같은 버튼 반복 클릭
한 버튼을 클릭해 상태가 바뀌면(예: 클릭 후 disabled) 다음 스냅샷에서 그 버튼은 다른 ref 번호를 받는다. 에이전트가 "아까 그거랑 같은 버튼"이라는 걸 몰라서 이미 클릭한 버튼을 계속 재클릭하는 현상이 있었다. `ACTION_SYSTEM`에 "previousActions에 같은 **이름**의 click이 이미 있으면 그건 끝난 것으로 보고 done"이라는 지침을 추가해 ref가 아니라 이름으로 판단하게 했다.

### `pageText()`가 1500자에서 잘림 → 실제로 맞았는데 판정만 FAIL
실제로는 정확한 값이 저장됐는데(DB로 직접 확인), 판정 AI가 보는 `pageText`가 1500자에서 잘려서 필요한 텍스트가 안 보인 적이 있었다. 1500 → 6000자로 늘림.

### 판정 AI가 `elements`에 값이 있는데도 `pageText`로 재확인하려다 망설임
select/input의 현재 값은 `elements[].value`에 이미 정확히 담겨있는데도, 판정 AI가 `pageText`에서 또 확인하려다 못 찾으면 INCONCLUSIVE를 냈다. `JUDGE_SYSTEM`에 "elements의 value만으로 충분한 근거"라고 명시. **이건 TC 하나의 문제가 아니라 select/input 값을 검증하는 모든 TC에 영향을 주므로 프롬프트 레벨에서 고쳤다.**

### expected가 애초에 판정 불가능한 조건을 요구한 경우
- "강조 배경으로 표시됨"처럼 **CSS 스타일**을 요구하면, 스냅샷이 스타일 정보를 아예 안 담으므로 항상 INCONCLUSIVE다 → 화면에 실제로 보이는 텍스트(예: 선택된 Path 텍스트) 존재 여부로 바꿔야 판정 가능.
- "스텝이 1개 추가됨"처럼 **변경 전후 비교**가 필요하면, 판정 시점엔 이전 상태를 안 주므로 구조적으로 판정 불가 → "방금 입력한 값이 지금 화면에 보이는지"처럼 **최종 상태만으로** 확인 가능하게 바꿔야 한다.

---

## 4. TC 작성 가이드라인 (검증된 규칙)

1. **진입 경로를 `preconditions` 텍스트에만 의존하지 않는다.** `agent-worker`가 그 필드를 읽지 않으므로, 필요하면 `steps`에 직접 포함시킨다.
2. **화면 진입에 쓰는 텍스트가 앱 내 다른 곳과 겹치는지 작성 전 `grep`으로 확인한다.** 겹치면 (a) 코드 라벨을 구분되게 바꾸거나 (b) `href`/`data-testid`로 구분 가능한지 확인한다 (2026-07-30부터 agent-worker가 이 두 값을 캡처함).
3. **"예: X"처럼 예시로 값을 제시하지 않는다.** action과 expected 모두 실제로 사용할 확정값을 그대로 적는다. 예시 표기는 에이전트가 임의의 값을 지어내는 원인이 된다.
4. **`expected`를 빈 값으로 두지 않는다.** 빈 문자열은 판정 불가(INCONCLUSIVE)로 직결된다. 모든 스텝에 "무엇이 보이면 통과인지"를 구체적으로 적는다.
5. **버튼/필드 문구는 실제 코드 문구를 그대로 쓴다.** 의역하지 말고 코드의 실제 텍스트("+ New Company" 등)를 그대로 action에 적는다.
6. **한 Phase 안의 TC는 서로 데이터 의존을 가정하지 않는다.** 다른 TC가 만든 데이터("TestCo" 등)에 기대는 검증은 자기 자신이 그 데이터를 만드는 단계를 포함하거나, Phase 실행 순서·스킵 정책을 별도로 문서화한다.
7. **`expected_results`(TC 전체 기대 결과)는 실제 시드 데이터 기준으로 작성한다.** DB를 복원하거나 시드를 바꾸면 그 데이터를 참조하는 TC도 같이 갱신한다.
8. **모달/트리처럼 상태가 있는 UI는 "확정적으로 관측 가능한 신호"까지 expected에 적는다.** "모달 닫힘"만으로는 약하다 — "모달 닫힘, 목록에 X 카드 표시"처럼 두 조건을 같이 명시한다.
9. **CSS 스타일(강조 배경, 색상 등)을 expected에 요구하지 않는다.** 스냅샷이 스타일 정보를 아예 안 담으므로 항상 판정 불가(INCONCLUSIVE)다. 대신 화면에 실제로 보이는 텍스트(예: 선택된 경로 텍스트, 상태 라벨)로 바꿔 쓴다.
10. **변경 전후 비교("1개 추가됨", "값이 바뀜")를 expected에 요구하지 않는다.** 판정은 액션 이후의 최종 상태 스냅샷 하나만 보고 이뤄지므로 "이전과 달라졌는지"는 구조적으로 판정 불가하다. "방금 입력/생성한 값이 지금 화면에 보이는지"처럼 최종 상태만으로 확인 가능하게 쓴다.
11. **개발자 용어(리프 노드, 컴포넌트명 등) 대신 앱이 실제로 화면에 표시하는 용어를 쓴다.** 예: "리프 노드" 대신 앱이 쓰는 "Path". 작성 전 실제 화면(또는 스크린샷)에서 그 용어가 진짜 쓰이는지 확인한다.

---

## 5. TC 작성 시 셀프 체크리스트

- [ ] 이 TC가 Product의 `exec_seed_note`가 도달시켜주는 화면(현재는 `/features`)에서 시작해도 되는가, 아니면 그보다 더 깊은 화면이 필요한가? 후자라면 `steps`에 진입 과정을 직접 넣었는가?
- [ ] action에 "예:"처럼 예시로 값을 제시한 곳이 있는가? 있다면 확정값으로 바꿨는가?
- [ ] 모든 step의 `expected`가 비어있지 않고, 구체적인 관측 기준을 담고 있는가?
- [ ] expected가 CSS 스타일이나 변경 전후 비교를 요구하지 않는가? (판정 시점의 최종 상태만으로 확인 가능한가)
- [ ] 화면 진입에 쓰는 링크/버튼 텍스트가 앱 전체에서 유일한가? (`grep`으로 확인)
- [ ] 이 TC가 같은 Phase의 다른 TC가 만든 데이터에 의존하는가?
- [ ] `expected_results`가 현재 실제 데이터/코드 문구와 일치하는가?
- [ ] action/expected에 개발자 용어가 아니라 앱이 실제로 표시하는 용어를 썼는가?

---

## 6. 코드 레벨에서 이미 반영된 것 (2026-07-30)

- `agent-worker/src/agent.js` `snapshotInteractive()` — `testId`(`data-testid`), `href`, `type` 캡처 추가.
- `agent-worker/src/agent.js` `snapshotInteractive()` — 명시적 상호작용 요소 외에 `cursor` 스타일(pointer/move/grab 등)이 있는 `div/span/li/tr/td/label`도 후보로 포함(서드파티 앱에도 통하는, 소스 수정 불필요한 `<div onClick>` 감지 방법).
- `agent-worker/src/agent.js` `snapshotInteractive()` — 카드형 컨테이너 이름 계산 시 중첩된 상호작용 자손(이미 별도 후보)의 텍스트는 제외(`ownTextContent`).
- `agent-worker/src/agent.js` `snapshotInteractive()` — cursor 후보 중, 조상도 후보이고 커서 값까지 같은(=순수 상속) 자손은 제외. 값이 다르면(=자기만의 명시적 스타일) 유지.
- `agent-worker/src/agent.js` `ACTION_SYSTEM` 프롬프트 — name이 같은 요소가 여럿이면 href/testId/type으로 구분하라는 지침, 이미 목표 상태에 도달했으면 done하라는 지침, previousActions에 같은 이름의 click이 이미 있으면 재클릭 말고 done하라는 지침 추가.
- `agent-worker/src/agent.js` `JUDGE_SYSTEM` 프롬프트 — select/input 값 확인은 elements의 value만으로 충분(pageText 재확인 불필요)하다는 지침 추가.
- `agent-worker/src/agent.js` `agenticGoal()` — 진행 상황을 `docker logs`에 남기도록 로그 추가(`[worker] seed[i] ...`). 이전엔 이 단계가 완전히 블랙박스라 디버깅이 불가능했음.
- `agent-worker/src/agent.js` `runTestCase()` — `stepLogs.actionTaken`을 `history.join(' → ')`로 통일해 액션 실행 성공/실패가 항상 로그에 남게 정정(이전엔 실패해도 성공한 것처럼 보였음).
- `agent-worker/src/agent.js` `pageText()` — 캡처 길이 1500자 → 6000자로 상향(길어서 판정에 필요한 텍스트가 잘리는 문제 방지).
- `product.exec_seed_note` (product_id=1119) — 중복 로그인 지시 제거, "이미 목표 상태면 done"에 맞게 상태 서술로 재작성.
- `test_case.steps` (id=992, 999, 1006, 1007, 1009) — 확정값 사용, 빈 expected 채움, 진입 경로 포함, CSS/diff 의존 조건 제거, 개발자 용어 정리.

## 7. 후속 조치 후보 (미착수)

- `agent-worker`가 `tc.preconditions`를 실제로 소비하도록 확장 (지금은 `steps`에 진입 경로를 직접 넣는 방식으로 우회 중)
- TC995/997 삭제 반영 (User 작업)
- `agenticGoal`이 목적지 도착 후에도 `done`을 선언하지 못하고 액션을 낭비하는 현상 — 결과에 영향은 없었으나 완전히 해결되진 않음(재발 시 조사)
- cursor 휴리스틱은 시각적 신호(커서 스타일) 자체가 없는 클릭 요소는 여전히 못 잡음 — 100% 커버 아님
