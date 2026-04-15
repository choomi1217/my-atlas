# Feature Registry — TestCase 이미지 개선 & PathList UX (v14)

> 변경 유형: 기능 개선 + 버그 수정  
> 작성일: 2026-04-15  
> 버전: v14  
> 상태: 진행 중

---

## 요구사항

### [FEAT-1] Step/Expected Result에서 이미지 선택·삽입

- TestCase에 이미지를 등록할 순 있지만, Step과 Expected Result에서 가져다 쓸 수가 없음
- Step/Expected Result에서 이미지를 선택할 수 있어야 함
- 이미지 선택 UX 디자인 필요 (현재 디자인 없음)

### [FEAT-2] Phase : TestRun = 1 : N 관계 변경 (CRITICAL)

- 현재 Phase에는 TestRun이 1개만 연동됨 (1:1)
- **1차 테스트 Phase에서 보려는 테스트가 아주 많을 수 있음** — TestRun 여러 개를 묶어야 함
- Phase : TestRun = 1 : N 으로 변경 필요
- 예시:
  ```
  Version: v2.0 Release QA
  ├── Phase: 1차 테스트
  │   ├── TestRun: 로그인/회원가입 (15 TC)
  │   ├── TestRun: 결제 플로우 (22 TC)
  │   └── TestRun: 마이페이지 (8 TC)     ← 총 45 TC
  └── Phase: Regression
      └── TestRun: 전체 회귀 테스트 (100 TC)
  ```

### [FEAT-3] TestRun Detail — Included Test Cases 상세보기 펼침 (CRITICAL)

- TestRun Detail 페이지의 Included Test Cases 목록에서 각 TC의 상세 내용을 펼쳐볼 수 없음
- 현재: TC ID + 제목 + priority/testType 1줄 표시만 가능
- **TC를 클릭하면 상세 내용(Description, Preconditions, Steps, Expected Result, Images)을 펼칠 수 있어야 함**
- TestCasePage의 Expand 패턴과 동일한 UX

### [UX-1] Path List 전체 노출 (스크롤 제거)

- Path List의 가장 중요한 목적은 전체 목차를 한 눈에 보여주기 위함
- 스크롤링으로 구현되면 UX를 해침
- 늘어나면 늘어나는대로 화면에 전체를 다 보여줘야 함

### [BUG-1] TestCase 추가 모달에 Image 등록 섹션 없음

- **재현경로:**
  1. 랜덤 TestCase List 진입
  2. `+Add Test Case` 버튼 클릭
  3. 모달창 UI 확인
- **Actual Result:** Image를 등록할 수 있는 섹션 자체가 없음
- **Expected Result:** Image를 등록할 수 있어야 함

### [BUG-2] TestCase 간 이미지 격리 실패

- **재현경로:**
  1. TestCase A에 Image #1 추가
  2. TestCase B 작성
  3. TestCase B Edit 버튼 클릭 후 모달창 오픈
  4. Image 섹션 확인
- **Actual Result:** Image #1이 노출됨
- **Expected Result:** TestCase B에서 등록한 Image만 나와야 함

### [참고] Image Storage 형태 고려

이번에 Image 관련 기능을 Improve & Bug Fix 하면서
Image를 Storage 형태로 해서 등록한 후, 이곳 저곳에서 사용할 수 있게끔 Image를 Storage 형태로 만드는 것도 고려해볼 수 있음

---

## 현재 코드 분석 (Context)

### TestCaseFormModal.tsx (452줄)

- 파일: `frontend/src/components/features/TestCaseFormModal.tsx`

**BUG-1 원인 (L289):**
```tsx
{isEdit && initialData?.id && (
  <div>
    <label>Images</label>
    {/* 이미지 업로드 영역 */}
  </div>
)}
```
- `isEdit && initialData?.id` 가드 → **추가 모드(initialData=null)에서 이미지 섹션 완전 미노출**
- `handleImageUpload` (L82-83): `if (!initialData?.id) return;` → TC ID 없으면 업로드 불가
- **근본 원인:** 이미지 업로드 시 `testCaseImageApi.addImage(initialData.id, ...)` 호출하므로, TC가 DB에 먼저 생성되어야 함 (chicken-and-egg 문제)

**BUG-2 원인:**
- `useEffect` (L59-80): `setImages(initialData.images || [])` — initialData 변경 시 이미지 초기화
- `handleImageUpload` (L82-98): 업로드 후 모달 로컬 `images` state만 업데이트
- **TestCasePage의 `testCases` state는 갱신되지 않음** — 모달 내 이미지 변경이 부모 상태에 반영 안됨
- 모달을 닫고 다른 TC를 열 때, `initialData.images`가 초기 로드 시점의 stale 데이터
- 모달의 `images` state가 이전 TC의 데이터를 일시적으로 유지할 수 있는 React state 동기화 이슈

**FEAT-1 현재 상태:**
- Steps 영역 (L357-408): 순수 텍스트 입력 (`<input>` for action, expected) — 이미지 참조 삽입 기능 없음
- Expected Result (L413-426): 순수 `<textarea>` — 이미지 참조 기능 없음
- v12에서 `image #N` 호버 미리보기가 읽기 모드(TestCasePage)에 구현되었으나, **편집 시 이미지 선택·삽입 UI는 미구현**

