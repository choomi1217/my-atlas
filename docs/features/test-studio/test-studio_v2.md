# Test Studio — v2: Header 승격 + Path 추천 보관 + 수동 적용 UX

> 변경 유형: 기능 개선
> 작성일: 2026-04-20
> 버전: v2
> 상태: 진행 중

---
# 요구사항
Segment 미지정 섹션에 자동완성된 TC에 Path를 부여할 방법이 없음

# 추가 요구사항

1. Test Studio를 Product Test Suite 의 하위 메뉴가 아닌 Header에 존재했으면 좋겠습니다.
  - Test Stuido만의 UI가 필요합니다.
  - Company 선택 -> 문서 삽입 -> TC 생성
  - 자동 완성되었으나 아직 배정되지 않은 TC 목록 / 자동 완성되었고 배정도 된 TC 목록
    - 선택한 Company의 TC 목록을 보여주고 싶습니다.
2. 현재 Product까지 선택해야 TC를 생성할 수 있으나 Company 종속으로 만든 후, Product를 선택할 수 있게 하고 싶습니다.

3. registry 관련 요구사항
  1. TC 목록 TC List에서 TC Card를 드래그 앤 드랍시 TC의 Path를 수정할 수 있어야 합니다.
  2. TC 수정페이지에서 Path를 수정할 수 있어야 합니다.

4. 한번만 더 확인할 사항
  - 자동완성된 TC에 강제로 Path를 주입하지 않는지 한번 더 확인 하셔야 합니다.
  - 자동완성된 TC에 Path를 수동 주입해줄때, 유저 편의성을 지원해야합니다.
    1. 자동완성된 TC에 Path 추천 후, 추천대로 삽입 기능
    2. 추천대로 진행하지 않을경우 수동 삽입 , 이때 대량 체크 후 Path 삽입 기능 지원

---

## Context

### 현재 상태 (v1 + v1.1 완료)

Test Studio는 Markdown/PDF 문서를 투입하면 Claude(RAG: KB + Convention + 기존 TC)로 DRAFT TestCase를 자동 생성한다. 각 TC 응답에는 `suggestedSegmentPath: List<String>` 필드가 포함되며 Claude가 추정한 Segment 계층(예: `["결제", "IC카드 결제"]`)을 담고 있다.

그러나 현재 구현은:
- **저장 시 `suggestedSegmentPath`를 폐기**한다 (`TestStudioGenerator.toTestCaseEntity()`에서 파싱만 하고 DB 미저장).
- `test_case.path`는 하드코딩으로 `new Long[0]` → **모든 DRAFT TC가 📦 Segment 미지정 섹션에 누적**된다.
- Test Studio 진입은 `/features/companies/:cid/products/:pid/test-studio`로 Product 드릴다운 하위에 있어 Company 단위 TC 현황 파악이 어렵다.
- 기존 `TestCasePage`는 TC Path 수정 UI가 없다 — API(`PUT /api/test-cases/{id}`)는 path 필드를 받지만, `TestCaseFormModal`에 path 편집 위젯이 없고 DnD도 Segment 재부모화에만 사용된다.

### v2 목표 (요구사항 1~4 통합)

1. **Header 최상위 메뉴로 승격** — `/features` 밑의 드릴다운이 아닌 `/test-studio` 루트 탭. Test Studio 전용 레이아웃: Company 선택 → Product 선택 → 문서 투입 → TC 생성 → Company 레벨 DRAFT TC 대시보드.
2. **`suggestedSegmentPath`를 DB에 영속화** — TC에 Claude 추천 경로를 **문자열 그대로 보관**. 저장 시점에 `path`를 자동 주입하지 **않는다** (요구사항 4의 "강제 주입 금지" 준수).
3. **추천 1클릭 적용 + 일괄 적용 UX** — DRAFT TC별로 "🤖 추천" 배지 노출. 단건 "추천 적용" 버튼과 체크박스 다중 선택 후 "일괄 추천 적용" 버튼 제공. 서버가 Segment 트리에서 이름 기반 최장 접두사 매칭으로 실제 ID 배열로 변환하여 저장.
4. **TC Path 수동 편집** — TC Card DnD로 Segment 트리 노드에 드롭 시 path 교체. TC 편집 모달에 Segment Tree Picker 추가.
5. **Company 레벨 DRAFT 대시보드** — 선택한 Company의 모든 Product를 가로지르는 DRAFT TC를 2섹션으로 구분: 🤖 자동 생성 / Path 미배정 vs ✅ 자동 생성 / Path 배정완료.

