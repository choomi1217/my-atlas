# Feature Registry — TestCase 페이지 UX 개선 (v13)

> 변경 유형: 기능 개선  
> 작성일: 2026-04-10  
> 버전: v13  
> 상태: 진행 중

---

## 요구사항

### [UX-1] 현재 위치(Breadcrumb) 부재

- 좌측 트리에서 특정 Path를 클릭해도, 우측에 "지금 어느 Path를 보고 있는지" 표시가 없다.
- Path hierarchy가 핵심 컨셉인데 정작 우측에서 사라진다.
- **변경:** 우측 상단에 선택된 Path를 Breadcrumb 형태로 표시 (예: `LNB > A 버튼 > A 페이지`)

### [UX-2] 선택된 Path 시각적 강조

- 좌측 트리에서 특정 Path를 클릭해도 시각적으로 어느 노드가 선택되었는지 구분이 어렵다.
- 기본 펼침 상태(전체 펼침)와 카운트 배지는 현재 그대로 유지한다.
- **변경:** 선택된 Path 노드에 background highlight 적용하여 현재 위치 강조

### [UX-3] Test Case 카드의 위계 부족

- 제목과 태그(3개)가 모두 비슷한 무게감이라 "어떤 TC가 중요한지" 스캔이 어렵다.
- 특히 HIGH/MEDIUM 같은 Priority가 시각적으로 강조되지 않는다.
- **변경:** Priority에 색상 강조 적용 (HIGH=빨강, MEDIUM=노랑, LOW=회색), 카드 좌측에 Priority 컬러 바 추가

### [UX-4] 과도한 우측 여백

- Edit/Delete 버튼이 화면 끝에 붙어 있어 제목과의 거리가 너무 멀다 (1440px+ 모니터 기준).
- **변경:** 카드 max-width 제한, 액션 버튼은 카드 호버 시 노출

### [UX-5] Add Test Case 버튼의 모호함

- Path를 눌러야만 추가할 수 있다.
- **변경:** Path Tree 노드에 우클릭 또는 `+` 버튼으로 해당 경로에 TC 추가 가능하도록 개선

### [UX-6] TestCase 펼침 시 Path highlight 연동

- 우측에서 TestCase를 펼쳐서 상세 내용을 보고 있을 때, 좌측 PathList에서 해당 TC의 path가 highlight되지 않는다.
- **변경:** TC 카드 펼침(expand) 시 해당 TC의 path를 selectedPath로 자동 반영 → 좌측 트리 highlight 연동

### [UX-7] PathList 스크롤 고정 (Sticky)

- 우측 TestCase 목록을 스크롤해도 좌측 PathList가 함께 올라가서, 현재 보고 있는 TC가 어느 Path에 속하는지 확인하려면 다시 스크롤을 올려야 한다.
- **변경:** 좌측 PathList를 sticky로 고정하여 우측 스크롤과 독립적으로 유지

### [UX-8] 스크롤 위치 기반 Path 자동 highlight (Scroll Spy)

- 우측 TC 목록을 스크롤할 때, 현재 화면 중앙에 보이는 TC 그룹의 Path가 좌측 트리에서 자동으로 highlight되면 좋겠다.
- 유저가 Path를 클릭하지 않아도 스크롤만으로 "지금 어떤 Path의 TC를 보고 있는지" 좌측에서 바로 확인 가능
- **변경:** IntersectionObserver로 각 path 그룹 섹션을 관찰, 화면 중앙 근처에 진입한 섹션의 path를 selectedPath로 자동 반영

---

## 현재 코드 분석 (Context)

### TestCasePage.tsx (450줄)

- 파일: `frontend/src/pages/features/TestCasePage.tsx`
- **레이아웃 (L249):** `flex gap-6` 2-column — 좌측 `w-72 flex-shrink-0`, 우측 `flex-1`
- **좌측 패널 (L251-278):** SegmentTreeView + 선택된 경로 텍스트 표시 (blue) + "Clear" 버튼
- **우측 패널 (L282-422):** 상단 Add 버튼 (selectedPath 필수) + path별 그룹핑된 TC 카드 목록
- **카드 구조 (L307-409):** title (bold) + 3개 배지 (priority/type/status) + Edit/Delete 버튼 + 클릭 시 상세 펼침
- **Add 버튼 (L284-291):** `selectedPath.length === 0`이면 disabled, 우측 패널 최상단에 위치
- **그룹핑 (L97-116):** `groupedTestCases` — DFS 순서로 path별 그룹, 각 그룹에 경로명 헤더

