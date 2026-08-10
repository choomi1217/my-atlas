# Registry v20 — TC 실행 에이전트 엔진 (Agentic Test Execution)

> 변경 유형: 기능 추가
> 작성일: 2026-07-13
> 버전: v20
> 상태: 진행 중 (계획 — qa_v14 전략에서 분기, 착수 전 Phase 0 PoC 결과 필요)

---

## 배경 — 이 문서의 위치

전략 문서 [qa_v14](../../qa/qa_v14.md)(TC 실행 에이전트 엔진 전략)가 두 실행 문서로 분기되었다:

| 실행 문서 | 담당 범위 |
|-----------|----------|
| **본 문서 (registry_v20)** | **실행·기록** — 에이전트 실행 엔진, TestResult 자동 기록, 실행 프로파일 |
| [test-studio_v3](../test-studio/test-studio_v3.md) / [test-studio_v4](../test-studio/test-studio_v4.md) | **생성·승격** — TC 생성 품질(v3), TC→자동화 코드 생성(v4 Phase 4) |

UI 배치 근거(qa_v14 §4-1): 실행 결과를 소비하는 생태계(TestResult 6상태, ProgressStats, FAIL→Jira, Release Readiness)가 전부 Registry 도메인에 있다. 에이전트 실행은 "사람이 수동으로 상태를 바꾸던 자리에서 AI가 같은 상태를 자동으로 바꾸는" 기능이므로 Registry 소속이다.

---

## 스코프

**포함 (qa_v14 시나리오 1·2 + Phase A):**
- Phase 0 — PoC 스파이크 (제품 코드 밖, go/no-go 게이트)
- 실행 프로파일 — Product에 baseUrl·로그인 seed 설정
- TC 단건 AI 시험 실행 (dry run) — TestCasePage
- Phase 일괄 AI 실행 + TestResult 자동 기록 — VersionPhaseDetailPage
- 실행 주체 구분(HUMAN/AGENT) + 증적(step별 판정 로그·스크린샷)
- CI 결과 수신 endpoint (JUnit XML → TestResult) — 에이전트 결과와 동일 경로

**제외:**
- TC 생성 품질 개선 → test-studio_v3 (Phase 0 컨텍스트 보강 + 대화형 루프)
- TC→Playwright 코드 승격 → test-studio_v4 Phase 4 (단, **승격 버튼 진입점은 Registry의 TC 상세** — UI는 여기, 기능 소유는 v4)
- 외부 제품 실행(읽기 전용 안전선, step 분류기) → **registry_v21+** (엔진 신뢰성 검증 후)

**전제 (변경 불가 원칙, qa_v14 승계):**
- 초기 검증은 **수동 작성 gold TC로만** — 생성 TC 품질과 엔진 신뢰성 변수 분리
- 에이전트 실행은 **수동 트리거 전용** — CI마다 자동 호출 금지 (비용)
- 사람 게이트 유지: 실행은 자동, **FAIL 판정의 최종 확인과 Jira 티켓 생성은 사람**

---

## 아키텍처 (qa_v14 §3 요약 + 구체화)

```
[VersionPhaseDetailPage / TestCasePage]
   → POST /api/agent-executions  (단건 dry run | Phase 일괄)
   → agent_execution_job (PENDING)          ← Test Studio Job 패턴 복제
   → 실행 워커 (Node 사이드카, Playwright MCP + Claude)
        · Product 실행 프로파일로 브라우저 구동 + seed 로그인
        · TC step 순차 해석 → 액션 → expected 대조 판정
        · 증적: step별 로그(JSONB) + 스크린샷(S3)
   → 판정 회신 → TestResult 기록 (dry run은 기록 생략)
        · executed_by = AGENT
        · 판정불가 → RETEST 상태 (신규 Enum 대신 재활용 — 하단 결정사항)
   → 기존 생태계 자동 반영: ProgressStats, Release Readiness, Failed TC 히스토리
```

### 워커 배치 (확인 필요 → 결정)

| 안 | 장점 | 단점 |
|----|------|------|
| A. EC2 내 Node 컨테이너 | 배포 단순 | t3.small 메모리에서 Chromium 구동 위험 — **실측 필요** |
| B. GitHub Actions 러너에서 실행 (workflow_dispatch) | 인프라 비용 0, Chromium 확보 | 실행 지연(러너 기동), 인터랙티브성 낮음 |
| C. 로컬 워커 (개발자 머신 폴링) | PoC 즉시 가능 | 데모용 한정, 상시 가용 아님 |

→ **Phase 0은 C로 검증, 제품화 시 A 실측 후 A/B 결정.**

---

## 데이터 설계 (초안)

### 신규: `agent_execution_job`

```
id, product_id, phase_id(nullable — 단건 dry run이면 null),
scope(SINGLE | PHASE_ALL | PHASE_UNTESTED | PHASE_PREV_FAIL),
status(PENDING | RUNNING | DONE | FAILED | CANCELLED),
requested_by, created_at, completed_at, error_message,
total_count, done_count, pass_count, fail_count, inconclusive_count
```

