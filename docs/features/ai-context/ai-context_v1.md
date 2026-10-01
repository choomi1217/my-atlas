# AI Context — v1: AI 프롬프트 컨텍스트 지도 + 통합 계획

> 변경 유형: 기능 개선  
> 작성일: 2026-10-01  
> 버전: v1  
> 상태: 진행 중 (계획 — User 의사결정 대기)

---

# 배경

전체 기능 골격(KB · Word Convention · Senior · Test Studio · AI 자동화 실행)은 갖춰졌다.
이제 **세밀한 품질 작업**이 필요한데, 출발점이 막막한 이유는 하나로 모인다:

> **"AI에게 무엇이 들어가는지"가 코드 곳곳(Java 3곳 + Node 워커 1곳)에 흩어져 있어,
> 한눈에 볼 수도, 바꿀 수도, 검증할 수도 없다.**

## User가 생각하는 기능 흐름

| 흐름 | 단계 |
|------|------|
| 흐름 1 | ① KB 저장 · Word Convention 저장 → ② Senior 질문 |
| **흐름 2 (중요)** | ① KB · Word Convention 저장 → ② **Company 정보 저장 (신규)** → ③ TC Studio로 TC 자동 생성 → 원하는 TC만 확정 → ④ TC Automation 실행 |

## 이 문서의 목표

1. **(지금)** 현재 AI 호출 지점별로 "어떤 정보가, 어디서, 어떻게 잘려서" 들어가는지 코드 기준으로 정리한다 — §1
2. **(지금)** 흐름 1·2 대비 빈 구멍을 정리한다 — §2
3. **(결정 후)** 흩어진 프롬프트를 모으고, Company 정보를 만들고, 자동화 컨텍스트를 보강하는 단계별 계획 — §3~§4

---

# 1. 현황 — AI 컨텍스트 지도 (코드 기준, 2026-10-01 develop)

## 1-0. AI 호출 지점 전체 목록

| # | 기능 | 위치 | 모델 | 흐름 |
|---|------|------|------|------|
| A | Senior 채팅 | `backend/.../senior/SeniorServiceImpl.java` `buildRagContext()` | application.yml 기본(haiku-4-5) | 흐름 1 |
| B | **TC Studio 생성** | `backend/.../teststudio/TestStudioGenerator.java` `buildPrompt()` | 동일, `maxTokens=8192` per-call | 흐름 2-③ |
| C | **TC Automation (웹·Android)** | `agent-worker/src/agent.js` `ACTION_SYSTEM` / `JUDGE_SYSTEM` | env `AGENT_MODEL`(기본 haiku-4-5) | 흐름 2-④ |
| D | TC 단건 AI Draft (레거시) | `backend/.../feature/TestCaseServiceImpl.java` `generateDraft()` | 동일 | — |
| E | KB 내용 정리 | `backend/.../knowledgebase/KbContentCleanupService.java` `PROMPT_TEMPLATE` | 동일 | 흐름 1-① 부수 |

> D: 프론트 `frontend/src/api/features.ts`에 API 클라이언트는 있으나 `.tsx`에서 호출하는 곳이 없음 → **미사용 추정** (§5 확인 필요).
> E: 프롬프트 컨텍스트 주입 대상이 아니므로 이 문서 범위 밖.

## 1-1. (B) TC Studio — 프롬프트 구성

`TestStudioGenerator.buildPrompt()`가 **하나의 user 메시지**로 아래 섹션을 이어붙인다 (system 메시지 없음).