### SegmentTreeView.tsx (578줄)

- 파일: `frontend/src/components/features/SegmentTreeView.tsx`
- **기본 펼침 (L51-55):** `useEffect`에서 모든 segments를 expanded Set에 추가 → 전체 펼침 (유지)
- **카운트 배지 (L462-466):** `count > 0`인 모든 노드에 회색 배지 표시 (유지)
- **선택 상태 시각화:** 선택된 Path 노드에 대한 background highlight **없음**
- **노드 렌더링 (L405-486):** chevron(▼/▶/-) + 이름 + 카운트 + hover 시 `+` 버튼
- **우클릭 컨텍스트 메뉴 (L521-551):** "상단에 Path 추가", "하단에 Path 추가", "Path 삭제" — **TC 추가 옵션 없음**

### 카드 배지 스타일 (TestCasePage.tsx L318-326)

- Priority 배지: `bg-gray-100 text-gray-600` — HIGH/MEDIUM/LOW 모두 동일 회색
- Type 배지: `bg-blue-50 text-blue-700`
- Status 배지: `bg-green-50 text-green-700`
- 모든 배지가 비슷한 시각적 무게감 → Priority 위계 구분 불가

### Breadcrumb.tsx (54줄)

- 파일: `frontend/src/components/features/Breadcrumb.tsx`
- 표시: "Product Test Suite > Company > Product" — **Path 경로 미표시**

### TC 펼침과 Path 연동 (UX-6 관련)

- **expandedId (L34):** 현재 펼쳐진 TC의 id (단일)
- **TC 클릭 시 (L332-334):** `setExpandedId(expandedId === tc.id ? null : tc.id)` — selectedPath 변경 **없음**
- TC를 펼쳐도 좌측 트리의 highlight가 변하지 않음

### 좌측 패널 스크롤 (UX-7 관련)

- **좌측 패널 (L257):** `w-72 flex-shrink-0` — sticky 아님
- 우측 스크롤 시 좌측도 함께 스크롤됨

### Path 그룹 섹션 (UX-8 관련)

- **그룹 섹션 (L311-314):** 각 path별 `<div id="section-${path.join('-')}">`로 구분됨
- 이미 `handleSelectPath`에서 `scrollIntoView`로 해당 섹션으로 이동하는 로직 존재
- IntersectionObserver를 붙일 수 있는 `id` 속성이 이미 준비됨
- 현재는 스크롤 → selectedPath 역방향 연동 **없음** (클릭/펼침으로만 변경)

---

## 구현 계획

### Step 1 — [UX-1] 우측 패널 상단에 선택된 Path Breadcrumb 표시

**변경 파일:** `frontend/src/pages/features/TestCasePage.tsx`

**변경 사항:**
- 우측 패널 최상단에 선택된 Path를 Segment 이름으로 해석하여 Breadcrumb 스타일로 표시
- selectedPath가 비어있으면 "Path를 선택하세요" 안내 텍스트
- selectedPath가 있으면 `LNB > A 버튼 > A 페이지` 형태로 표시
- 기존 좌측 패널 하단의 선택 경로 텍스트(L265-277) 제거 → 우측으로 이동

```
┌── 우측 패널 ────────────────────────────────────────┐
│  📍 LNB > A 버튼 > A 페이지          [+ Add TC]    │
│  ─────────────────────────────────────────────────  │
│  (테스트 케이스 목록)                               │
└─────────────────────────────────────────────────────┘
```

- [x] 우측 상단에 Path Breadcrumb 렌더링 (resolvePathNames 재사용)
- [x] selectedPath 비어있을 때 안내 텍스트 표시
- [x] 좌측 패널의 기존 선택 경로 표시 영역(L265-277) 제거
- [x] Add 버튼을 Path Breadcrumb 우측에 배치 (한 줄)

---

### Step 2 — [UX-2] 선택된 Path 노드 시각적 강조

**변경 파일:** `frontend/src/components/features/SegmentTreeView.tsx`