### TestCasePage.tsx — PathList Sticky (UX-1 관련)

- 파일: `frontend/src/pages/features/TestCasePage.tsx`
- **좌측 패널 (L307):**
  ```tsx
  <div className="w-72 flex-shrink-0 sticky top-0 self-start max-h-[calc(100vh-12rem)] overflow-y-auto">
  ```
- `sticky top-0 self-start`: 화면 상단 고정
- `max-h-[calc(100vh-12rem)] overflow-y-auto`: 높이 제한 + 독립 스크롤
- **v13 UX-7에서 추가된 기능** — Path가 많을 때 트리 자체가 스크롤되어 전체 목차를 한눈에 볼 수 없음

### Phase:TestRun 1:1 구조 (FEAT-2 관련)

**DB 스키마 (V8):**
- `version_phase` 테이블: `test_run_id BIGINT NOT NULL REFERENCES test_run(id)` — **단일 FK, NOT NULL**
- `test_result` 테이블: `UNIQUE (version_phase_id, test_case_id)` — Phase당 TC는 1개 결과만

**Backend Entity (`VersionPhaseEntity.java`):**
```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "test_run_id", nullable = false)
private TestRunEntity testRun;  // ← 단일 참조
```

**Backend DTO (`VersionDto.java`):**
```java
public record PhaseRequest(
    String phaseName,
    Long testRunId       // ← 단일 ID
) {}

public record VersionPhaseDto(
    Long id, String phaseName,
    Long testRunId,             // ← 단일 ID
    String testRunName,         // ← 단일 이름
    Integer testRunTestCaseCount, // ← 단일 TestRun의 TC 수
    Integer orderIndex, ProgressStats phaseProgress
) {}
```

**Backend Service (`VersionPhaseServiceImpl.java:37-61`):**
- `addPhase()`: 단일 `testRunId`로 TestRun 조회 → Phase 생성 → `createInitialResults(versionId, phaseId, testRunId)` 1회 호출
- `toPhaseDto()`: `entity.getTestRun().getId()`, `.getName()` — 단일 TestRun 참조

**Backend Service (`TestResultServiceImpl.java:32-58`):**
- `createInitialResults(versionId, phaseId, testRunId)`: 단일 testRunId의 TC 목록 → TestResult 생성

**Frontend (`types/features.ts:189-197`):**
```typescript
export interface VersionPhase {
  testRunId: number;           // ← 단일
  testRunName: string;         // ← 단일
  testRunTestCaseCount: number; // ← 단일
}
```

**Frontend 모달:**
- `PhaseFormModal.tsx`: 단일 `<select>` (TestRun 1개 선택)
- `VersionFormModal.tsx`: Phase당 단일 `testRunId` in `PhaseFormData`

**영향 범위 요약:**
- DB: `version_phase.test_run_id` 컬럼 → junction table로 이전
- Backend: Entity, DTO, Service(addPhase, toPhaseDto, createInitialResults), Controller, 복사 로직
- Frontend: types, api, PhaseFormModal, VersionFormModal, VersionDetailPage, VersionPhaseDetailPage

### TestRunDetailPage — Included Test Cases (FEAT-3 관련)

- 파일: `frontend/src/pages/features/TestRunDetailPage.tsx`
- **TC 목록 (L246-263):** path별 그룹핑 후 각 TC를 1줄 row로 표시
  ```tsx
  <div className="px-4 py-2 flex items-center gap-3">
    <span className="text-xs text-gray-400">T{tc.id}</span>
    <span className="text-sm text-gray-800">{tc.title}</span>
    <span className="ml-auto text-xs text-gray-400">{tc.priority} / {tc.testType}</span>
  </div>
  ```
- **펼침 기능 없음** — `expandedId` state 없음, 클릭 이벤트 없음
- **`allTestCases` (L18):** `testCaseApi.getByProductId()`로 로드 — TC의 전체 상세 데이터(steps, preconditions, expectedResult, images) 이미 보유
- **TestCasePage의 Expand 패턴 (L382-491):** `expandedId` state → 클릭 토글 → 펼침 영역에 Description, Preconditions, Steps 테이블, Expected Result, 이미지 표시

### Backend — TestCase Image 구조

- `test_case_image` 테이블: `test_case_id`(FK) 기준 1:N 바인딩
- `TestCaseImageRepository.findAllByTestCaseIdOrderByOrderIndex(id)`: TC ID로 정확히 필터링
- `TestCaseController.addImage()` (L75-93): `testCaseRepository.findById(id)`로 TC 검증 후 이미지 연결
- `orderIndex`: `countByTestCaseId(id) + 1`로 TC별 독립 순번
- **Backend는 TC별 이미지 격리가 정확함** — 문제는 Frontend state 동기화

---

## Image 구현 방식 비교

### 방식 A: TestCase-level Images (현재 구조 유지 + 개선)

현재 `test_case_image` 테이블의 1:N 구조를 유지하되, 버그를 수정하고 Step/Expected Result에서 참조할 수 있게 개선