| 순서 | 섹션 | 출처 | 범위(Scope) | 가공 |
|------|------|------|-------------|------|
| 1 | `[System]` 지시문 | 코드 하드코딩 | — | "시니어 QA, JSON 배열, 예외 케이스 1건 이상" |
| 2 | `[Product]` | `product.name` + `product.description` | Product | description 없으면 name만 |
| 3 | `[Context: Domain Knowledge]` | KB 벡터 검색 `findSimilar(top 5)` | **전역** (회사 무관) | 쿼리 = 입력문서 **앞 2000자**만 임베딩 / 각 청크 **400자 절단** / 수동·PDF 구분 없음 |
| 4 | `[Context: Word Convention]` | `conventionRepository.findAll()` | **전역 전체** | `- term: definition` 나열, 필터·절단 없음 |
| 5 | `[팀 스타일 예시 TC]` | `styleService.resolveActiveExamples(companyId)` | **Company** | 활성 세트 verbatim, 없으면 내장 로그인 Sample |
| 6 | `[작성 지침 — 보조]` | `styleService.getConfig(companyId)` | Company | Step 포맷 / 상세 수준 / 문체 enum → 한글 문장 |
| 7 | `[Input Document]` | 사용자 업로드 MD 또는 PDF(PDFBox 텍스트) | 요청 | 원문 그대로 (길이 제한 없음) |
| 8 | `[Output Schema]` | 코드 하드코딩 | — | title/preconditions/steps/expectedResults/priority/testType/suggestedSegmentPath |

**들어가지 않는 것:** Company 자체 정보(Company 엔티티는 `name`, `isActive`뿐), Product의 Segment 트리, 기존 TC(v2.5에서 제거), 실행 프로파일.

## 1-2. (C) TC Automation — 프롬프트 구성

워커(Node)가 백엔드 `GET .../context`(`AgentExecutionServiceImpl.getExecutionContext`)로 받은 데이터 + 브라우저 관측값으로 **호출마다 JSON**을 만들어 user 메시지로 보낸다. system 프롬프트는 `agent.js` 상수 2개(웹·Android 공용).

### 백엔드 → 워커로 전달되는 데이터 (`WorkerContextResponse`)

| 필드 | 출처 | **워커가 프롬프트에 사용?** |
|------|------|------------------------------|
| `baseUrl` | `product.execBaseUrl` | 진입 URL로만 사용 (프롬프트엔 X) |
| `seedNote` | `product.execSeedNote` | ✅ segmentPath 없을 때 seed 목표 |
| `testCases[].segmentPath` | TC path → Segment 이름 | ✅ seed 목표 (`A > B > C` 화면까지 이동) |
| `testCases[].steps[].action/expected` | TC | ✅ 핵심 입력 |
| `testCases[].title` | TC | ❌ 로그 출력만 |
| `testCases[].preconditions` | TC | ❌ **전달되지만 미사용** |
| `testCases[].expectedResults` | TC | ❌ **전달되지만 미사용** |

### 호출 유형별 입력

| 호출 | system | user JSON 필드 |
|------|--------|----------------|
| seed 이동 (`agenticGoal`) | `ACTION_SYSTEM` | goal, url, elements, availableActions |
| step 액션 결정 (step당 최대 `MAX_STEP_ACTIONS`회: 웹 4 / Android 6) | `ACTION_SYSTEM` | action, expectedState, url, elements, previousActions, availableActions |
| step 판정 (step당 1회) | `JUDGE_SYSTEM` | expected, url, elements, pageText(6000자), accessibilityTree(depth 15) |

**들어가지 않는 것:** Product 설명, Company 정보, Word Convention, KB, TC 제목·사전조건·기대결과, 이전 step 결과.

**기타 확인 사항:** 로그인은 `autoLogin()`이 대상 앱의 `/api/auth/login`을 직접 호출하고 워커 자신의 계정(`AGENT_WORKER_USERNAME/PASSWORD`)을 쓴다 → **my-atlas 자신을 테스트하는 구조에 묶여 있음**. 다른 회사 서비스를 테스트하려면 로그인 정보·방식이 Company/Product 쪽 설정으로 와야 한다.

## 1-3. (A) Senior — 참고 (흐름 1)

| 섹션 | 출처 | 범위 |
|------|------|------|
| 역할 지시 | 코드 하드코딩 (영문) | — |
| FAQ 참고 항목 | 사용자가 선택한 FAQ | 요청 |
| KB (직접 작성) | `findSimilarManual(top 3)` | 전역 |
| KB (도서) | `findSimilarPdf(top 2)` | 전역 |

**들어가지 않는 것: Word Convention.** 흐름 1이 "KB + Convention 저장 → Senior 질문"인데, 현재 Senior는 Convention을 보지 않는다.

## 1-4. 관측성(Observability)