### 신규: `agent_execution_result` (job 하위, TC별)

```
id, job_id, test_case_id, verdict(PASS | FAIL | INCONCLUSIVE),
step_logs(JSONB — [{order, action_taken, observed, judgment, screenshot_key}]),
ai_failure_analysis(TEXT — 제품 결함/테스트 결함/환경 분류 + 근거),
duration_ms, token_cost
```

### 변경: `test_result`

- `executed_by` 컬럼 추가 (HUMAN | AGENT | CI) — default HUMAN, 기존 데이터 호환
- `agent_execution_result_id` (nullable FK) — 증적 역참조

### 변경: `product`

- 실행 프로파일: `exec_base_url`, `exec_seed_note`(로그인 절차 서술), 자격증명은 **DB 평문 저장 금지** — 방식 확인 필요 (env 참조 키 방식 우선 검토)

### 결정사항 (컨펌 필요)

1. **판정불가 상태**: TestResult Enum에 INCONCLUSIVE 신설 vs 기존 RETEST 재활용. **RETEST 재활용 추천** — Enum 변경은 통계·E2E·프론트 전 계층 파급. RETEST 의미("재확인 필요")와 부합. `executed_by=AGENT` + RETEST 조합으로 식별 가능
2. **dry run 결과의 TestResult 기록 여부**: 미기록 추천 (시험 실행 = 품질 lint, 이력 오염 방지)
3. 마이그레이션 버전: 타임스탬프 형식 (`V{YYYYMMDD}{HHmm}__create_agent_execution.sql`)

---

## API 설계 (초안)

| Method | Endpoint | 용도 |
|--------|----------|------|
| POST | `/api/agent-executions` | Job 생성 (scope + 대상) |
| GET | `/api/agent-executions/{jobId}` | 진행 상태 폴링 (Test Studio 2초 폴링 패턴 재사용) |
| POST | `/api/agent-executions/{jobId}/cancel` | 중단 |
| GET | `/api/agent-executions/{jobId}/results/{tcId}` | step별 증적 조회 |
| POST | `/api/test-results/import` | CI JUnit XML 수신 (Phase A — 인증: service 토큰, ADMIN 권한) |
| (워커용) | 내부 폴링 or 큐 — 방식 확인 필요 | 워커 ↔ backend 통신 |

---

## 구현 절차 (User 승인 단위)

각 Step은 User 지시 없이 다음으로 넘어가지 않는다.

### Phase 0 — PoC 스파이크 (제품 코드 없음, go/no-go 게이트)
- [x] **Step 0-1** — 대상 gold TC 5개 + 네거티브 1개 선정 (난이도 층화) + 측정 항목 확정 → `poc_testplan.md` / 하단 측정 결과
- [x] **Step 0-2** — Playwright MCP + Claude로 TC 실행 루프 실측 → 측정 결과를 **본 문서 하단에 기록** (2026-07-14)
- [x] **Step 0-3** — go/no-go 결정: **GO (직접 구축 지속)** — User 승인 (2026-07-14)

### Phase 1 — 실행 프로파일 + Job 도메인 (Phase 0 통과 후)
- [x] **Step 1** — `product` 실행 프로파일 + `agent_execution_job/result` 마이그레이션 + 도메인 계층 (2026-07-14)
  - 마이그레이션 `V202607141600__create_agent_execution.sql`: 2 테이블 + `test_result`(executed_by, agent_execution_result_id) + `product`(exec_base_url, exec_seed_note)
  - 도메인(`feature/`): Enum 4 (AgentExecutionScope/Status, AgentVerdict, ExecutedBy) + record AgentStepLog + Entity 2 (AgentExecutionJob/Result) + Repository 2 + Product/TestResult 엔티티 필드 추가
  - 결정: status = `PENDING/RUNNING/DONE/FAILED/CANCELLED`(doc 스펙), 판정불가는 RETEST 재활용(INCONCLUSIVE는 result.verdict 전용), 자격증명 컬럼 이연
  - 검증: `./gradlew compileJava` 통과 + 마이그레이션 DDL 롤백 트랜잭션 유효성 확인. (DB 실제 반영은 앱 부팅 시 Flyway, 전체 파이프라인 검증은 Phase 4)
- [x] **Step 2** — Job API (생성/조회/취소) + 워커 통신 경로 (2026-07-14)
  - `AgentExecutionController` `/api/agent-executions`: 사용자 `POST`(생성)·`GET /{id}`(폴링)·`GET ?productId=|phaseId=`(목록)·`POST /{id}/cancel`·`GET /{id}/results/{tcId}`(증적)
  - 워커 통신 = **폴링 모델**(doc "폴링 vs 큐" 해소): `POST /{id}/claim`(PENDING→RUNNING)·`POST /{id}/results`(TC결과 보고+카운터)·`POST /{id}/complete`(DONE/FAILED). 외부 Node 워커가 JVM 밖이므로 in-process @Async 미사용
  - `AgentExecutionService`/Impl + `AgentExecutionDto`(records) + 스키마 보강: `agent_execution_job.target_test_case_id`(SINGLE 대상 TC)
  - 검증: `./gradlew compileJava` 통과 + 마이그레이션 DDL 재검증. 워커 endpoint 인증(service 토큰)은 Phase E, PHASE_* scope의 TC 목록 해석은 Phase 3(Step 5)
  - 단위/통합 테스트는 Phase 4(Step 8) 예정 (본 문서 Step 순서 준수)

