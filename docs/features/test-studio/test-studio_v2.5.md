# Test Studio — v2.5: 스타일 예시 TC (Style-by-Example)

> 변경 유형: 기능 추가
> 작성일: 2026-07-14
> 버전: v2.5 (v2 출시 후 · v3 대화형 루프의 **선행 작업**)
> 상태: 완료 (2026-07-28 구현·검증 완료 — develop PR 대기)

---

# 한 줄 요약

**사용자가 팀 방식대로 직접 쓴 "예시 TC 세트"를 그대로(verbatim) 저장해, 생성 시 few-shot으로 원문 주입**한다. AI는 스타일을 재해석하지 않고 **형식·문체만 흉내낸다.** 사용자가 세트를 안 만들면 **기본 견본(Sample, 로그인)** 을 참조한다. 기존의 "운영 TC 자동 주입"은 제거한다.

---

# 개발 배경

Test Studio는 문서 투입 시 **기존 TC를 RAG context로 주입**해 "팀 작성 스타일"을 학습하도록 설계돼 있었다(`buildExistingTcContext`). v3 Phase 0에서 이 retrieval을 재설계하던 중, 접근 자체를 재고하게 됐다.

## 기존 "운영 TC 자동 주입"의 한계

| 한계 | 설명 |
|---|---|
| **콜드스타트** | 신규 Company/Product엔 참고할 ACTIVE TC가 0개 → 스타일 학습 불가 |
| **자의적 절단으로 스타일 유추** | 운영 TC를 통째로 넣되 `TC_STEP_LIMIT`·글자수 상한처럼 **우리가 임의로 잘라** 스타일을 유추 → 어디서 끊을지가 자의적이라 원본 스타일을 부정확하게 반영 |
| **일관성 부재** | 운영 TC에 여러 스타일이 섞여 있으면 AI가 무엇을 따라야 할지 모호 |
| **간접·통제 불가** | 사용자가 원하는 스타일을 "기존 TC에서 유추"하게 두는 것이라, 직접 지정 불가 |

## 해결: 사용자가 스타일 기준을 직접 작성한다

운영 TC를 긁어 유추하는 대신, **사용자가 "이게 우리 팀 스타일이다" 하는 대표 예시 TC를 직접 작성**하게 하고, 그 예시를 **원문 그대로** 생성 프롬프트에 넣는다. 유추·절단이 사라진다.

- 로그인 같은 **보편적 기능**의 TC를 쓰면 도메인 고민 없이 "우리 팀 문체"만 시연 가능.
- few-shot은 **내용(content)이 아니라 형식(form)** 을 가르친다. 예시가 로그인이어도 결제 문서엔 결제 TC가 나온다. (내용 오염은 프롬프트 지시로 차단.)

---

# 핵심 아이디어 — Style-by-Example + 스타일 세트

```
[설정 시]  사용자가 이름 붙인 '스타일 세트'를 만들고, TC 폼으로 예시 TC를 채움 → verbatim 저장 (AI 관여 0)
           Setting 페이지 셀렉트 박스로 활성 세트 선택
                                                              │
[생성 시]  선택된 세트의 예시 TC 원문을 few-shot으로 주입 ─────┘
           "이 형식·문체를 따르되 내용은 문서 기준으로 새로 생성하라"
           (세트 미선택/미작성 → 기본 견본 'Sample'(로그인) 참조)
```

**AI의 역할은 "생성 시 형식 모방"뿐이다.** 설정 시엔 예시를 다시 쓰거나 요약하지 않는다 — "너의 생각이 담기면 안 되고 TC 문장 그대로"를 이렇게 지킨다.

---

# 핵심 결정 (사용자 확정)

| 항목 | 결정 |
|---|---|
| **설정 범위** | **Company별** |
| **주 메커니즘** | 사용자 작성 **예시 TC 세트**를 verbatim few-shot으로 주입 |
| **스타일 세트(프로필)** | 이름 붙인 세트를 **여러 개** 생성(이름 변경 가능). Setting의 **셀렉트 박스**로 활성 세트 1개 선택 |
| **기본 견본 (Sample)** | 시스템 제공 **로그인 견본**(정상 2 + 실패 1). 사용자가 세트를 안 만들거나 비어 있으면 **fallback으로 참조** |
| **예시 구성 기준** | 세트당 **정상 흐름 2 + 실패 흐름 1 (총 3개)** 권장, 상한 5 |
| **우선순위** | **예시 TC 스타일이 무조건 최상위.** enum·기본값은 예시가 **없을 때만** 작동하는 안전망 |
| **보조 설정(enum)** | 문체/포맷/상세수준 **병행 유지**(약한 힌트). `language`는 **제거**(아래) |
| **입력 UI** | **기존 TC 작성 폼 재사용** (title/preconditions/steps/expectedResults 등) |
| **AI 개입 정도** | 순수 verbatim — 설정 시 AI 관여 0 |
| **기존 운영 TC 자동 주입** | **제거** |
| **미리보기** | **미제공** (오버스펙 — 사용자가 자기 예시를 이미 눈으로 봄) |
| **출력 언어** | 별도 enum 없음. **기본 한국어 + 기술 용어는 Word Convention을 따름** |