```
TestCase ──1:N──→ TestCaseImage
              ├── image #1 (login.png)
              └── image #2 (error.png)

Step.action: "로그인 페이지에서 [image #1] 참고하여 입력"
Step.expected: "[image #2] 에러 메시지 확인"
```

| 장점 | 단점 |
|------|------|
| 기존 DB 스키마 변경 불필요 | TC 간 이미지 공유 불가 |
| 이미지 소유권 명확 (TC 삭제 시 CASCADE) | 동일 이미지를 여러 TC에서 쓰려면 중복 업로드 |
| 구현 복잡도 낮음 (Frontend만 수정) | 이미지 재사용성 제한 |
| 이미지 참조 추적 단순 (TC ID로 필터) | |

### 방식 B: Product-level Image Storage (공유 이미지 라이브러리)

Product 레벨에 이미지를 저장하고, 모든 TC에서 참조할 수 있는 공유 라이브러리

```
Product ──1:N──→ ProductImage (공유 라이브러리)
                  ├── img-001 (login.png)
                  ├── img-002 (error.png)
                  └── img-003 (dashboard.png)

TestCase A → Step에서 img-001 참조
TestCase B → Step에서 img-001, img-003 참조  ← 공유 가능
```

| 장점 | 단점 |
|------|------|
| 이미지 재사용 (한 번 업로드, 여러 TC에서 참조) | DB 스키마 변경 필요 (product_image 테이블) |
| 중복 업로드 방지 | 이미지 삭제 시 참조 중인 TC 확인 필요 |
| Product 단위 이미지 관리 가능 | TC 삭제 시 이미지 자동 삭제 안됨 (고아 이미지) |
| 이미지 갤러리 UI 가능 | 구현 복잡도 중간 (Backend + Frontend) |

### 방식 C: 독립 Image Storage (중앙 저장소)

이미지를 별도 엔티티로 완전 독립 관리. TC, Comment, 기타 기능에서 URL로 참조

```
FeatureImage (중앙 저장소)
├── {uuid}.png — 메타데이터: originalName, uploadedAt, usedBy[]
├── {uuid}.jpg
└── ...

TestCase.steps[0].action = "... [img:uuid] ..."
TestResultComment.imageUrl = "/api/feature-images/{uuid}"
```

| 장점 | 단점 |
|------|------|
| 가장 유연 — 어디서든 참조 가능 | 구현 복잡도 높음 (참조 추적 시스템 필요) |
| 중앙 관리, 통계, 검색 가능 | 고아 이미지 정리 로직 필요 (GC) |
| 향후 확장에 유리 (다른 기능에서도 활용) | 삭제 안전성 검증 복잡 (어디서 참조 중인지) |
| 중복 업로드 완전 방지 가능 (해시 기반) | 과도한 설계 위험 (현재 규모 대비) |

### 채택: 방식 A (현재 구조 유지 + 개선)

**이유:**
1. 현재 `test_case_image` 스키마가 정확히 동작하므로 Backend 변경 불필요
2. 버그는 Frontend state 동기화 문제이므로 Frontend만 수정하면 해결
3. 현재 사용 패턴(TC별 이미지 첨부)에 가장 적합
4. 이미지 공유 필요성이 발생하면 그때 방식 B로 확장 가능
5. 구현 범위를 최소화하여 빠른 버그 수정 + 기능 완성

---

## 구현 계획

### Step 1 — [UX-1] PathList 스크롤 제거 (전체 목차 항상 노출)

**변경 파일:** `frontend/src/pages/features/TestCasePage.tsx`

**변경 사항:**
- 좌측 패널에서 `sticky top-0 self-start max-h-[calc(100vh-12rem)] overflow-y-auto` 제거
- PathList는 높이 제한 없이 전체를 다 보여줌
- 우측 TC 목록과 함께 자연스럽게 스크롤

**Before (L307):**
```tsx
<div className="w-72 flex-shrink-0 sticky top-0 self-start max-h-[calc(100vh-12rem)] overflow-y-auto">
```

**After:**
```tsx
<div className="w-72 flex-shrink-0">
```

- [ ] `sticky top-0 self-start` 제거
- [ ] `max-h-[calc(100vh-12rem)] overflow-y-auto` 제거
- [ ] v13 Scroll Spy(IntersectionObserver) 유지 — PathList 위치와 무관하게 selectedPath 자동 반영은 그대로 동작

---

### Step 2 — [BUG-1] TestCase 추가 모달에 Image 섹션 추가

**변경 파일:** `frontend/src/components/features/TestCaseFormModal.tsx`

**문제:** TC가 DB에 생성되기 전에는 ID가 없어 이미지를 링크할 수 없음 (chicken-and-egg)

**해결 방식 — 2단계 생성:**
1. 모달에서 "Create" 클릭 시 TC를 먼저 생성 (기존 로직)
2. 생성 성공 후 모달을 닫지 않고 **편집 모드로 전환** (생성된 TC의 ID 사용)
3. 이미지 업로드 섹션이 활성화되어 이미지 첨부 가능
4. 사용자가 이미지 첨부 완료 후 직접 모달을 닫음

