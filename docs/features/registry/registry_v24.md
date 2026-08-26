# Registry v24 — Android 테스트 자동화

> 변경 유형: 기능 추가  
> 작성일: 2026-08-25  
> 버전: v24  
> 상태: 완료 (Step 1~6·8 구현·개발서버 검증 완료 / Step 7 미실시 — §8 참조)

---

## 0. 목표

**자연어로 작성된 TC를 AI가 Android 앱에서 직접 실행하고 판정한다.**

기존 웹(Playwright) 에이전트 실행 엔진(v20)의 관측·액션 층만 Appium(UiAutomator2)으로 교체한다. 액션 결정·판정 프롬프트, Job 도메인, TestResult 기록, 프론트 UI는 **그대로 재사용**한다.

### 스코프

| 포함 | 제외 (별도 버전으로 이연) |
|------|--------------------------|
| Android 실행 (에뮬레이터) | **iOS** — 환경 블로커, 아래 참조 |
| 단건 + **다건 배치** 실행 | 웹 UI 모달 안 실행 화면 보기 |
| `key` 액션 (검색 제출 등) | 백그라운드 전환 토글 |
| Segment Path → 전제조건 네비게이션 | Driver 추상화 리팩터 |
| **개발서버** 연결 | 프로덕션 연결 · 디바이스 팜 |

> **iOS 제외 사유**: macOS 15.7.4는 Xcode 16.x가 상한이고 그 DeviceSupport는 iOS 18까지인데, 보유 기기는 **iOS 26.6**이다. App Store의 Xcode 26.x는 macOS 26.2를 요구해 설치조차 불가. 서명 방식으로 우회할 수 없는 **메이저 버전 격차**다. 전체 분석은 [registry_v24_original.md](./registry_v24_original.md) §17 참조.

> **실행 화면 보기 제외 사유**: Xvfb+noVNC는 macOS의 Android 에뮬레이터에 통하지 않는다. 스크린샷 스트림 방식이 맞는 길이며 별도 작업으로 이연한다. **데모에서는 에뮬레이터 창을 그대로 보여준다**(코드 0줄).

---

## 1. Phase 0에서 증명된 것 (2026-08-24~25 실측)

**핵심 가설이 실증됐다: 웹용 프롬프트가 한 글자도 고치지 않고 네이티브에서 동작한다.**

`ACTION_SYSTEM`/`JUDGE_SYSTEM`(`agent-worker/src/agent.js:221`, `:239`)을 원문 그대로 쓰고 관측·액션만 Appium으로 바꿔 실제 패스오더 앱에서 gold TC를 실행했다.

| TC | 내용 | 판정 | 원인 |
|----|------|:---:|------|
| 1 | 검색창 터치 시, 검색 전 페이지 진입 | ✅ **PASS** | — |
| 2 | 목록의 매장 터치 시, 매장 상세 진입 | ❌ FAIL | 엔진이 **Segment Path 미전달** (§4) |
| 3 | 검색 후 최근 검색 이력 (5 step) | ❌ FAIL | 액션 어휘에 **키 입력 없음** (§3) |
| 4 | TC-2 + 전제조건 step (대조군) | ✅ **PASS** | path가 할 일을 수동 대행 |

**TC 3건 모두 결함이 없었다.** 실패 2건은 전부 엔진 누락이며, 그 둘이 이 버전의 핵심 구현 과제다.

**Phase 0 범위에서는 판정기가 거짓 PASS를 내지 않았다.** 실패는 전부 정직하게 FAIL/INCONCLUSIVE로 떨어졌다.

> ⚠️ **이 문장은 구현 후 실측에서 뒤집혔다.** 개발서버 실행 중 거짓 PASS 2건이 드러났다(아래 「구현 후 개발서버 실측」). Phase 0의 4개 TC가 그 조건을 밟지 않았을 뿐이며, "판정기는 믿을 만하다"의 근거로 이 줄을 인용하면 안 된다.

