# registry_v24 2차 리뷰 — 수정 지시서

> 대상: [registry_v24.md](./registry_v24.md) (1차 리뷰 반영본)
> 1차 리뷰: [registry_v24_review.md](./registry_v24_review.md)
> 작성일: 2026-08-24
> 성격: **어디를 어떻게 고칠지의 패치 목록.** 각 항목은 `위치 / 현재 / 수정안 / 이유` 형식이며 그대로 찾아 바꿀 수 있게 원문을 인용했다.

---

## 0. 요약

**1차 리뷰 반영 품질은 좋다.** 코드 관련 주장을 실물과 대조했고 **전부 정확**했다(§1). 다만 개정 과정에서 **새 결함 3건**, **수정 누락 3곳**, **깨진 Step 참조 8곳**, **플랫폼 전환 미반영 3곳**이 생겼다. 새 결함 2건이 하필 "데모 전 필수"로 격상한 Step 1-K와 B-3 대응책에 박혀 있어 우선순위가 높다.

| 순위 | 항목 | 소요 | 안 고치면 |
|:---:|---|---|---|
| **1** | [N-3](#n-3) `waitForQuiescence` 오기 | 5분 | B-3이 그대로 재현, 원인 추적 불가 |
| **2** | [N-1](#n-1)·[N-2](#n-2) Step 1-K 설계 결함 | 10분 | 중지를 눌러도 "실행 실패"로 표시 |
| **3** | [S-1](#s-1) 수요일 스코프 확정 | 5분 | 이틀 오가다 양쪽 다 미완 |
| 4 | [N-4](#n-4)~[N-6](#n-6) 번호·문구 정합 | 30분 | 체크리스트 따라가다 혼선 |
| 5 | [S-2](#s-2)~[S-5](#s-5) 보완 | 20분 | 당일 판단 근거 부재 |

1~3번은 합쳐 **20분**이다. 나머지보다 먼저 처리할 것.

---

## 1. 사실 확인 — 1차 리뷰 반영분 검증 (전부 정확)

개정본이 새로 적어넣은 코드 주장을 실제 파일과 대조했다. **재의심할 필요 없다.**

| 개정본 주장 | 검증 결과 |
|---|---|
| `page.url()` 9곳 = `agent.js:191, 265, 283, 286, 290, 322, 347, 355, 365` | ✅ **정확히 일치** (9곳, 라인번호 전부 맞음) |
| `claimJob`이 RUNNING인 job도 성공 반환 (`AgentExecutionServiceImpl:115`) | ✅ |
| `cancelJob`은 DB 상태만 변경 (`:78-86`) | ✅ |
| 모달에 중지 버튼 없음 (`AgentRunModal.tsx:106, 200`) | ✅ |
| 워커가 실행 중 job 상태 미확인 (`index.js:78-90`) | ✅ |
| `index.js:71-73`이 baseUrl 없으면 throw | ✅ |

---

## 2. 새로 생긴 결함 (개정이 만든 것)

<a id="n-1"></a>
### N-1 🛑 Step 1-K의 `complete(CANCELLED)`는 실행하면 터진다

> **한줄요약: 중지 버튼을 만들어도, 누르면 화면에 "실행 실패"로 뜬다.**

**위치 2곳**
- §0-1 「안전 규칙 > 사후 차단」 불릿 1
- §10 Phase 1 「Step 1-K」

**현재**
```
워커: 각 TC 실행 전, 그리고 각 step 실행 전에 job 상태를 조회해
`CANCELLED`면 즉시 중단 후 `complete(CANCELLED)` 보고
```

**왜 터지는가**

`completeJob`은 DONE/FAILED만 받고 그 외엔 예외를 던진다.

```java
// AgentExecutionServiceImpl:158-160
if (request.status() != AgentExecutionStatus.DONE && request.status() != AgentExecutionStatus.FAILED) {
    throw new IllegalArgumentException("종료 상태는 DONE 또는 FAILED만 허용됩니다: " + request.status());
}
```

그리고 그 예외가 워커의 catch로 흘러가 **`complete(FAILED)`를 다시 부른다.**

```js
// index.js:94-101
} catch (err) {
  console.error(`[worker] job=${jobId} 실패: ${err.message}`);
  try {
    await backend.complete(jobId, 'FAILED', err.message);   // ← CANCELLED를 덮어쓴다
  } catch (e2) { ... }
  throw err;
}
```

`completeJob`은 **현재 상태를 검사하지 않으므로**(`:161-167`) CANCELLED → FAILED로 덮인다. 사용자가 중지를 눌렀는데 모달에는 `실행 실패: 종료 상태는 DONE 또는 FAILED만 허용됩니다: CANCELLED`가 뜬다.

**수정안**

| 안 | 방식 | 장단 |
|---|---|---|
| **A (권장)** | 워커가 CANCELLED를 감지하면 **아무것도 보고하지 않고 조용히 종료.** `cancelJob`이 이미 `status`·`completedAt`을 종료 상태로 만들었으므로(`:83-84`) 추가 보고가 불필요 | 백엔드 무변경. 단 `index.js`의 catch가 `complete(FAILED)`를 부르지 않도록 **전용 예외(`CancelledError`) 분기가 필수** |
| B | `completeJob` 허용 목록에 CANCELLED 추가 + 이미 종료된 job 덮어쓰기 가드 | 상태 전이가 명시적. 백엔드 변경 + `AgentExecutionServiceImplTest` 수정 필요 |

**교체할 문구 (안 A 기준)**
```
워커: 각 TC 실행 전, 그리고 각 step 실행 전에 job 상태를 조회해 `CANCELLED`면
즉시 중단한다. **완료 보고는 하지 않는다** — `cancelJob`이 이미 status·completedAt을
종료 상태로 만들었고, `completeJob`은 DONE/FAILED만 허용하므로(`:158-160`)
`complete(CANCELLED)`는 예외를 던지고 그 예외가 `index.js:97`의
`complete(FAILED)`로 흘러가 **CANCELLED를 FAILED로 덮어쓴다.**
→ 워커에 전용 `CancelledError`를 두고 `runJob`의 catch에서 이것만 별도 분기해
  아무 보고 없이 return 한다.
```

**연쇄 수정**: §10 「🎯 수요일 데모 최소선」의 아래 문장도 부정확해진다.
```
현재: - **백엔드·프론트 변경은 [중지] 버튼(Step 1-K) 하나뿐이다.**
수정: - **백엔드는 무변경, 프론트는 [중지] 버튼 1개, 워커는 상태 폴링 + CancelledError 분기다.**
```

---

<a id="n-2"></a>
### N-2 중단 직후 `recordResult`도 터진다 (N-1의 부수 효과)

> **한줄요약: 중지하면 진행 중이던 TC 결과는 버려진다 — 맞는 동작이지만 모르면 디버깅 시간을 날린다.**

**위치**: §10 Step 1-K (설명 보강)

`recordResult`는 job이 RUNNING이어야 한다.

```java
// AgentExecutionServiceImpl:125-127
if (job.getStatus() != AgentExecutionStatus.RUNNING) {
    throw new IllegalArgumentException("실행 중(RUNNING) Job에만 결과를 보고할 수 있습니다: " + job.getStatus());
}
```

Step 1-K를 "TC·step 실행 **전**" 체크로 설계한 것 자체는 맞다. 다만 **이미 실행에 들어간 TC의 결과는 보고 자체가 불가능**하다는 점을 문서에 명시해야 한다.

**추가할 문구**
```
> 중단 시 **이미 실행에 들어간 TC의 결과는 기록되지 않는다.** `recordResult`가
> RUNNING 상태를 요구하기 때문이다(`:125-127`). 의도된 동작이지만, 모르면
> "왜 마지막 TC 결과가 없지"로 시간을 쓰게 되므로 명시해 둔다.
```

---

<a id="n-3"></a>
### N-3 ⚠️ `appium:waitForQuiescence=false`는 존재하지 않는 capability다

> **한줄요약: B-3을 막으려고 넣은 설정이, 하필 B-3을 그대로 재현시킨다.**

**위치 2곳**
- §10 Phase 0 「Step 0-I2」
- §11 리스크 표 「iOS 기본 대기 설정으로 TC당 시간 폭증」 행의 대응란

**현재**
```
- [ ] **Step 0-I2** — **대기 시간 캡 먼저 설정**(리뷰 B-3):
  `appium:waitForQuiescence=false`, `appium:waitForIdleTimeout`·
  `appium:animationCoolOffTimeout` 축소.
```

**무엇이 틀렸나**

XCUITest 드라이버 공식 capabilities 문서에 **`waitForQuiescence`는 존재하지 않는다.** 대응하는 것은 `appium:waitForIdleTimeout`(기본 10초)이다.

실패 방식이 특히 나쁘다. 알 수 없는 `appium:` capability는 보통 **경고만 남기고 무시**되므로, **"껐다고 생각했는데 실제로는 10초 대기가 그대로 도는"** 상태가 된다. 데모 당일 "왜 이렇게 느리지"의 원인을 못 찾는다.

그리고 **`snapshotMaxDepth`가 통째로 빠졌다.** 공식 문서가 *"Lower values can help speed up source retrieval and prevent out of memory or timeout errors"*라고 적은, **조회 시간과 토큰을 동시에 줄이는 가장 직접적인 손잡이**다. §8의 "depth 제한 필수"와 Step 0-I2가 연결되어 있지 않다.

**capability와 setting은 적용 경로가 다르다** — 이걸 구분해야 실제로 먹는다.

| 이름 | 종류 | 기본값 | 적용 경로 |
|---|---|:---:|---|
| `waitForIdleTimeout` | **capability** | 10초 | 세션 생성 capabilities에 `appium:` 접두사로 |
| `animationCoolOffTimeout` | **setting** | 2초 | 세션 시작 직후 `updateSettings` |
| `snapshotMaxDepth` | **setting** | 50 | 세션 시작 직후 `updateSettings` |

**교체할 문구**
```
- [ ] **Step 0-I2** — **대기·깊이 캡을 먼저 설정한다**(리뷰 B-3). 실행해보고 느리면
      조정하는 게 아니라 **처음부터 꺼두고 시작**한다.

      ```js
      // 세션 생성 capabilities
      'appium:waitForIdleTimeout': 0,      // 기본 10초 → 대기 안 함

      // 세션 시작 직후 (이 둘은 capability가 아니라 setting이다)
      await driver.updateSettings({
        animationCoolOffTimeout: 0,        // 기본 2초
        snapshotMaxDepth: 20,              // 기본 50 — 조회 시간·토큰 동시 절감
      });
      ```

      > `waitForQuiescence`는 **현재 드라이버에 없는 이름**이다. 알 수 없는 `appium:`
      > capability는 경고만 남기고 무시되므로, 껐다고 착각한 채 10초 대기가 그대로
      > 도는 최악의 실패 모드가 된다.
```

**§11 리스크 표 대응란도 함께 교체**
```
현재: Step 0-4에서 `waitForQuiescence=false` 등 **선제 설정**
수정: Step 0-I2에서 `waitForIdleTimeout=0` + `animationCoolOffTimeout`/`snapshotMaxDepth` 축소를 **선제 설정**
```

---

## 3. 수정 누락 — §0·§2는 고쳤는데 다른 절이 원문 그대로

문서 안에서 같은 사안을 두 가지로 말하고 있다. 읽는 사람이 어느 쪽을 믿어야 할지 알 수 없다.

<a id="n-5"></a>
### N-5a §3 — Node 버전 정정이 §0-1에만 반영됨

**위치**: §3 「주의할 버전 사실 (2026-08 기준)」 두 번째 불릿

**현재**
```
- Appium 3는 **Node 20.19+ / npm 10+** 를 요구한다 → 우리 워커
  (`engines.node >=20`, Playwright 이미지 = Node 20)와 호환.
  단 20.19 미만이면 베이스 이미지 상향 필요.
```

**수정안**
```
- Appium 3의 Node 요구 범위는 **`^20.19.0 || ^22.12.0 || >=24.0.0`** 이다 —
  단순한 "20.19 이상"이 아니라 **21.x와 22.0~22.11이 미지원 구간**이다(npm은 10+).
  현 워커는 `engines.node >=20`, Playwright 이미지가 Node 20이므로 **패치 버전 확인 필수**:
  20.19 미만이면 베이스 이미지 상향, 22를 쓸 거면 22.12 이상이어야 한다.
```

**이유**: §0-1 환경 점검표에서 A-2로 정정한 바로 그 내용이 §3에 원문 그대로 남아 있다.

### N-5b §9-1 — A-1 정정이 반영 안 됨

**위치**: §9-1 「워커: Driver 인터페이스 도입」 첫 문단

**현재**
```
`agent.js`에서 드라이버 의존 부분만 뽑아 인터페이스 뒤로 보낸다.
**`runTestCase`의 루프 구조와 프롬프트는 건드리지 않는다.**
```

**수정안**
```
`agent.js`에서 드라이버 의존 부분만 뽑아 인터페이스 뒤로 보낸다.
**`runTestCase`의 루프 구조(step 순회 → 액션 결정 → 실행 → 판정)와 프롬프트는
유지한다.** 단 §2에서 짚었듯 `page.url()` 9곳은 `driver.location()`으로
치환해야 하므로 **파일이 무변경인 것은 아니다**(Step 3).
```

**이유**: A-1을 수용해 §0·§2를 고치고 Step 3까지 신설했는데 §9-1만 원문이다. §2의 "🔧 최소 수정"과 정면 충돌한다.

### N-5c §9-4 — 앞 블록과 뒤 블록이 충돌

**위치**: §9-4 「실행 모드」 중간 소제목

**현재**
```
**채택 (User 선택): 항상 headed + 가상 디스플레이 + noVNC 중계**
```
바로 아래에 "2단계로 쪼갠다 — 2-A 먼저, 2-B는 그 위에"가 붙어 있다. 앞은 "채택", 뒤는 "나중". 정면 충돌.

**수정안**: 소제목을 강등하고 순서를 명시한다.
```
**2-B 상세 설계 — 항상 headed + 가상 디스플레이 + noVNC 중계**

> 아래는 **2-B의 설계이며 착수는 2-A 이후다**(이 절 끝의 「2단계로 쪼갠다」 참조).
```

---

<a id="n-4"></a>
## 4. 깨진 Step 참조 8곳

Phase 0을 `0-0 / 0-A* / 0-I* / 0-C*`로 재편했는데 다른 절이 옛 번호를 그대로 쓴다. **존재하지 않는 Step을 8곳이 가리킨다.**

| # | 위치 | 현재 표기 | 고칠 값 |
|:---:|---|---|---|
| 1 | §0-1 「패스오더 프레임워크 미확인 리스크」 마지막 문장 | `Step 0-3` | **`Step 0-A2 / 0-I3`** |
| 2 | §11 리스크 「Flutter/Unity 대상이면 전제가 무너짐」 대응란 | `Step 0-1에서 가장 먼저 확인` | **`Step 0-A2 / 0-I3에서 가장 먼저 확인`** |
| 3 | §11 리스크 「iOS 기본 대기 설정…」 대응란 | `Step 0-4` | **`Step 0-I2`** (N-3에서 문구째 교체) |
| 4 | §11 리스크 「판정 비결정성 미검증」 대응란 | `Step 0-7 3회 반복` | **`Step 0-C2 3회 반복`** |
| 5 | §12-2 「폴백 발동 기준에 동의하는가?」 | `Step 0-2(WDA 서명)` | **`Step 0-I1(WDA 서명)`** |
| 6 | §14 B-3 행 처리란 | `Step 0-4로 선제 설정` | **`Step 0-I2로 선제 설정`** |
| 7 | §14 C-1 행 처리란 | `Step 0-2에 추가` | **`Step 0-I1에 추가`** |
| 8 | §14 C-2 행 처리란 | `Step 0-7 신설` | **`Step 0-C2 신설`** |

> 참고: `Step 0-1`~`0-7`은 개정 후 **하나도 존재하지 않는다.** 문서 전체에서 `Step 0-` 뒤에 숫자만 오는 표기를 찾아 전부 치환하면 된다(`0-0`은 유효).

---

<a id="n-6"></a>
## 5. 플랫폼 전환 미반영 3곳 (데모 최소선이 Android로 바뀐 결과)

**위치**: §10 「🎯 수요일 데모 최소선」 + Phase 1 제목

| # | 현재 | 수정안 | 이유 |
|:---:|---|---|---|
| 1 | "워커가 브라우저 대신 **iPhone**을 구동하기만 하면" | "워커가 브라우저 대신 **에뮬레이터/기기**를 구동하기만 하면" | 최소선은 Android 트랙인데 iPhone이라 적혀 있다 |
| 2 | "화면 중계는 **QuickTime USB 미러링**으로 대체 (Phase 2 불필요)" | "화면 중계는 **Android 에뮬레이터 창을 그대로 노출**해 대체(iOS 실기기라면 QuickTime USB 미러링). Phase 2 불필요" | **Android는 에뮬레이터 창이 그냥 보인다.** QuickTime은 iOS 실기기 전용 |
| 3 | `### Phase 1 — 안전장치 + Driver 추상화 + iOS 드라이버` | `### Phase 1 — 안전장치 + Driver 추상화 + 모바일 드라이버` | Step 2가 "Android·iOS 공용 1파일"로 바뀌었다 |

---

## 6. 판단이 갈리는 지점

<a id="s-1"></a>
### S-1 ⚠️ Android 포함은 방향은 맞다. 그러나 "둘 다 동등"은 2일에 안 맞는다

> **한줄요약: 1차 리뷰의 D-1은 "Android를 하라"가 아니라 "제외 근거가 틀렸다"였다. 과잉 수용일 수 있다.**

**근거 1 — 문서가 스스로 인정한다.** §0-1: *"설치·검증이 각각 필요하므로 환경 세팅 시간은 대략 2배다. 코드가 싼 것이지 세팅이 싼 게 아니다."* 2일에 툴체인 2벌(Xcode 10~15GB + WDA 서명 + 실기기 / Android SDK + ARM64 이미지 + AVD + Google 계정)을 세우면 **양쪽 다 미완으로 끝날 위험**이 실재한다.

**근거 2 — 문서 안에서 우선순위가 두 가지로 말해진다.**

| 위치 | 말하는 내용 |
|---|---|
| §0-1 우선순위 행 | "① iOS·**Android 둘 다**" (동등) |
| §10 Phase 0 도입부 | "**Android를 선행한다**" |
| §10 데모 최소선 | "Android를 먼저 확보해 데모를 보장하고, **iOS는 시간이 남는 만큼**" |

**수정안 — §0-1 확정 스코프 표의 우선순위 행을 교체**
```
현재: | 우선순위 | **① iOS·Android 테스트 자동화 → ② 실행 화면을 웹에서 보기 → ③ 백그라운드 전환** |

수정: | 우선순위 | **수요일 데모 = Android 단독 확정.** iOS는 데모 후 Phase 1-b로 이월
             (드라이버 속성 매핑 스위치만 추가하면 되는 구조로 Step 2에서 미리 설계).
             이후 ② 실행 화면을 웹에서 보기 → ③ 백그라운드 전환 |
```

**면접 서사는 손해가 아니다.** "Android로 먼저 증명했고, iOS는 드라이버의 속성 매핑만 갈아끼우면 되는 구조로 설계했다"는 게 오히려 **설계 능력을 보여주는 이야기**다. 반대로 "둘 다 동등"으로 남기면 이틀 내내 양쪽을 오가다 둘 다 못 붙일 위험이 크다.

---

<a id="s-2"></a>
### S-2 §5 `select` 반박 — 개정본이 맞다. 1차 리뷰가 틀렸다 ✅

`<select>`의 옵션 리스트는 브라우저가 OS 위젯으로 그려 DOM에 없고, 그래서 Playwright에 `selectOption()` 전용 API가 존재한다. 웹에서 제거하면 회귀가 난다는 판단이 정확하다. **"웹 유지 + 모바일 미지원 오류 반환 + 프롬프트 단일 유지"** 결론에 동의한다. 반박을 그대로 유지할 것.

**다만 한 줄 추가 권고** — §5 「`select` 처리」 마지막에:
```
> **부수 비용**: 미지원 오류를 history에 남겨 에이전트가 다음 액션에서 우회하게 하는
> 설계는 `MAX_STEP_ACTIONS`(기본 4)를 **1회 소모**한다. select가 필요한 모바일 TC는
> 실질 예산이 3으로 줄어든다 → 모바일 프로파일에서 `MAX_STEP_ACTIONS`를 5~6으로
> 올리는 것을 함께 검토한다.
```

---

<a id="s-3"></a>
### S-3 §9-4 / §14 D-2 — 2-B를 정당화하는 논거 하나가 성립하지 않는다

**위치**: §9-4 「2단계로 쪼갠다」 본문 + §14 D-2 행

**현재**
```
다만 스크린샷 폴링만으로는 부족하다. 요구가 "실제로 클릭하고 움직이는 게 보이는 것"인데
2초 간격 스크린샷은 **슬라이드쇼**지 실시간이 아니다.
```

**무엇이 틀렸나**: **폴링 주기는 상수 하나다.**

```ts
// AgentRunModal.tsx:16
const POLL_INTERVAL_MS = 2000;
```

스크린샷 전용 경로를 300~500ms로 따로 돌리면 초당 2~3프레임이라 "움직이는 게 보인다"에 충분히 근접한다. **"2초라서 안 된다"는 근거는 성립하지 않는다.**

**수정안**
```
다만 스크린샷 폴링에는 상한이 있다. 폴링 주기 자체는 상수이므로
(`AgentRunModal.tsx:16`) 스크린샷 전용 경로를 300~500ms로 낮추면 초당 2~3프레임까지는
올라가지만, 그 이상의 부드러움이나 DOM 상호작용 관전은 캡처 방식으로 불가능하다.
→ 2-B의 정당화는 "2초라서 안 된다"가 아니라 **"초당 10프레임 이상 + DOM 관전"**이다.
   그 요구가 없으면 2-A에서 멈춰도 된다.
```

(2-B 자체를 버리자는 게 아니라, 근거를 실제로 성립하는 것으로 바꾸자는 것이다.)

---

<a id="s-4"></a>
### S-4 Step 0-A1에 단계 하나가 빠졌다

**위치**: §10 Phase 0 「Step 0-A1」

**현재**
```
🚦 **30분 관문: 에뮬레이터에 패스오더가 뜨는가** — Play Store 포함 ARM64 시스템
이미지로 AVD 생성 → 패스오더 설치·실행.
```

**빠진 것**: Play Store에서 앱을 받으려면 **에뮬레이터 안에서 Google 계정 로그인**이 먼저 필요하다. 이 단계가 30분 관문 안에 들어가야 현실적이다.

**수정안**
```
🚦 **30분 관문: 에뮬레이터에 패스오더가 뜨는가** — Play Store 포함 ARM64 시스템
이미지로 AVD 생성 → **에뮬레이터 안에서 Google 계정 로그인** → Play Store에서
패스오더 설치·실행. (계정 로그인이 막히면 APK 사이드로드로 우회 가능하나 출처
문제가 붙으므로 차선으로 둔다.)
```

---

<a id="s-5"></a>
### S-5 Step 0-C2에 통과 기준이 없다

**위치**: §10 Phase 0 「Step 0-C2」

**현재**
```
3회 중 판정이 흔들리면 **라이브 대신 녹화본**으로 전환 결정
```

**문제**: "흔들리면"의 기준이 없다. 3/3 일치인지 2/3인지를 미리 안 정하면 당일에 "2번 됐으니 괜찮겠지"로 흘러간다.

**수정안**
```
**통과선: 동일 TC 3회 실행에서 verdict가 3/3 일치.** 2/3 이하면 라이브 데모를
포기하고 성공한 실행의 **녹화본**으로 전환한다. 이 기준은 실행 전에 확정하며,
당일에 완화하지 않는다.
```

---

## 7. 수정 체크리스트

작업 순서대로. 1~3그룹은 합쳐 20분.

**그룹 1 — 즉시 (5분)**
- [ ] N-3: Step 0-I2 문구 교체 (`waitForIdleTimeout=0` + `updateSettings` 코드블록, `snapshotMaxDepth` 추가)
- [ ] N-3: §11 리스크 표 「iOS 기본 대기 설정…」 대응란 교체

**그룹 2 — 즉시 (10분)**
- [ ] N-1: §0-1 「사후 차단」 불릿 + §10 Step 1-K 문구 교체 (안 A)
- [ ] N-1: §10 데모 최소선 「백엔드·프론트 변경은 [중지] 버튼 하나뿐」 문장 교체
- [ ] N-2: Step 1-K에 "중단 시 진행 중 TC 결과 미기록" 주석 추가

**그룹 3 — 즉시 (5분)**
- [ ] S-1: §0-1 확정 스코프 표 「우선순위」 행 교체 (수요일 = Android 단독)

**그룹 4 — 정합성 (30분)**
- [ ] N-4: Step 참조 8곳 치환 (표 §4 참조)
- [ ] N-5a: §3 Node 버전 문구 교체
- [ ] N-5b: §9-1 첫 문단 교체
- [ ] N-5c: §9-4 「채택」 소제목 → 「2-B 상세 설계」 강등 + 순서 주석
- [ ] N-6: 데모 최소선 iPhone → 에뮬레이터/기기, QuickTime → 에뮬레이터 창, Phase 1 제목 → 모바일 드라이버

**그룹 5 — 보완 (20분)**
- [ ] S-2: §5에 `MAX_STEP_ACTIONS` 부수 비용 주석 추가
- [ ] S-3: §9-4 / §14 D-2의 2-B 정당화 논거 교체
- [ ] S-4: Step 0-A1에 Google 계정 로그인 단계 추가
- [ ] S-5: Step 0-C2에 통과선 3/3 명시

---

## 8. 참조

### 코드 근거 (2026-08-24 실물 대조)
- `agent-worker/src/agent.js:191, 265, 283, 286, 290, 322, 347, 355, 365` — `page.url()` 9곳
- `agent-worker/src/index.js:71-73` — baseUrl 필수 가드 / `:94-101` — catch → `complete(FAILED)`
- `backend/.../AgentExecutionServiceImpl.java:78-86` — `cancelJob` / `:115` — `claimJob` idempotent / `:125-127` — `recordResult` RUNNING 가드 / `:158-160` — `completeJob` DONE·FAILED 전용
- `frontend/src/components/features/AgentRunModal.tsx:16` — `POLL_INTERVAL_MS = 2000` / `:106, 200` — 닫기 버튼만 존재

### 외부 출처
- [Appium XCUITest Driver — Capabilities (master)](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/reference/capabilities.md) — `waitForQuiescence` **부재**, `appium:waitForIdleTimeout` 기본 10초
- [Appium XCUITest Driver — Settings (master)](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/reference/settings.md) — `snapshotMaxDepth` 기본 50, `animationCoolOffTimeout` 기본 2초, `waitForIdleTimeout` 기본 10초
- [Appium 2→3 마이그레이션 가이드](https://appium.io/docs/en/3.1/guides/migrating-2-to-3/) — Node `^20.19.0 || ^22.12.0 || >=24.0.0`, npm 10+

### 관련 문서
- [registry_v24.md](./registry_v24.md) — 대상 문서
- [registry_v24_review.md](./registry_v24_review.md) — 1차 리뷰
