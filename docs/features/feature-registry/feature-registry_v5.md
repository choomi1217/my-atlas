# feature-registry_v5
Feature Registry UI 버그 수정 및 UX 개선

## 변경 유형
버그 수정 + 기능 개선

## 배경
v4에서 TreeView 기반 Path 관리를 도입했으나, TestCase의 Add/Edit이 모달이 아닌 인라인 폼으로 구현되어 UX가 의도와 다르다.
또한 Company/Product 목록 페이지에서 Add 인풋이 검색창과 혼동되는 UX 문제가 있다.

---

## 개선 항목

### 1. TestCase Add/Edit → 모달로 변경 (버그 수정)

**현재 문제:**
- Add TestCase: 페이지 내 인라인 폼으로 표시됨
- Edit TestCase: 카드 내부에서 인라인 편집됨
- Edit 시 title, priority, testType, status만 수정 가능 (description, preconditions, steps, expectedResult 편집 불가)

**개선:**
- `TestCaseFormModal` 컴포넌트 생성 (FaqFormModal 패턴 참고)
- Add/Edit 모두 동일한 모달에서 처리
- 모달에 전체 필드 포함: Path(읽기 전용), Title, Description, Prompt Text, Priority, TestType, Status, Preconditions, Steps, Expected Result

```
[TestCase 모달]
┌──────────────────────────────────────────────┐
│  Add Test Case  /  Edit Test Case      [✕]   │
├──────────────────────────────────────────────┤
│                                              │
│  Path (읽기 전용)                              │
│  ┌──────────────────────────────────────┐    │
│  │ Main > Login > Social               │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  Title *                                     │
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  Description                                 │
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  Prompt Text                                 │
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ Priority ▼ │ │ TestType ▼ │ │ Status ▼ │ │
│  └────────────┘ └────────────┘ └──────────┘ │
│                                              │
│  Preconditions                               │
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  Steps                                       │
│  ┌──────────────────────────────────────┐    │
│  │ #1  Action: [        ]               │    │
│  │     Expected: [      ]               │    │
│  │ #2  Action: [        ]               │    │
│  │     Expected: [      ]               │    │
│  │ [+ Add Step]                         │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  Expected Result                             │
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  [Cancel]                      [Create/Save] │
└──────────────────────────────────────────────┘
```

### 2. Company/Product 목록 UX 개선 (기능 개선)

**현재 문제:**
- Company: 상단에 "Company name..." 인풋 + "Add Company" 버튼이 검색창처럼 보임
- Product: 상단에 Add Product 인라인 폼이 검색/추가 구분이 안 됨

**개선 — Company 목록 (`CompanyListPage`):**
- 상단: 검색 인풋 (돋보기 아이콘) + 정렬 드롭다운 (이름순/최신순)
- 카드 그리드: 기존 Company 카드들 + 맨 앞에 "+" 카드 (Add Company)
- "+" 카드 클릭 시 → Add Company 모달 오픈

```
[상단 바]
┌─────────────────────────────────┐  ┌─────────────┐
│ 🔍 Search companies...          │  │ Sort: Name ▼│
└─────────────────────────────────┘  └─────────────┘

[카드 그리드]
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│             │  │             │  │             │
│     ＋      │  │  My-Atlas   │  │  Other Co   │
│  Add New    │  │             │  │             │
│             │  │ [Activate]  │  │ [Activate]  │
│             │  │ [Delete]    │  │ [Delete]    │
└─────────────┘  └─────────────┘  └─────────────┘
```

**개선 — Product 목록 (`ProductListPage`):**
- 동일한 패턴 적용: 상단 검색 + 정렬, "+" 카드로 Add
- "+" 카드 클릭 시 → Add Product 모달 오픈 (Name, Platform, Description 입력)

### 3. Delete 확인 다이얼로그 통일 (기능 개선)

**현재 문제:**
- Company, Product, TestCase 삭제 시 `window.confirm()` (브라우저 기본 다이얼로그) 사용

**개선:**
- 프로젝트 내 모달 스타일과 일관된 커스텀 확인 다이얼로그 적용
- "정말 삭제하시겠습니까?" + 대상 이름 표시 + Cancel/Delete 버튼

---

## 영향 범위