**에이전트가 권한 다이얼로그를 스스로 처리했다** — TC-1 중 위치 권한 요청이 뜨자 인식하고 넘어갔다. 단, 프롬프트가 "목표 달성"에 최적화돼 **스스로 허용**하므로 권한을 거부해야 하는 TC는 step에 명시해야 한다.

### 검증된 환경

| 항목 | 버전 |
|------|------|
| Node | **v20.20.2** (Appium 3 요구: `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`) |
| Appium | **3.6.0** |
| 드라이버 | **uiautomator2@8.5.0** |
| webdriverio | **9.31.2** |
| AVD | `v24-android34` (pixel_7, `android-34;google_apis_playstore;arm64-v8a`, RAM 4G) |
| 대상 앱 | `com.paytalab.mkseo.passorder` — 네이티브 Android (Flutter 아님), 에뮬레이터에서 정상 실행 |

> ⚠️ **`npm`은 PATH의 node를 탄다.** nvm 절대경로로 `npm`을 호출해도 시스템 v18.16.0으로 떨어져 Appium 3 요구를 위반한다. PATH 선행 고정이 필수.

### 성능 실측

| 항목 | 값 |
|------|-----|
| `getPageSource` 지연 | **123 / 165 / 250 ms** |
| 세션 생성 | 10.3초 (job당 1회) |
| 노드 필터링 | 142 → 37 후보 (26%) |
| 토큰 | 원문 ~14,719 → JSON **~1,611** (8.9배 절감) |
| step당 | **10~25초 / 6~10k 토큰** (Haiku) |

---

## 1-1. 구현 후 개발서버 실측 (2026-08-25)

Step 1~6·8 구현을 마치고 개발서버(백엔드 :8080)에 로컬 Mac 워커를 붙여 실행한 결과다.

### 실행 결과

| Job | 범위 | 결과 | 비고 |
|-----|------|------|------|
| 85 | 단건 | PASS | 첫 개발서버 연결 성공 |
| 86 | 배치 2건 | **2/2 PASS** | `executed_by=AGENT` + 증적 연결 확인 |
| 97 | 단건 | PASS | 10,327 토큰 |
| 99 | 단건 (TC 3470 매장 상세) | PASS | 44.1초 / 13,061 토큰 |

- **중단**: claim 전 취소·실행 중 취소 두 경로 모두 검증.
- **Step 8**(`execTargetKind`): 워커 오배치 차단·폴링 건너뜀·프로파일 UI 3개 기준 모두 검증.
- **비용**: TC 1건당 약 $0.018(≈26원). 100건 Phase 전체를 돌려도 $2 수준이라 병목은 비용이 아니라 에뮬레이터 속도다.

### 판정 결함 2건 — 거짓 PASS (수정 완료)

Phase 0에서 관측되지 않았던 결함이 실사용에서 즉시 드러났다. **둘 다 판정기가 화면이 아니라 `location()` 문자열을 신뢰해서 생긴 같은 뿌리의 결함이다.**

| # | 증상 | 근본 원인 | 수정 |
|---|------|-----------|------|
| 1 | 런처(앱 밖)에 있는데 PASS | `location()`이 `cfg.appPackage`를 **하드코딩**해, 실제 어느 앱에 있든 대상 앱으로 보고 | `getCurrentPackage()`로 실제 패키지 조회 → `(대상 앱 밖)` 표기, `enter()`에서 `activateApp()`, 스냅샷 시 재활성화, 판정 규칙에 "앱 밖이면 PASS 금지, INCONCLUSIVE" 추가 |
| 2 | ANR 다이얼로그가 떠 있는데 PASS | 에이전트가 *"크래시 다이얼로그만 보이지만 URL 상으로는 목표 화면 도달"*이라고 명시하고도 PASS | `detectSystemAlert()` 추가 → `(앱 응답 없음/크래시 다이얼로그)` 표기, 판정 규칙에 FAIL 강제 |

> **교훈**: 웹에서 `page.url()`은 화면과 강하게 연동되지만, 네이티브에서 패키지·액티비티명은 **화면 위에 무엇이 떠 있는지를 말해주지 않는다.** 시스템 다이얼로그·앱 이탈은 location으로 드러나지 않으므로 별도 관측이 필요하다.