---

# 스코프 (v2.5 포함 / 제외)

**포함:**
- Company별 **스타일 세트(프로필)** + 세트 내 **예시 TC(verbatim)** 도메인 — 기존 TC 폼으로 작성, CRUD
- Setting 셀렉트 박스로 **활성 세트 선택**, 기본 견본 **Sample(로그인) fallback**
- 보조 설정(enum: 문체/포맷/상세)
- `TestStudioGenerator`에 **선택 세트 예시 verbatim + 보조 지침** 주입, **기존 TC 자동 주입 제거**

**제외 (후순위 / 타 버전):**
- Product별 오버라이드, 라이브 LLM 미리보기, 출력 언어 선택 UI
- 대화형 사전분석 루프 → **v3** / Figma·자동화 → **v4**

---

# 데이터 모델

## ① `test_studio_style_profile` — 스타일 세트

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| company_id | BIGINT FK → company.id (CASCADE) | 대상 Company |
| name | VARCHAR(100) NOT NULL | 세트 이름 (변경 가능) |
| created_at / updated_at | TIMESTAMP | |

**Index:** `(company_id)`
> **기본 견본 Sample은 이 테이블의 row가 아니라 코드 상수**(로그인 예시)로 제공한다 — 모든 Company 공통 fallback이라 중복 저장 불필요. 셀렉트 박스에서 "Sample (기본 견본)"으로 노출.

## ② `test_studio_style_example` — 세트 내 예시 TC (verbatim)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| profile_id | BIGINT FK → test_studio_style_profile.id (CASCADE) | 소속 세트 |
| title | VARCHAR(300) NOT NULL | |
| preconditions | TEXT NULL | |
| steps | JSONB NULL | `List<TestStep>` — `test_case`와 동일 매핑 재사용 |
| expected_results | JSONB NULL | `List<String>` — `test_case`와 동일하게 JSONB 매핑 |
| priority | VARCHAR(10) NULL | HIGH/MEDIUM/LOW (선택 입력) |
| test_type | VARCHAR(20) NULL | SMOKE/FUNCTIONAL/… (선택 입력) |
| sort_order | INT NOT NULL DEFAULT 0 | 표시·주입 순서 |
| created_at / updated_at | TIMESTAMP | |

**Index:** `(profile_id, sort_order)`
> 별도 테이블인 이유: 예시 TC는 Company-scoped이며 Product의 Segment/path와 무관하고 **운영 Test Suite(`test_case`)에 노출되면 안 된다.** 단 컬럼은 TC와 동형이라 폼·매핑을 재사용.

## ③ `test_studio_config` — 보조 설정 + 활성 세트 (Company 1:1)

| 컬럼 | 타입 | 기본값 |
|---|---|---|
| id | BIGINT PK | |
| company_id | BIGINT FK **UNIQUE** | |
| selected_profile_id | BIGINT FK → profile NULL | NULL = 기본 견본 Sample |
| step_format | VARCHAR(30) | `ACTION_EXPECTED` |
| detail_level | VARCHAR(20) | `STANDARD` |
| tone | VARCHAR(20) | `PLAIN` |
| created_at / updated_at | TIMESTAMP | |

### Enum (보조 힌트)
| Enum | 값 | 렌더 예시 |
|---|---|---|
| StepFormat | `ACTION_EXPECTED` | `1. 로그인 버튼 클릭 → 로그인 화면 표시` |
| | `GIVEN_WHEN_THEN` | `Given 로그아웃 / When 클릭 / Then 표시` |
| | `NARRATIVE` | `사용자가 버튼을 누르면 화면이 나타난다` |
| DetailLevel | `CONCISE` / `STANDARD` / `DETAILED` | 핵심만 / 보통 / 촘촘히 |
| Tone | `BULLET`(-함/-음) / `FORMAL`(합니다) / `PLAIN`(한다) | 문체 |