### Frontend 변경
| 파일 | 변경 내용 |
|------|----------|
| `components/features/TestCaseFormModal.tsx` | **신규** — TestCase Add/Edit 모달 |
| `components/features/CompanyFormModal.tsx` | **신규** — Company Add 모달 |
| `components/features/ProductFormModal.tsx` | **신규** — Product Add 모달 |
| `components/features/ConfirmDialog.tsx` | **신규** — 공통 삭제 확인 다이얼로그 |
| `pages/features/TestCasePage.tsx` | 인라인 Add/Edit 폼 제거 → 모달 호출로 변경 |
| `pages/features/CompanyListPage.tsx` | 상단 Add 폼 제거 → 검색+정렬+카드 구조로 변경 |
| `pages/features/ProductListPage.tsx` | 상단 Add 폼 제거 → 검색+정렬+카드 구조로 변경 |

### Backend 변경
없음 (프론트엔드 UI 변경만 해당)

---

## 현재 코드 분석

### 현재 구현 상태 요약

| 항목 | 현재 구현 | 문제점 |
|------|----------|--------|
| TestCase Add | `TestCasePage.tsx` 내 인라인 폼 (284-472줄) | 페이지 스크롤이 길어지고 UX 불편 |
| TestCase Edit | 카드 내 인라인 편집 (478-562줄) | title/priority/testType/status만 수정 가능, description·preconditions·steps·expectedResult 편집 불가 |
| Company Add | `CompanyListPage.tsx` 상단 텍스트 인풋 + 버튼 | 검색창과 혼동 |
| Product Add | `ProductListPage.tsx` 상단 인라인 폼 (name/platform/description) | 검색/추가 구분 안 됨 |
| Delete 확인 | Company·Product·TestCase·Segment 모두 `window.confirm()` | 브라우저 기본 다이얼로그, 스타일 불일치 |

### 참고할 기존 모달 패턴
- `FaqFormModal.tsx` (senior 모듈): fixed overlay + backdrop(bg-black/40) + 중앙 white container + Header/Body/Footer 구조
- `PdfUploadModal.tsx` (kb 모듈): 동일 모달 구조, 파일 업로드 특화
- z-index: z-50 표준 사용

### 영향 받는 파일 (Frontend Only)

**신규 생성:**
- `components/features/ConfirmDialog.tsx`
- `components/features/TestCaseFormModal.tsx`
- `components/features/CompanyFormModal.tsx`
- `components/features/ProductFormModal.tsx`

**수정:**
- `pages/features/TestCasePage.tsx` — 인라인 Add/Edit 폼 제거 → 모달 호출
- `pages/features/CompanyListPage.tsx` — 상단 Add 폼 제거 → 검색+정렬+카드("+" 카드) 구조
- `pages/features/ProductListPage.tsx` — 상단 Add 폼 제거 → 검색+정렬+카드("+" 카드) 구조
- `components/features/SegmentTreeView.tsx` — window.confirm() → ConfirmDialog 적용

---

## 구현 계획

### Step 1 — ConfirmDialog 공통 컴포넌트 생성 ✅
- [x] `ConfirmDialog.tsx` 생성
  - Props: `isOpen`, `title`, `message`, `onConfirm`, `onCancel`, `confirmLabel?`, `confirmColor?`
  - FaqFormModal과 동일한 overlay 패턴 (fixed inset-0 z-50 bg-black/40)
  - 기본: "Delete" 빨간 버튼 + "Cancel" 회색 버튼
  - 삭제 대상 이름을 message에 포함하여 표시

### Step 2 — TestCaseFormModal (버그 수정 — 핵심) ✅
- [x] `TestCaseFormModal.tsx` 생성
  - Props: `isOpen`, `onClose`, `onSubmit`, `initialData?` (Edit 시), `pathDisplay` (읽기 전용 경로 문자열)
  - 전체 필드 포함: Path(읽기 전용), Title*, Description, Prompt Text, Priority, TestType, Status, Preconditions, Steps(동적 추가/삭제), Expected Result
  - Steps 섹션: `#N Action / Expected` 형태, `+ Add Step` 버튼, 각 Step 삭제 가능
  - Add/Edit 모드 자동 판별 (initialData 유무)
  - max-w-2xl, 본문 영역 max-h + overflow-y-auto (긴 폼 스크롤)
- [x] `TestCasePage.tsx` 수정
  - `showAddForm` + 인라인 Add 폼(284-472줄) 제거 → `showModal` state + TestCaseFormModal 호출
  - `editingId/editingData` + 인라인 Edit(478-562줄) 제거 → 동일 모달에 initialData 전달
  - "Add Test Case" 버튼 클릭 → 모달 오픈 (path: selectedPath 기반)
  - 카드의 "Edit" 버튼 클릭 → 모달 오픈 (initialData: 해당 testCase)
  - Delete → ConfirmDialog 적용