### 환경 결함 3건

| # | 증상 | 진단 | 조치 |
|---|------|------|------|
| 1 | 지도·매장 검색이 "주소를 불러올 수 없습니다" | **속도 문제가 아니라 DNS 불일치.** 에뮬레이터는 부팅 시점의 DNS를 고정 보관하고 스냅샷이 그 낡은 설정을 얼린다. 에뮬레이터는 `1.214.68.2, 61.41.153.2`를 들고 있었고 Mac의 실제 DNS는 `168.126.63.1` | `-dns-server 168.126.63.1,8.8.8.8`로 재기동 → `dumpsys connectivity`에 `VALIDATED` 확인 |
| 2 | `System UI isn't responding` ANR 반복 | **호스트 메모리 고갈** (free 0.1GB, compressed 7.9GB, pageouts 4.77M). AVD RAM을 4G로 올린 것이 악화 요인 | RAM 3072 / heap 384 / GPU host로 하향 |
| 3 | 재기동 시 `Running multiple emulators with the same AVD` | 죽은 qemu 프로세스가 AVD 락을 쥐고 있었음 | 프로세스 정리 후 재기동 |

> DNS 건은 **증상이 원인을 오도한 사례**다. "느려서 그렇다"로 넘어갔다면 에뮬레이터 사양만 계속 올렸을 것이다.

### 제품 결함 (미수정)

- `VersionDto.PhaseRequest.testRunIds`가 null이면 NPE. 이번 작업과 무관한 기존 결함이라 손대지 않았다.

---

## 2. 관측 — Android UI 트리를 웹 스냅샷과 같은 JSON으로

`getPageSource()`(XML) → 기존 웹 `snapshotInteractive`가 만들던 것과 **동일한 스키마**로 변환한다.

| 우리 필드 | Android 속성 |
|-----------|--------------|
| `role` / `tag` | `class` (`android.widget.Button` → `button`) |
| `name` | `text` ‖ `content-desc` ‖ (아래 3패턴) |
| `value` | EditText의 `text` |
| `testId` | `resource-id` |
| **`clickable`** | `clickable` — 웹의 cursor 휴리스틱이 불필요해진다 |
| **`enabled`** | `enabled` |
| **`scrollable`** | `scrollable` |

**후보 조건**: `displayed && (clickable || editable || scrollable)`

### 이름 해석 — 3가지 패턴을 모두 처리해야 한다

1. **자기 텍스트** — `text` 또는 `content-desc`
2. **라벨이 자식에** — 클릭 가능한 컨테이너의 `text`가 비고 자식 `TextView`에 라벨. → 자손 텍스트 수집. 단 **자식이 그 자체로 clickable이면 제외**(대상이 섞인다)
3. **라벨이 형제에** ⚠️ — 보이지 않는 clickable View가 라벨 View 위에 겹쳐 있다. **자식도 조상도 아니라 트리 탐색으로는 못 찾는다.** → **bounds 겹침**으로 해결: 라벨 박스의 80% 이상이 후보 박스에 들어오면 그 이름으로 채택(4개 초과 겹치면 화면 전체 컨테이너이므로 제외)

> **3번이 없으면 이름 있는 후보가 4/37, 있으면 28/37이다.** `재주문`·`쿠폰함`·`포인트/스탬프`·`사다리타기`·`경유매장찾기`·`선물하기`가 전부 무명이 되어 에이전트가 지목조차 못 한다.

**스크롤 컨테이너 이름 오염**: `scrollable && !clickable`이면 자손 텍스트를 모으지 않는다. 안 그러면 화면의 모든 글자가 이름 하나로 뭉친다.

### locator — xpath 폴백이 필수다

| 우선순위 | 전략 | 실제 화면 분포 |
|:---:|------|:---:|
| 1 | `resource-id` | 17/37 |
| 2 | `accessibility id` (content-desc) | 소수 |
| 3 | **xpath** (취약) | **20/37** |
| 4 | **좌표 탭** (최후 폴백) | — |