### Phase 2 — 단건 dry run (시나리오 1)
- [x] **Step 3** — 워커: 단건 TC 실행 루프 (PoC 스크립트 제품화) — 코드 완료 (2026-07-14, 런타임 검증은 docker up 시)
  - 워커 방식 = **Node 사이드카** (User 승인). 신규 `agent-worker/` (Playwright + @anthropic-ai/sdk, ESM, Node≥20)
  - 백엔드 지원: `GET /api/agent-executions/{id}/context` — claim 후 대상 TC(steps/expected) + Product 실행 프로파일(baseUrl/seedNote) 반환 (SINGLE 구현, PHASE_*는 Phase 3)
  - 워커 루프(`agent-worker/src/`): login→claim→context→chromium 구동→seed 로그인(agentic)→step마다 [Claude 액션 결정→Playwright 실행→Claude expected 판정]→recordResult→complete. Phase 0 수동 루프의 제품화
  - 판정: 전부 PASS→PASS / FAIL 하나라도→FAIL / (FAIL 없이) 모호→INCONCLUSIVE. step당 액션 상한(MAX_STEP_ACTIONS)으로 토큰 보호. 수동 트리거 전용
  - 검증: `./gradlew compileJava` 통과(context endpoint) + 워커 3파일 `node --check` 통과. **런타임 검증은 Step 4 + docker up 후** (npm install + 브라우저 + 마이그레이션 적용 + Job 필요)
- [x] **Step 4** — TestCasePage: [AI 시험 실행] 버튼 + step별 판정 뷰 (2026-07-20)
  - `TestCaseCard`에 **[AI 시험 실행]** 버튼(onRunAgent) → `AgentRunModal`: Job 생성(SINGLE)→2초 폴링→완료 시 verdict + step별 판정 증적 표시(dry run, TestResult 미기록)
  - TestCasePage 헤더 **[AI 실행 프로파일]** → `ExecProfileModal`: Product baseUrl/seedNote 설정 (`PATCH /api/products/{id}/exec-profile`)
  - 백엔드: `ProductDto`(execBaseUrl/execSeedNote) + `ProductService.setExecProfile` + `ProductController` PATCH endpoint
  - 프론트: `types/features.ts`(AgentExecution 타입) + `api/features.ts`(agentExecutionApi, productApi.setExecProfile)
  - 검증: `tsc --noEmit` + `eslint` 통과(exit 0). 기존 `TestCaseCard.test.tsx`에 onRunAgent mock 추가. 런타임 확인은 docker up

### Phase 3 — Phase 일괄 실행 + 자동 기록 (시나리오 2)
- [x] **Step 5** — 일괄 실행 (scope 선택) + TestResult 자동 기록 (`executed_by=AGENT`) (2026-07-23)
  - `AgentExecutionServiceImpl`: `resolvePhaseTestCaseIds`(Phase의 materialize된 test_result 기준 PHASE_ALL/UNTESTED/PREV_FAIL 필터) → submitJob total_count + getExecutionContext TC 목록. `recordResult`가 job.phaseId 있으면 `upsertAgentTestResult`(verdict→RunResultStatus: PASS/FAIL/INCONCLUSIVE→RETEST, executed_by=AGENT, 증적 역참조). SINGLE(phaseId=null)은 미기록(dry run)
  - 라이브 검증: PHASE_ALL total=76, PHASE_PREV_FAIL total=2(=FAIL 개수) 일치
- [x] **Step 6** — VersionPhaseDetailPage: [AI 일괄 실행] + 진행 바 + AGENT 배지 (2026-07-23)
  - `BatchAgentRunModal`(scope 선택→createBatch→폴링: 진행 바 done/total·P/F/I + TC별 verdict), 완료 시 부모 `loadData` 재로딩. ResultRow에 **AGENT/CI 배지**(executed_by). `GET /{jobId}/results` 목록 endpoint + `TestResultResponse`에 executedBy/agentExecutionResultId 추가
- [x] **Step 7** — CI 결과 수신 endpoint + e2e.yml 연동 (2026-07-23)
  - `POST /api/admin/test-results/import?versionPhaseId=`(ADMIN, JUnit XML→제목 매칭→executed_by=CI, XXE 방지 파서). e2e.yml `ui-e2e`에 opt-in import step(`vars.AGENT_IMPORT_PHASE_ID` 설정 시만, continue-on-error). 라이브 검증: matched/recorded/unmatched 정확, TC가 `PASS|CI`로 기록