### 스코프 분리 (v2에 포함 / 제외)

**포함:** Header 메뉴 승격, `suggested_segment_path` 컬럼 추가, 추천/일괄 적용 API·UI, TC Card DnD→Path 수정, TC 편집 모달 Segment Picker, Company 레벨 DRAFT 대시보드.

**제외 (v3+):** fuzzy 매칭, 자동 Segment 생성, Notion/Figma URL 연동, PDF 멀티모달, 매핑 신뢰도 점수.

---

## 설계 원칙

1. **강제 Path 주입 금지** (요구사항 4-1) — 생성 파이프라인은 `path=[]`로 저장을 유지. 이름→ID 변환은 오직 **사용자가 "추천 적용"을 명시적으로 트리거할 때만** 서버에서 수행.
2. **추천은 DB에 보관** — `test_case.suggested_segment_path TEXT[]` 컬럼 신규. Claude 응답을 문자열 배열 그대로 저장해 언제든 재적용 가능.
3. **최장 접두사 매칭 (서버 Resolver)** — 추천 적용 API는 Product의 Segment 트리에서 이름 기반으로 순회. 매칭 성공분만 `path`에 반영, 전부 실패 시 400 대신 200 + `resolvedLength=0` 응답으로 UI에서 수동 유도.
4. **드릴다운 유지** (CLAUDE.md Frontend 규칙) — Test Studio 페이지 내에서도 한 번에 한 뷰. Company → Product → 입력/대시보드 전환은 탭/스텝 형태로.
5. **결정적 이름 매칭** — `String.strip()` 후 대소문자 구분. 동일 parent 하 동명 중복 시 id 오름차순 + WARN 로그.
6. **기존 Product 레벨 라우트 제거** — `/features/.../test-studio` 라우트와 TestCasePage의 "Test Studio" 진입 버튼은 제거. 대신 TestCasePage에서 DRAFT 필터 배너에만 "Test Studio로 이동" 링크 유지.
7. **Backward compatibility** — 기존 DRAFT TC(`suggested_segment_path=NULL`)도 UI에서 수동 할당 경로로 처리 가능해야 함.

---

## 파일 변경 목록

### Backend — 신규

| 파일 | 용도 |
|------|------|
| `backend/src/main/java/com/myqaweb/teststudio/SegmentPathResolver.java` | `@Component` — `ResolverContext buildContext(Long productId)` + `Long[] resolve(ctx, List<String> names)` 최장 접두사 매칭 |
| `backend/src/main/java/com/myqaweb/feature/TestCasePathController.java` | 신규 컨트롤러 — 추천 적용 / 경로 수정 / 일괄 적용 전용 엔드포인트 모음 (`/api/test-cases/{id}/apply-suggested-path`, `/{id}/path`, `/bulk-apply-suggested-path`) |
| `backend/src/main/resources/db/migration/V{timestamp}__add_test_case_suggested_segment_path.sql` | `test_case.suggested_segment_path TEXT[]` 컬럼 추가 (NULL 허용) |
| `backend/src/test/java/com/myqaweb/teststudio/SegmentPathResolverTest.java` | 단위 테스트 9건 (null/empty/부분/동명중복 등) |
| `backend/src/test/java/com/myqaweb/feature/TestCasePathControllerTest.java` | `@WebMvcTest` — 단건/일괄 적용, 수동 path 교체, 400/404 |

### Backend — 수정

