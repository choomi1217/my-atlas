# TC 실행 에이전트 엔진 (Agentic Test Execution) 전략 플랜

> 변경 유형: 기능 추가 + 테스트 보강
> 작성일: 2026-07-13
> 버전: v14 (r5 — 실행 문서 분기 확정: registry_v20 + test-studio_v3/v4)
> 상태: 확정 (전략 문서 — 구현은 아래 분기 문서가 소유)

---

## 0. 이 문서의 분기 구조 (r5 확정)

**qa_v14는 전략 문서로 유지되고, 구현은 두 갈래의 기능 버전 문서가 소유한다:**

```
qa_v14 (전략: 비전·기술 조사·시나리오·리스크)
  │
  ├─ [registry_v20] Product Test Suite — 실행·기록
  │     · Phase 0 PoC, 실행 프로파일, 단건 dry run(시나리오 1),
  │       Phase 일괄 실행 + TestResult 자동 기록(시나리오 2, Phase A/E),
  │       CI 결과 수신. 외부 제품(시나리오 4)은 registry_v21+
  │
  └─ [test-studio_v3 / v4] Test Studio — 생성·승격
        · 트랙 T(생성 품질) → v3에 귀속:
            T1(설계 기법·체크리스트 프롬프트 주입)은 v3 Phase 0 Step 2.5로 반영 완료
            T2(self-review)는 v3의 대화형 사전분석 + per-TC revise + 확정 게이트가
            상위 호환으로 흡수 — 별도 구현 불요
        · Phase P(코드 승격) → v4 Phase 4(자동화 코드 생성)와 동일 작업으로 통합:
            v4의 열린 질문 4개에 본 문서 §2 조사 결과가 답함
            (타깃=기존 qa/ Playwright + 공식 generator, 셀렉터=라이브 검증 생성,
             검증 루프=에이전트 실행 이력 기반 승격 기준 + healer, 대상=my-atlas 자신 우선)
            단, 승격 버튼 진입점 UI는 Registry의 TC 상세 화면
        · T3(dry run 연동 품질 지표)는 registry_v20 시나리오 1 출시 후 양쪽 접점
```

**의존 관계**: registry_v20 Phase 0 PoC와 test-studio_v3 Phase 0(컨텍스트 보강+T1)은 병렬 착수 가능. test-studio_v4 Phase 4는 registry_v20의 실행 이력 축적 + v3 완료가 선행 조건.

---

## 1. 확정된 비전

**my-atlas는 "등록된 제품의 TC를 에이전트가 실행하는 범용 실행 엔진"을 갖는다. 검증 실험체 1호는 my-atlas 자신이다.**

r1(자기 테스트 폐루프)에서 확장된 배경: my-atlas 안의 TC는 my-atlas 것만이 아니다. Toss처럼 **코드 접근이 불가능한 외부 제품**의 TC도 담긴다. 이 TC를 자동 실행하려면 코드 생성(Playwright spec) 방식이 아니라, **자연어 TC의 step을 AI가 브라우저에서 즉석 해석·수행하고 Pass/Fail을 판정하는 에이전트 방식**이 필요하다.

### 대상 × 실행 방식 매트릭스

| | my-atlas 자신 (코드 접근 O) | 외부 제품 (코드 접근 X) |
|---|---|---|
| **코드 생성형** (TC→spec→CI) | ✅ 안정·저비용, 반복 실행에 적합 | ❌ 환경 통제 없어 유지보수 불가 |
| **에이전트형** (즉석 해석 실행) | ✅ 가능 — 신뢰성 측정용 실험체 | ⚠️ 가능 — 단, 읽기 전용 안전선 필수 |

두 방식은 배타적이 아니라 **단계**다: 에이전트형으로 실행 → 안정성이 검증된 TC는 코드 생성형으로 "승격"하여 CI에 편입.

### 외부 실서비스 안전선 (변경 불가 원칙)