**변경 사항:**
- 기본 펼침 상태(전체 펼침)와 카운트 배지는 현재 그대로 유지
- selectedPath에 포함된 노드(경로 상의 모든 조상 + 현재 노드)에 background highlight 적용
- 마지막 노드(leaf): 진한 강조 (`bg-indigo-100 text-indigo-800`)
- 경로 상 조상 노드: 연한 강조 (`bg-indigo-50`) — 경로 추적 용이
- 기존 노드 이름 색상 로직과 병합

```
▼ Main                        ← bg-indigo-50 (조상)
  ▼ Login                     ← bg-indigo-50 (조상)
    - Social Login             ← bg-indigo-100 (선택됨, 진한 강조)
    - Email Login
  ▶ Signup (2)
```

- [x] selectedPath prop에서 현재 선택된 노드와 조상 노드 구분
- [x] 마지막 노드에 `bg-indigo-100 text-indigo-800 rounded` 스타일 적용
- [x] 조상 노드에 `bg-indigo-50 rounded` 스타일 적용

---

### Step 3 — [UX-3] Test Case 카드 Priority 시각적 강조

**변경 파일:** `frontend/src/pages/features/TestCasePage.tsx`

**3-A. Priority 배지에 색상 적용:**
- HIGH: `bg-red-100 text-red-700`
- MEDIUM: `bg-yellow-100 text-yellow-700`
- LOW: `bg-gray-100 text-gray-500`

**3-B. 카드 좌측 Priority 컬러 바:**
- 카드 `div`에 `border-l-4` 적용
- HIGH: `border-l-red-400`
- MEDIUM: `border-l-yellow-400`
- LOW: `border-l-gray-300`

```
┌─┬──────────────────────────────────────────────┐
│ │  TC 제목                                      │
│R│  [HIGH]  [FUNCTIONAL]  [ACTIVE]               │
│E│                                               │
│D│  (펼침 시 상세 내용)                           │
└─┴──────────────────────────────────────────────┘
```

- [x] Priority별 배지 색상 매핑 변경 (회색 → 빨강/노랑/회색)
- [x] 카드 좌측에 `border-l-4` Priority 컬러 바 추가

---

### Step 4 — [UX-4] 카드 max-width + 호버 시 액션 버튼 노출

**변경 파일:** `frontend/src/pages/features/TestCasePage.tsx`

**4-A. max-width 제한:**
- 우측 패널 카드 컨테이너에 `max-w-4xl` (896px) 적용
- 넓은 모니터에서 과도한 여백 방지

**4-B. 액션 버튼 호버 시 노출:**
- 기존: Edit/Delete 버튼 항상 표시
- 변경: 기본 숨김 (`opacity-0`), 카드 hover 시 노출 (`group-hover:opacity-100`)
- 전환 애니메이션: `transition-opacity duration-150`

- [x] 카드 컨테이너에 `max-w-4xl` 적용
- [x] 카드에 `group` 클래스, 버튼 영역에 `opacity-0 group-hover:opacity-100` 적용

---

### Step 5 — [UX-5] Path Tree 노드에서 TC 추가 기능

**변경 파일:** `frontend/src/components/features/SegmentTreeView.tsx`

**변경 사항:**
- 우클릭 컨텍스트 메뉴에 "Test Case 추가" 옵션 추가
- 클릭 시 해당 노드의 path를 선택하고 TestCasePage의 모달 열기 콜백 호출

**변경 파일:** `frontend/src/pages/features/TestCasePage.tsx`

- SegmentTreeView에 `onAddTestCase?: (path: number[]) => void` 콜백 prop 추가
- 콜백 구현: path 설정 → 모달 open

```
우클릭 메뉴:
┌────────────────────────┐
│ 상단에 Path 추가        │
│ 하단에 Path 추가        │
│ ───────────────────── │
│ Test Case 추가          │  ← 신규
│ ───────────────────── │
│ Path 삭제               │
└────────────────────────┘
```

- [x] SegmentTreeView에 `onAddTestCase` prop 추가
- [x] 컨텍스트 메뉴에 "Test Case 추가" 항목 추가 (구분선 포함)
- [x] TestCasePage에서 콜백 구현: 해당 path 선택 + 모달 open

---