| 파일 | 변경 |
|------|------|
| `backend/src/main/java/com/myqaweb/feature/TestCaseEntity.java` | `suggestedSegmentPath: List<String>` 필드 추가 (`@JdbcTypeCode(SqlTypes.ARRAY)`, `text[]`) |
| `backend/src/main/java/com/myqaweb/feature/TestCaseDto.java` | Response에 `suggestedSegmentPath` 필드 추가 |
| `backend/src/main/java/com/myqaweb/feature/TestCaseServiceImpl.java` | `toResponse` 매핑 한 줄 추가. `updateTestCase`가 path 필드 변경을 허용하는지 확인(허용됨, 기존). `listTestCases`에 **`companyId` 쿼리 지원** 추가: `@Query("SELECT tc FROM TestCaseEntity tc WHERE tc.product.company.id = :companyId ...")` |
| `backend/src/main/java/com/myqaweb/feature/TestCaseRepository.java` | `findAllByCompanyIdAndStatus(Long companyId, TestStatus status)` 신규 (JPQL or derived) |
| `backend/src/main/java/com/myqaweb/feature/TestCaseController.java` | `GET /api/test-cases`에 `companyId` 쿼리 파라미터 지원 추가. `productId`와 상호배타 (둘 중 하나만). |
| `backend/src/main/java/com/myqaweb/teststudio/TestStudioGenerator.java` | `toTestCaseEntity`에서 `tc.setSuggestedSegmentPath(draft.suggestedSegmentPath())` 추가. `tc.setPath(new Long[0])`은 **유지** (강제 주입 금지 원칙). INFO 로그 1줄로 "saved suggestion" 기록. |

### Backend — 테스트 수정

| 파일 | 변경 |
|------|------|
| `backend/src/test/java/com/myqaweb/teststudio/TestStudioGeneratorTest.java` | 저장된 TC의 `suggestedSegmentPath` 필드 검증 추가 (기존 테스트 보강, 신규 미필요) |
| `backend/src/test/java/com/myqaweb/teststudio/TestStudioIntegrationTest.java` | 기존 end-to-end 테스트에서 `suggested_segment_path` 컬럼에 기대 값 저장 검증 |
| `backend/src/test/java/com/myqaweb/feature/TestCaseServiceImplTest.java` | `findAllByCompanyIdAndStatus` 경로 검증 |

### Frontend — 신규

| 파일 | 용도 |
|------|------|
| `frontend/src/pages/TestStudioHomePage.tsx` | 신규 최상위 페이지 (`/test-studio`). 탭 구성: ① 새 Job 생성 ② Company DRAFT 대시보드 |
| `frontend/src/components/test-studio/CompanyProductSelector.tsx` | Company 드롭다운 (활성 Company 목록) → Product 드롭다운 (Company 종속) |
| `frontend/src/components/test-studio/CompanyDraftDashboard.tsx` | 선택 Company의 DRAFT TC를 2섹션으로 렌더링: 🤖 미배정 / ✅ 배정완료 |
| `frontend/src/components/test-studio/DraftTcCard.tsx` | 카드 내부에 `suggestedSegmentPath` 배지 + "추천 적용" 버튼 + 체크박스 |
| `frontend/src/components/test-studio/BulkApplyBar.tsx` | 체크된 TC 수 + "선택 항목 일괄 추천 적용" 버튼 (sticky) |
| `frontend/src/components/features/SegmentTreePicker.tsx` | TestCaseFormModal 및 수동 Path 지정 모달에서 재사용 가능한 Segment Tree 선택 위젯 |
| `frontend/src/hooks/useCompanyDraftTestCases.ts` | Company 기준 DRAFT TC 조회 + 재조회 헬퍼 |
| `frontend/src/api/test-case-path.ts` | `applySuggestedPath(tcId)`, `bulkApplySuggestedPath(tcIds[])`, `updatePath(tcId, path)` |

### Frontend — 수정