### Phase 4 — 테스트 · 검증
- [x] **Step 8** — Backend 단위 테스트 (2026-07-23) — `AgentExecutionServiceImplTest`(submit/claim/record 카운터·verdict 매핑·AGENT 자동기록·dry run 미기록/getContext 해석), `TestResultImportServiceImplTest`(XML 파싱·제목 매칭·CI 기록·unmatched). 필드 추가로 깨진 기존 Product 생성자 테스트 수정. 전부 BUILD SUCCESSFUL
- [x] **Step 9** — E2E (워커 stub) (2026-07-23) — `qa/ui/agent-execution.spec.ts`: agent API route 모킹 → [AI 시험 실행]→모달 진행→PASS+step 증적 검증. 통과
- [x] **Step 10** — Agent-D 검증 + 문서 갱신 (2026-07-23) — compileJava·단위테스트 통과 + docker 재빌드·배포(health UP, Flyway validate) + 배치/import 라이브 스모크 + E2E 통과. 본 섹션 갱신

---

## Phase 0 PoC 측정 결과 (2026-07-14)

> 실행 주체: Claude(에이전트 역할) + **Playwright MCP**(목표 아키텍처 도구). 대상 앱: 로컬 my-atlas `http://localhost:5173`(worktree 5178 슬롯과 동일 코드·공유 DB). 로그인 admin/admin. run 식별자 `{seq}=pw-1527`. DB 리셋 없음(생성 리소스에 suffix 부여).

### 실행 환경 복구 (착수 전 발생한 실측 이슈 — 그 자체가 발견)

1. **Playwright MCP 구동 불가 → 복구함.** 최초 `browser_navigate`가 `URL.canParse is not a function`으로 실패. 원인: MCP 서버가 시스템 기본 **Node v18.16.0**(`/usr/local/bin/node`, `URL.canParse` 미지원, 18.17+ 필요)로 기동됨. 조치: `.mcp.json`의 playwright `command`를 **nvm Node v20.20.2 절대경로 npx** + `env.PATH` 선행으로 고정, `@playwright/mcp`용 브라우저(Chrome for Testing chromium v1232) 설치 → 재접속 후 정상.
2. **claude-in-chrome MCP는 이 React SPA 구동에 부적합.** `form_input`이 controlled-component의 onChange 미트리거(React state 미반영), ref/좌표 클릭이 onClick 미트리거로 **모달 열기 실패**, 스크린샷 좌표계(1509×812)≠viewport(1680×904). → 저수준 액션 신뢰성 부족. **Playwright는 trusted event로 동일 동작이 전부 1회에 성공.**

**결론: 목표 아키텍처(Playwright MCP + Claude)는 유효하되, 워커 런타임의 Node≥20 + 브라우저 프로비저닝이 선행 조건이다.**

### TC별 판정 결과 (판정 정확도 6/6 = 100%)

| TC | 대상 | 기대 verdict | 에이전트 판정 | DB 교차검증 | 일치 | 소요(약, wall-clock) |
|----|------|:---:|:---:|------|:---:|:---:|
| G1 · TC-01 | Company 생성 | PASS | PASS | company id 3583 | ✓ | ~2m* |
| G2 · TC-08 | Product 생성(+Platform) | PASS | PASS | product id 2994 (WEB) | ✓ | ~1m40s |
| G3 · TC-15 | Root Segment 등록 | PASS | PASS | segment id 4540 (root) | ✓ | ~1m40s |
| G4 · TC-18 | TestCase 생성(트리 경로) | PASS | PASS※ | tc id 3586, path{4540} | ✓ | ~1m50s |
| G5 · TC-22 | 3단계 드릴다운 E2E + CRUD | PASS | PASS | co3584/prod2995/seg4541→4542/tc create·edit·delete | ✓ | ~6m40s |
| N1 · 네거티브 | Company 중복이름 차단 | **FAIL** | **FAIL** | 중복 2행 {3585,3586} | ✓ | ~1m45s |

*G1은 로그인·초기 네비 포함. ※G4 주석은 아래 oracle 항목.

**판정 정확도: 6/6.** 기대-PASS 5건 모두 PASS로, 기대-FAIL(N1) 1건을 FAIL로 정확히 감별.

### 측정 항목별 발견

1. **판정 정확도** — 6/6(100%). 모든 판정이 DB 실측(human gold)과 일치. N1 네거티브에서 판정기가 "관측(중복 생성됨) ≠ TC 기대(차단)"를 **FAIL로 정확히 감별** → 판정 로직 sanity-check 통과.
2. **Step 해석 실패 유형** —
   - (해소됨) TC 원문 레이블("Add New") ↔ 실제 UI("+ New Company"/"+Add New") 변형을 의미 매핑으로 해소.
   - (TC 품질 신호) TC-18 원문 예시 경로 "Authentication > Login"이 시드에 없어 실제 선택 경로로 대체 필요 → 에이전트 실행 가능성이 **TC 구체성 결핍을 드러내는 lint** 역할(qa_v14 시나리오 1의 "숨은 가치" 실증).