**실제 콘텐츠 화면에서는 절반 이상이 xpath뿐이다.** `resource-id`가 없는 동적 리스트 항목이 많기 때문. → **locator 실패 시 name/testId로 재조회**하고, 그래도 실패하면 **bounds 중심 좌표 탭**으로 폴백한다.

> 🐛 **xpath 색인 주의**: xpath는 **같은 태그 이름을 가진 형제 중 몇 번째**로 센다. `index` 속성(전체 형제 기준)을 그대로 쓰면 Appium과 어긋난다 — Phase 0에서 실측된 버그.

> 🐛 **`displayed` 속성 부재**: raw `adb shell uiautomator dump`에는 `displayed`가 없고 Appium `getPageSource`에는 있다. 없으면 **`bounds` 면적으로 폴백**해야 두 경로 모두에서 동작한다.

---

## 3. 액션 — 키 입력을 추가한다

현재 어휘: `click | fill | select | navigate | done`

| 액션 | Android 매핑 | 조치 |
|------|-------------|------|
| `click` | `element.click()` / 실패 시 `mobile: clickGesture` 좌표 | 좌표 폴백 유지 |
| `fill` | `element.setValue()` / 실패 시 **탭 후 `mobile: type`** | 🐛 **좌표 폴백 추가** — 없어서 TC-3이 전수 실패했다 |
| **`key`** 🆕 | `Enter` / `Search`(IME) / `Back` | **신규 — TC-3 실패의 직접 원인** |
| `back` 🆕 | `driver.back()` | 신규 |
| `scroll` 🆕 | `mobile: scrollGesture` | 신규 — 가상화 리스트 대응 |
| `select` | **대응물 없음** | 웹은 유지, 모바일은 미지원 오류 반환 |
| `navigate` | URL 개념 없음 | 미지원 오류 반환 |

> **`key`가 왜 필수인가**: `fill`로 텍스트만 넣으면 **검색이 실행되지 않는다.** 실측으로 확인 — `adb shell input keyevent 66`(ENTER)을 보내야 `'starbucks'에 관한 검색 결과가 없어요`가 뜬다. 검색이 제출돼야 최근 검색어에도 저장된다. 웹에서는 폼 자동 제출이나 DOM 버튼이 있어 드러나지 않던 결함이다.

> **`select` 미지원 처리의 부수 비용**: 미지원 오류를 history에 남겨 우회시키는 설계는 `MAX_STEP_ACTIONS`(기본 4)를 1회 소모한다. 모바일 프로파일은 **5~6으로 상향**을 검토한다.

### `page.url()` 9곳 → `driver.location()`

네이티브에는 URL이 없다. `getUrl()`은 UiAutomator2에서 `Method has not yet been implemented`로 실패한다(실측). → **현재 액티비티**를 "사람이 읽을 수 있는 한 줄"로 반환하는 `location()`으로 치환한다. 부수 효과로 `stepLogs.observed`가 의미 있는 값을 갖는다.

해당 위치: `agent.js:191, 265, 283, 286, 290, 322, 347, 355, 365`

---

## 4. Segment Path를 전제조건으로 전달한다 (TC-2 실패의 원인)

Registry의 정보 구조에서 **TC의 위치가 전제조건을 선언한다**:

```
검색창  →  검색 전 화면  →  나와 가까운 매장 목록
                                └─ [TC 3412] 목록의 매장 터치 시, 매장 상세 진입
```

작성자는 "나와 가까운 매장 목록이 출력된 상태"를 path로 명시했고, step에 중복 기재하지 않는 것이 이 레포의 컨벤션이다.

**그런데 엔진이 그 정보를 워커에 보내지 않는다:**

```java
// AgentExecutionDto.java:104-108 — path가 빠져 있다
return new TestCaseContext(
        e.getId(), e.getTitle(), e.getPreconditions(),
        e.getSteps(), e.getExpectedResults());
```

`TestCaseEntity:29`에 `Long[] path`가 있는데 누락된다. 에이전트는 자기가 어디서 시작해야 하는지 모른 채 "앱이 마침 떠 있는 화면"에서 실행한다.

