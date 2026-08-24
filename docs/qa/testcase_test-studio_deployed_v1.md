# Test Studio — TestCase 명세 (실제 배포 화면 기준)

> 변경 유형: 테스트 보강
> 작성일: 2026-07-01
> 버전: v1
> 상태: 완료
> 대상: `https://youngmi.works/test-studio` (실제 배포본, MyAtlas Company #1440로 탐색)

---

## 결론 먼저

실제 배포된 Test Studio 화면을 Chrome으로 직접 탐색하고 frontend/backend 코드로 교차 검증하여, **전체 흐름(진입 → Job 생성 → 라이프사이클 → Path 배정 → 검토 핸드오프 → 삭제)** 을 커버하는 **62개 TestCase**를 설계했다. 모든 TC는 실측한 UI label·route·검증 메시지·API 계약에 근거한다.

이 문서는 기존 `testcase_test-studio.md`(스펙 기반 gold set)를 **대체하지 않는다.** 별개 산출물로, "실제 배포본이 지금 이렇게 동작한다"는 관점의 실행용 TC다.

> ⚠️ **실행 시 비용 주의**: Job 생성(생성 요청) TC는 실제 Claude + OpenAI Embedding API를 호출한다. `TS-E*`, `TS-J01`은 실행 시 API 비용이 발생하므로 최소 횟수로 수행할 것.

---

## 탐색으로 확인한 실제 구조 (근거)

### Route (실측)
| 단계 | URL | 페이지 |
|------|-----|--------|
| 홈/대시보드 | `/test-studio` (`?companyId=X` 동기화) | TestStudioHomePage |
| Job 생성 | `/test-studio/new?companyId=X` | TestStudioJobCreatePage |
| 검토 핸드오프 | `/features/companies/{cid}/products/{pid}?status=DRAFT&jobId={id}` | TestCasePage (Product Test Suite) |

> 메인 명세서(`docs/features/test-studio/test-studio.md`)에는 route가 `/features/companies/:cid/products/:pid/test-studio`로 적혀 있으나 **실제 배포 route는 top-level `/test-studio`** 다. 명세서가 stale — 아래 [발견된 이슈] R-1 참조.

### Backend API 계약 (실측/코드)
| Method | Endpoint | 비고 |
|--------|----------|------|
| POST | `/api/test-studio/jobs` | multipart: productId, sourceType, title, content?/file? → 201 `{jobId}` |
| GET | `/api/test-studio/jobs?productId=` \| `?companyId=` | 정확히 하나, 최신순 |
| GET | `/api/test-studio/jobs/{id}` | 단건 |
| DELETE | `/api/test-studio/jobs/{id}` | 204, DRAFT TC 보존 |
| PATCH | `/api/test-cases/{id}/path` | 수동 Path 지정 (엄격 검증, Segment 생성 안 함) |
| POST | `/api/test-cases/{id}/apply-suggested-path` | 추천 적용 (**누락 Segment 신규 생성**) |
| POST | `/api/test-cases/bulk-apply-suggested-path` | 일괄 추천 적용 |
| GET | `/api/test-cases?companyId=&status=DRAFT` | Company 전체 DRAFT |

### 검증 상한 (코드)
- 제목(title): 최대 200자 / Markdown 내용: 최대 100,000자 / PDF: 최대 20MB.
- Job status: `PENDING`(대기 중) → `PROCESSING`(처리 중) → `DONE`(완료) | `FAILED`(실패). 대시보드는 PENDING/PROCESSING 존재 시 2초 간격 폴링.

### TC 스키마
앱 `test_case`와 동일: `title` / `preconditions` / `steps[{order, action, expected}]` / `expectedResults` / `priority(HIGH·MEDIUM·LOW)` / `testType(SMOKE·FUNCTIONAL·REGRESSION·E2E)` / `status`. 본 문서 참조 시 `data-testid`는 실제 DOM에서 확인한 값이다.

---

## 발견된 이슈 / 리스크 (탐색 중 확인)

| ID | 심각도 | 내용 |
|----|--------|------|
| **R-1** | 중 | 메인 명세서의 route(`/features/.../test-studio`)와 실제 배포 route(`/test-studio`)가 불일치. 문서 최신화 필요. |
| **R-2** | **높음** | `/test-studio` 및 데이터 조회/생성 API가 **로그인 없이 접근 가능**(헤더에 "Login" 링크가 떠 있는 비로그인 상태에서 Company 목록·DRAFT·Job 조회가 그대로 노출). `App.tsx`는 `ProtectedRoute`로 감싸져 있으나 실질 인증 게이트가 동작하지 않는 것으로 관측됨 → 인증/인가 정책 확인 필요. (TS-SEC01) |
| **R-3** | 중 | "추천 적용"(apply-suggested-path)은 이름 매칭이 아니라 **누락 Segment를 신규 생성**(`resolveOrCreate`)한다. 반면 "수동 지정"(updatePath)은 기존 Segment만 엄격 검증. 두 경로의 부작용이 다름 → 사용자에게 "추천 적용 시 Segment가 생성될 수 있음"이 toast로만 고지됨. (TS-F02) |
| **R-4** | 낮음 | "📋 완료된 Job" 섹션은 명칭과 달리 `DONE`뿐 아니라 `FAILED`도 포함(종료된 Job). 라벨 오해 소지. |

---

# Part A — 진입 & Company 선택 (Home Dashboard)

#### [TS-A01] Header 진입 & 초기 상태
- **분류**: Home | **Type**: SMOKE | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: 앱 접속 상태
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Header "Test Studio" 클릭 | `/test-studio` 진입. 타이틀 "Test Studio", 서브 "디자인 문서 삽입 → TestCase 자동완성 → 원하는 Product, Path에 TestCase를 지정하세요." 노출 |
  | 2 | Company 미선택 상태 확인 | Company select 값 "— 선택 —", 본문 "Company를 선택하면 자동 생성된 TestCase와 Job 목록이 표시됩니다.", `+ TestCase 생성 요청` 버튼 **비활성**(disabled) |
- **예상 결과**: 초기 빈 상태 + 생성 버튼 게이트 정상

#### [TS-A02] Company select 옵션 & 활성 표시
- **분류**: Home | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: Company 여러 개 존재(1개 활성)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Company select 펼치기 | Company 목록 노출, **활성 Company에 " (활성)" suffix**(실측: "🚙 Mycle (활성)") |
- **예상 결과**: 활성 Company 시각 구분

#### [TS-A03] Company 선택 → 대시보드 렌더 & URL 동기화
- **분류**: Home | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: TS-A01
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Company 선택(예: MyAtlas) | URL이 `?companyId=1440`로 갱신(history replace), 대시보드 4개 섹션 렌더 |
  | 2 | `+ TestCase 생성 요청` 버튼 확인 | 활성화(enabled) |
- **예상 결과**: 선택 즉시 대시보드 + 버튼 게이트 해제

#### [TS-A04] `?companyId=` 딥링크/새로고침 복원
- **분류**: Home | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 없음
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `/test-studio?companyId=1440` 직접 접근/새로고침 | 해당 Company 대시보드가 그대로 복원(공유 링크 동작) |
- **예상 결과**: URL 상태 영속

#### [TS-A05] 존재하지 않는 companyId
- **분류**: Home | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **사전조건**: 없음
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `/test-studio?companyId=99999999` 접근 | "해당 Company를 찾을 수 없습니다. 다른 Company를 선택해 주세요." 노출(대시보드 미렌더) |
- **예상 결과**: 잘못된 파라미터 안전 처리

#### [TS-A06] Company 선택 해제
- **분류**: Home | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **사전조건**: Company 선택 상태
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Company를 "— 선택 —"으로 변경 | `companyId` 파라미터 제거, 초기 빈 상태로 복귀, 생성 버튼 비활성 |
- **예상 결과**: 상태 초기화 정상

---

# Part B — 대시보드 섹션 표시

#### [TS-B01] 진행 중 Job 섹션(빈 상태)
- **분류**: Dashboard | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 진행 중 Job 없음
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "⏳ 진행 중 Job (N)" 섹션 확인 | 카운트 (0), "진행 중인 Job이 없습니다." |
- **예상 결과**: 빈 상태 문구 정상

#### [TS-B02] 완료된 Job 섹션 접기/펼치기
- **분류**: Dashboard | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 완료(DONE/FAILED) Job ≥1
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "📋 완료된 Job (N)" 최초 상태 | 기본 접힘, 우측 "▸ 펼치기" |
  | 2 | 클릭 | 펼쳐지며 "▾ 접기"로 토글, Job 카드 노출 |
- **예상 결과**: collapsible 정상 (`data-testid=history-toggle`)

#### [TS-B03] 완료 Job 카드 구성
- **분류**: Dashboard | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: DONE Job ≥1 (실측: "Test", 12개 DRAFT 생성)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 완료 Job 카드 확인 | 아이콘(MARKDOWN=📝/PDF=📄), 제목, 상태배지 "완료", "Product: {name}", 생성일시, "{generated_count}개 DRAFT 생성", 버튼 "DRAFT TC 보기"·"삭제" |
- **예상 결과**: 메타·액션 정확 표시

#### [TS-B04] 미배정 DRAFT 섹션 카드 구성
- **분류**: Dashboard | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: path 미배정 DRAFT ≥1
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "🤖 자동 생성 / Path 미배정 (N)" 카드 확인 | 제목, priority 배지, testType 배지, "Product: {name}", "Job #{id}", "🤖 추천: A > B > C"(amber) 또는 "🤖 추천 없음" |
- **예상 결과**: 카드 구성 정확 (`data-testid=draft-tc-card`)

#### [TS-B05] 배정완료 DRAFT 섹션 카드 구성
- **분류**: Dashboard | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: path 배정된 DRAFT ≥1
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "✅ 자동 생성 / Path 배정완료 (N)" 카드 확인 | "📍 {실제 경로}" 라벨 표시, 버튼은 "수동 지정"만(추천 적용 없음) |
- **예상 결과**: 배정완료 표현 정확

#### [TS-B06] 각 DRAFT 섹션 빈 상태
- **분류**: Dashboard | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **사전조건**: 해당 섹션 0건
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 미배정 0건 | "Path 미배정 DRAFT TC가 없습니다." |
  | 2 | 배정완료 0건 | "Path가 배정된 DRAFT TC가 아직 없습니다." |
- **예상 결과**: 빈 상태 문구 정확

#### [TS-B07] 추천 유무에 따른 카드 컨트롤 차이
- **분류**: Dashboard | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 추천 있는 카드 + 추천 없는 카드 혼재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 추천 있는 미배정 카드 | 체크박스 노출, 버튼 "추천 적용" + "수동 지정" |
  | 2 | 추천 없는 미배정 카드 | 체크박스 **없음**(일괄 대상 제외), "추천 적용" 없음, 버튼 라벨 "Path 지정" |
- **예상 결과**: 추천 여부로 UI 분기 정확

---

# Part C — Job 생성 폼 진입 & Product 선택

#### [TS-C01] 생성 폼 진입
- **분류**: Create | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: Company 선택됨
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `+ TestCase 생성 요청` 클릭 | `/test-studio/new?companyId=X` 이동. "TestCase 생성 요청" 타이틀, "Company: {name}", "Product *" select, "← Test Studio로 돌아가기" 링크 |
- **예상 결과**: 생성 페이지 진입 정상

#### [TS-C02] companyId 없이 생성 페이지 접근 → 가드
- **분류**: Create | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: 없음
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `/test-studio/new` 직접 접근(companyId 없음) | "Company가 지정되지 않았습니다." + "Test Studio로 돌아가기" 링크(폼 미노출) |
- **예상 결과**: 컨텍스트 없는 딥링크 차단 (실측)

#### [TS-C03] Product 미선택 시 폼 숨김
- **분류**: Create | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: Product 2개 이상인 Company
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 생성 페이지 진입 후 Product 미선택 | "Product를 선택하면 문서 입력 폼이 나타납니다." (폼 숨김) |
  | 2 | Product 선택 | "새 Job 생성" 폼 노출 |
- **예상 결과**: Product 게이트 정상 (실측: MyAtlas 4개 Product)

#### [TS-C04] Product 1개 Company 자동 선택
- **분류**: Create | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **사전조건**: Product 정확히 1개인 Company
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 생성 페이지 진입 | Product가 자동 선택되고 폼이 즉시 노출 |
- **예상 결과**: 단일 Product 편의 처리

#### [TS-C05] Product 0개 Company
- **분류**: Create | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **사전조건**: Product 없는 Company
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 생성 페이지 진입, Product select 확인 | 옵션 "이 Company에 Product가 없습니다", 폼 미노출 |
- **예상 결과**: Product 없음 안내

---

# Part D — 폼 필드 & Client 검증

#### [TS-D01] Markdown 폼 필드 렌더
- **분류**: Create/Form | **Type**: SMOKE | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: Product 선택 완료
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "새 Job 생성" 폼 확인 | 제목 input(placeholder "예: v2.1 NFC 결제 PRD", 카운터 "0 / 200"), 소스 타입 radio "Markdown"(기본 선택)/"PDF 파일", "Markdown 내용" textarea(placeholder "PRD / 스펙 본문을 붙여넣으세요.", 카운터 "0 / 100,000"), "생성 요청" 버튼 |
- **예상 결과**: 폼 구성 정확 (실측)

#### [TS-D02] 제목 빈 값 제출
- **분류**: Create/Validation | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 제목 공백, 내용 입력
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 제목 비운 채 "생성 요청" | client 검증 "제목을 입력하세요." (Job 미생성) |
- **예상 결과**: 필수값 검증

#### [TS-D03] 제목 201자 (경계 초과)
- **분류**: Create/Validation | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: 소스 Markdown, 내용 유효
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 제목 201자 입력 | 카운터 "201 / 200", 카운터 강조, "생성 요청" 버튼 disabled |
  | 2 | (제출 시도) | 제출 불가. (강제 제출 시 "제목이 너무 깁니다 (최대 200자).") |
- **예상 결과**: title 상한 강제(off-by-one 방지). input `maxLength=201`

#### [TS-D04] 제목 정확히 200자 (경계 통과)
- **분류**: Create/Validation | **Type**: REGRESSION | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 소스 Markdown, 내용 유효
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 제목 정확히 200자 입력 | 카운터 "200 / 200", 버튼 활성, 제출 가능 |
- **예상 결과**: 경계값 허용

#### [TS-D05] Markdown 내용 공백만
- **분류**: Create/Validation | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 제목 유효, 소스 Markdown
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 내용에 공백/개행만 입력 후 제출 | "Markdown 내용을 입력하세요." |
- **예상 결과**: 공백 문서 낭비 호출 방지

#### [TS-D06] Markdown 100,001자 (경계 초과)
- **분류**: Create/Validation | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: 제목 유효, 소스 Markdown
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 내용 100,001자 입력 | 카운터 "100,001 / 100,000" 빨강 강조, "생성 요청" disabled |
  | 2 | (강제 제출 시) | "문서 길이가 100,000자를 초과했습니다." |
- **예상 결과**: 입력 토큰 상한 강제

#### [TS-D07] Markdown 정확히 100,000자 (경계 통과)
- **분류**: Create/Validation | **Type**: REGRESSION | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 제목 유효, 소스 Markdown
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 내용 정확히 100,000자 입력 | 카운터 정상색, 버튼 활성, 제출 가능 |
- **예상 결과**: 경계값 허용

#### [TS-D08] PDF 소스 전환 & 파일 표시
- **분류**: Create/Form | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 생성 폼
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 소스 타입 "PDF 파일" 선택 | Markdown textarea 사라지고 파일 input 노출(accept `.pdf`) |
  | 2 | PDF 파일 첨부 | "{파일명} ({X.XX} MB)" 표시 |
- **예상 결과**: 소스 타입 전환 정상

#### [TS-D09] PDF 선택인데 파일 없음
- **분류**: Create/Validation | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 소스 PDF, 제목 유효
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 파일 없이 "생성 요청" | "PDF 파일을 선택하세요." |
- **예상 결과**: 파일 필수 검증

#### [TS-D10] 제출 중 상태
- **분류**: Create/Form | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **사전조건**: 유효 입력
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "생성 요청" 클릭 직후 | 버튼 라벨 "제출 중…", 입력 필드/버튼 disabled(중복 제출 방지) |
- **예상 결과**: 제출 중 잠금

---

# Part E — 제출 & Job 라이프사이클

> ⚠️ 아래 TC는 실제 생성 파이프라인을 구동(API 비용). 재현 최소화.

#### [TS-E01] Markdown 정상 제출 → 리다이렉트
- **분류**: Lifecycle | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: 유효한 제목 + Markdown 내용
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "생성 요청" 클릭 | `POST /api/test-studio/jobs` 201, toast "Job #{id} 생성됨 — Test Studio로 돌아갑니다…" |
  | 2 | 약 0.7초 대기 | `/test-studio?companyId=X`로 자동 이동, 새 Job이 "⏳ 진행 중 Job"에 "대기 중" 배지로 노출 |
- **예상 결과**: 생성 → 대시보드 반영

#### [TS-E02] 상태 폴링 & 전이
- **분류**: Lifecycle | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: 방금 생성한 Job(PENDING)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 대시보드에 머무름 | 2초 간격 자동 폴링, 상태배지 "대기 중" → "처리 중"(진행 중…) → "완료" 전이 |
  | 2 | 모든 Job terminal 도달 후 | 폴링 중단(불필요한 요청 없음) |
- **예상 결과**: 상태 전이 관측 가능, 폴링 라이프사이클 정상

#### [TS-E03] DONE 결과 반영
- **분류**: Lifecycle | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: Job DONE
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 완료 후 대시보드 확인 | Job이 "📋 완료된 Job"으로 이동, "{generated_count}개 DRAFT 생성" 표시 |
  | 2 | 미배정 DRAFT 섹션 확인 | 생성된 DRAFT TC들이 "🤖 Path 미배정"에 노출 |
- **예상 결과**: 산출물 가시화

#### [TS-E04] 텍스트 추출 불가 → FAILED
- **분류**: Lifecycle | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 텍스트 레이어 없는 스캔 PDF(또는 추출 불가 소스)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 해당 PDF로 Job 생성 후 대기 | Job "실패" 배지, errorMessage "원본 문서에서 텍스트를 추출할 수 없습니다."(빨강). 무한 PROCESSING 아님 |
- **예상 결과**: 추출 실패가 명확한 FAILED

#### [TS-E05] 파싱 0건 → FAILED
- **분류**: Lifecycle | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: LLM이 유효 JSON 배열을 못 만드는 입력(재현/모킹)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Job 완료 대기 | Job "실패", errorMessage "JSON 배열 파싱 실패 — 생성된 TC 없음" |
- **예상 결과**: 0건은 DONE 아닌 FAILED

#### [TS-E06] 부분 파싱 성공 → DONE
- **분류**: Lifecycle | **Type**: REGRESSION | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 일부 TC만 유효한 응답(재현/모킹)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Job 완료 대기 | 유효분만 저장, generated_count=성공분, Job "완료"(일부 실패가 전체 실패로 번지지 않음) |
- **예상 결과**: 부분 성공 보존

#### [TS-E07] 응답 truncation 복구 → DONE
- **분류**: Lifecycle | **Type**: REGRESSION | **Priority**: LOW | **status**: DRAFT
- **사전조건**: max_tokens 근처에서 잘린 JSON 배열 응답
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Job 완료 대기 | 마지막 완결 객체까지 복구 저장(나머지 폐기), Job "완료" |
- **예상 결과**: 잘린 응답에서도 완결분 보존

#### [TS-E08] RAG 컨텍스트 일부 실패 → 생성 계속
- **분류**: Lifecycle | **Type**: REGRESSION | **Priority**: LOW | **status**: DRAFT
- **사전조건**: KB/Convention/기존 TC 조회 중 일부 실패(재현/모킹)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Job 실행 | 실패 소스는 폴백 문구("(관련 지식 베이스 조회 실패)" 등)로 대체하고 생성 계속, Job DONE |
- **예상 결과**: graceful degradation (컨텍스트 실패가 전체 실패 아님)

---

# Part F — Path 배정 (추천 적용 / 일괄 / 수동)

#### [TS-F01] 단건 추천 적용
- **분류**: Path | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: 추천 있는 미배정 DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 카드 "추천 적용" 클릭 | `POST /api/test-cases/{id}/apply-suggested-path`, toast "추천 적용 완료 (N단계[, Segment M개 신규 생성])." |
  | 2 | 섹션 확인 | 해당 카드가 "✅ Path 배정완료"로 이동, "📍 경로" 표시 |
- **예상 결과**: 추천 → 배정완료 전이 (`data-testid=draft-tc-apply-suggestion`)

#### [TS-F02] 추천 적용이 누락 Segment 신규 생성 (핵심)
- **분류**: Path | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: 추천 경로 중 존재하지 않는 Segment 이름 포함
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 해당 카드 "추천 적용" | toast에 "Segment M개 신규 생성" 포함(`createdSegmentCount>0`), 경로 전량 해소 시 `fullMatch=true` |
  | 2 | Product Test Suite의 Segment 트리 확인 | 추천 경로의 누락 노드가 실제로 생성되어 있음 |
- **예상 결과**: apply-suggested-path는 이름 매칭이 아닌 **resolveOrCreate**. (R-3)

#### [TS-F03] 일괄 추천 적용
- **분류**: Path | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 추천 있는 미배정 DRAFT ≥2
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "전체 선택 (0/N)" 또는 개별 체크 | 선택 수가 "선택 N건 일괄 추천 적용" 버튼에 반영 |
  | 2 | 버튼 클릭 | `POST /bulk-apply-suggested-path`, toast "M/N건 적용[, Segment K개 신규 생성].", 선택 해제, 적용분 배정완료로 이동 |
- **예상 결과**: 배치 적용 정상

#### [TS-F04] 수동 지정 모달 구성
- **분류**: Path | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 미배정/배정완료 DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "수동 지정" 클릭 | "Path 수동 지정" 모달: TC 제목 부제, "Claude 추천: {경로} (이대로 사용하려면 카드의 "추천 적용" 버튼을 사용하세요)" 배너, "Segment 경로" 트리("경로 없음 (📦 Segment 미지정으로 되돌림)" / Segment 노드들 / "Root"), "선택 중: {경로}" 라벨, "취소"/"저장" |
- **예상 결과**: 모달 구성 정확 (실측)

#### [TS-F05] 수동 지정 저장
- **분류**: Path | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: 수동 지정 모달 열림
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Segment 노드 선택 → "저장" | `PATCH /api/test-cases/{id}/path`, toast "Path를 저장했습니다.", 배정완료로 이동, "📍 경로" 반영 |
- **예상 결과**: 수동 경로 부여 (updatePath, 엄격 검증)

#### [TS-F06] 수동 지정으로 미배정 되돌리기
- **분류**: Path | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 배정완료 DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "수동 지정" → "경로 없음 (📦 Segment 미지정으로 되돌림)" 선택 → 저장 | toast "경로를 미배정으로 되돌렸습니다.", 카드가 "🤖 미배정"으로 이동 |
- **예상 결과**: 경로 해제 정상

#### [TS-F07] 수동 지정 취소
- **분류**: Path | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **사전조건**: 수동 지정 모달 열림
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 노드 선택 후 "취소" 또는 X | 변경 없이 닫힘(경로 미반영) |
- **예상 결과**: 취소 시 부작용 없음

#### [TS-F08] 추천 없는 카드의 Path 지정
- **분류**: Path | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **사전조건**: 추천 없는 미배정 DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 카드 확인 | "🤖 추천 없음", "추천 적용" 버튼 없음, 버튼 라벨 "Path 지정", 체크박스 없음 |
  | 2 | "Path 지정" → 수동 저장 | 경로 반영 |
- **예상 결과**: 추천 null도 수동으로 처리 가능

---

# Part G — Job 삭제 (DRAFT 보존)

#### [TS-G01] Job 삭제 확인 다이얼로그
- **분류**: Delete | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: 완료/진행 Job ≥1
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Job 카드 "삭제" 클릭 | `window.confirm` "이 Job을 삭제하시겠습니까? (이미 생성된 DRAFT TC는 유지됩니다)" |
  | 2 | 확인 | `DELETE /api/test-studio/jobs/{id}` 204, 카드 제거, toast "Job을 삭제했습니다." |
- **예상 결과**: 삭제 정상 (`data-testid=company-job-delete`)

#### [TS-G02] Job 삭제 후 DRAFT TC 보존 (CRITICAL)
- **분류**: Delete | **Type**: REGRESSION | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: DONE Job + 그로 생성된 DRAFT TC 존재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 해당 Job 삭제 | Job만 제거 |
  | 2 | DRAFT 섹션/`GET /api/test-cases?companyId=&status=DRAFT` 확인 | 생성된 DRAFT TC는 **유지**(FK `ON DELETE SET NULL` → `test_studio_job_id`만 NULL) |
- **예상 결과**: Job 삭제가 산출 TC를 삭제하지 않음

#### [TS-G03] 삭제 취소
- **분류**: Delete | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **사전조건**: Job ≥1
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "삭제" → confirm에서 취소 | Job 유지(삭제 안 됨) |
- **예상 결과**: 취소 시 보존

---

# Part H — 검토 핸드오프 (→ Product Test Suite)

#### [TS-H01] DRAFT TC 보기 이동
- **분류**: Handoff | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: DONE Job
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 완료 Job "DRAFT TC 보기" 클릭 | `/features/companies/{cid}/products/{pid}?status=DRAFT&jobId={id}` (TestCasePage)로 이동, 해당 Job의 DRAFT 필터 적용 |
- **예상 결과**: 검토 화면으로 핸드오프 (`data-testid=company-job-view-drafts`)

#### [TS-H02] DRAFT → ACTIVE 전환 (경계: TestCasePage 소관)
- **분류**: Handoff | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: TS-H01 진입
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | DRAFT TC 검토·수정 후 status를 ACTIVE로 저장 | 일반 TC로 전환되어 Test Suite/테스트 실행에 참여 |
- **예상 결과**: 문서→DRAFT→ACTIVE 흐름 종결. (상세 편집·전환 검증은 Product Test Suite TC 스위트 소관)

---

# Part I — API 레벨 (계약)

#### [TS-I01] Job 생성 API
- **분류**: API | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `POST /api/test-studio/jobs` multipart(productId, sourceType=MARKDOWN, title, content) | 201, `ApiResponse.data = {jobId}` |
- **예상 결과**: 생성 계약 정상

#### [TS-I02] Job 생성 서버 검증 (negative 묶음)
- **분류**: API | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | title 누락 | 400 "title is required" |
  | 2 | MARKDOWN인데 content 누락 | 400 "Markdown content is required" |
  | 3 | content 100,001자 | 400 "문서 길이가 100,000자를 초과했습니다" |
  | 4 | PDF인데 file 누락 | 400 "PDF file is required" |
  | 5 | PDF 20MB 초과 | 400 "PDF 파일 크기가 20MB를 초과했습니다" |
  | 6 | 없는 productId | 400 "Product not found: {id}" |
- **예상 결과**: 서버측 검증 메시지 정확(클라 우회 시에도 방어)

#### [TS-I03] Job 목록 조회 (최신순)
- **분류**: API | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `GET /jobs?productId={id}` | 해당 Product Job, created_at DESC |
  | 2 | `GET /jobs?companyId={id}` | Company 전체 Product Job, created_at DESC |
- **예상 결과**: 스코프별 최신순 반환

#### [TS-I04] Job 목록 파라미터 상호배타
- **분류**: API | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `GET /jobs` (둘 다 없음) | 400 "productId or companyId is required" |
  | 2 | `GET /jobs?productId=1&companyId=1` (둘 다) | 400 "productId and companyId are mutually exclusive" |
- **예상 결과**: 모호 쿼리 차단

#### [TS-I05] 단건 조회 404
- **분류**: API | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `GET /jobs/99999999` | 400/404 "Job not found: {id}" |
- **예상 결과**: 미존재 명확 처리

#### [TS-I06] 삭제 API & 404
- **분류**: API | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `DELETE /jobs/{id}` | 204 No Content |
  | 2 | `DELETE /jobs/99999999` | "Job not found: {id}" |
- **예상 결과**: 삭제 계약 정상

#### [TS-I07] 수동 Path 무결성 검증
- **분류**: API | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `PATCH /test-cases/{id}/path` 타 Product segment 포함 | 400 "Segment {sid} does not belong to product {pid}" |
  | 2 | 부모 체인 불일치 path | 400 "Invalid path chain at segment ..." |
  | 3 | 없는 segmentId | 400 "Segment not found: {sid}" |
  | 4 | path=[] (빈 배열/null) | 미배정으로 리셋(정상) |
- **예상 결과**: updatePath 엄격 검증(추천 적용과 달리 생성 안 함)

#### [TS-I08] apply-suggested-path 응답
- **분류**: API | **Type**: FUNCTIONAL | **Priority**: MEDIUM | **status**: DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 추천 없는 TC | 200, `error="NO_SUGGESTION"`, resolvedLength=0 |
  | 2 | 추천 있는 TC | 200, `resolvedPath`, `resolvedLength`, `fullMatch`, `suggestedLength`, `createdSegmentCount` 반환, 누락 Segment 생성 |
- **예상 결과**: 응답 스키마·생성 동작 정확

#### [TS-I09] bulk-apply-suggested-path
- **분류**: API | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | testCaseIds 빈 배열 | 200, `[]` |
  | 2 | 없는 id 포함 | 해당 항목 `error="NOT_FOUND"` |
  | 3 | 추천 없는 id 포함 | 해당 항목 `error="NO_SUGGESTION"` |
- **예상 결과**: 항목별 결과 반환(부분 실패 격리)

#### [TS-I10] Company DRAFT 조회
- **분류**: API | **Type**: FUNCTIONAL | **Priority**: LOW | **status**: DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `GET /api/test-cases?companyId={id}&status=DRAFT` | Company 내 모든 Product의 DRAFT TC 반환 |
- **예상 결과**: Company 스코프 DRAFT 집계

---

# Part J — E2E 전체 흐름

#### [TS-J01] E2E — 문서 투입 → 생성 → 배정 → ACTIVE
- **분류**: E2E | **Type**: E2E | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: Company/Product 준비, Segment 트리·(선택) Convention/KB 준비. ⚠️ API 비용 발생
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Company 선택 → "+ TestCase 생성 요청" → Product 선택 | 생성 폼 노출 |
  | 2 | 제목 + Markdown 스펙 투입 → "생성 요청" | 201, toast 후 대시보드 이동, "대기 중" Job |
  | 3 | 폴링 관찰 | 대기 중 → 처리 중 → 완료, "{n}개 DRAFT 생성" |
  | 4 | "🤖 미배정" 섹션 확인 | 신규 DRAFT TC 노출 |
  | 5 | 한 TC "추천 적용" | "✅ 배정완료"로 이동, "📍 경로" 반영(필요 시 Segment 신규 생성) |
  | 6 | 완료 Job "DRAFT TC 보기" → TestCasePage | `?status=DRAFT&jobId=` 필터로 해당 TC 표시 |
  | 7 | TC 검토·수정 → status ACTIVE 저장 | ACTIVE 전환, 경로에 표시 |
- **예상 결과**: 문서 → DRAFT → 경로 배정 → ACTIVE까지 end-to-end 정상

#### [TS-J02] E2E — 삭제 후 DRAFT 보존
- **분류**: E2E | **Type**: E2E | **Priority**: MEDIUM | **status**: DRAFT
- **사전조건**: DONE Job + DRAFT TC 존재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 완료 Job "삭제" → 확인 | Job 제거 |
  | 2 | DRAFT 섹션 재확인 | 해당 DRAFT TC 유지 |
- **예상 결과**: Job-TC 수명주기 분리 확인

---

# Part K — 비기능 / 보안

#### [TS-SEC01] 비로그인 접근 (R-2 검증)
- **분류**: Security | **Type**: FUNCTIONAL | **Priority**: HIGH | **status**: DRAFT
- **사전조건**: 로그아웃 상태(헤더에 "Login" 링크 노출)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 비로그인으로 `/test-studio` 접근 후 Company 선택 | **(현재 관측)** Company 목록·DRAFT·Job이 그대로 조회됨 |
  | 2 | 기대 정책 확인 필요 | 인증이 필요한 화면이라면 `/login` 리다이렉트 또는 401이 되어야 함 |
- **예상 결과**: **확인 필요** — `ProtectedRoute`가 실제로 게이트하지 않음. 인증 정책 확정 후 기대값 재정의 (현 상태는 결함 의심)

---

## 커버리지 요약

| 영역 | TC | 핵심 |
|------|-----|------|
| A. 진입·Company | TS-A01~A06 | 진입, URL 동기화, 버튼 게이트, 딥링크 |
| B. 대시보드 | TS-B01~B07 | 4개 섹션, 카드 구성, 추천 유무 분기 |
| C. 생성 진입·Product | TS-C01~C05 | companyId 가드, Product 게이트, 자동선택 |
| D. 폼·Client 검증 | TS-D01~D10 | 필드, 경계(200/100,000), negative |
| E. 라이프사이클 | TS-E01~E08 | 제출, 폴링, DONE/FAILED, 부분성공·복구 |
| F. Path 배정 | TS-F01~F08 | 추천/일괄/수동, Segment 생성 vs 검증 |
| G. 삭제 | TS-G01~G03 | confirm, DRAFT 보존(CRITICAL) |
| H. 핸드오프 | TS-H01~H02 | DRAFT 보기 → ACTIVE |
| I. API 계약 | TS-I01~I10 | 검증·상호배타·404·path·apply |
| J. E2E | TS-J01~J02 | 전체 흐름, 삭제 보존 |
| K. 보안 | TS-SEC01 | 비로그인 접근(R-2) |

**총 62 TC** — testType 기준 SMOKE 2 / FUNCTIONAL 52 / REGRESSION 6 / E2E 2. (경계·negative 다수 포함, 보안 1건 포함)

## 실행 우선순위 (권장)
1. **P0(먼저)**: TS-A01, A03, C01/C02, D01·D03·D06(경계), E01~E03, F01·F02, G02, TS-SEC01
2. **P1**: 나머지 FUNCTIONAL + API 계약(I 묶음)
3. **P2**: REGRESSION(E06~E08 등 재현 조건 필요분), LOW 우선순위

## AI vs 사람 비교 활용 (선택)
본 문서를 gold set로, 동일 PRD를 Test Studio에 투입해 생성된 DRAFT TC와 (a) 커버리지 갭(특히 negative·경계 D03/D06, 보존 G02, 보안 SEC01), (b) 검증 메시지 정확도, (c) 제목/steps 스타일을 대조한다.