3. **Oracle 모호성 (중요)** ※ — TC-18 step4 기대 "목록 추가 **+ 모달 닫힘**" 중, 앱은 생성 후 모달을 **Edit 모드로 유지**(닫히지 않음). 핵심 expected_result(경로 아래 저장·표시)는 충족 → PASS로 판정했으나, 복합/UI-부수 oracle이 판정 경계를 모호하게 만든다. → 생성 TC의 oracle은 "핵심 결과 1개"로 원자화 권장.
4. **네거티브 감별 + 실제 결함 발견** — N1에서 앱이 **회사명 중복을 차단하지 않음**(동일 이름 2건 생성). 판정기는 FAIL로 정확히 감별했고, 부수적으로 **실제 검증 공백(company/product 이름 유니크 제약·중복 검증 부재)**을 드러냄.
5. **시간/비용** — 6 TC 총 ~16분(로그인 포함 wall-clock, LLM 추론 시간 포함). E2E(G5, 7-step)가 최장 ~6m40s. **정밀 토큰/$ 측정은 metered 워커 필요** → Phase E로 이연.
6. **결정성** — 각 TC 1회 실행(TC-01은 claude-in-chrome+Playwright 2회, 모두 PASS로 일관). qa_v14 리스크의 "동일 TC 3회 반복" 정식 측정은 **후속 과제**로 남김.

### 후속 아젠다 (User 결정 — 이연됨)

- **Oracle 엄밀성 정책 (G4/TC-18)**: TC 기대에 "모달 닫힘" 같은 복합/부수 절이 포함되고 앱이 이를 어기면, 판정기는 **FAIL로 처리**하고 **사용자가 TC를 수정**하는 방향이 맞다(User, 2026-07-14). 본 PoC에서는 핵심 결과 기준 PASS로 뒀으나, 판정기 엄밀성·oracle lint 정책은 **다음 아젠다**로 넘긴다(test-studio 트랙 T의 oracle 명확성 / 생성 TC 품질과 연계).

### go/no-go 권고 (Step 0-3 — 최종 판단은 User)

**권고: GO (직접 구축 — Playwright MCP + Claude 지속).**
- 근거: 판정 정확도 6/6, 목표 도구가 React SPA를 trusted 액션으로 안정 구동함을 실증, 기존 Playwright 자산(spec·CI)과 정합.
- 선결 조건(Phase 1 착수 전 반영): ① 워커 런타임 **Node≥20 + 브라우저 프로비저닝** 표준화, ② **oracle 명확성 lint**(복합 기대·모호 경로 차단), ③ **결정성 3× 반복** 정식 측정, ④ FAIL 감별 케이스 확대, ⑤ 토큰/시간 metered 측정.
- Stagehand 전환은 현 시점 불요(직접 구축이 동작함). 단 비용/속도 실측(Phase E) 후 재평가 여지.

### PoC 생성 데이터 (정리 대기)

DB 리셋 없이 실행하여 아래 테스트 데이터가 공유 DB에 잔존(보호 seed·테이블 미접촉). 정리 필요 시 이름 suffix `pw-1527`/`p0-1721`로 식별 후 삭제 가능:
- company: `TestCo-pw-1527`(3583), `QA-Team-pw-1527`(3584), `DupCo-pw-1527`×2(3585,3586), `TestCo-p0-1721`(3582, claude-in-chrome 초기 실행분)
- product: `WebApp-pw-1527`(2994), `Mobile-App-pw-1527`(2995)
- segment: `Authentication-pw-1527`(4540), `Feature-A-pw-1527`(4541)→`Scenario-1-pw-1527`(4542)
- test_case: `TC-Create-pw-1527`(3586). (E2E의 `E2E-TC-pw-1527`은 TC-22에서 삭제 완료)

---

## Phase 2 런타임 검증 · 신뢰성 개선 (2026-07-23)

docker로 실제 기동(registry 슬롯 5178/8085 + agent-worker 컨테이너)해 UI에서 [AI 시험 실행]까지 돌리며 발견·수정한 통합 이슈:

**프론트/모달**
- `AgentRunModal` 폴링이 **React StrictMode**(mount→cleanup→mount)에서 `cancelled` 클로저가 조기 true → job 상태 미갱신("워커 시작 대기" 고정). ref 기반(`stoppedRef`/`timerRef` + effect 시작 시 reset)으로 수정.

**워커 실행 환경 (실제 브라우저 구동에서만 드러난 것들)**
1. **Playwright 버전 불일치** — `^1.47.2`가 1.61로 올라 도커 베이스 이미지(1.47.2-jammy)와 브라우저 revision 불일치 → `playwright`를 **1.47.2 정확 고정**.
2. **상대경로 navigate** — 에이전트가 `/login` 등 상대경로 반환 → `page.goto` 실패 → `new URL(v, page.url())`로 절대화.
3. **Vite dev host 차단** — 워커가 컨테이너 호스트명 `myqaweb-registry-frontend:5173` 접근 시 Vite가 "Blocked request"로 빈 페이지 → `vite.config` `server.allowedHosts: true`.
4. **백엔드 CORS 403** — 컨테이너 origin의 브라우저 API 호출이 `Invalid CORS request`로 전부 차단(로그인 포함) → **Vite 프록시에서 Origin 헤더 제거**(dev, `configure`+`removeHeader('origin')`)로 non-CORS 전달.
5. **seed 로그인 불안정** — 폼 구동(`fill`)이 React controlled-input 갱신을 놓쳐 로그인 실패 → **로그인 API를 in-page fetch로 호출해 token+user를 localStorage 주입** 방식(결정적)으로 대체.