### Step 6 — [UX-6] TestCase 펼침 시 Path highlight 연동

**변경 파일:** `frontend/src/pages/features/TestCasePage.tsx`

**변경 사항:**
- TC 카드 클릭(expand) 시 `setExpandedId`와 함께 `setSelectedPath(tc.path)` 호출
- TC를 접을 때(collapse)는 selectedPath 유지 (마지막으로 본 경로 유지)
- 이를 통해 좌측 트리에서 현재 보고 있는 TC의 경로가 자동으로 indigo highlight

```
우측: TC 카드 클릭 (펼침)
  ↓
selectedPath = tc.path
  ↓
좌측: 해당 path의 조상 노드 bg-indigo-50 + 선택 노드 bg-indigo-100
```

- [x] TC expand 시 `setSelectedPath(tc.path)` 추가

---

### Step 7 — [UX-7] PathList Sticky 고정

**변경 파일:** `frontend/src/pages/features/TestCasePage.tsx`

**변경 사항:**
- 좌측 패널 div에 `sticky top-0 self-start` 적용
- `max-h-[calc(100vh-12rem)] overflow-y-auto` — 트리가 길 경우 독립 스크롤
- 우측 TestCase 목록을 스크롤해도 좌측 PathList는 화면 상단에 고정

```
┌────────────────┬──────────────────────────────────────┐
│  Path (sticky) │  TestCase 목록 (스크롤)               │
│                │                                      │
│  ▼ Main        │  ┌─ TC 1 ─────────────────────────┐ │
│    ▼ Login     │  │ ...                             │ │
│      - Social  │  └─────────────────────────────────┘ │
│                │  ┌─ TC 2 ─────────────────────────┐ │
│  (고정됨)      │  │ ... (스크롤 중)                  │ │
│                │  └─────────────────────────────────┘ │
└────────────────┴──────────────────────────────────────┘
```

- [x] 좌측 패널에 `sticky top-0 self-start` 적용
- [x] `max-h-[calc(100vh-12rem)] overflow-y-auto`로 독립 스크롤 지원

---

### Step 8 — [UX-8] 스크롤 위치 기반 Path 자동 highlight (Scroll Spy)

**변경 파일:** `frontend/src/pages/features/TestCasePage.tsx`

**변경 사항:**
- IntersectionObserver를 사용하여 각 path 그룹 섹션(`section-${path.join('-')}`)을 관찰
- 화면 중앙 근처(rootMargin: `-45% 0px -45% 0px`)에 진입한 섹션의 path를 selectedPath로 자동 반영
- 유저가 수동으로 path를 클릭하거나 TC를 펼칠 때는 기존 로직 유지
- 스크롤 중에만 자동 연동 — IntersectionObserver가 `isIntersecting`인 섹션을 감지

```
유저 스크롤: TC 목록을 아래로 스크롤
  ↓
IntersectionObserver: "section-3-7" 화면 중앙 진입 감지
  ↓
selectedPath = [3, 7]
  ↓
좌측 트리: Main > Login 자동 highlight (유저 클릭 없이)
```

**주의사항:**
- `handleSelectPath`에서 `scrollIntoView`를 호출하므로, Scroll Spy에 의한 selectedPath 변경은 `scrollIntoView`를 트리거하지 않도록 분리 필요
- `useEffect` cleanup으로 observer disconnect 필수

- [x] `useEffect`에서 IntersectionObserver 생성 (groupedTestCases 의존)
- [x] 각 path 그룹 섹션 DOM 요소를 observe
- [x] 화면 중앙에 진입한 섹션의 path로 `setSelectedPath` 호출
- [x] `handleSelectPath`(클릭)와 scroll spy 간 충돌 방지 (isScrollingToRef로 800ms 억제)
- [x] cleanup: observer.disconnect()

---

## 변경 요약

### 신규 파일

없음 (기존 파일 수정만)

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `pages/features/TestCasePage.tsx` | Path Breadcrumb 추가, Priority 색상, 카드 max-width, 호버 버튼, onAddTestCase 콜백, TC 펼침→Path 연동, PathList sticky |
| `components/features/SegmentTreeView.tsx` | 선택 Path highlight (indigo), 컨텍스트 메뉴에 TC 추가, onAddTestCase prop |