**변경 사항:**
- `onSubmit` 반환값을 `Promise<TestCase | void>`로 변경 — 생성 시 새 TC 반환
- 생성 성공 후 `initialData`를 새로 생성된 TC로 교체 → 이미지 섹션 활성화
- 모달 타이틀: "Add Test Case" → "Edit Test Case (이미지를 첨부하세요)"로 전환
- `isEdit` guard (L289) 수정: `initialData?.id` 체크 유지하되, 생성 직후에도 활성화

**변경 파일:** `frontend/src/pages/features/TestCasePage.tsx`

- `handleModalSubmit` 반환값 변경: 생성 시 새 TC 객체 반환
- 모달 `onSubmit`에서 반환된 TC를 활용하여 편집 모드 전환

```
유저 플로우:
┌─────────────────────────────────────────────┐
│  Add Test Case                     [x]      │
│  ────────────────────────────────────────── │
│  Title: [입력]                              │
│  Steps: [입력]                              │
│  (이미지 섹션 숨김)                          │
│  ────────────────────────────────────────── │
│                              [Cancel] [Create] │
└─────────────────────────────────────────────┘
                   │ Create 클릭
                   ▼
┌─────────────────────────────────────────────┐
│  Edit Test Case                    [x]      │
│  ────────────────────────────────────────── │
│  Title: [기존 입력값]                       │
│  Steps: [기존 입력값]                       │
│  ────────────────────────────────────────── │
│  Images                                     │
│  ┌─────────────────────────────────────┐   │
│  │  Drop images here or click to attach │   │
│  └─────────────────────────────────────┘   │
│  ────────────────────────────────────────── │
│                              [Close] [Save]  │
└─────────────────────────────────────────────┘
```

- [ ] `onSubmit` 반환 타입을 `Promise<TestCase | void>`로 변경
- [ ] 생성 성공 후 모달 내부에서 `createdTc` state로 전환 (모달 유지, 편집 모드)
- [ ] 이미지 섹션 가드를 `createdTc?.id || initialData?.id`로 변경
- [ ] 생성 후 모달 타이틀, 버튼 텍스트 전환

---

### Step 3 — [BUG-2] TestCase 간 이미지 격리

**변경 파일:** `frontend/src/components/features/TestCaseFormModal.tsx`

**근본 원인:** 모달의 `images` state가 이전 TC의 데이터를 유지한 채 다음 TC로 전환될 때 stale 데이터 노출 가능

**수정 사항:**

**3-A. 모달 열릴 때 이미지를 API에서 직접 로드:**
- `initialData.images` (stale 가능)에 의존하지 않고, `testCaseImageApi.getByTestCaseId(initialData.id)` 호출
- 항상 최신 이미지 데이터 보장

```tsx
// Before (stale data from parent state)
setImages(initialData.images || []);

// After (fresh data from API)
if (initialData?.id) {
  const freshImages = await testCaseImageApi.getByTestCaseId(initialData.id);
  setImages(freshImages);
} else {
  setImages([]);
}
```

**3-B. 모달 닫힐 때 이미지 state 즉시 초기화:**
- `isOpen`이 false가 되는 시점에 `setImages([])` 보장

**3-C. 이미지 변경 후 부모 상태 동기화:**
- 이미지 업로드/삭제 후 `testCases` state 갱신을 위한 콜백 추가
- 모달에 `onImageChange?: (tcId: number, images: TestCaseImage[]) => void` prop 추가
- TestCasePage에서 해당 TC의 images 필드 업데이트

- [ ] 모달 open 시 `testCaseImageApi.getByTestCaseId(id)`로 최신 이미지 로드
- [ ] 모달 close 시 `setImages([])` 즉시 호출
- [ ] `onImageChange` 콜백으로 부모 상태 동기화
- [ ] 이미지 업로드/삭제 시 `onImageChange` 호출

---

### Step 4 — [FEAT-1] Step/Expected Result에서 이미지 선택·삽입

**변경 파일:** `frontend/src/components/features/TestCaseFormModal.tsx`

**디자인: Step 입력 옆 이미지 삽입 버튼**

```
Steps:
┌────┬───────────────────────────┬────────────────────────────┬───┐
│ #  │ Action                    │ Expected                   │   │
├────┼───────────────────────────┼────────────────────────────┼───┤
│ 1  │ 로그인 페이지 접속 [📎]   │ image #1 참고        [📎] │ × │
│    │                           │        ↑ 클릭 시 드롭다운  │   │
│ 2  │ 비밀번호 입력       [📎]   │ image #2 에러 확인   [📎] │ × │
└────┴───────────────────────────┴────────────────────────────┴───┘

📎 클릭 시 드롭다운:
┌─────────────────────────────┐
│  image #1  login.png    🔍 │
│  image #2  error.png    🔍 │
│  (이미지 없음 — 상단에서   │
│   먼저 업로드하세요)        │
└─────────────────────────────┘
```

**Expected Result에도 동일한 삽입 버튼:**

```
Expected Result:
┌────────────────────────────────────────────┬───┐
│ image #1과 동일한 화면이 표시되어야 함      │📎│
└────────────────────────────────────────────┴───┘
```

