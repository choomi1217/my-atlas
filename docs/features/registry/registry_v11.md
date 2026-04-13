# Feature Registry — TestRun 상세 페이지 & TC 선택 개선 (v11)

> 변경 유형: 기능 개선  
> 작성일: 2026-04-08  
> 버전: v11  
> 상태: 완료

---

## 요구사항

### [개선-1] TestRun 상세정보 페이지

**유저 시나리오:**
1. LNB → Product Test Suite → Company 카드 클릭 → ProductListPage
2. Product 카드의 Test Runs 버튼 → TestRunListPage
3. TestRun 카드 클릭 → **TestRunDetailPage** (신규 페이지)

**기대 동작:**
- TestRun의 이름, 설명, 생성일, 수정일 표시
- 포함된 테스트 케이스 목록을 Segment path 기준으로 그룹핑하여 계층 구조로 표시

### [개선-2] 상세 페이지에서 수정/삭제

**현재:** TestRunListPage의 수정 버튼 → 모달에서 수정 (버그 있음)  
**변경:** 수정 버튼 제거, 상세 페이지에서 직접 수정/삭제

- "수정" 버튼 클릭 → 편집 모드 전환 (이름, 설명 인라인 편집 + TC 추가/제거)
- "삭제" 버튼 → ConfirmDialog → 삭제 후 목록으로 이동

> 이 기능 구현을 우선으로 하여 아래 BUG-1, BUG-2를 함께 해소한다.

### [개선-3] TestCase 선택 방식 개선 (Path 기반 그룹 선택)

**현재 불편사항:**
1. 각각의 테스트 케이스를 하나하나 선택하는게 불편함
2. 테스트 케이스의 hierarchy가 보이지 않아서 불편함

**제안 — Path 기반 그룹 선택 UI:**

```
┌─────────────────────────────────────────┐
│ 테스트 케이스 선택           선택: 3/8개   │
│ ┌─────────────────────────────────────┐ │
│ │ 🔍 검색...                          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ▼ ☑ Main (3/5)                         │
│   ▼ ☑ Login (2/3)                      │
│       ☑ TC-12: 로그인 성공 테스트       │
│       ☑ TC-13: 비밀번호 오류 테스트     │
│       ☐ TC-14: 소셜 로그인 테스트       │
│   ▶ ☐ Signup (0/2)                     │
│                                         │
│ ▼ ☑ Settings (1/3)                     │
│   ...                                   │
└─────────────────────────────────────────┘
```

- Segment path를 트리 형태로 표시
- 각 노드에 "(선택수/전체수)" 배지
- **노드 체크박스:** 하위 TC 일괄 선택/해제
- **TC 체크박스:** 개별 선택/해제
- **접기/펼치기** 토글
- **검색 필터** (TC 제목 기준)
- 이 컴포넌트를 TestRunDetailPage 편집 모드 + TestRunFormModal(생성) 양쪽에 적용

### [BUG-1] 수정 시 새로운 TestRun이 생김

**재현경로:**
1. LNB > Product Test Suite 클릭
2. Company List > 랜덤 Company 클릭
3. Product List > 랜덤 Product의 Test Runs 클릭
4. Test Run List > 랜덤한 Test Run 수정 버튼 클릭
5. 이름 혹은 설명을 변경, 테스트케이스를 랜덤하게 선택 후 저장 버튼 클릭

**버그 내용:** TestRun 수정 모달에서 저장 시 기존 TestRun이 수정되지 않고 새로운 TestRun이 생김

### [BUG-2] TestRun의 TestCase 추가 기능이 동작하지 않음

**재현경로:**
1. Test Run List 진입 > 랜덤한 Test Run 수정 버튼 클릭
2. 테스트케이스를 랜덤하게 선택 후 저장 버튼 클릭

**버그 내용:** 이름, 설명을 수정하지 않고 테스트케이스만 선택해도 새로운 TestRun이 생김

---

## 현재 코드 분석 (Context)

### TestRunListPage (BUG-1, BUG-2 관련)
- 파일: `frontend/src/pages/features/TestRunListPage.tsx`
- **BUG-1 원인 (line 172):** 모달의 `onSubmit`이 항상 `handleCreate`를 호출
  ```tsx
  <TestRunFormModal
    onSubmit={handleCreate}          // ❌ selectedTestRun이 있어도 항상 create
    initialData={selectedTestRun}    // ✅ edit 데이터는 정상 전달
  />
  ```
  - `handleCreate`는 `testRunApi.create()` (POST)만 호출 → 새 TestRun 생성
  - `handleUpdate` 함수 자체가 존재하지 않음
  - `testRunApi.update()` (PATCH)는 `api/features.ts`에 구현되어 있으나 미사용