**에이전트 루프 신뢰성**
- SPA 비동기 렌더 전 스냅샷 → 빈 요소: `waitReady`(networkidle) + `snapshotStable`(요소 나올 때까지 재시도).
- 판정기에 **pageText**(카드 제목 등 보이는 텍스트) 추가 → "X가 목록에 추가됨" 검증 가능.
- step 내 **액션 히스토리 메모리** + 실패 액션 기록 → 같은 버튼 반복 클릭(모달 뒤 covered) 루프 해소.

**결과**: 에이전트가 로그인→앱 관측→모달 열기→폼 입력→**데이터 생성(company DB insert)**→목록 검증까지 안정 수행. TC 992("Company 신규 등록") step1·3 PASS, step2는 TC 자체의 모호 oracle("텍스트 입력 완료")로 INCONCLUSIVE — **TC 품질 lint 가치 재확인**. 남은 과제: 멀티라우트 E2E의 판단 품질(vision/스크린샷 판정, 액션 계획) — 후속.

---

## 확인 필요

- EC2 t3.small Chromium 구동 가능 여부 (워커 안 A 실측)
- 자격증명 저장 방식 (env 참조 키 vs Secret Manager)
- 워커 ↔ backend 통신 (폴링 vs 큐)
- Playwright MCP 헤드리스 구동의 세션당 메모리/시간 실측 (Phase 0에서 함께)
- S3 스크린샷 버킷 — 기존 `my-atlas-images` 재사용 vs 분리

---

## 리스크 (qa_v14 §5 승계 + 구체화)

| 리스크 | 대응 |
|--------|------|
| 판정 비결정성 | Phase 0에서 동일 TC 3회 반복 실행으로 판정 일관성 실측. 불일치 시 INCONCLUSIVE 폴백 |
| 토큰 비용 | job당 상한 (예: TC당 max step×토큰), 초과 시 FAILED 처리. 비용을 `token_cost`에 기록해 가시화 |
| 워커 장애로 job 고아화 | heartbeat + 타임아웃 시 FAILED 전환 |
| E2E 테스트와 에이전트 실행의 대상 충돌 (같은 DB) | 에이전트 실행은 실행 프로파일의 대상 환경에서만 — CI E2E 환경과 분리 |
| knowledge_base 등 보호 테이블 접촉 | 에이전트 실행 TC는 Registry 도메인 화면으로 한정, 파괴적 step은 gold TC에서 배제 |

---

## 참조

- [qa_v14](../../qa/qa_v14.md) — 상위 전략 (기술 조사·비전·시나리오 원문)
- [test-studio_v3](../test-studio/test-studio_v3.md) — TC 생성 품질 (트랙 T 귀속처)
- [test-studio_v4](../test-studio/test-studio_v4.md) — TC→코드 승격 (Phase P 귀속처)
- [registry.md](./registry.md) — 메인 명세서

---

## 추가 개발 건 (백로그)

> 출시 후 나온 개선 요구. 착수 시 각 항목을 Step으로 승격하거나 다음 버전 문서로 분기한다.

### B1 — FAIL 시 실패 이유를 TestResult.comment에 기록 ✅ 완료 (User 요청, 2026-07-24)

**요구**: 에이전트 일괄 실행에서 TC가 FAIL(또는 판정불가)일 때, **왜 실패했는지**를 `test_result.comment`에 적어 Phase 결과 화면에서 바로 확인할 수 있게 한다.

**구현 (1차, 저비용 — LLM 추가 호출 없음)**:
- 워커 `agent-worker/src/index.js` `buildFailureAnalysis(result)`: verdict!=PASS면 실패/판정불가 step들의 판정(judgment)을 요약(`[AI {verdict}] #n {judgment}…`, 1500자 상한)해 `recordResult`의 `aiFailureAnalysis`로 전달.
- 백엔드 `upsertAgentTestResult`는 기존대로 `aiFailureAnalysis`(non-blank)를 `comment`에 기록. 프론트 `VersionPhaseDetailPage`는 comment를 이미 표시.
- **라이브 검증**: 1-TC 배치(job 57) → TestResult가 `RETEST | AGENT` + comment=`[AI INCONCLUSIVE] #2 INCONCLUSIVE: 기대값 '텍스트 입력 완료'는 모호…`로 기록됨.

**후속(선택, 미착수)**: 2차 — 실패 step 근거로 LLM에 "제품 결함/테스트 결함/환경" 분류 요청 (qa_v14 "AI 실패 분류", FAIL/INCONCLUSIVE만, 비용 고려). [registry_v22](./registry_v22.md)의 step 스크린샷 증적과 합쳐 텍스트+시각 근거 완성.