**동작:**
1. 각 Step의 action/expected 입력 필드 옆에 📎 버튼 배치
2. Expected Result textarea 우측에 📎 버튼 배치
3. 📎 클릭 → 현재 TC의 이미지 목록 드롭다운 표시 (썸네일 + `image #N` + 원본명)
4. 이미지 선택 → 커서 위치에 `image #N` 텍스트 삽입
5. 이미지가 없으면 "이미지 없음 — 상단에서 먼저 업로드하세요" 안내
6. 🔍 버튼으로 이미지 미리보기 (hoveredImage 재활용)

**구현:**
- `ImageInsertButton` 컴포넌트 생성 (TestCaseFormModal 내부)
  - Props: `images: TestCaseImage[]`, `onInsert: (text: string) => void`
  - 드롭다운 위치: 버튼 아래 (absolute positioning)
  - 드롭다운 외부 클릭 시 닫힘

- Step action/expected `<input>`에 `ref` 추가 → 커서 위치 추적
  - `onInsert` 호출 시 `input.selectionStart` 위치에 `image #N` 삽입
  - 삽입 후 커서를 삽입된 텍스트 뒤로 이동

- Expected Result `<textarea>`에도 동일 로직

- [ ] `ImageInsertButton` 컴포넌트 구현 (드롭다운 + 이미지 목록 + 미리보기)
- [ ] Step action 입력 필드 옆에 📎 버튼 배치
- [ ] Step expected 입력 필드 옆에 📎 버튼 배치
- [ ] Expected Result textarea 옆에 📎 버튼 배치
- [ ] 커서 위치에 `image #N` 텍스트 삽입 로직
- [ ] 이미지 없을 때 안내 메시지 표시

---

### Step 4-B — [FEAT-1] 삽입된 image #N 참조 hover 시 이미지 미리보기

**변경 파일:** `frontend/src/components/features/TestCaseFormModal.tsx`

**문제:** `<input>` 내부 텍스트에는 hover 이벤트를 감지할 수 없음 — `image #N` 텍스트 위에 마우스를 올려도 이미지를 보여줄 수 없음

**해결:** 입력 필드 아래에 `image #N` 참조를 인라인 badge로 렌더링하고, badge hover 시 이미지 미리보기 제공

**`ImageRefPreview` 인라인 컴포넌트:**
- 텍스트에서 `image #(\d+)` 정규식으로 참조 파싱
- 매칭되는 이미지를 `images` 배열에서 찾아 badge 렌더링
- 기존 `hoveredImage` / `hoverPos` / `handleImageHover` 상태 재사용
- badge hover → 이미지 미리보기 팝업 (기존 Image hover preview div 재사용)

```
Steps:
#1  [로그인 페이지 접속 image #1          ] [📎]
    [image #1]  ← badge hover 시 이미지 미리보기 팝업
    [image #1 참고하여 확인               ] [📎]
    [image #1]

Expected Result:
[image #2와 동일한 화면                        ] [📎]
[image #2]  ← badge hover 시 이미지 미리보기 팝업
```

- [x] `ImageRefPreview` 컴포넌트 구현 (정규식 파싱 + badge + hover 연동) — 편집 모달용
- [x] 각 Step action/expected input 아래에 `ImageRefPreview` 배치
- [x] Expected Result textarea 아래에 `ImageRefPreview` 배치

### Step 4-C — [FEAT-1] TC 카드 펼침 영역에서 image #N hover 미리보기

**TC 카드를 펼칠 수 있는 모든 위치:**
1. `TestCasePage.tsx` — TC 목록 카드 펼침 (L438-492)
2. `TestRunDetailPage.tsx` — TestRun 상세 TC 펼침 (L284-350)
3. `VersionPhaseDetailPage.tsx` — Phase 상세 TestResult 펼침 (L217-260)

**공통 컴포넌트:** `frontend/src/components/features/ImageRefText.tsx` (신규)
- 텍스트에서 `image #N` 패턴을 감지하여 hoverable 링크로 변환
- TC의 `images` 배열에서 매칭되는 이미지의 URL을 찾아 hover 시 팝업 표시
- `<span>` 기반으로 inline 렌더링 — 기존 `<p>`, `<span>`, `<td>` 내부에서 사용 가능

**적용:**
- `{step.action}` → `<ImageRefText text={step.action} images={tc.images} />`
- `{step.expected}` → `<ImageRefText text={step.expected} images={tc.images} />`
- `{tc.expectedResult}` → `<ImageRefText text={tc.expectedResult} images={tc.images} />`

- [ ] `ImageRefText` 공통 컴포넌트 생성
- [ ] TestCasePage 펼침 영역 적용
- [ ] TestRunDetailPage 펼침 영역 적용
- [ ] VersionPhaseDetailPage 펼침 영역 적용

---

### Step 5 — [FEAT-3] TestRun Detail — Included Test Cases 상세보기 펼침

**변경 파일:** `frontend/src/pages/features/TestRunDetailPage.tsx`

**변경 사항:**
- `expandedTcId` state 추가 — 현재 펼쳐진 TC의 ID (단일)
- TC row 클릭 시 expand/collapse 토글
- 펼침 영역: TestCasePage의 Expand 패턴 재사용

**Before (L246-263) — 1줄 row:**
```tsx
<div className="px-4 py-2 flex items-center gap-3">
  <span>T{tc.id}</span>
  <span>{tc.title}</span>
  <span>{tc.priority} / {tc.testType}</span>
</div>
```