### Step 3 — Company 목록 UX 개선 ✅
- [x] `CompanyFormModal.tsx` 생성
  - Props: `isOpen`, `onClose`, `onSubmit`
  - 단일 필드: Company Name
- [x] `CompanyListPage.tsx` 수정
  - 상단: 검색 인풋 (🔍 아이콘) + 정렬 드롭다운 (이름순/최신순)
  - 상단 인라인 Add 폼 제거
  - 카드 그리드 맨 앞에 "+" 카드 추가 (클릭 시 CompanyFormModal 오픈)
  - 기존 카드: name, Active 배지, Activate/Delete 버튼 유지
  - Delete → ConfirmDialog 적용
  - 검색: `companies.filter(c => c.name.toLowerCase().includes(query))` (클라이언트 사이드)
  - 정렬: 이름순(name asc) / 최신순(createdAt desc)

### Step 4 — Product 목록 UX 개선 ✅
- [x] `ProductFormModal.tsx` 생성
  - Props: `isOpen`, `onClose`, `onSubmit`
  - 필드: Name, Platform(select), Description
- [x] `ProductListPage.tsx` 수정
  - Company와 동일 패턴: 검색+정렬+카드("+" 카드)
  - 상단 인라인 Add 폼 제거
  - Delete → ConfirmDialog 적용

### Step 5 — Segment 삭제 ConfirmDialog 적용 ✅
- [x] `SegmentTreeView.tsx` 수정
  - `window.confirm("이 Path를 삭제하시겠습니까?")` → ConfirmDialog 컴포넌트로 교체
  - 우클릭 "Delete" → ConfirmDialog 오픈 → 확인 시 삭제 수행

### Step 6 — Backend Unit & Integration Tests (Agent-B)
- Backend 변경 없음 → 기존 테스트 유지, 추가 테스트 불필요

### Step 7 — E2E Tests (Agent-C) ✅
- [x] `qa/ui/company-panel.spec.ts` — "+" 카드 클릭 → 모달 Add, 검색/정렬, ConfirmDialog 삭제 시나리오
- [x] `qa/ui/product-panel.spec.ts` — "+" 카드 클릭 → 모달 Add, 검색/정렬, ConfirmDialog 삭제 시나리오
- [x] `qa/ui/feature-panel.spec.ts` — 모달 Add/Edit, 전체 필드 편집, ConfirmDialog 삭제 시나리오
- [x] `qa/pages/features-page.ts` — Page Object 업데이트 (모달 기반 Add/Delete 메서드)

### Step 8 — Build & Verification (Agent-D) ✅
- [x] `./gradlew clean build` 성공
- [x] `./gradlew test` 성공
- [x] `docker compose up -d` 성공
- [x] `npx playwright test` — feature 관련 19개 전체 통과 (기존 KB/Senior 8개 실패는 v5 무관)
- [x] `docker compose down` 정리 (볼륨 보존)

---

## [최종 요약]

### 변경 파일

**신규 생성 (4개):**
- `frontend/src/components/features/ConfirmDialog.tsx` — 공통 삭제 확인 다이얼로그
- `frontend/src/components/features/TestCaseFormModal.tsx` — TestCase Add/Edit 모달 (전체 필드)
- `frontend/src/components/features/CompanyFormModal.tsx` — Company Add 모달
- `frontend/src/components/features/ProductFormModal.tsx` — Product Add 모달

**수정 (4개):**
- `frontend/src/pages/features/TestCasePage.tsx` — 인라인 Add/Edit 폼 → 모달, window.confirm → ConfirmDialog
- `frontend/src/pages/features/CompanyListPage.tsx` — 검색+정렬+"+" 카드 구조, 모달 Add, ConfirmDialog
- `frontend/src/pages/features/ProductListPage.tsx` — 동일 패턴 적용
- `frontend/src/components/features/SegmentTreeView.tsx` — window.confirm → ConfirmDialog

**E2E 테스트 (4개):**
- `qa/pages/features-page.ts` — 모달 기반 Add/Delete 메서드 추가
- `qa/ui/company-panel.spec.ts` — 모달/ConfirmDialog 시나리오 반영
- `qa/ui/product-panel.spec.ts` — 동일
- `qa/ui/feature-panel.spec.ts` — 동일

### 검증 결과
- Backend: build + unit tests 모두 통과
- Frontend: TypeScript 타입체크 + Vite 빌드 통과
- E2E: feature 관련 19개 테스트 전체 통과