> 예시 세트가 항상 존재(선택 세트 or Sample)하므로 enum은 사실상 **약한 힌트**다. 예시와 충돌하면 **항상 예시가 이긴다.**

---

# 프롬프트 통합 설계

## 제거
- `buildExistingTcContext(...)` + helper(`summarizeTc`/`relevanceScore`/`tokenize`) + 상수(`TC_TOP_K`, `TC_STEP_LIMIT`, …)
- `buildPrompt`의 `[Context: Existing TC Patterns]` 블록

## 활성 예시 해석
1. `config.selected_profile_id`가 있으면 → 그 세트의 예시(sort 순)
2. 없거나 그 세트가 비어 있으면 → **기본 견본 Sample(로그인 상수)**

## 추가 — verbatim 예시 블록(주) + 보조 지침 블록
```
[팀 스타일 예시 TC — 형식·문체 참고용. 내용은 무시하고 아래 문서 기준으로 생성하라]
{선택 세트 예시 TC 1 원문}
{선택 세트 예시 TC 2 원문}
...

[작성 지침 — 보조]
- Step 포맷: {stepFormat}
- 상세 수준: {detailLevel}
- 문체/어조: {tone}
- 언어: 한국어로 작성하되 기술 용어는 Word Convention을 따른다
```
생성 지시 명시: **"위 예시의 형식·문체를 그대로 따르되, 예시의 내용(로그인 등)은 무시하고 [Input Document] 기준으로 새로 생성하라."**
- 예시는 원문 그대로 렌더(요약·절단 없음). `product.description` 주입(v3 Phase 0 Step 1)은 유지.

---

# Backend 변경

## 신규 (`com.myqaweb.teststudio`)
| 파일 | 용도 |
|---|---|
| `TestStudioStyleProfileEntity/Repository/Dto` | 세트 CRUD (`findAllByCompanyId`) |
| `TestStudioStyleExampleEntity/Repository/Dto` | 세트 내 예시 verbatim 저장·조회 (`findAllByProfileIdOrderBySortOrder`) |
| `TestStudioConfigEntity/Repository/Dto` | 보조 설정 + `selected_profile_id` (company 1:1) |
| `StepFormat/DetailLevel/Tone` enum | |
| `DefaultStyleSamples` (상수/리소스) | 기본 견본 Sample = 로그인 예시(정상 2 + 실패 1) |
| `TestStudioStyleService/Impl` + `TestStudioStyleController` | 세트·예시 CRUD + 설정/선택 GET·PUT |
| `db/migration/V{timestamp}__create_test_studio_style.sql` | 세 테이블 생성 |

## 수정
| 파일 | 변경 |
|---|---|
| `TestStudioGenerator.java` | 활성 예시 해석 + verbatim few-shot + 보조 지침 주입, **기존 TC 주입 제거** |
| `TestStudioGeneratorTest.java` | 기존 TC 테스트 제거/대체, verbatim 주입·내용무시 지시·Sample fallback 렌더링 검증 |

---

# API 스펙 (`ApiResponse<T>`)

### 스타일 세트
- `GET /api/test-studio/style-profiles?companyId={id}` — 세트 목록 (+ 항상 "Sample" 옵션 포함해 프론트 렌더)
- `POST /api/test-studio/style-profiles` — 세트 생성 `{ companyId, name }`
- `PUT /api/test-studio/style-profiles/{id}` — 이름 변경
- `DELETE /api/test-studio/style-profiles/{id}` — 세트 삭제(예시 CASCADE)

### 세트 내 예시 TC (TC 폼과 동일 바디)
- `GET /api/test-studio/style-profiles/{profileId}/examples`
- `POST /api/test-studio/style-profiles/{profileId}/examples`
- `PUT /api/test-studio/style-examples/{id}` / `DELETE /api/test-studio/style-examples/{id}`

### 보조 설정 + 활성 세트 선택
- `GET /api/test-studio/config?companyId={id}` — 없으면 기본값(selected=null=Sample) 반환
- `PUT /api/test-studio/config` — upsert (`selectedProfileId`, enum)

---

# Frontend 변경