- **BUG-2 원인 (TestRunFormModal line 39):** edit 시 testCaseIds가 빈 배열로 초기화
  ```tsx
  setForm({
    name: initialData.name,
    description: initialData.description || '',
    testCaseIds: [],  // ❌ 기존 선택된 TC ID를 가져올 수 없음
  });
  ```
  - `TestRun` 인터페이스에 `testCaseIds` 또는 `testCases` 필드가 없음 (count만 있음)
  - 편집 모달에서 모든 체크박스가 비어있는 상태로 표시됨

### TestRunFormModal
- 파일: `frontend/src/components/features/TestRunFormModal.tsx`
- `isEdit = !!initialData`로 편집 모드 감지 → 타이틀만 변경 ("테스트 실행 수정")
- TC 선택: flat 체크박스 목록 (max-h-32, overflow-y-auto) — 계층 구조 미표시
- 제출 시: `onSubmit(form)` 호출 — create/update 구분은 부모 컴포넌트에 위임

### Frontend 타입 & API
- `TestRun` 인터페이스 (`types/features.ts:140`): `testCaseCount: number`만 있음, testCases 배열 없음
- `testRunApi.getById()` (`api/features.ts:267`): 반환 타입이 `TestRun`이나 Backend는 `TestRunDetail` 반환 (testCases 배열 포함)
- `testRunApi.update()` (`api/features.ts:292`): PATCH 엔드포인트 구현 완료, 미사용

### Backend API
- `GET /api/test-runs/{id}` → `TestRunDetail` 응답: `{ id, productId, name, description, testCases: [{id, title}], createdAt, updatedAt }`
- `PATCH /api/test-runs/{id}` → 부분 업데이트: name, description, testCaseIds 모두 optional
  - testCaseIds 제공 시 기존 연결 DELETE → 새로 CREATE (교체 방식)
- `DELETE /api/test-runs/{id}` → TestResult cascade 삭제 후 TestRun 삭제

### 라우팅 현황
- 기존: `/features/companies/:companyId/products/:productId/test-runs` → TestRunListPage
- 상세 페이지 라우트 없음 (TestRunDetailPage 미존재)

---

## 구현 계획

### Step 1 — 타입 보강 & API 정비

**변경 파일:** `frontend/src/types/features.ts`

- [x] `TestRun` 인터페이스에 `testCases` optional 필드 추가 (`TestCaseSummary` 인터페이스도 추가)
  ```ts
  export interface TestRun {
    // ...기존 필드
    testCases?: { id: number; title: string }[];  // getById 응답에서 제공
  }
  ```

**변경 파일:** `frontend/src/api/features.ts`

- [x] `testRunApi.getById()` 반환 타입 확인 (Backend TestRunDetail과 매핑) — 기존 코드 그대로 호환

### Step 2 — TestRunDetailPage 생성 (읽기 모드)

**신규 파일:** `frontend/src/pages/features/TestRunDetailPage.tsx`

- [x] 라우트 등록: `/features/companies/:companyId/products/:productId/test-runs/:testRunId`
- [x] `App.tsx`에 Route 추가
- [x] `testRunApi.getById(testRunId)` 호출로 TestRun 상세 로드
- [x] `testCaseApi.getByProductId(productId)` + `segmentApi.getByProductId(productId)` 로드 (path 해석용)
- [x] 읽기 모드 UI:
  - Breadcrumb (Company > Product > Test Runs > {name})
  - TestRun 이름, 설명, 생성일, 수정일 표시
  - 포함된 TC 목록을 path 기준 그룹핑으로 표시 (segment 이름 해석)
  - "수정" / "삭제" 버튼

### Step 3 — TestRunDetailPage에 수정/삭제 기능 추가

**변경 파일:** `frontend/src/pages/features/TestRunDetailPage.tsx`

- [x] 편집 모드 전환 (state: `isEditing`)
  - 이름, 설명 → input/textarea로 전환
  - TC 목록 → TestCaseGroupSelector로 전환 (기존 선택 상태 유지)
- [x] "저장" 버튼 → `testRunApi.update(testRunId, name, description, testCaseIds)` 호출
- [x] "취소" 버튼 → 편집 모드 해제, 원래 값 복원
- [x] "삭제" 버튼 → ConfirmDialog → `testRunApi.delete(testRunId)` → 목록으로 navigate

### Step 4 — TestRunListPage 정리 (카드 클릭 네비게이션)

**변경 파일:** `frontend/src/pages/features/TestRunListPage.tsx`

- [x] "수정" 버튼 삭제
- [x] 카드 div에 `onClick` → navigate to TestRunDetailPage, `cursor-pointer` 스타일
- [x] "삭제" 버튼에 `e.stopPropagation()` 추가
- [x] 모달은 생성 전용으로 유지 (`onSubmit={handleCreate}` 유지, selectedTestRun 관련 로직 제거)
- [x] TestRunFormModal에서 `initialData` prop 제거 (생성 전용)