**After — 클릭 펼침 Accordion:**
```
┌─── Login > Social Login ─────────────────── (3) ──┐
│                                                     │
│  T12  로그인 성공 테스트        HIGH / FUNCTIONAL ▼ │
│  ┌─────────────────────────────────────────────┐   │
│  │  Description: 소셜 로그인 전체 플로우 검증   │   │
│  │                                             │   │
│  │  Preconditions: 구글 계정 필요              │   │
│  │                                             │   │
│  │  Steps:                                     │   │
│  │  #1  구글 로그인 버튼 클릭                   │   │
│  │      Expected: OAuth 팝업 표시              │   │
│  │  #2  계정 선택                              │   │
│  │      Expected: 리다이렉트 후 로그인 완료     │   │
│  │                                             │   │
│  │  Expected Result: 메인 페이지 이동           │   │
│  │                                             │   │
│  │  Images: [image #1] [image #2]              │   │
│  │  Created: 2026-04-10                        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  T13  비밀번호 오류 테스트     MEDIUM / FUNCTIONAL  │
│  T14  소셜 로그인 테스트      LOW / REGRESSION      │
└─────────────────────────────────────────────────────┘
```

**구현:**
- `allTestCases`에 이미 TC 전체 데이터가 로드되어 있으므로 추가 API 호출 불필요
- `expandedTcId` state + 클릭 토글 로직
- 펼침 영역에 표시: Description, Preconditions, Steps 리스트(순서/동작/기대결과), Expected Result, Images(`image #N` 라벨), Created 날짜
- row에 `cursor-pointer hover:bg-gray-50` 스타일
- Priority 컬러 바 (`border-l-4`) — TestCasePage 패턴 재사용

- [ ] `expandedTcId` state 추가 (`useState<number | null>(null)`)
- [ ] TC row에 `onClick` 토글 + `cursor-pointer` 스타일
- [ ] 펼침 영역: Description, Preconditions, Steps 테이블, Expected Result
- [ ] 펼침 영역: Images 라벨 표시 (`image #N` + 원본명)
- [ ] Priority 컬러 바 적용 (border-l-4, RED/YELLOW/GRAY)
- [ ] 편집 모드에서는 펼침 비활성 (isEditing일 때 expandedTcId 무시)

---

### Step 6 — [FEAT-2] DB Migration: Phase:TestRun 1:N Junction Table

**신규 파일:** `backend/src/main/resources/db/migration/V{타임스탬프}__phase_test_run_junction.sql`

**변경 사항:**

```sql
-- 1. Junction table (version_phase : test_run = N:M)
CREATE TABLE version_phase_test_run (
    id                BIGSERIAL PRIMARY KEY,
    version_phase_id  BIGINT NOT NULL REFERENCES version_phase(id) ON DELETE CASCADE,
    test_run_id       BIGINT NOT NULL REFERENCES test_run(id) ON DELETE CASCADE,
    added_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (version_phase_id, test_run_id)
);
CREATE INDEX idx_vptr_phase ON version_phase_test_run(version_phase_id);
CREATE INDEX idx_vptr_run ON version_phase_test_run(test_run_id);

-- 2. 기존 데이터 이전 (version_phase.test_run_id → junction)
INSERT INTO version_phase_test_run (version_phase_id, test_run_id)
SELECT id, test_run_id FROM version_phase WHERE test_run_id IS NOT NULL;

-- 3. version_phase에서 test_run_id FK 제거
ALTER TABLE version_phase DROP CONSTRAINT version_phase_test_run_id_fkey;
ALTER TABLE version_phase DROP COLUMN test_run_id;
```

**주의:**
- 기존 데이터를 junction으로 이전 후 컬럼 삭제 — 데이터 손실 없음
- `test_result` 테이블의 `UNIQUE (version_phase_id, test_case_id)` 유지 — 동일 Phase 내 같은 TC는 1개 결과만 (중복 방지)

- [ ] 타임스탬프 기반 마이그레이션 파일 생성
- [ ] junction table 생성 + 데이터 이전 + 기존 컬럼 삭제

---

### Step 7 — [FEAT-2] Backend: Entity, DTO, Repository 변경

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `feature/VersionPhaseTestRunEntity.java` | @Entity version_phase_test_run junction |
| `feature/VersionPhaseTestRunRepository.java` | JPA Repository (findAllByVersionPhaseId, deleteByVersionPhaseId) |

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `feature/VersionPhaseEntity.java` | `testRun` 필드 제거 |
| `feature/VersionDto.java` | PhaseRequest, VersionPhaseDto 1:N 대응 |

**VersionPhaseEntity 변경:**
```java
// Before
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "test_run_id", nullable = false)
private TestRunEntity testRun;

// After — testRun 필드 완전 제거
// junction table로 관리 (VersionPhaseTestRunEntity)
```

**VersionDto 변경:**
```java
// PhaseRequest: 단일 → 다건
public record PhaseRequest(
    String phaseName,
    List<Long> testRunIds    // ← testRunId → testRunIds
) {}

// 응답용 TestRun 요약
public record PhaseTestRunInfo(
    Long testRunId,
    String testRunName,
    Integer testCaseCount
) {}

// VersionPhaseDto: 단일 → 다건
public record VersionPhaseDto(
    Long id, String phaseName,
    List<PhaseTestRunInfo> testRuns,     // ← 다건
    Integer totalTestCaseCount,          // ← 전체 TC 수 (중복 제거)
    Integer orderIndex,
    ProgressStats phaseProgress
) {}
```

