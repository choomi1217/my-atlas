# Feature Registry — UX 불편사항 개선 (v10)

> 변경 유형: 기능 개선  
> 작성일: 2026-04-05  
> 버전: v10  
> 상태: 완료

---

## 요구사항

### [BUG-1] Phase 상세보기에서 테스트를 실행할 수 없음

**유저 시나리오:**
1. LNB → Product Test Suite → Company 카드 클릭 → ProductListPage
2. Product 카드의 Versions 버튼 → VersionListPage
3. Version 카드 클릭 → VersionDetailPage (상세보기 진입)
4. Phase 카드 클릭 → VersionPhaseDetailPage (Phase 상세보기 진입)
5. Phase 상세보기에서 각 TestCase에 대해 **테스트를 실행**(상태 변경)할 수 있어야 함

**현재 문제:**
- VersionPhaseDetailPage가 실제 TestResult API를 호출하지 않음
- `Array.from({ length: phase.phaseProgress.total })` 로 더미 배열을 생성하여 하드코딩된 데이터 표시
- ResultStatusBadge가 모든 행에서 `RunResultStatus.PASS`로 고정
- select onChange에서 `idx + 1`을 resultId로 사용 — 실제 result ID와 무관
- 테스트 케이스 제목이 "테스트 케이스 제목"으로 하드코딩
- 테스트 케이스의 상세 내용(Steps, Expected Result 등)을 볼 수 없음

**기대 동작 (TestRail 참고):**

상단 — 진행률 통계:
- Phase 진행률 (ProgressStats) — 상태 변경 시 실시간 반영
- Passed / Failed / Blocked / Retest / Untested 각각의 건수 및 비율 표시

하단 — 테스트 실행 목록 (TestRail 좌측 패널 참고):
- `GET /api/versions/{versionId}/phases/{phaseId}/results` API로 실제 결과 목록 조회
- 각 행: TC ID, 테스트 케이스 제목, 현재 상태(Status 드롭다운)
- Status 드롭다운 변경 즉시 `PATCH /api/versions/{versionId}/results/{resultId}` 호출
- 상태 변경 성공 시 해당 행의 배지 업데이트 + 상단 통계 실시간 갱신

테스트 케이스 상세 (TestRail 우측 패널 참고):
- 테스트 케이스 행 클릭 시 상세 내용 펼침 (드릴다운 방식, Accordion/Expand)
- 표시 항목: Preconditions, Steps (순서 → 동작 → 기대결과), Expected Result
- Comment 입력 필드 (테스트 실행 결과에 대한 비고 작성)

### [UX-1] Version 카드 클릭으로 상세보기 진입

**현재:** VersionListPage에서 "상세보기" 텍스트 버튼 클릭 필요  
**변경:** 카드 전체 클릭 → VersionDetailPage 이동, "상세보기" 버튼 삭제

### [UX-2] Phase 카드 클릭으로 Phase 상세보기 진입

**현재:** VersionDetailPage에서 "결과 보기 →" 텍스트 링크 클릭 필요  
**변경:** Phase 카드 전체 클릭 → VersionPhaseDetailPage 이동, "결과 보기 →" 링크 삭제

### [UX-3] 버전 복사 모달 UX 개선

**현재:**
- 모달 제목: "버전 분기 (복사)"
- 새 버전명 default 값: `{versionName}-延期` (한자)
- placeholder: `예: v9-延期, v9-hotfix`
- 제출 버튼: "분기" / "분기 중..."

**변경:**
- 모달 제목: "버전 복사"
- 새 버전명 default 값: 빈 문자열
- placeholder: `새로운 버전명`
- 제출 버튼: "복사" / "복사 중..."

### [UX-4] 복사 출처에 Version ID 대신 Version 이름 표시

**현재:** VersionDetailPage 정보란에 `Version #3` (숫자 ID)  
**변경:** `v1.0-release` 같은 실제 버전 이름 표시. Backend API에서 copiedFrom(Long)으로 Version 이름을 조회하여 전달하거나, Frontend에서 ID→이름 변환

### [UX-5] Product 카드에서 Test Cases 버튼 삭제

**현재:** Product 카드에 Test Cases / Test Runs / Versions / Delete 4개 버튼  
**변경:** 카드 클릭 = TestCasePage 이동이므로 Test Cases 버튼 불필요. Test Runs / Versions / Delete 3개만 유지