### B2 — DB 복원 후 Phase 일괄 실행 전수 FAIL (job#59, 7/7) 원인 규명 및 하드닝 ✅ 완료 (2026-07-29~30)

**계기**: `companies/1440/products/1119/versions/764/phases/768`에서 Phase 일괄 실행 시 7건 전부 FAIL. TC 콘텐츠가 아니라 **실행 인프라 자체의 버그 여러 겹**이 원인이었음을 라이브 디버깅으로 규명. TC 작성 관점의 교훈은 [docs/qa/testcase_guideline.md](../../qa/testcase_guideline.md)로 분리 정리.

**B2-1 — `exec_seed_note`가 이미 끝난 로그인을 또 시켜서 액션 예산 소진 (핵심 원인)**
- `agent-worker` `runTestCase()`는 `autoLogin()`으로 결정적 로그인을 먼저 끝내는데, 당시 `product.exec_seed_note`가 "먼저 `/login`으로 이동해 로그인하라"는 지시를 중복으로 담고 있었음.
- 이미 로그인된 상태에서 에이전트가 문구를 그대로 따라 `/login`으로 재이동 → username 칸에 `admin`을 반복 입력하며 제자리걸음 → `maxStepActions`(4) 전부 소진 → **"Product Test Suite 링크 클릭"은 시도조차 못 함.**
- 그동안 실패마다 도착 페이지가 `/feature/test-suite`, `/settings`, `/` 등 매번 달랐던 이유가 이것 — 액션을 다 쓴 어중간한 상태에서 TC 스텝이 시작되니 매번 다른 곳에서 멈춘 것.
- **수정**: `exec_seed_note`에서 로그인 지시 삭제, "로그인 후 ~ 이동한다"는 상태 서술만 남김(로그인은 코드가 이미 보장).

**B2-2 — 동일 텍스트 라벨이 앱 내 2곳에 존재해 클릭 대상 구분 불가**
- `Layout.tsx`의 상단 네비 링크와 `FeaturesSection.tsx`의 Overview 카드가 둘 다 "Product Test Suite"라는 이름을 씀. 스냅샷이 `{ref, role, name, tag, value}`만 캡처해 위치·목적지 정보가 없어 두 요소가 완전히 동일하게 보였음.
- **수정**: `agent-worker/src/agent.js` `snapshotInteractive()`에 `testId`(`data-testid`), `href`, `type` 캡처 추가. `ACTION_SYSTEM` 프롬프트에 "name이 같으면 href/testId/type으로 구분, 근거 없으면 ref가 작은 쪽 우선"이라는 지침 추가.

**B2-3 — seed 단계(`agenticGoal`)가 완전히 블랙박스라 디버깅 불가**
- TC 스텝(`runTestCase`의 steps 루프)은 `stepLogs`로 남지만, 그 앞의 seed 네비게이션(`agenticGoal`)은 어떤 로그도 남기지 않아 실패 원인 추적이 불가능했음.
- **수정**: `agenticGoal`에 각 액션 결정을 `docker logs`로 남기는 로그(`[worker] seed[i] url=... → action :: 이유`) 추가. B2-1의 실제 원인도 이 로그로 확정함.