- [ ] `VersionPhaseTestRunEntity` 생성
- [ ] `VersionPhaseTestRunRepository` 생성 (findAllByVersionPhaseId, deleteByVersionPhaseId)
- [ ] `VersionPhaseEntity`에서 `testRun` 필드 제거
- [ ] `VersionDto.PhaseRequest`: `testRunId` → `testRunIds: List<Long>`
- [ ] `VersionDto.VersionPhaseDto`: 단일 testRun 필드 → `testRuns: List<PhaseTestRunInfo>`, `totalTestCaseCount`
- [ ] `VersionDto.PhaseTestRunInfo` record 추가

---

### Step 8 — [FEAT-2] Backend: Service 로직 변경

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `feature/VersionPhaseServiceImpl.java` | addPhase, updatePhase, toPhaseDto — 다건 TestRun 처리 |
| `feature/TestResultServiceImpl.java` | createInitialResults — 다건 TestRun의 TC 합산, 중복 제거 |
| `feature/VersionServiceImpl.java` | Version 생성/복사 — Phase별 다건 TestRun |

**VersionPhaseServiceImpl 변경:**
```java
// addPhase: 다건 TestRun 처리
public VersionPhaseDto addPhase(Long versionId, PhaseRequest request) {
    // 1. Phase 생성 (testRun 없이)
    VersionPhaseEntity phase = new VersionPhaseEntity();
    phase.setVersion(version);
    phase.setPhaseName(request.phaseName());
    phase.setOrderIndex(nextOrderIndex);
    VersionPhaseEntity saved = versionPhaseRepository.save(phase);

    // 2. Junction table에 N개 TestRun 연결
    for (Long testRunId : request.testRunIds()) {
        VersionPhaseTestRunEntity junction = new VersionPhaseTestRunEntity();
        junction.setVersionPhase(saved);
        junction.setTestRun(testRunRepository.findById(testRunId).orElseThrow(...));
        versionPhaseTestRunRepository.save(junction);
    }

    // 3. 모든 TestRun의 TC에 대해 TestResult 생성 (중복 제거)
    testResultService.createInitialResults(versionId, saved.getId(), request.testRunIds());

    return toPhaseDto(saved);
}
```

**TestResultServiceImpl 변경:**
```java
// Before: createInitialResults(Long versionId, Long phaseId, Long testRunId)
// After:  createInitialResults(Long versionId, Long phaseId, List<Long> testRunIds)

public void createInitialResults(Long versionId, Long phaseId, List<Long> testRunIds) {
    // 여러 TestRun의 TC를 합산하되, 중복 TC는 제거
    Set<Long> seenTestCaseIds = new HashSet<>();
    List<TestResultEntity> results = new ArrayList<>();

    for (Long testRunId : testRunIds) {
        List<TestRunTestCaseEntity> rtcs = testRunTestCaseRepository.findAllByTestRunId(testRunId);
        for (TestRunTestCaseEntity rtc : rtcs) {
            if (seenTestCaseIds.add(rtc.getTestCase().getId())) {  // 중복 방지
                TestResultEntity result = new TestResultEntity();
                // ... (기존 로직)
                results.add(result);
            }
        }
    }
    testResultRepository.saveAll(results);
}
```

**toPhaseDto 변경:**
```java
private VersionPhaseDto toPhaseDto(VersionPhaseEntity entity) {
    List<VersionPhaseTestRunEntity> junctions =
        versionPhaseTestRunRepository.findAllByVersionPhaseId(entity.getId());

    List<PhaseTestRunInfo> testRuns = junctions.stream()
        .map(j -> new PhaseTestRunInfo(
            j.getTestRun().getId(),
            j.getTestRun().getName(),
            testRunTestCaseRepository.findAllByTestRunId(j.getTestRun().getId()).size()
        ))
        .toList();

    int totalTestCaseCount = testResultRepository.findAllByVersionPhaseId(entity.getId()).size();
    ProgressStats phaseProgress = testResultService.computePhaseProgress(entity.getId());

    return new VersionPhaseDto(
        entity.getId(), entity.getPhaseName(),
        testRuns, totalTestCaseCount,
        entity.getOrderIndex(), phaseProgress
    );
}
```

- [ ] `VersionPhaseServiceImpl.addPhase()` — junction 다건 생성 + 다건 TestRun의 TC 합산
- [ ] `VersionPhaseServiceImpl.updatePhase()` — junction 교체 (기존 삭제 → 새로 생성)
- [ ] `VersionPhaseServiceImpl.toPhaseDto()` — junction에서 다건 TestRun 정보 조회
- [ ] `TestResultServiceImpl.createInitialResults()` — `List<Long> testRunIds` 시그니처, 중복 TC 제거
- [ ] `VersionServiceImpl.create()` — Phase 생성 시 다건 testRunIds 전달
- [ ] `VersionServiceImpl.copy()` — 복사 시 junction 데이터도 복사