**구현**
1. 백엔드: `TestCaseContext`에 **`segmentPath`(세그먼트 이름 배열)** 추가. ID 배열은 LLM에 무의미하므로 이름으로 해석해 실을 것
2. 워커: TC step 실행 **전에** path를 목표로 `agenticGoal`(`agent.js:278`) 수행 → 해당 화면에 도달. Product 단위 고정 `seedNote`를 **TC 단위 path**로 대체·확장

> 시작 상태의 네 축 중 앞의 셋(권한·로그인·위치)은 기기/계정 상태라 스냅샷으로 고정되지만, **path는 앱 내 화면 위치**라 TC마다 달라 반드시 실행 시 네비게이션으로 도달해야 한다.

---

## 5. 시작 상태 관리

### AVD 스냅샷 (확보됨, 각 ~3.8GB)

| 스냅샷 | 권한 | 로그인 | 위치 | 프로모션 |
|--------|:---:|:---:|:---:|:---:|
| `pre-login` | 처리됨 | ✗ | ✗ | — |
| `base` | 처리됨 | ✓ | ✗ | 미정리 |
| **`base-located`** | 처리됨 | ✓ | ✓ 송파구 | 정리됨 ← **기본 시작점** |

```
adb emu avd snapshot save/load <name>
emulator -avd v24-android34 -snapshot <name>
```

> **Quick Boot과 다르다.** `fastboot.forceFastBoot=yes`의 Quick Boot은 종료할 때마다 자동으로 덮어써져 반복 실행의 시작점이 될 수 없다. **명시적 스냅샷만이 재현 가능한 시작점이다.**

> ⚠️ **서버 상태는 롤백되지 않는다.** 스냅샷은 기기만 복원한다. TC가 서버에 만든 것(주문·장바구니)은 남는다. 읽기 전용 TC에서는 무해하지만 쓰기 동작에서는 격리를 보장하지 않는다.

### 위치 — 시작 상태의 세 번째 축

에뮬레이터 기본 좌표는 **`37.421998, -122.084000`(구글 본사)**다. 위치가 "없는" 게 아니라 **패스오더 매장이 없는 곳**이라 목록이 빈다.

> ⚠️ **`adb emu geo fix`가 동작하지 않는다.** 콘솔 인증(`~/.emulator_console_auth_token`)을 거쳐 보내도 **OK를 반환하면서 좌표가 갱신되지 않는다**(25회 반복·앱 재기동 포함). **Extended Controls(`⋯`) → Location → SET LOCATION** GUI로만 반영됐다. 자동 주입은 후속 과제.

### 프로모션 모달 12개

로그인 후 홈 진입 시 캐러셀형 프로모션이 연달아 뜬다. **`일주일 동안 보지 않기` 체크 후 `닫기`**를 눌러야 일괄 해소된다(체크박스만 누르면 안 닫힘).

---

## 6. 안전 규칙

패스오더는 **실제 주문·결제가 일어나는 상용 서비스**다.

**사전 예방**
- ✅ 읽기 전용 TC만 — 매장 검색, 상세 진입, 메뉴 조회
- ❌ **장바구니 이후 단계·결제 화면 접근 금지**
- ✅ 결제 수단 해제 권장
- ⚠️ **재로그인 금지** — 이미 로그인된 상태에서 시작한다. v20 B2-1에서 `seedNote`가 끝난 로그인을 또 시켜 액션 예산을 소진한 사고가 있었다

**사후 차단 — 실행 중단 수단이 없다 (구현 필요)**

| 계층 | 현 상태 |
|------|---------|
| 프론트 | **중지 버튼 없음** — `닫기`는 모달만 닫고 워커는 계속 돈다 (`AgentRunModal.tsx:106, 200`) |
| 백엔드 | `cancelJob`은 **DB 상태만** 변경 (`AgentExecutionServiceImpl:78-86`) |
| 워커 | TC 목록을 **끝까지 순회**, 중간에 상태 재확인 없음 (`index.js:78-90`) |