**B2-4 — `<div onClick>`으로 구현된 카드가 스냅샷에서 아예 누락**
- Company/Product 카드, Segment 트리 행이 전부 `<div onClick={...}>`로 구현되어 있는데, 스냅샷 셀렉터(`button, a[href], input, select, textarea, [role="button"], [contenteditable="true"]`)엔 일반 `<div>`가 안 잡힘. React onClick은 HTML `onclick` 속성이 아니라 합성 이벤트라 DOM만 봐서는 클릭 가능 여부를 알 수 없었음.
- `role="button"` 추가는 자기 코드에만 가능해 서드파티 앱엔 적용 불가하다는 지적에 따라, **소스 수정 없이도 통하는 대안**으로 결정: 개발자가 클릭 가능함을 알리려 넣는 `cursor` 스타일(pointer/move/grab 등)을 단서로 후보를 넓힘.
- **수정**: `snapshotInteractive()`가 명시적 상호작용 셀렉터 외에, `div/span/li/tr/td/label` 중 `getComputedStyle().cursor`가 `auto`/`default`/`text`가 아닌 요소도 후보로 포함하도록 확장. 100% 커버는 아님(시각적 신호 자체가 없는 클릭 요소는 여전히 못 잡음)이나 소스 수정 없이 대부분의 커스텀 클릭 요소를 잡아냄.
- **검증**: TC999 재실행 → Company 카드(cursor 감지) 클릭이 실제로 성공, `/features/companies/1440`로 정상 이동 확인(job#72).

**B2-5 — 카드형 컨테이너의 이름에 안쪽 버튼 텍스트가 다 섞여 헷갈림**
- B2-4로 잡힌 카드 컨테이너의 이름을 `el.textContent`로 뽑다 보니, 안에 있는 "Test Runs"/"Edit"/"Delete" 등 **중첩 버튼의 텍스트까지 전부 이어붙여** `"WebApp-QAMOBILETest RunsVersionsEditDelete"`처럼 지저분해짐. TC999에서 "Product 카드 클릭"을 지시했는데 카드 대신 안쪽의 진짜 `<button>`(Test Runs)을 눌러 TestRun 화면으로 새는 현상으로 재현됨.
- **수정**: `snapshotInteractive()`에 `ownTextContent()` 추가 — 이미 별도 후보로 잡히는 중첩 상호작용 요소(SELECTOR 매치)를 복제본에서 제거한 뒤 남는 텍스트만 이름으로 사용. 벗겨내면 빈 문자열이 되는 극단적 경우엔 원래 `textContent`로 자동 폴백해 정보 손실 방지.
- **검증**: TC999 재실행 → 카드 이름이 `"WebApp-QA MOBILE"`처럼 깔끔해지고 Product 카드를 정확히 클릭, **PASS**(job#72).

**B2-6 — 같은 이름의 버튼을 반복 클릭 + 액션 실행 실패가 로그에 안 남음**
- TC1006에서 "+ Root Path" 버튼을 정확히 찾아 클릭했으나(1차 성공, 인라인 입력 표시), ref 번호가 스냅샷마다 새로 매겨지는 탓에 "아까 그 버튼과 같다"는 걸 몰라서 **같은 버튼을 disabled 상태로 2번 더 클릭**(재시도) → 판정 시점엔 입력 필드를 못 찾아 FAIL. 게다가 실행 실패(disabled 요소 클릭 등)는 `history`에만 `[실패:...]`로 남고 최종 `stepLogs.actionTaken`엔 반영 안 돼, DB 로그만 봐선 "정상적으로 3번 클릭한 것"처럼 보여 원인 파악이 어려웠음(사용자가 "버튼 텍스트가 정확히 맞는데 왜 실패?"로 지적).
- **수정**: ① `ACTION_SYSTEM`에 "previousActions에 같은 이름의 click이 이미 성공 기록돼 있으면 재클릭하지 말고 done" 지침 추가. ② `stepLogs.actionTaken`을 별도 문자열이 아니라 `history.join(' → ')`로 통일해 **성공/실패 여부가 항상 로그에 그대로 남게** 정정.
- **검증**: TC1006 재실행 → "+ Root Path" 1회 클릭 후 정상적으로 입력·저장까지 완료, **PASS**(job#74).

**B2-7 — cursor 상속으로 같은 대상이 중복 후보로 잡힘 + 판정 불가능한 expected 문구**
- TC1009에서 SegmentTreeView 행(cursor:move)의 자식 span(세그먼트 이름 텍스트)이 부모의 cursor 스타일을 그대로 물려받아 **똑같은 대상이 서로 다른 이름으로 중복 후보**가 됨(행 전체 vs 이름 span만). B2-4의 cursor 휴리스틱이 넓혀놓은 후보군에서 발생한 부작용.
  - **수정**: 조상이 이미 cursor 후보이고 커서 **값까지 같으면**(=단순 상속) 자손은 제외, 값이 다르면(=자기만의 명시적 스타일, 예: 펼치기/접기 화살표) 유지. 단순 "조상이 후보면 무조건 제외"는 진짜 별개 동작(접기/펼치기)까지 지워버리는 부작용이 있어 값 비교로 정교화함.
- TC1009 step3의 expected("강조 배경으로 표시됨")는 CSS 스타일 정보를 아예 안 담는 우리 스냅샷 구조로는 **애초에 판정 불가능한 조건**이었음. step7("스텝 1개 추가됨")도 판정 시점엔 이전 상태를 안 주므로 변경 전후 비교가 불가능해 구조적으로 판정 불가.
  - **수정**: 두 step 모두 "이미 화면에 보이는 최종 상태"만으로 확인 가능하게 expected를 다시 씀(Path 텍스트 존재 확인 / 방금 입력한 값 존재 확인). CSS나 diff가 필요한 조건은 앞으로도 피해야 함(가이드라인에 반영).
- **부수 발견**: `pageText()`가 1500자에서 잘려 "Path: Product Test Suite" 뒤의 전체 경로 텍스트가 판정 AI에게 안 보였음(실제 DB엔 정확한 경로로 저장됐는데도 FAIL). 1500 → 6000자로 상향.
- **부수 발견 2**: elements에 select 값이 정확히 있는데도 판정 AI가 pageText로 재확인하려다 망설이는 경향 — `JUDGE_SYSTEM`에 "select/input 값 확인은 elements의 value만으로 충분, pageText 재확인 불필요"를 명시(TC 하나의 문제가 아니라 select 검증하는 모든 TC에 영향을 주는 일반 규칙이라 프롬프트 레벨에서 수정).
- **검증**: TC1007/1009 재실행 → 각각 **PASS**(job#75, #79).

**결과**: phase 768의 원래 실패 TC 5건(992/999/1006/1007/1009) **전부 PASS 확인**(job#65, #72, #74, #75, #79). TC995/997은 User가 폐기(삭제) 결정.