| 파일 | 변경 |
|------|------|
| `frontend/src/components/Layout.tsx` | Header nav에 `{ to: '/test-studio', label: 'Test Studio' }` 추가 (기존 5개 항목 뒤) |
| `frontend/src/App.tsx` | `<Route path="/test-studio" element={<TestStudioHomePage />} />` 추가. 기존 `/features/.../test-studio` 라우트 **삭제**. |
| `frontend/src/pages/features/TestCasePage.tsx` | ① "Test Studio" 진입 버튼 제거 (상단 링크). ② TC Card를 **draggable** 전환: SegmentTreeView 노드에 drop → `testCasePathApi.updatePath(tcId, newPath)` 호출 → 트리 재렌더. ③ 📦 Segment 미지정 섹션 유지 (수동 할당 대상). ④ TC 카드 우상단에 "🤖 추천" 아이콘(있으면). |
| `frontend/src/components/features/TestCaseFormModal.tsx` | Segment Tree Picker 필드 추가. 저장 시 `path` 포함. |
| `frontend/src/components/features/SegmentTreeView.tsx` | TC Card drop 수용 로직 추가 (기존 segment drop과 구분 — `dataTransfer.getData("type")` 기반 분기). |
| `frontend/src/types/features.ts` | `TestCase.suggestedSegmentPath?: string[] \| null` 추가 |
| `frontend/src/api/features.ts` | `listTestCases({ companyId })` 파라미터 허용 |

### E2E — 신규/수정

| 파일 | 변경 |
|------|------|
| `qa/api/test-studio.spec.ts` | 신규 테스트: ① Job 생성 후 DRAFT TC에 `suggestedSegmentPath` 저장 확인. ② `POST /api/test-cases/{id}/apply-suggested-path` — 매칭 성공 시 path 반영. ③ `POST /api/test-cases/bulk-apply-suggested-path` — 일괄 적용. ④ `GET /api/test-cases?companyId=X&status=DRAFT` — Company 레벨 필터. |
| `qa/api/test-case-path.spec.ts` | 신규 파일 — TC path 수정 전용 API 테스트 (수동 path PUT, 추천 적용, 일괄 적용) |
| `qa/ui/test-studio.spec.ts` | 대폭 개정: Header에 Test Studio 탭 가시성, `/test-studio` 진입, Company → Product 2단 드롭다운, Job 제출, DRAFT 대시보드 2섹션 노출 검증, 단건 "추천 적용" 클릭 후 섹션 이동 확인, 체크박스 다중선택 + 일괄 적용 확인 |
| `qa/ui/test-case-dnd.spec.ts` | 신규 — TestCasePage에서 TC Card를 Segment 노드로 DnD → Path 변경 확인 |
| `qa/ui/test-case-modal-path.spec.ts` | 신규 — TC 편집 모달에서 Segment 선택 → 저장 → Path 반영 확인 |

### Docs — 양쪽 작성 (메인 레포 + worktree)

| 파일 | 변경 |
|------|------|
| `docs/features/test-studio/test-studio_v2.md` | 본 파일 |
| `docs/features/test-studio/test-studio.md` | 버전 히스토리 테이블에 v2 행 추가 + 현재 버전 배너 v1.1 → v2. 시스템 아키텍처 다이어그램 업데이트 (Header 진입). |
| `docs/features/registry/registry.md` | TC Path 수정(DnD + 모달) 반영한 짧은 업데이트 섹션 추가 |

---

## 신규 API 스펙

### `GET /api/test-cases?companyId={id}&status=DRAFT`
- 기존 `productId` 쿼리와 상호배타 — 한 쪽만 지정.
- 응답: `ApiResponse<TestCaseResponse[]>` (Product를 가로지르는 Company 내 전체 TC)

### `POST /api/test-cases/{id}/apply-suggested-path`
- Body 없음. 서버가 해당 TC의 `suggestedSegmentPath`를 읽어 `resolver.resolve(ctx, names)`로 변환 후 `path` 저장.
- 응답 body:
  ```
  { "testCaseId": 42, "resolvedPath": [12, 34], "resolvedLength": 2, "fullMatch": true }
  ```
- `suggestedSegmentPath`가 null/empty → 200 + `resolvedLength=0, fullMatch=false`. 수동 유도.

### `POST /api/test-cases/bulk-apply-suggested-path`
- Body: `{ "testCaseIds": [1, 2, 3] }` (최대 100개)
- 응답: `{ "results": [{testCaseId, resolvedLength, fullMatch}, ...] }` — 일부 실패도 200.