> 🛑 **`complete(CANCELLED)`를 보고하면 안 된다.** `completeJob`은 DONE/FAILED만 허용하므로(`:157-160`) 예외가 나고, 그 예외가 `index.js:97`의 `complete(FAILED)`로 흘러가 **CANCELLED를 FAILED로 덮어쓴다.** → 워커에 전용 `CancelledError`를 두고 **아무 보고 없이 종료**한다.
>
> 중단 시 **이미 실행에 들어간 TC의 결과는 기록되지 않는다** — `recordResult`가 RUNNING을 요구하기 때문(`:125-127`). 의도된 동작이나 모르면 디버깅 시간을 날린다.

**물리적 최후 수단**: 에뮬레이터 종료. 데모 전 리허설해 둘 것.

---

## 7. 권한 다이얼로그도 TC 대상이다

"알림 권한을 거부하면 X가 표시된다" 같은 것은 정당한 TC다. 매핑은 이미 통과한다 — `permission_allow_foreground_only_button`, `permission_deny_button` 등이 전부 `resource-id`로 잡힌다.

**설계 함정 3가지**

1. ❌ **스냅샷에 `appPackage` 필터 금지** — 권한 다이얼로그는 **`com.android.permissioncontroller`** 패키지다. 필터를 걸면 다이얼로그가 통째로 안 보이고 에이전트는 "화면에 아무것도 없다"며 실패한다. 성능을 이유로 필터를 넣기 쉬운 자리라 명시적으로 금지한다
2. ❌ **`autoGrantPermissions` 기본 활성화 금지** — 켜면 다이얼로그가 아예 안 떠 검증 대상이 사라진다. 실행 프로파일 옵션으로만 노출
3. ⚠️ **권한 TC는 시작 상태가 다르다** — 권한은 한 번 처리하면 다시 묻지 않는다. `pm reset-permissions` 전처리 또는 별도 스냅샷 필요

---

## 8. 구현 절차 (User 승인 단위)

> Driver 추상화(원본 문서 Phase 1 Step 1)는 **하지 않는다.** `runTestCase` 상단 얇은 분기로 간다 — 웹 gold TC 5건 회귀에 반나절이 드는데 Android 경로에는 웹이 한 번도 쓰이지 않는다.

- [x] ✅ **Step 1** — 워커 모바일 드라이버 이식
  - `agent-worker/package.json`에 `webdriverio`, `fast-xml-parser` 추가
  - `agent-worker/src/drivers/mobile.js` 신규 — §2의 매핑(3패턴 이름 해석·bounds 겹침·locator 폴백) + 액션 실행
  - `agent.js` `runTestCase` 상단 얇은 분기, `index.js` 대상 종류 env 분기(모바일이면 브라우저 미기동)
- [x] ✅ **Step 2** — `key` 액션 추가 (§3) + `ACTION_SYSTEM`에 한 줄 + `fill` 좌표 폴백
- [x] ✅ **Step 3** — `page.url()` 9곳 → `driver.location()` + `ctx.baseUrl` 필수 검사 완화(`index.js:71-73`이 baseUrl 없으면 throw라 모바일 Product는 시작조차 못 한다)
- [x] ✅ **Step 4** — Segment Path 전달·수행 (§4) — 백엔드 `TestCaseContext.segmentPath` + 워커 선행 네비게이션
- [x] ✅ **Step 5** — 🛑 **실행 중단 수단** (§6) — 워커 상태 폴링 + `CancelledError` 분기, `AgentRunModal`에 **[중지]** 버튼
- [x] ✅ **Step 6** — **개발서버 연결** + 스모크
  - 워커를 로컬 Mac에서 실행(에뮬레이터가 Mac에 있으므로 Docker 아님), `BACKEND_URL`을 개발서버로
  - **단건 + 다건 배치** 모두 확인. 배치는 기존 `for (const tc of ctx.testCases)` 루프가 이미 처리한다