- ❌ 부작용 있는 step 자동 실행 금지 — 결제, 주문, 계정 변경, 데이터 생성/삭제
- ✅ 읽기 전용 플로우만 — 탐색, 조회, 화면 검증
- 실서비스 약관·부하 문제 존재. 포트폴리오 데모의 외부 대상은 통제 가능한 대상(별도 배포한 샘플 앱 등) 우선

---

## 2. 기술 조사 결과 (2026-07 기준, 출처 검증 완료)

### 2-1. Playwright 공식 생태계 — 최유력 기반

**Playwright MCP** — 브라우저 자동화를 LLM이 호출 가능한 도구(tool)로 노출하는 공식 MCP 서버. 에이전트가 accessibility tree로 페이지를 관찰하고 액션을 결정하는 루프의 표준 브릿지. ([playwright.dev/mcp](https://playwright.dev/mcp/introduction))

**Playwright Test Agents** — 공식 제공 3종 에이전트 ([playwright.dev/docs/test-agents](https://playwright.dev/docs/test-agents)):

| Agent | 역할 |
|-------|------|
| planner | 앱을 탐색하여 **Markdown 테스트 플랜** 생성 (steps + expected results) |
| generator | Markdown 플랜 → Playwright spec 코드 생성 (셀렉터·assertion을 라이브로 검증하며 생성) |
| healer | 실패 테스트 재실행 → UI 변화 감지 → 셀렉터/대기 패치 제안 → 재실행 |

**핵심 발견: planner의 Markdown 플랜 구조가 my-atlas `test_case` 스키마와 사실상 동형이다** (steps[{action, expected}] + expectedResults). 즉 my-atlas의 TC가 planner 산출물의 자리를 그대로 대체할 수 있다 — **my-atlas TC → generator → spec 코드**라는 승격 경로가 공식 도구 체인으로 성립한다. 이건 우리가 억지로 끼워 맞추는 게 아니라 업계 표준 구조에 이미 부합한다는 뜻.

주의: Test Agents는 개발 루프(VS Code/Claude Code) 도구로 설계됨. 제품 기능으로 내장하려면 오케스트레이션을 직접 구현해야 함 (Playwright Agent CLI 존재 확인, 프로그래매틱 사용 가능성 — 확인 필요).

### 2-2. 서드파티 프레임워크

| 프레임워크 | 특징 | 평가 |
|-----------|------|------|
| Stagehand (Browserbase) | TS, act/extract/observe API, v3(2026-02)에서 CDP 직결로 고속화. 가장 성숙 (22k+ stars) | 하이브리드(코드+AI 혼용)에 강점. 후보 |
| browser-use | Python, goal 기반 추론 루프, 에이전트 프레임워크 결합에 최적 | Python 스택 도입 필요 — 우리 스택(TS/Java)과 이질 |
| Magnitude | 비전 우선(TS), 호스팅 Chrome 사업 결합 | 비전 기반은 판정 신뢰성 검증 부담 큼 |

출처: [Stagehand vs Browser Use vs Playwright (NxCode, 2026)](https://www.nxcode.io/resources/news/stagehand-vs-browser-use-vs-playwright-ai-browser-automation-2026), [Framework Wars (DEV)](https://dev.to/stevengonsalvez/browser-tools-for-ai-agents-part-2-the-framework-wars-browser-use-stagehand-skyvern-4gn)

### 2-3. 비용 참고

에이전트 루프는 step마다 관찰→결정→검증 LLM 호출 발생. 서드파티 자료 기준 10-step 워크플로우당 $0.15–0.30 (GPT-4o 기준) 수준. ([fastCRW](https://fastcrw.com/blog/browser-automation-ai-agents)) → 매 실행 에이전트 방식은 비싸다. **반복 실행은 코드 승격으로 해결**하는 하이브리드가 업계 공통 패턴 (예측 가능한 80%는 코드, AI 판단 필요한 20%만 에이전트).

### 2-4. 기술 선택 (제안)

**Playwright MCP + Claude (직접 구축)를 1순위로 제안한다.**

| 관점 | 근거 |
|------|------|
| 자산 재활용 | Playwright 인프라·spec 40개·CI 이미 보유. Spring AI(Anthropic) 백엔드도 보유 |
| 학습/포트폴리오 가치 | "프레임워크 갖다 씀"이 아니라 실행 루프를 직접 설계 — AI QA 역량 증명의 본체 |
| 승격 경로 | 공식 Test Agents(generator/healer)와 같은 생태계라 연결 자연스러움 |
| 리스크 | 구현 비용 최대. Stagehand 대비 초기 속도 불리 — PoC로 실측 후 판단 |

Stagehand는 PoC에서 직접 구축이 과하다고 판명되면 대안으로 전환 (act/extract API 위에 판정 레이어만 구축).

---

## 3. 목표 아키텍처

```
[test_case (자연어 TC)] ── my-atlas가 이미 보유
      │
      ▼
[Execution Job 생성] ── Test Studio의 비동기 Job 패턴 재활용 (PENDING→RUNNING→DONE/FAILED)
      │
      ▼
[실행 워커 (Node 사이드카)]
      · Playwright MCP로 브라우저 구동
      · Claude가 TC step을 순차 해석 → 액션 결정 → 수행
      · step별 expected를 화면 상태와 대조 → Pass/Fail 판정
      · 증적 수집: 스크린샷, 트레이스, step별 판정 로그
      │
      ▼
[TestResult 자동 기록] ── 기존 Version→Phase→TestResult 도메인에 기록 (Phase A와 합류)
      │
      ├─ 실패 → AI 원인 분류 (제품 결함/테스트 결함/판정 불확실) → Slack/Jira
      │
      └─ 안정 TC (N회 연속 통과 등 기준) → [코드 승격]
            · TC → Playwright generator → spec 코드 → PR 초안 → 사람 리뷰 → CI 편입
            · 이후 반복 실행은 CI(무료·결정적), 깨지면 healer 패턴으로 수리
```

사람 게이트: ① TC 승인(DRAFT→ACTIVE, 기존), ② 승격 spec 코드 리뷰, ③ 외부 제품 실행 전 안전선 확인.

**아키텍처 근거**: Test Studio가 이미 "문서→Job→비동기 AI 파이프라인→DB 저장" 패턴을 갖고 있다 (`TestStudioService`, `TestStudioJobEntity`). Execution Engine은 같은 패턴의 두 번째 인스턴스 — 입력이 문서가 아니라 TC이고, 출력이 TC가 아니라 TestResult일 뿐. 단, **실행 워커는 브라우저가 필요하므로 Spring 프로세스 밖 Node 사이드카**로 분리 (확인 필요: EC2 t3.small에서 Chromium 구동 메모리 — 로컬 워커/별도 실행 환경 검토).

---

## 4. Phase 재구성

### Phase 0 — PoC 스파이크 (1주 이내, 최우선)

로컬에서 최소 루프 검증. 제품 코드 작성 없이 스크립트 수준:
1. my-atlas TC 1개(예: 로그인 TC)를 JSON으로 추출
2. Claude + Playwright MCP로 step 순차 실행 → Pass/Fail 판정 출력
3. 측정: 판정 정확도(gold: 사람 판정), 소요 시간, API 비용, step 해석 실패 유형

**결정 포인트**: 직접 구축 지속 vs Stagehand 전환 vs 접근 재검토. PoC 결과를 본 문서에 추가 후 다음 Phase 컨펌.

### Phase A — 결과 기록 폐루프 (r1 유지, 범위 확장)

TestResult 자동 기록 endpoint + 태깅 규칙. r1과 동일하되, 소비자가 CI(JUnit XML)와 에이전트 워커 둘 다가 되도록 입력 포맷 설계.

### Phase E — Execution Engine 제품화 (Phase 0 통과 후)

Job 도메인, 실행 워커, 증적 저장(스크린샷 S3), UI(실행 버튼 + step별 판정 뷰). 대상은 my-atlas 자신으로 한정.

### Phase P — 코드 승격 파이프라인 (r1의 Phase B 대체)

안정 TC → generator 기반 spec 생성 → PR 초안. 선행 조건: data-testid 정비(확인 필요) + Phase E의 실행 이력 데이터.

### Phase X — 외부 제품 확장 (마지막)

읽기 전용 안전선 구현(step 분류기: 부작용 감지 시 실행 거부), 통제 가능한 외부 대상으로 데모.

### README 재포장 시점

Phase 0 PoC 데모(영상)만 나와도 스토리가 성립. Phase 0 직후 README 개편 착수 (qa-refocus-plan 연계).

---

## 4-1. UI 배치 결정 — Test Studio가 아니라 Product Test Suite다

### 결론

**실행 진입점은 Product Test Suite(Feature Registry)의 Phase 실행 화면과 TC 카드에 둔다. Test Studio에는 두지 않는다.**

### 근거 — 도메인 책임 분리 (코드 확인 기준)

| 영역 | 도메인 책임 | 근거 |
|------|------------|------|
| Test Studio | **생성** — 문서 투입 → AI가 TC 설계 | `TestStudioJobForm`: 입력이 문서, 출력이 DRAFT TC |
| Product Test Suite | **실행·기록** — Version → Phase → TestResult | `VersionPhaseDetailPage`: 결과 입력 + 댓글 + Jira 티켓. ProgressStats, Release Readiness가 전부 여기 붙어 있음 |

에이전트 실행은 "실행" 활동이다. 실행 결과가 소비되는 곳(TestResult 6상태, ProgressStats 실시간 집계, FAIL→Jira 자동 티켓, Release Go/No-Go)이 전부 Registry 도메인에 이미 있다. Test Studio에서 실행하면 결과가 이 생태계 밖에서 겉돌고, 별도 결과 화면을 중복으로 만들어야 한다. 반대로 Phase 화면에 붙이면 **"사람이 수동으로 상태를 바꾸던 바로 그 자리에서, AI가 같은 상태를 자동으로 바꾼다"** — 기존 도메인이 한 줄도 버려지지 않는다.

단, **Test Studio의 비동기 Job 패턴(backend)은 재사용한다**. 도메인 배치(UI가 어디냐)와 구현 패턴(Job 오케스트레이션)은 별개 문제다.

### 화면별 변경 목록

| 화면 | 변경 | 목적 |
|------|------|------|
| `TestCasePage` (TC 카드/모달) | "AI 시험 실행" 버튼 + step별 판정 결과 뷰 | TC 단건 검증 (시나리오 1) |
| `VersionPhaseDetailPage` | "AI 일괄 실행" 버튼 + 실행 진행 상태 + 결과별 AGENT 배지 | Phase 회귀 실행 (시나리오 2) |
| `ProductListPage` 또는 Product 설정 | **실행 프로파일** 설정: baseUrl, 로그인 시퀀스(seed), 외부 제품 여부(읽기 전용 플래그) | 실행 대상 정보 (전 시나리오 선행 조건) |
| TestResult 상세 | 증적 뷰: step별 판정 로그 + 스크린샷 + AI 원인 분류 | 결과 신뢰성 |
| (신규 없음) | Test Studio는 현행 유지 | 생성 도구로서의 정체성 보존 |

**스키마 영향 (확인 필요 포함):**
- `test_result`: 실행 주체 구분 필드 (`executed_by`: HUMAN / AGENT) + 증적 참조 — 마이그레이션 필요
- `product`: 실행 프로파일 (baseUrl, seed 로그인 정보 — 자격증명은 암호화 저장, 확인 필요) — 마이그레이션 필요
- 신규 `agent_execution_job`: Test Studio Job 패턴 복제 (PENDING→RUNNING→DONE/FAILED, step별 로그 JSONB)
- TestResult 상태 확장 여부: INCONCLUSIVE를 신규 상태로 넣을지, 기존 `RETEST`를 재활용할지 — **설계 시 결정** (기존 6상태 Enum 변경은 통계·E2E 영향 큼, RETEST 재활용안 우선 검토)

---

## 4-2. 유저 시나리오

페르소나: QA 엔지니어 앵미. Feature Registry에 my-atlas(자사)와 Toss(외부 분석 대상) Product를 등록해둔 상태.

**전제 — TC 공급원 (중요)**: 시나리오의 TC는 두 경로로 공급된다. ① **수동 작성** (현재 주력 — 시드 TC 22개, test-studio gold set 등), ② **Test Studio 자동 생성** (현재 품질 미흡 — 트랙 T에서 병렬 개선). 실행 엔진은 공급원을 가리지 않으며, **초기 검증(Phase 0~E)은 품질이 통제된 수동 TC로만 수행한다.** 생성 TC의 품질과 엔진의 신뢰성이라는 두 변수를 동시에 흔들면 실패 원인 분리가 불가능하기 때문 (통제 변인).

### 시나리오 1 — TC 단건 시험 실행: "이 TC, AI가 실행할 수 있을 만큼 명확한가?"

> Phase 0 PoC의 제품화 형태. 가장 먼저 출시되는 조각.

1. 앵미가 `TestCasePage`에서 TC "로그인 성공 — 올바른 자격증명" 카드를 연다
2. **[AI 시험 실행]** 클릭 → 대상 환경 선택 (Product 실행 프로파일의 baseUrl) → 실행 확인
3. Job 생성 (PENDING) → 워커가 브라우저 구동, seed 로그인 수행 → TC steps를 순차 해석·실행
4. TC 모달에 step별 진행이 표시된다: `step 1 ✅ 수행 (스크린샷) → step 2 ✅ → expected 대조 ✅ PASS`
5. 판정 불가 step이 있으면: `step 3 ⚠️ "Expected '적절한 메시지 표시'는 판정 기준이 모호합니다 — 구체적 문구를 명시하세요"`
6. 앵미는 TC를 수정하거나, PASS 확인 후 종료. **결과는 TestResult에 기록되지 않는다** (시험 실행 = dry run)

**이 시나리오의 숨은 가치**: 에이전트가 실행 못 하는 TC는 대부분 사람에게도 모호한 TC다 (Oracle 불명확 — user_feedback.md #7, #25). **에이전트 실행 가능성이 TC 품질 lint 역할을 한다.** "AI 시대의 TC 품질 기준"이라는 포트폴리오 스토리가 여기서 나온다.

### 시나리오 2 — Phase 일괄 실행: "회귀 30개, AI한테 돌려놓고 퇴근"

> 본편. Phase A(결과 기록) + Phase E(엔진)의 결합.

1. 릴리즈 v1.2의 Regression Phase에 TC 30개가 할당돼 있다 (`VersionPhaseDetailPage`)
2. **[AI 일괄 실행]** 클릭 → 실행 범위 선택 (전체 / Untested만 / 이전 FAIL만) → 확인
3. `agent_execution_job` 생성, TC 순차 실행. 화면 상단에 진행 바: `12/30 실행 중 · PASS 9 · FAIL 2 · 판정불가 1`
4. 실행이 끝난 TC부터 TestResult가 자동 기록된다 — 상태 옆에 **AGENT 배지**, 클릭하면 step별 증적(스크린샷·판정 로그)
5. FAIL 건에는 AI 원인 분류가 첨부된다: `제품 결함 추정 — step 4에서 저장 버튼 클릭 후 500 응답` → 앵미가 확인 후 기존 플로우대로 Jira 티켓 생성
6. 판정불가 건은 RETEST 상태로 남아 사람 확인 대기열이 된다
7. ProgressStats·Release Readiness가 실시간 갱신 — **사람 실행과 AI 실행이 같은 Phase 안에서 합산**된다
8. 다음날 앵미는 FAIL 2건과 판정불가 1건만 직접 본다 — 30건 전수 수동 실행이 3건 확인으로 줄었다

### 시나리오 3 — 코드 승격: "매번 AI로 돌리기엔 아깝다"

1. TC 상세에 실행 이력 기반 배지: `AGENT 실행 5회 연속 PASS — 코드 승격 후보`
2. **[Playwright 코드로 승격]** 클릭 → generator 파이프라인이 spec 초안 생성 → PR 초안 링크 제공
3. 앵미가 코드 리뷰 후 머지 → 이후 이 TC는 CI에서 무료·결정적으로 실행되고, CI 결과가 Phase A 경로로 TestResult에 기록된다
4. TC에 `자동화됨(CODE)` 표시 — 에이전트 일괄 실행 대상에서 자동 제외

### 시나리오 4 — 외부 제품: "Toss 탐색 TC를 에이전트로"

1. Toss Product의 실행 프로파일에 `외부 제품(읽기 전용)` 플래그 설정
2. Phase 실행 시 step 분류기가 선행 검사: 부작용 step(결제·주문·가입·작성) 포함 TC는 **실행 거부 + 사유 표시**
3. 통과한 읽기 전용 TC(화면 진입, 조회, 표시 검증)만 실행 — 결과 기록은 동일 플로우
4. 거부된 TC는 `수동 전용` 표시로 남는다

### 시나리오 간 관계와 출시 순서

```
시나리오 1 (단건 dry run)     ← Phase 0 PoC 직후, 최소 제품화. 여기까지만 해도 데모 성립
   ↓ 신뢰성 데이터 축적            ↖ 트랙 T와 상호 피드백: 생성 TC를 dry run에 투입
시나리오 2 (Phase 일괄 + 기록) ← Phase A + E. 제품의 본편
   ↓ 실행 이력 축적
시나리오 3 (코드 승격)         ← Phase P
시나리오 4 (외부 제품)         ← Phase X. 안전선 구현이 선행 조건
```

---

## 4-3. 트랙 T — Test Studio 생성 품질 개선 (병렬 트랙)

### 위치 판단: 실행 엔진의 선행 조건이 아니다

전체 파이프라인에서 Test Studio는 TC **공급** 단계이고 실행 엔진은 **소비** 단계라 의존이 있어 보이지만, 수동 TC라는 대체 공급원이 있으므로 순서를 강제하지 않는다. 오히려 역방향 의존이 더 크다: **dry run(시나리오 1)이 생기면 생성 TC의 품질을 "실행 가능성"이라는 객관 지표로 측정할 수 있다.** 현재 채점시트(사람 채점)에 자동 지표가 추가되는 것.

### 현재 품질 문제의 원인 진단 (`TestStudioGenerator.buildPrompt()` 확인)

| 항목 | 현재 상태 |
|------|----------|
| 프롬프트 내 설계 지시 | "예외/실패 케이스 최소 1건" — **이것이 전부** |
| 테스트 설계 기법 (EP/BVA/State Transition/Decision Table) | ❌ 없음 |
| TC 설계 체크리스트 (user_feedback.md 26건 — 원자성, Oracle 명확성, 구체 시나리오 등) | ❌ 없음 |
| 생성 후 self-review 단계 | ❌ 없음 — 단발 호출로 종료 |
| RAG 컨텍스트 | KB 유사도 청크 + 용어 컨벤션 + 기존 TC 패턴 (이건 잘 돼 있음) |

**결론: 앵미가 가진 최고 자산(실무 QA 피드백 26건의 이론 매핑)이 정작 생성 프롬프트에 주입되지 않고 있다.**

### 개선 계획 (T1 → T3, 각각 독립 배포 가능)

| 단계 | 내용 | 기대 효과 |
|------|------|----------|
| **T1** | 설계 기법 + 체크리스트 핵심 규칙을 프롬프트에 주입 (원자성, 단일 Oracle, Positive/Negative 쌍, 구체적 Expected — "또는" 금지 등). 문서 특성에 따라 기법 선택 지시 | 비용 증가 거의 없이 즉시 개선 |
| **T2** | 2-pass 구조: 생성 → 체크리스트 기반 self-review(수정/탈락 사유 포함) → 최종 산출. 탈락 사유는 job 로그에 기록 | 품질 향상 + 리뷰 과정 자체가 포트폴리오 증거 |
| **T3** | dry run 연동: 생성 TC 샘플을 자동 dry run → 실행 가능성 점수를 채점시트에 추가 (시나리오 1 출시 후) | 품질의 정량 측정, 개선 회귀 방지 |

**평가 방법**: 기존 채점 체계 재사용 — 동일 입력 문서(TestStudio_입력문서 5종)로 개선 전/후 생성 → 채점시트로 비교. T1부터 즉시 적용 가능.

### 진행 시점

T1~T2는 실행 엔진과 코드 충돌이 없어 **언제든 병렬 진행 가능**. 권장: Phase 0 PoC와 동시 시작 (T1은 프롬프트 수정 + 평가라 규모가 작다). T3만 시나리오 1 출시에 의존.

---

## 5. 리스크

| 리스크 | 대응 |
|--------|------|
| 에이전트 판정의 비결정성 (같은 TC, 다른 결과) | Phase 0에서 판정 정확도 실측. 판정 불확실 시 "INCONCLUSIVE" 상태 도입, 사람 확인으로 폴백 |
| API 비용 폭증 | 에이전트 실행은 수동 트리거 전용. 반복 실행은 코드 승격으로 이관. step당 토큰 상한 |
| EC2 t3.small에서 브라우저 구동 불가 | 워커를 로컬/GitHub Actions 러너에서 실행하는 구조 우선 검토 (확인 필요) |
| 외부 실서비스 부작용 | step 분류기 + 읽기 전용 화이트리스트. 자동 실행 전 사람 확인 게이트 |
| 범위 폭발 (엔진+승격+외부까지) | Phase 0 결과 없이는 어떤 제품 코드도 작성하지 않는다 |

---

## 6. 진행 순서

> r5부터 구현 순서는 분기 문서가 소유한다. 아래는 문서 간 순서만 관리한다.

1. [x] 본 플랜 컨펌 및 분기 확정 (r5)
2. [ ] registry_v20 Phase 0 PoC ∥ test-studio_v3에 T1 Step 추가(User 컨펌) 후 v3 Phase 0 착수
3. [ ] PoC 결과 → registry_v20 go/no-go (User)
4. [ ] README 재포장 (PoC 스토리 포함, qa-refocus-plan 연계)
5. [ ] registry_v20 Phase 1~4 ∥ test-studio_v3 Phase 1~3 (각 문서의 Step 순서대로)
6. [ ] test-studio_v4 Phase 4 (코드 승격) — registry_v20 실행 이력 + v3 완료 후
7. [ ] registry_v21+ (외부 제품 안전선) / T3 (dry run 품질 지표 연동)

---

## 참고 출처

- [Playwright Test Agents (공식)](https://playwright.dev/docs/test-agents)
- [Playwright MCP (공식)](https://playwright.dev/mcp/introduction)
- [Stagehand vs Browser Use vs Playwright, NxCode 2026](https://www.nxcode.io/resources/news/stagehand-vs-browser-use-vs-playwright-ai-browser-automation-2026)
- [Browser Tools for AI Agents: Framework Wars, DEV](https://dev.to/stevengonsalvez/browser-tools-for-ai-agents-part-2-the-framework-wars-browser-use-stagehand-skyvern-4gn)
- [Browser Automation for AI Agents, fastCRW](https://fastcrw.com/blog/browser-automation-ai-agents)
- [Playwright AI Ecosystem 2026, TestDino](https://testdino.com/blog/playwright-ai-ecosystem)