### `PATCH /api/test-cases/{id}/path`
- Body: `{ "path": [12, 34] }` (Long 배열, 빈 배열 허용)
- 검증: 모든 Segment ID가 해당 TC의 product에 속하고 parent 체인이 일관되어야 함 (순서대로 조상 관계). 깨지면 400.
- 응답: 업데이트된 `TestCaseResponse`

> 설계 메모: 이 3개 엔드포인트는 `TestCasePathController`에 몰아서 관심사를 분리. 기존 `TestCaseController.updateTestCase`는 그대로 두어 범용 전체 업데이트는 유지.

---

## DB 마이그레이션

**파일:** `V{YYYYMMDD}{HHmm}__add_test_case_suggested_segment_path.sql` (타임스탬프 버전)

```sql
ALTER TABLE test_case
    ADD COLUMN suggested_segment_path TEXT[] NULL;

COMMENT ON COLUMN test_case.suggested_segment_path IS
    'Claude가 생성 시 추천한 Segment 경로(문자열). 사용자가 추천 적용을 트리거할 때 path로 변환. 강제 주입 금지 원칙으로 기본은 NULL.';
```

- `text[]`는 pgvector 환경과 무관 — Hibernate의 `@JdbcTypeCode(SqlTypes.ARRAY)`로 매핑.
- NULL 허용 — 기존 TC와 수동 작성 TC는 `NULL`.

---

## UI/UX 설계

### Test Studio Home (`/test-studio`)

```
┌ Header ────────────────────────────────────────────────────┐
│ My Senior | Knowledge Base | Word Conventions |            │
│ Product Test Suite | Test Studio ★ | Resume                │
└────────────────────────────────────────────────────────────┘

┌ /test-studio ──────────────────────────────────────────────┐
│ [Company ▼ my-atlas] [Product ▼ 결제 단말기]                │
│                                                            │
│ Tab: ( • Job 생성 )  ( DRAFT 대시보드 )                     │
├────────────────────────────────────────────────────────────┤
│ [Job 생성 탭]                                              │
│   제목 / 소스 타입 / 내용 / 파일                             │
│   [생성 요청]                                               │
│                                                            │
│   Job 히스토리 (Product 선택 시 기존 TestStudioJobList 재사용)│
└────────────────────────────────────────────────────────────┘
```

### Company DRAFT 대시보드

```
[DRAFT 대시보드 탭] — Company=my-atlas

🤖 자동 생성 / Path 미배정 (N)          [☐ 전체 선택] [일괄 추천 적용]
┌──────────────────────────────────────────────────────────┐
│ ☐ [IC카드 NFC 결제 실패 처리]                            │
│    🤖 추천: 결제 > IC카드 결제                            │
│    Product: 결제 단말기 | Job #13                        │
│    [추천 적용] [수동 지정] [수정] [삭제]                   │
├──────────────────────────────────────────────────────────┤
│ ☐ [카드 리더기 연결 오류]                                │
│    🤖 추천 없음  [수동 지정]                              │
└──────────────────────────────────────────────────────────┘

✅ 자동 생성 / Path 배정완료 (M)
┌──────────────────────────────────────────────────────────┐
│ [결제 > IC카드 결제] NFC 결제 플로우                      │
│ Product: 결제 단말기 | Job #13 | path: 결제 > IC카드 결제 │
│ [Path 변경] [수정] [삭제]                                  │
└──────────────────────────────────────────────────────────┘
```

### TestCasePage (Product 레벨)

- TC Card는 `draggable`. Segment 트리 노드에 drop → toast "Path를 'X > Y'로 이동했습니다".
- 기존 📦 Segment 미지정 섹션은 유지 (수동 할당 대상 + 추천 없는 TC).
- 상단 "Test Studio 진입" 버튼 제거 (Header로 승격).

### TestCaseFormModal

- 기존 입력 필드 + Segment Tree Picker 섹션 추가. 현재 path를 펼친 상태로 사전 선택. 변경 후 저장.

---

## 구현 절차 (User 승인 단위)

각 Step은 User 지시 없이 다음으로 넘어가지 않는다. 완료 시 체크박스를 `[x]`로 갱신.