- [ ] ⏸ **Step 7** — 결정성 검증 — **미실시 (2026-08-25 중단 결정)**
  - 원안: 동일 TC 3회 실행에서 verdict 3/3 일치, 2/3 이하면 라이브 대신 녹화본
  - **중단 사유**: 후보였던 TC 3470이 단일 step이라 3/3이 나와도 증명력이 약하다. 판정 변동성은 step이 쌓이는 흐름(TC-3 같은 5-step)에 있으므로, 단순 TC의 3/3은 "흔들리지 않는다"의 근거가 되지 못한다. 통과선을 완화한 것이 아니라 **측정 대상이 부적절해 항목 자체를 접었다**
  - **대체**: 실사용 반복 실행에서 관찰. 결정성을 정식으로 재려면 다중 step TC를 대상으로 별도 수행한다
  - ⚠️ 이 결정으로 **라이브 실행의 1회성 리스크는 해소되지 않은 채 남아 있다** (§9 리스크 표 참조)

---

## 8-1. Step 8 — 실행 대상 종류를 제품이 선언한다 (✅ 완료)

> 이연 항목이었으나 **실사용에서 곧바로 문제가 드러나 승격**했다(2026-08-25).

### 배경 — 왜 지금 필요한가

`[AI 시험 실행]`을 눌러도 **UI가 "웹이냐 앱이냐"를 묻지 않는다.** 물어볼 자리가 없기 때문이다 — 대상 종류가 워커의 환경변수(`TARGET_KIND`)로만 존재하고 제품에는 선언되어 있지 않다.

현재 분리 수단은 `POLL_PRODUCT_ID` 하나뿐이다:

```
ANDROID 워커  ← POLL_PRODUCT_ID=2750 → 패스오더 job만
WEB 워커      ← POLL_PRODUCT_ID=1119 → my-atlas job만
```

**문제 3가지**
1. **UI가 물을 수 없다** — 답을 저장할 필드가 없다
2. **워커를 잘못 붙이면 조용히 망가진다** — Android 워커에 `POLL_PRODUCT_ID=1119`(my-atlas, 웹 전용)를 주면 웹 TC를 에뮬레이터에서 실행하려 든다. 막는 코드가 없다
3. **워커 2종 동시 기동이 위험하다** — `claimJob`은 이미 RUNNING인 job도 성공으로 돌려주므로(idempotent, `AgentExecutionServiceImpl:117`) 둘 다 같은 Job을 집어갈 수 있다 (원본 문서 리뷰 B-1)

### 설계

**1) `product.exec_target_kind` 신설** — `WEB | ANDROID | IOS`, 기본 `WEB`

> ⚠️ **기존 `product.platform`을 재사용하지 않는다.** `platform`(`WEB/DESKTOP/MOBILE/ETC`)은 **제품 분류 메타데이터**이고, 한 제품이 웹과 앱을 동시에 가질 수 있다. 실행 대상은 별개 개념이다. (원본 문서 §9-2에서 이미 결정한 사항)

**2) `WorkerContextResponse.execTargetKind`** — 워커가 job을 집기 전에 알 수 있어야 한다.

**3) 워커가 자기 담당이 아닌 job은 집지 않는다** — 핵심.
- 폴링 모드: job 목록에서 대상 종류가 다르면 **claim 자체를 건너뛴다**
- 단건 모드: 불일치면 즉시 에러로 중단(오배치를 조용히 넘기지 않는다)
- 이러면 워커 2종을 동시에 띄워도 서로 남의 job을 안 건드려 **문제 3이 함께 해결**된다

> 대상 종류는 **job 목록 응답**에도 있어야 claim 전에 거를 수 있다. `JobResponse`에 추가한다.

**4) 프론트 `ExecProfileModal`에 대상 종류 셀렉트** — 사용자가 제품 단위로 한 번 정한다. TC마다 묻지 않는다(같은 제품의 TC는 같은 대상에서 돈다).

**5) `TARGET_KIND` env는 "이 워커가 구동할 수 있는 종류"로 의미를 바꾼다** — 제품이 대상을 선언하고, 워커는 자기 능력을 선언한다. 둘이 맞을 때만 실행된다.

### 작업 단위