- **Test Studio Home에 "스타일 설정" 진입 추가** — 드릴다운 준수. Company 선택 후 진입.
- **셀렉트 박스** — `[ Sample(기본 견본) · 내 세트들… ]` 중 활성 세트 선택 → `config.selectedProfileId` 저장.
- **세트 관리 UI(자연스럽게)** — 새 세트 만들기(이름) / 이름 변경 / 삭제. 세트 선택 시 그 안의 예시 TC 목록.
- **예시 TC 작성 — 기존 TC 폼 재사용**: `TestCaseFormModal`의 내용 필드 재사용, **Product 전용(Segment/path) 필드 제외**. 저장은 style-example 엔드포인트.
- 보조 enum 드롭다운(문체/포맷/상세).
- 신규: `api/test-studio-style.ts`, `hooks/useTestStudioStyle.ts`, `types` 확장, `TestStudioStylePage`.

---

# 설정 입력 가이드 (UX)

1. **온보딩 안내(빈 상태)** — *"로그인처럼 보편적인 기능의 대표 TC를 평소 팀 방식대로 **정상 2 + 실패 1 (총 3개)** 작성하세요. 내용이 아니라 형식·문체가 학습됩니다."*
2. **기본 견본 Sample 항상 제공** — 아무것도 안 만들어도 로그인 견본으로 즉시 동작(콜드스타트 없음). 셀렉트 박스 첫 옵션.
3. **기존 TC 폼 재사용** — 새 UI 학습 불필요.
4. **보조 enum** — 예시가 못 보여주는 축만 약하게 보강.

---

# 구현 절차 (User 승인 단위)

각 Step은 User 지시 없이 다음으로 넘어가지 않는다. 완료 시 `- [ ]`를 `- [x]`로 갱신.

### Phase A — Backend
- [x] **Step 1** — 마이그레이션(세 테이블) + Profile/Example/Config Entity·enum·Repository·Dto + 기본 견본 `DefaultStyleSamples` 상수(로그인 정상2+실패1). (2026-07-14) — `V202607141612__create_test_studio_style.sql` 3테이블 생성, enum 3종(StepFormat/DetailLevel/Tone), Entity 3종(plain Long id, steps/expectedResults JSONB), Repository 3종, Dto 3종. `compileJava` + `TestStudioIntegrationTest`(Flyway 실적용) 통과.
- [x] **Step 2** — Service(세트·예시 CRUD, config upsert+선택, 기본값·Sample fallback) + Controller + 단위/컨트롤러 테스트. (2026-07-14) — `TestStudioStyleService(Impl)` + `TestStudioStyleController`(세트 4 + 예시 4 + config 2 엔드포인트). not-found는 도메인 관례대로 `IllegalArgumentException`(→400). 세트 상한 10/예시 상한 5, 선택 세트 Company 소속 검증, `resolveActiveExamples`(Sample fallback). 단위 25건 + 컨트롤러 16건 통과.
- [x] **Step 3** — `TestStudioGenerator` 통합: 활성 예시 해석 + verbatim few-shot + 내용무시 지시 + 보조 지침, **기존 TC 주입 제거**(메서드/블록/상수/테스트 정리). 프롬프트 렌더링 테스트. (2026-07-14) — generator가 `styleService.resolveActiveExamples`/`getConfig`(companyId via `product.getCompany().getId()`) 호출, `[팀 스타일 예시 TC]`(verbatim) + `[작성 지침]`(enum) 블록 주입 + "예시 내용 무시" 지시. `buildExistingTcContext`/`summarizeTc`/`relevanceScore`/`tokenize` 및 `TC_*` 상수 제거(**v3 Phase 0 Step 2 §F 코드 폐기 완료**). Generator 12건 + 통합 2건 + 전체 백엔드 스위트 통과.

### Phase B — Frontend
- [x] **Step 4** — `api/test-studio-style.ts` + `useTestStudioStyle` + types. (2026-07-20) — `types/test-studio.ts`에 StepFormat/DetailLevel/Tone·StyleProfile/StyleExample(Input)/TestStudioConfig 추가(TestStep/priority/testType는 features.ts 재사용). API 모듈 10개 엔드포인트, `useTestStudioStyle(companyId)` 훅(profiles+config 로드, 세트/설정 변경 헬퍼, 예시 CRUD passthrough, exampleCount 동기화). `tsc --noEmit` + eslint 0 warnings 통과.
- [x] **Step 5** — 스타일 설정 화면: 셀렉트 박스(Sample+세트) + 세트 생성/이름변경/삭제 + 예시 TC CRUD(TC 폼 재사용) + 보조 enum + Home 진입 + 온보딩 안내. (2026-07-20) — `TestStudioStylePage`(`/test-studio/style`), `StyleExampleModal`(TC 폼 내용 필드 미러링, path/status/images 제외). Home 헤더 "스타일 설정" 버튼 + App 라우트. `tsc`/eslint 0 warnings + `npm run build` 통과. data-testid 부여(style-profile-select/create/rename/delete/add-example/example-row/config-*).