### Phase A — Backend 추천 보관 + 적용 API
- [ ] **Step 1** — Flyway 마이그레이션 (`test_case.suggested_segment_path TEXT[]`). `TestCaseEntity`/`TestCaseDto`에 필드 추가 + `toResponse` 매핑. `TestStudioGenerator.toTestCaseEntity`에서 추천 저장.
- [ ] **Step 2** — `SegmentPathResolver` + 단위 테스트 9건. 최장 접두사 매칭 로직, 동명 중복 처리, 배치 로드.
- [ ] **Step 3** — `TestCasePathController` + `TestCaseServiceImpl` 보강 (3 엔드포인트). `TestCasePathControllerTest` + Service 단위 테스트. `GET /api/test-cases?companyId=X` 지원 (`TestCaseRepository.findAllByCompanyIdAndStatus`).

### Phase B — Frontend Header 승격 + Home
- [ ] **Step 4** — `Layout.tsx`에 Test Studio nav 추가. `App.tsx`에 `/test-studio` 라우트 신설, 기존 `/features/.../test-studio` 라우트 제거. `TestStudioHomePage` 골격 + `CompanyProductSelector`. Job 생성 탭은 기존 `TestStudioJobForm`/`TestStudioJobList` 재사용.
- [ ] **Step 5** — `CompanyDraftDashboard` 탭 + `DraftTcCard` + `BulkApplyBar`. 단건 "추천 적용" + 체크박스 다중선택 + 일괄 적용 완주.
- [ ] **Step 6** — TestCasePage 상단 Test Studio 링크 제거, 📦 섹션 유지, 필터 배너 유지.

### Phase C — Path 수동 편집 UX
- [ ] **Step 7** — `SegmentTreePicker` 컴포넌트 + `TestCaseFormModal` 통합 (path 편집).
- [ ] **Step 8** — TestCasePage TC Card DnD (Segment 노드 drop) + `SegmentTreeView`에 TC drop 수용.

### Phase D — 테스트 + 검증
- [ ] **Step 9** — E2E: `qa/api/*` 4건 + `qa/ui/test-studio.spec.ts` 개정 + `qa/ui/test-case-dnd.spec.ts` 신규 + `qa/ui/test-case-modal-path.spec.ts` 신규.
- [ ] **Step 10** — 문서: `test-studio.md` 버전 히스토리 갱신 + `registry.md`에 Path 편집 섹션 추가 (양쪽 경로).
- [ ] **Step 11** — 4-Agent Pipeline Agent-D 검증: `./gradlew clean build` → `docker compose up -d --build && sleep 10` → `npx playwright test` → `docker compose down`.

---

## 테스트 케이스 요약

### Backend 단위 (신규/보강 ~25건)
- `SegmentPathResolverTest` 9건 (null/empty/부분/전체/공백/대소문자/동명중복/배치)
- `TestCasePathControllerTest` 6건 (apply 단건, apply 단건 매칭실패, bulk apply 혼합, PATCH path 성공, PATCH path 제품 불일치 400, PATCH path 존재하지 않는 segment 400)
- `TestCaseServiceImplTest` 보강 3건 (applySuggested, bulkApplySuggested, companyId 필터)
- `TestStudioGeneratorTest` 보강 — 저장 TC에 `suggestedSegmentPath` 포함 확인 (스텁 변경)

### Backend 통합 1건
- `TestStudioIntegrationTest` — Job DONE 후 TC의 `suggested_segment_path` 필드 persist 확인.

### E2E — 7건
- `qa/api/test-studio.spec.ts` 2건 (suggestion persisted, company-scoped listing)
- `qa/api/test-case-path.spec.ts` 3건 (apply single, bulk apply, manual PATCH)
- `qa/ui/test-studio.spec.ts` 개정 + 2건 추가 (header tab 가시성, 대시보드 2섹션, 단건/일괄 적용)
- `qa/ui/test-case-dnd.spec.ts` 1건
- `qa/ui/test-case-modal-path.spec.ts` 1건

**셀렉터 규칙**: 각 TSX 파일을 선행 Read 후 실제 DOM 기반으로 `data-testid` 부여/활용.