---

### Step 9 — [FEAT-2] Frontend: 타입, API, 모달 변경

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `types/features.ts` | VersionPhase 인터페이스 1:N 대응 |
| `api/features.ts` | versionApi, versionPhaseApi 시그니처 변경 |
| `components/features/PhaseFormModal.tsx` | 단일 select → 다중 체크박스 선택 |
| `components/features/VersionFormModal.tsx` | Phase당 다건 TestRun 선택 |
| `pages/features/VersionDetailPage.tsx` | Phase 카드에 다건 TestRun 표시 |
| `pages/features/VersionPhaseDetailPage.tsx` | 다건 TestRun 이름 표시 |

**types/features.ts 변경:**
```typescript
// Before
export interface VersionPhase {
  testRunId: number;
  testRunName: string;
  testRunTestCaseCount: number;
  // ...
}

// After
export interface PhaseTestRunInfo {
  testRunId: number;
  testRunName: string;
  testCaseCount: number;
}

export interface VersionPhase {
  testRuns: PhaseTestRunInfo[];     // ← 다건
  totalTestCaseCount: number;       // ← 전체 TC 수
  // ...
}
```

**PhaseFormModal 변경 — 다중 체크박스:**
```
┌──────────────────────────────────────────┐
│ 새 Phase 추가                            │
│ ──────────────────────────────────────── │
│ Phase 이름 *                             │
│ [1차 기능 테스트                        ] │
│                                          │
│ TestRun 선택 * (1개 이상)                │
│ ┌──────────────────────────────────────┐ │
│ │ ☑ 로그인/회원가입       (15 TC)     │ │
│ │ ☑ 결제 플로우           (22 TC)     │ │
│ │ ☐ 마이페이지             (8 TC)     │ │
│ │ ☑ 설정 페이지           (12 TC)     │ │
│ └──────────────────────────────────────┘ │
│ 선택: 3개, 총 49 TC                      │
│ ──────────────────────────────────────── │
│                          [취소] [저장]    │
└──────────────────────────────────────────┘
```

**VersionDetailPage — Phase 카드 표시:**
```
┌─── Phase: 1차 기능 테스트 ────────────────────┐
│  TestRun: 로그인/회원가입 (15 TC)             │
│           결제 플로우 (22 TC)                  │
│           설정 페이지 (12 TC)                  │
│  총 49 TC  |  Pass 30  Fail 5  Untested 14    │
└───────────────────────────────────────────────┘
```

- [ ] `types/features.ts` — `PhaseTestRunInfo` 추가, `VersionPhase` 다건 대응
- [ ] `api/features.ts` — `versionPhaseApi.addPhase(versionId, phaseName, testRunIds[])`, `versionApi.create()` phases 시그니처 변경
- [ ] `PhaseFormModal.tsx` — 단일 `<select>` → 다중 체크박스 목록 + 선택 카운터
- [ ] `VersionFormModal.tsx` — Phase당 다건 TestRun 선택 UI
- [ ] `VersionDetailPage.tsx` — Phase 카드에 다건 TestRun 이름 나열
- [ ] `VersionPhaseDetailPage.tsx` — 헤더에 다건 TestRun 이름 표시

---

## 변경 요약

### 신규 파일

| 파일 | 내용 |
|------|------|
| `db/migration/V{타임스탬프}__phase_test_run_junction.sql` | junction table + 데이터 이전 |
| `feature/VersionPhaseTestRunEntity.java` | @Entity junction |
| `feature/VersionPhaseTestRunRepository.java` | JPA Repository |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `pages/features/TestCasePage.tsx` | PathList sticky/scroll 제거, onImageChange 콜백 구현 |
| `components/features/TestCaseFormModal.tsx` | 추가 모드 이미지 지원 (2단계 생성), API 기반 이미지 로드, 이미지 격리, ImageInsertButton (📎 드롭다운) |
| `pages/features/TestRunDetailPage.tsx` | expandedTcId 상태 + TC 펼침 영역 (Details, Steps, Images) |
| `feature/VersionPhaseEntity.java` | `testRun` 필드 제거 |
| `feature/VersionDto.java` | PhaseRequest(testRunIds), VersionPhaseDto(testRuns[]), PhaseTestRunInfo 추가 |
| `feature/VersionPhaseServiceImpl.java` | addPhase/updatePhase/toPhaseDto — 다건 TestRun 처리 |
| `feature/TestResultServiceImpl.java` | createInitialResults — 다건 TestRun, 중복 TC 제거 |
| `feature/VersionServiceImpl.java` | 생성/복사 로직 다건 대응 |
| `types/features.ts` | PhaseTestRunInfo 추가, VersionPhase 다건 대응 |
| `api/features.ts` | versionApi, versionPhaseApi 시그니처 변경 |
| `components/features/PhaseFormModal.tsx` | 단일 select → 다중 체크박스 |
| `components/features/VersionFormModal.tsx` | Phase당 다건 TestRun 선택 |
| `pages/features/VersionDetailPage.tsx` | Phase 카드에 다건 TestRun 표시 |
| `pages/features/VersionPhaseDetailPage.tsx` | 헤더에 다건 TestRun 이름 표시 |