- [x] ✅ **8-1** 마이그레이션 `V202608252140__add_product_exec_target_kind.sql` — `exec_target_kind varchar(20) not null default 'WEB'`
- [x] ✅ **8-2** `ProductEntity.execTargetKind` + `ExecTargetKind` enum + `ProductDto`/`setExecProfile` 반영
- [x] ✅ **8-3** `AgentExecutionDto`: `JobResponse.execTargetKind`, `WorkerContextResponse.execTargetKind`
- [x] ✅ **8-4** 워커: 폴링 시 불일치 job 건너뛰기, 단건 시 불일치면 중단
- [x] ✅ **8-5** 프론트: `ExecProfileModal` 셀렉트 + 타입
- [x] ✅ **8-6** 검증 — 웹 제품 job에 Android 워커를 붙여 **집어가지 않는 것** 확인, 그 반대도 확인

### 검증 기준

1. Android 워커 기동 상태에서 **웹 제품(1119) job 생성** → 워커가 집지 않고 PENDING 유지
2. Android 워커 기동 상태에서 **Android 제품(2750) job 생성** → 정상 실행
3. 단건 모드로 불일치 job을 직접 지정 → 명확한 에러로 중단(조용한 실패 없음)

### 리스크

| 리스크 | 대응 |
|--------|------|
| 기존 제품이 전부 WEB으로 기본값 → 웹 워커 동작 불변 | default 'WEB'로 마이그레이션 (기존 데이터 호환) |
| 대상 종류를 안 고른 모바일 제품이 웹으로 실행됨 | `ExecProfileModal`에서 명시 선택. 워커가 불일치를 에러로 알림 |
| `JobResponse` 필드 추가로 프론트 타입 불일치 | optional 필드로 추가, 기존 화면 무영향 |

---

### 이연 (별도 버전)

- 웹 UI 모달 안 실행 화면 보기 (스크린샷 스트림) + 백그라운드 전환
- iOS (XCUITest) — 환경 블로커 해소 후
- Driver 추상화 리팩터
- 위치 자동 주입 (`geo fix` 미동작 해결)

---

## 9. 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 🛑 실행 중단 수단 부재 | 상용 결제 앱에서 오작동을 못 멈춤 | ✅ 해소 — Step 5 구현, 취소 2경로 검증 (§1-1) |
| 🎲 판정 비결정성 미검증 | 라이브 1회 실행에서 흔들리면 복구 불가 | ⚠️ **미해소** — Step 7을 접었으므로 이 리스크는 그대로 남는다. 다중 step TC 대상 별도 측정 필요 |
| 🕳 판정기가 화면이 아닌 location을 신뢰 | 거짓 PASS (실측 2건) | ✅ 해소 — 실제 패키지 조회 + 시스템 다이얼로그 탐지 (§1-1). 다만 "location만으로 판정 가능하다"는 가정 자체가 깨졌으므로 유사 사각지대를 계속 의심할 것 |
| 워커가 Mac에서만 돈다 | Mac·에뮬레이터가 꺼지면 실행 불가 | KVM 제약(원본 §7). 제품화는 디바이스 팜 |
| xpath 취약(20/37) | 앱 업데이트 시 조용히 깨짐 | name/testId 재조회 + 좌표 폴백 |
| 빈 TC를 배치로 실행 | 무의미한 실행·토큰 낭비 | **돌릴 Phase를 고르는 것**으로 관리. 기능 제한은 하지 않는다 |
| 위치 자동 주입 불가 | 매장 목록 TC의 시작 상태를 스크립트로 못 만듦 | 당분간 `base-located` 스냅샷 사용 |

---

## 10. 참조

- [registry_v24_original.md](./registry_v24_original.md) — 전체 기술 리서치·iOS 분석·실행 화면 설계·1~3차 리뷰 반영 내역
- [registry_v20.md](./registry_v20.md) — 웹 에이전트 실행 엔진 (이 버전이 확장하는 대상)
- [registry_v21.md](./registry_v21.md) — 자격증명 + 외부 제품 지원
- [registry_v22.md](./registry_v22.md) — 실행 관측성 (스크린샷 증적)
- [registry.md](./registry.md) — 메인 명세서