### [UX-6] TestRunListPage 타이틀 영어로 변경

**현재:** "테스트 실행" (한글) — 테스트를 수행하는 곳으로 오해 소지  
**변경:** "Test Runs" (영어). 부제/로딩 메시지/빈 상태/버튼도 함께 영어화

---

## 현재 코드 분석 (Context)

### VersionPhaseDetailPage (BUG-1 관련)
- 파일: `frontend/src/pages/features/VersionPhaseDetailPage.tsx`
- `versionApi.getById()`로 Version을 로드한 후 `version.phases.find(p => p.id === phaseId)`로 Phase 정보 추출
- 결과 표시: `Array.from({ length: phase.phaseProgress.total })` — 더미 배열, 실제 API 미호출
- `testResultApi.getByVersionPhaseId()` API 함수는 `api/features.ts`에 이미 존재하지만 사용되지 않음
- Backend `GET /api/versions/{versionId}/phases/{phaseId}/results` 엔드포인트 구현 완료 (TestResultController)
- Backend 응답 형식: `TestResultResponse(id, versionId, versionPhaseId, testCaseId, testCaseTitle, status, comment, executedAt, createdAt, updatedAt)`

### VersionListPage (UX-1 관련)
- 파일: `frontend/src/pages/features/VersionListPage.tsx`
- 카드에 `data-testid="version-detail-btn"` 상세보기 버튼 존재
- 카드 div에 onClick 없음

### VersionDetailPage (UX-2, UX-4 관련)
- 파일: `frontend/src/pages/features/VersionDetailPage.tsx`
- Phase 카드에 "결과 보기 →" 텍스트 링크 존재, 카드 div에 onClick 없음
- 복사 출처: `version.copiedFrom ? 'Version #' + version.copiedFrom : '신규'` — ID 직접 표시
- "분기" 버튼으로 VersionCopyModal 오픈

### VersionCopyModal (UX-3 관련)
- 파일: `frontend/src/components/features/VersionCopyModal.tsx`
- `newName` 기본값: `${versionName}-延期`
- 모달 제목: "버전 분기 (복사)"
- 제출 버튼: "분기" / "분기 중..."

### ProductListPage (UX-5 관련)
- 파일: `frontend/src/pages/features/ProductListPage.tsx`
- 방금 복원한 상태: Test Cases / Test Runs / Versions / Delete 4개 버튼

### TestRunListPage (UX-6 관련)
- 파일: `frontend/src/pages/features/TestRunListPage.tsx`
- 타이틀: "테스트 실행", 버튼: "+ 새 테스트 실행", 빈 상태: "테스트 실행이 없습니다."

---

## 구현 계획

### Step 1 — [BUG-1] VersionPhaseDetailPage: 테스트 실행 페이지로 재구현

**변경 파일:** `frontend/src/pages/features/VersionPhaseDetailPage.tsx`

**1-A. 실제 TestResult API 연동:**
- [x] `testResultApi.getByVersionPhaseId(versionId, phaseId)` 호출하여 실제 결과 목록 로드
- [x] 결과 목록을 state(`results`)로 관리
- [x] 기존 더미 배열 렌더링 (`Array.from(...)`) 완전 제거

**1-B. 테스트 실행 목록 (TestRail 좌측 패널 스타일):**
- [x] 각 행: TC ID(testCaseId), testCaseTitle, ResultStatusBadge(실제 status), Status 드롭다운
- [x] Status 드롭다운 변경 → `testResultApi.updateResult(versionId, resultId, status)` 즉시 호출
- [x] 성공 시: 해당 행의 status 로컬 업데이트 + 상단 ProgressStats 재계산
- [x] Comment 입력: 각 행에 comment 텍스트 영역 (펼침 시 표시) + Save 버튼

**1-C. 테스트 케이스 상세 펼침 (Accordion/Expand, 드릴다운 방식):**
- [x] 행 클릭 시 해당 TC의 상세 내용 펼침/접힘 토글 (state: `expandedResultId`)
- [x] 펼침 영역에 표시: Preconditions, Steps 테이블(순서/동작/기대결과), Expected Result
- [x] 상세 데이터: 방법 A 채택 — `testCaseApi.getByProductId(productId)`로 전체 TC 미리 로드