### Phase C — 테스트 · 검증 · 문서
- [x] **Step 6** — Backend 단위/통합(세트·예시 CRUD, 선택, Sample fallback, generator verbatim 반영). (2026-07-20) — 단위 Service 25 + Controller 16 + Generator 12, 통합 `TestStudioStyleIntegrationTest` 4건(JSONB 라운드트립, FK CASCADE/SET NULL, resolve fallback, 스타일→generator 프롬프트 verbatim e2e).
- [x] **Step 7** — E2E: 세트 생성 → 예시 작성 → 선택 → Job 생성 시 스타일 반영 + 기존 운영 TC 미주입 + 미선택 시 Sample 사용 확인. (2026-07-20) — `qa/api/test-studio-style.spec.ts`(16건, CRUD+config, AI 비용 0) + `qa/ui/test-studio-style.spec.ts`(5건, 세트 생성/예시 폼/Sample fallback/enum 영속).
- [x] **Step 8** — 4-Agent Pipeline Agent-D(`./gradlew clean build` → `docker compose up -d --build` → `npx playwright test` → `docker compose down`). (2026-07-20) — clean build 통과, worktree 스택(8086/5179) 기동·Flyway 신규 마이그레이션 적용, **전체 Playwright 363 passed / 28 skipped**, 유일 실패는 pre-existing `ui/kb.spec.ts` KB Pin(test-studio 무관, 2회 동일 재현). teardown 후 공용 DB 보존 확인.
- [x] **Step 9** — 문서: `test-studio.md` 버전 히스토리 v2.5 반영 + v3 Phase 0 조정(아래) + 본 문서 [최종 요약]. (2026-07-28) — master 배너/히스토리/구현 현황 v2.5 반영, v3 Phase 0 Step 2 "v2.5 이관·폐기" 처리, 하단 [최종 요약] 추가.

---

# 기존 v3 Phase 0와의 관계 (중요)

| v3 Phase 0 항목 | 처리 |
|---|---|
| **Step 1** — `product.description` 주입 | **유지** (이미 구현·통과). 본 설정과 상호 보완 |
| **Step 2** — 기존 TC retrieval 재설계 | **폐기 → v2.5로 대체.** worktree 미커밋 재설계 코드(ACTIVE 필터/relevance/summarize)는 v2.5 Step 3에서 **제거**하며 정리 |

> v3는 "대화형 사전분석·확정 루프"에 집중, "컨텍스트를 무엇으로 채울지"의 스타일 축은 v2.5가 소유. v3 문서 Phase 0 Step 2 체크박스는 v2.5 Step 9에서 "v2.5로 이관" 주석과 함께 정리.

---

# 리스크 / 엣지 케이스

| 케이스 | 처리 |
|---|---|
| 예시가 로그인인데 문서는 결제 → 내용 오염 | 프롬프트에 "예시 내용 무시, 형식만" 명시 + 보편 도메인 권장 |
| 세트 없음/선택 세트 비어 있음 | 기본 견본 Sample(로그인)로 fallback. 콜드스타트 없음 |
| 예시 품질 낮음/모호 | 온보딩 가이드(정상2+실패1)로 유도. 나머지는 사용자 책임(직접 지정이 목적) |
| 예시 다수 → 토큰 폭증 | 세트당 상한 5 |
| 예시와 enum 상충 | **항상 예시 우선** |
| 예시 TC가 운영 Test Suite에 노출 | 별도 테이블 → 노출 원천 차단 |
| 선택 세트 삭제 시 config가 가리키던 id | 삭제 시 config.selected_profile_id를 NULL(=Sample)로 정리 |

---

# 확인 필요 / 선결정 사항 (대부분 확정)

| # | 항목 | 결정 |
|---|---|---|
| 1 | 예시 구성 | **정상 2 + 실패 1 (총 3) 권장, 상한 5** ✅ |
| 2 | 우선순위 | **예시 무조건 최상위** ✅ |
| 3 | priority/testType | **포함(선택 입력)** ✅ |
| 4 | 세트/셀렉트 박스 + Sample fallback | **채택** ✅ (아래 잔여 확인) |
| 5 | 미리보기 | **미제공** ✅ |
| 6 | 언어 | `language` enum 제거, **한국어 기본 + 기술용어 Convention** ✅ |