### Step 5 — TestCaseGroupSelector 컴포넌트 (Path 기반 그룹 선택)

**신규 파일:** `frontend/src/components/features/TestCaseGroupSelector.tsx`

- [x] Props:
  ```ts
  interface TestCaseGroupSelectorProps {
    segments: Segment[];
    testCases: TestCase[];
    selectedIds: Set<number>;
    onChange: (selectedIds: Set<number>) => void;
  }
  ```
- [x] Segment 트리를 빌드하고 TC를 path 기준으로 그룹핑
- [x] 노드 체크박스: 하위 TC 일괄 선택/해제 (indeterminate 지원)
- [x] TC 체크박스: 개별 선택/해제
- [x] 접기/펼치기 토글
- [x] 검색 필터 (TC 제목 기준)
- [x] 선택 카운터 ("선택: N/M개")

**변경 파일:** `frontend/src/pages/features/TestRunDetailPage.tsx`

- [x] 편집 모드의 TC 선택 영역에 TestCaseGroupSelector 적용

**변경 파일:** `frontend/src/components/features/TestRunFormModal.tsx`

- [x] 생성 모드의 TC 선택 영역을 TestCaseGroupSelector로 교체
- [x] segments prop 추가 (부모에서 전달)

### Step 6 — BUG 수정 검증

> [개선-1~2] 구현으로 BUG-1, BUG-2의 근본 원인이 해소된다.
> 이 Step에서는 기존 버그 시나리오가 재현되지 않음을 확인한다.

- [x] [BUG-1 검증] TestRunDetailPage에서 이름/설명 수정 후 저장 → 새 TestRun 생성되지 않음 확인 (E2E test #7 통과)
- [x] [BUG-1 검증] 수정 후 목록 페이지에서 TestRun 수가 동일함을 확인 (PATCH API 사용, POST 아님)
- [x] [BUG-2 검증] TestRunDetailPage에서 TC만 추가/제거 후 저장 → 정상 반영 확인 (testRunApi.update 사용)
- [x] [BUG-2 검증] 기존 선택된 TC가 편집 모드에서 체크 상태로 표시됨 확인 (getById → testCases 배열로 초기화)

---

## 영향 범위

### 변경 파일 (Frontend)

| 파일 | 변경 내용 |
|------|----------|
| `types/features.ts` | TestRun에 testCases 필드 추가 |
| `api/features.ts` | 타입 매핑 확인 |
| `App.tsx` | TestRunDetailPage 라우트 추가 |
| `pages/features/TestRunDetailPage.tsx` | **신규** — 상세/수정/삭제 |
| `pages/features/TestRunListPage.tsx` | 수정 버튼 제거, 카드 클릭 네비게이션 |
| `components/features/TestRunFormModal.tsx` | 생성 전용으로 단순화, GroupSelector 적용 |
| `components/features/TestCaseGroupSelector.tsx` | **신규** — Path 기반 그룹 선택 |

### Backend 변경

- 없음 (기존 API로 충분)

### E2E 테스트 영향

| 파일 | 변경 내용 |
|------|----------|
| `qa/api/test-run.spec.ts` | 영향 없음 (API 변경 없음) — 107 API 테스트 통과 |
| `qa/ui/version.spec.ts` | 기존 버그 1건 (`version-detail-btn` 셀렉터, v10 잔여) |
| `qa/ui/test-run.spec.ts` | **신규** — TestRunDetailPage UI 테스트 8개 추가 (전체 통과) |

---

## 최종 요약

### 검증 결과

| 항목 | 결과 |
|------|------|
| Backend Build | PASS (no changes) |
| Backend Tests | PASS (all existing tests) |
| Frontend Build | PASS (Vite build successful) |
| E2E Tests | **157 passed**, 1 pre-existing failure, 13 skipped |
| 새 E2E (test-run.spec.ts) | **8/8 passed** |

### 구현 내용

1. **TestRunDetailPage** — 읽기/편집/삭제 기능이 포함된 상세 페이지
2. **TestCaseGroupSelector** — Segment 계층 구조 기반 TC 선택 UI (트리, 검색, 그룹 선택)
3. **TestRunListPage** — 수정 버튼 제거, 카드 클릭 네비게이션
4. **TestRunFormModal** — 생성 전용으로 단순화, GroupSelector 적용
5. **BUG-1 해소** — 수정 시 PATCH API 사용 (POST 대신)
6. **BUG-2 해소** — getById 응답의 testCases 배열로 기존 선택 상태 초기화