| 기능 | 기록되는 것 | 기록 안 되는 것 |
|------|-------------|-----------------|
| Studio / Senior / Draft | `ai_usage_log`: feature, model, 토큰 수, 비용, 소요시간 | **실제로 보낸 프롬프트 내용** |
| Automation | `agent_execution_result.token_cost`, stepLogs(액션 이력·판정 근거) | 보낸 입력 JSON |

→ "이번 생성에 KB 어떤 청크가 들어갔지?"를 사후에 확인할 방법이 없다. **막막함의 직접 원인.**

---

# 2. 흐름 대비 갭(Gap)

| # | 갭 | 영향 흐름 | 심각도 |
|---|----|-----------|--------|
| G1 | 프롬프트가 4개 파일에 하드코딩 분산 (Java 텍스트블록 3 + JS 상수 1) | 전체 | 높음 (작업성) |
| G2 | 실제로 보낸 프롬프트/컨텍스트를 볼 수 없음 | 전체 | 높음 (검증 불가) |
| G3 | **Company 정보 저장소 없음** (엔티티가 name/isActive뿐) | 흐름 2-② | 높음 |
| G4 | Word Convention · KB가 **전역** — 회사가 2곳 이상이면 용어가 섞임 | 흐름 2 | 중 (결정 필요) |
| G5 | Automation이 Convention·Product 설명·TC 사전조건·기대결과를 모름 | 흐름 2-④ | 높음 |
| G6 | Automation 로그인이 my-atlas 전용 방식(`/api/auth/login`)으로 고정 | 흐름 2-④ | 중 (타사 대상이면 높음) |
| G7 | Senior가 Convention을 안 씀 | 흐름 1 | 중 |
| G8 | Studio KB 쿼리가 문서 앞 2000자만 사용 — 긴 PRD 뒷부분 기능은 KB 매칭 안 됨 | 흐름 2-③ | 중 |
| G9 | Studio Convention 전체 주입 — 용어가 많아지면 토큰만 늘고 노이즈 | 흐름 2-③ | 낮음 (현재 규모 의존) |

---

# 3. 제안 — 단계별 계획

원칙: **먼저 보이게(Phase 0) → 모으고(Phase 1) → 채운다(Phase 2~3).**
안 보이는 상태에서 프롬프트를 고치면 좋아졌는지 판단할 수 없으므로 순서를 바꾸지 않는 것을 권장한다.

## Phase 0 — 가시화 (동작 변화 없음)

| Step | 내용 | 갭 |
|------|------|----|
| 0-1 | 이 문서 §1을 메인 명세서 `docs/features/ai-context/ai-context.md`로 승격 (AI 호출 지점·섹션·출처·범위 단일 지도) | G1 |
| 0-2 | **컨텍스트 미리보기 API** — Studio: Product + 문서를 넣으면 Claude 호출 없이 "조립된 프롬프트 섹션별 내용"만 반환 (KB 검색용 임베딩 1회만 발생) | G2 |
| 0-3 | **프롬프트 스냅샷 저장** — Studio Job 실행 시 최종 프롬프트(또는 섹션별 요약: KB 청크 id 목록, Convention 개수, 스타일 세트 id)를 Job에 기록 | G2 |
| 0-4 | Automation stepLog에 판정 입력 요약(사용한 expected, pageText 길이 등) 기록 | G2 |

## Phase 1 — 모으기 (리팩터링, 출력 동일 유지)

| Step | 내용 | 갭 |
|------|------|----|
| 1-1 | 백엔드 프롬프트 텍스트를 `backend/src/main/resources/prompts/` 템플릿 파일로 분리 (Studio · Senior · Draft) | G1 |
| 1-2 | 공통 컨텍스트 블록을 만드는 서비스 하나로 통합 (예: `AiContextService` — `companyBlock()`, `productBlock()`, `conventionBlock()`, `kbBlock()`) → Studio · Senior · Automation context API가 같은 블록을 재사용 | G1 |
| 1-3 | 워커 프롬프트를 `agent-worker/src/prompts.js` 한 파일로 모음 | G1 |
| 1-4 | 리팩터 전후 **프롬프트 문자열 동일성** 단위 테스트 (스냅샷 비교) | — |

## Phase 2 — Company 정보 (흐름 2-② 신규)