**1-D. 상단 통계 실시간 반영:**
- [x] 상태 변경 시 results 배열에서 `useMemo`로 직접 통계 재계산 (API 재호출 불필요)
- [x] ProgressStats 컴포넌트에 계산된 liveStats 전달
- [x] 각 행의 배경색이 status에 따라 동적 변경 (PASS=초록, FAIL=빨강 등)

### Step 2 — [UX-1] VersionListPage: 카드 클릭으로 상세 이동

**변경 파일:** `frontend/src/pages/features/VersionListPage.tsx`

- [x] Version 카드 div에 `onClick` → navigate to VersionDetailPage 추가, `cursor-pointer` 스타일
- [x] "상세보기" 텍스트 버튼 삭제
- [x] "삭제" 버튼에 `e.stopPropagation()` 추가 (카드 클릭 이벤트 전파 방지)

### Step 3 — [UX-2] VersionDetailPage: Phase 카드 클릭으로 상세 이동

**변경 파일:** `frontend/src/pages/features/VersionDetailPage.tsx`

- [x] Phase 카드 div에 `onClick` → navigate to VersionPhaseDetailPage 추가, `cursor-pointer` 스타일
- [x] "결과 보기 →" 텍스트 링크 삭제
- [x] "삭제" 버튼에 `e.stopPropagation()` 추가

### Step 4 — [UX-3] VersionCopyModal: 한자 제거, 명칭 변경

**변경 파일:** `frontend/src/components/features/VersionCopyModal.tsx`

- [x] `newName` 기본값: `${versionName}-延期` → `''` (빈 문자열)
- [x] placeholder: `예: v9-延期, v9-hotfix` → `새로운 버전명`
- [x] 모달 제목: "버전 분기 (복사)" → "버전 복사"
- [x] 안내 문구: `"{versionName}"을(를) 기반으로 새로운 버전을 생성합니다.` 유지
- [x] 제출 버튼: "분기" → "복사", "분기 중..." → "복사 중..."

**변경 파일:** `frontend/src/pages/features/VersionDetailPage.tsx`

- [x] "분기" 버튼 텍스트 → "버전 복사"

### Step 5 — [UX-4] VersionDetailPage: 복사 출처에 버전 이름 표시

**변경 파일:** `frontend/src/pages/features/VersionDetailPage.tsx`

- [x] `version.copiedFrom`이 있을 때 `versionApi.getById(version.copiedFrom)`으로 이름 조회
- [x] `Version #3` → 실제 버전 이름 표시 (예: `v1.0-release`)
- [x] 조회 실패 시 fallback: `ID: {copiedFrom}`

### Step 6 — [UX-5] ProductListPage: Test Cases 버튼 삭제

**변경 파일:** `frontend/src/pages/features/ProductListPage.tsx`

- [x] "Test Cases" 버튼 삭제 (카드 onClick이 이미 TestCasePage로 이동)
- [x] Test Runs / Versions / Delete 3개 버튼만 유지

### Step 7 — [UX-6] TestRunListPage: 타이틀 영어로 변경

**변경 파일:** `frontend/src/pages/features/TestRunListPage.tsx`

- [x] 타이틀: "테스트 실행" → "Test Runs"
- [x] 버튼: "+ 새 테스트 실행" → "+ New Test Run"
- [x] 빈 상태: "테스트 실행이 없습니다." → "No test runs yet."
- [x] 로딩: "테스트 실행 로드 중..." → "Loading test runs..."
- [x] 삭제 확인: "이 테스트 실행을 삭제하시겠습니까?" → "Delete this test run?"

---

## 최종 요약

### 구현 내용

1. **[BUG-1]** VersionPhaseDetailPage — 더미 데이터 제거, 실제 TestResult API 연동, Accordion 상세 펼침, 실시간 통계 갱신
2. **[UX-1]** VersionListPage — 카드 클릭으로 상세 이동, "상세보기" 버튼 삭제
3. **[UX-2]** VersionDetailPage — Phase 카드 클릭으로 상세 이동, "결과 보기 →" 링크 삭제
4. **[UX-3]** VersionCopyModal — 한자 제거, "버전 복사" 명칭 통일, 빈 기본값
5. **[UX-4]** VersionDetailPage — 복사 출처에 Version ID 대신 실제 이름 표시
6. **[UX-5]** ProductListPage — 불필요한 "Test Cases" 버튼 삭제
7. **[UX-6]** TestRunListPage — 타이틀/버튼/빈 상태 영어화