---

## 수동 검증 (Agent-D 전)

1. Backend 빌드 통과 + Flyway 마이그레이션 적용 확인.
2. Docker 스택 기동.
3. Header에 "Test Studio" 탭 가시성 확인 → 클릭 → `/test-studio` 진입.
4. Company 드롭다운에서 `my-atlas` 선택 → Product 드롭다운에서 "결제 단말기" 선택.
5. Job 생성 탭에서 Markdown 제출 → DONE 대기.
6. DRAFT 대시보드 탭으로 이동 → 🤖 미배정 섹션에 신규 TC 다수 노출.
7. 한 TC의 "추천 적용" 클릭 → ✅ 배정완료 섹션으로 이동 확인.
8. 미배정 섹션 체크박스 3개 선택 → "일괄 추천 적용" → 3건 이동 확인.
9. 추천 없는/미매칭 TC → "수동 지정" 클릭 → Segment Picker로 선택 → 적용 확인.
10. 기존 `/features` 경로 TestCasePage 진입 → TC Card를 Segment 노드로 DnD → path 변경 확인.
11. TC 편집 모달 열어 Path 필드 수정 → 저장 → 반영 확인.
12. 기존 Product 레벨 Test Studio 라우트(`/features/.../test-studio`)가 404/리다이렉트 처리되는지 확인.

---

## 리스크 / 엣지 케이스

| 케이스 | 처리 |
|--------|------|
| 동일 parent 하 동명 Segment | id 오름차순 결정적 선택 + WARN 로그 |
| `suggestedSegmentPath=null` | 추천 배지 미노출, "수동 지정" 경로만 제공 |
| 추천 적용 시 일부만 매칭 | `resolvedLength < names.length` → 200 + `fullMatch=false`. UI 토스트로 안내 후 섹션 이동 |
| 기존 DRAFT TC (v1 생성분, suggestion NULL) | 수동 지정 경로만 제공. 마이그레이션에서 backfill 없음. |
| TC가 다른 Product로 이동 시도 (DnD) | 405 or 거부 — TC는 Product 고정. UI에서도 자기 Product의 Segment만 drop 대상으로. |
| PATCH path에서 Segment가 TC의 Product에 속하지 않음 | 400 + 메시지 |
| bulk apply 중 일부 TC not found | 200 + results에 404 항목 표시, 나머지는 성공 처리 |
| Company 드롭다운 비어있음 | "활성 Company를 먼저 설정하세요" 빈 상태 메시지 |
| 대규모 DRAFT (수백 건) | 대시보드에 pagination 또는 lazy 렌더 (v2는 최대 200건 제한) |
| 기존 `/features/.../test-studio` 북마크 | React Router 레벨 redirect to `/test-studio` |

---

## 핵심 파일 참조

**Backend**
- `backend/src/main/java/com/myqaweb/teststudio/TestStudioGenerator.java` — `toTestCaseEntity`에 `setSuggestedSegmentPath` 한 줄 추가. `setPath(new Long[0])` 유지.
- `backend/src/main/java/com/myqaweb/feature/TestCaseEntity.java` — 컬럼 추가 지점
- `backend/src/main/java/com/myqaweb/feature/TestCaseController.java:34-40` — `PUT /api/test-cases/{id}` 기존
- `backend/src/main/java/com/myqaweb/feature/TestCaseRepository.java` — `findAllByCompanyIdAndStatus` 추가 지점

**Frontend**
- `frontend/src/components/Layout.tsx:5-11` — Header nav 배열
- `frontend/src/App.tsx:48` — 기존 Product 레벨 Test Studio 라우트 제거
- `frontend/src/pages/features/TestCasePage.tsx:165-175,613-618` — 📦 유지 / 상단 링크 제거 / 카드 draggable화
- `frontend/src/components/features/SegmentTreeView.tsx:287-374` — TC drop 수용 확장
- `frontend/src/components/features/TestCaseFormModal.tsx` — Segment Picker 신규 필드

**DB**
- `backend/src/main/resources/db/migration/V{ts}__add_test_case_suggested_segment_path.sql` — 신규