| Step | 내용 | 갭 |
|------|------|----|
| 2-1 | Company 정보 항목 확정 (§5 Q1) → 신규 테이블 마이그레이션 (타임스탬프 버전) | G3 |
| 2-2 | Company 정보 화면 (드릴다운: Company 선택 → 정보 편집) | G3 |
| 2-3 | Studio 프롬프트에 `[Company]` 섹션 주입 | G3 |
| 2-4 | Convention / KB 회사 범위 정책 적용 (§5 Q2·Q3 결정에 따라) | G4 |

## Phase 3 — Automation 컨텍스트 보강

| Step | 내용 | 갭 |
|------|------|----|
| 3-1 | context API에 Product 설명 · Company 정보 · (관련) Convention 추가 | G5 |
| 3-2 | 워커가 TC 단위로 title · preconditions · expectedResults · 도메인 블록을 프롬프트에 포함 | G5 |
| 3-3 | 토큰 비용 전후 비교 (동일 TC 세트로 `token_cost` 측정) — 증가폭이 크면 블록 축소 | — |
| 3-4 | (타사 대상일 때) 로그인 방식을 Product 실행 프로파일로 이동 | G6 |

## Phase 4 — 흐름 1 보완 · 품질 튜닝 (후순위)

| Step | 내용 | 갭 |
|------|------|----|
| 4-1 | Senior에 Convention 블록 주입 (Phase 1-2 재사용) | G7 |
| 4-2 | Studio KB 검색을 문서 청크별로 수행 후 합산 (앞 2000자 한계 해소) | G8 |
| 4-3 | Convention을 문서에 등장하는 용어만 필터링해 주입 | G9 |

---

# 4. 관계 정리 — 기존 계획 문서와의 경계

| 문서 | 상태 | 이 문서와의 관계 |
|------|------|------------------|
| `test-studio/test-studio_v3.md` | 진행 중 (대화형 분석 루프 + 출처 태깅) | v3 §1 "컨텍스트 주입은 이미 구현됨"과 일치. 본 문서 Phase 0·1이 v3 출처 태깅(§G)의 **선행 기반**이 됨 — v3 착수 전 Phase 1 완료 권장 |
| `test-studio/test-studio_v4.md` | 계획 (Figma + 자동화 코드 생성) | 범위 겹치지 않음 |
| `registry/registry_v24.md` | 완료 (Android) | Automation 프롬프트는 웹·Android 공용 → Phase 3 변경은 양쪽에 동시 영향 |

---

# 5. 확인 필요 (User 결정 사항)

| # | 질문 | Claude 제안 |
|---|------|-------------|
| Q1 | **Company 정보에 무엇을 담을까?** 후보: 서비스 도메인/한 줄 소개, 주요 사용자·역할(권한 체계), 플랫폼(웹/앱), 테스트 환경 정보, 테스트 시 주의/금지사항(결제·실데이터 등) | 처음엔 **자유 서술 필드 3~4개**로 시작 → 쓰다 보면서 구조화. 너무 이른 정형화는 입력 부담만 늘림 |
| Q2 | Word Convention은 **회사별**인가 **전역**인가? | 회사별 (같은 단어가 회사마다 다른 의미일 수 있음) + "공통" 범위 허용 |
| Q3 | KB는 회사별인가 전역인가? | **전역 유지** (QA 일반지식·도서 청크는 회사 무관). 회사 특화 지식은 Q1 Company 정보로 |
| Q4 | Automation 대상이 **my-atlas 자신**뿐인가, **타사 서비스**도 포함인가? | 답에 따라 Phase 3-4(로그인) 우선순위가 결정됨 |
| Q5 | 레거시 단건 AI Draft(D, `generateDraft`) 제거해도 되는가? | UI 호출 없음 → 제거 시 프롬프트 지점 하나 감소 |
| Q6 | 시작 지점 | **Phase 0 (0-1 ~ 0-3)** 부터. 동작 변화 없고 즉시 "무엇이 들어가는지" 답을 줌 |

---

# 구현 절차 (User 승인 단위)

- [ ] Phase 0 — 가시화
- [ ] Phase 1 — 모으기
- [ ] Phase 2 — Company 정보
- [ ] Phase 3 — Automation 컨텍스트 보강
- [ ] Phase 4 — 흐름 1 보완 · 품질 튜닝