**잔여 확인 (소소):**
- (a) **세트/프로필 테이블 명** — `test_studio_style_profile` 로 제안(변경 가능).
- (b) **세트 개수 상한** — Company당 제안: 10개.
- (c) **기본 견본 Sample** — 코드 상수(read-only) 제안. (편집 원하면 사용자가 자기 세트 생성)

---

# 참조

- [test-studio.md](./test-studio.md) — 메인 명세서
- [test-studio_v2.md](./test-studio_v2.md) / [test-studio_v3.md](./test-studio_v3.md) (Phase 0 Step 2가 본 문서로 이관)
- 재사용 대상: `frontend/src/components/features/TestCaseFormModal.tsx` (TC 작성 폼)
- 연동 도메인: Word Convention(용어·언어), Knowledge Base, Feature Registry

---

> 본 문서는 **계획 단계**다. "확인 필요"(잔여 a~c) 정리 후 Phase A Step 1부터 착수하며, 각 Step 완료 시 체크박스를 갱신하고 모든 Step 완료 후 하단에 **[최종 요약]**을 추가한다.

---

## [최종 요약]

> 상태: **완료** — 2026-07-28. Step 1~9 전부 완료·검증. (미커밋 — 커밋/PR은 User 승인 후)

**무엇을**: 문서로 TC를 생성할 때 참고할 스타일을, 운영 TC를 긁어 유추하던 방식에서 **사용자가 직접 작성한 예시 TC를 verbatim으로 주입**하는 방식(Style-by-Example)으로 전환했다. AI는 예시의 형식·문체만 모방하고 내용은 무시한다.

**Backend**
- 신규 3테이블 — `test_studio_style_profile`(Company별 스타일 세트) / `test_studio_style_example`(세트 내 예시 TC, steps·expectedResults JSONB) / `test_studio_config`(보조 enum + `selected_profile_id`, Company 1:1). FK: 예시 CASCADE, config 선택 SET NULL.
- enum 3종 `StepFormat`/`DetailLevel`/`Tone`, 기본 견본 상수 `DefaultStyleSamples`(로그인 정상2+실패1).
- `TestStudioStyleService(Impl)` + `TestStudioStyleController` — 엔드포인트 10개(세트 4 + 예시 4 + config 2). 세트 상한 10/예시 상한 5, 선택 세트 Company 소속 검증, `resolveActiveExamples`(선택 세트 → 없거나 비면 Sample fallback).
- `TestStudioGenerator` — 활성 예시 verbatim few-shot 블록 + "예시 내용 무시" 지시 + 보조 enum 지침 주입. **기존 운영 TC 자동 주입(`buildExistingTcContext` 등) 제거** (v3 Phase 0 §F 코드 폐기).

**Frontend**
- `/test-studio/style` 화면(`TestStudioStylePage`) + Home 헤더 "스타일 설정" 진입. 셀렉트 박스(Sample + 세트) + 세트 생성/이름변경/삭제 + 보조 enum + 온보딩 안내.
- 예시 TC 작성은 `StyleExampleModal`(기존 TC 폼 내용 필드 미러링, Product 전용 path/status/images 제외).
- `api/test-studio-style.ts` + `useTestStudioStyle` 훅 + `types` 확장.

**테스트 / 검증**
- 단위: Service 25 + Controller 16 + Generator 12
- 통합(Testcontainers): `TestStudioStyleIntegrationTest` 4 (JSONB 라운드트립, FK CASCADE/SET NULL, resolve Sample fallback, 스타일→generator 프롬프트 verbatim e2e)
- E2E(Playwright): API 16 + UI 5
- Agent-D 전체: `clean build` 통과 → worktree 스택 기동(Flyway 신규 마이그레이션 적용) → **전체 Playwright 363 passed / 28 skipped** (유일 실패는 pre-existing `ui/kb.spec.ts` KB Pin, test-studio 무관) → teardown·공용 DB 보존.

**v3 Phase 0와의 관계**: Step 1(`product.description` 주입)은 **유지**, Step 2(기존 TC retrieval §F)는 **본 v2.5로 이관·폐기**. v3은 대화형 사전분석·확정 루프에 집중한다.

**후속(범위 밖)**: Product별 세트 오버라이드, 라이브 LLM 미리보기 → 필요 시 별도 버전.
