# Feature Registry v18 — Test Suite UX 개선 (Card 가독성 + Segment 구조)

> 변경 유형: 기능 개선  
> 작성일: 2026-04-27  
> 버전: v18  
> 상태: 진행 중

---

## QA에게 이 UX 개선이 왜 필요한가

### 문제: 정보가 보여도 "읽히지 않는" 화면

v17 까지 Test Suite 의 TestCase 카드는 모든 필드(Description, Preconditions, Steps, Expected Result)를 동일한 시각적 무게로 평면 나열했다. 정보가 전부 화면에 있어도, QA 가 카드를 빠르게 스캔하며 **"이 케이스의 최종 검증점은 무엇인가"** 를 즉시 인지하기 어려웠다.

특히 Expected Result 가 Steps 보다 위에 위치한 구조적 오류는 "모든 Step 실행 후의 최종 결과" 라는 자연스러운 읽기 흐름을 깨뜨린다.

또한 Segment 구조는 Product 하위에 단일 Root 만 허용해 `My Senior > [FAQ, Chat]` 처럼 형제 노드를 두려면 Product 이름을 한 번 더 써야 했다 (`My Senior > My Senior > FAQ`). 같은 레벨 형제 노드의 정렬 순서도 사용자가 바꿀 수 없어 새 Segment 를 추가하면 항상 끝에 붙었다.

### 해결: 시각적 위계 + 자유로운 트리 구조

v18 은 4 가지 UX 결함을 한 번에 정리한다.

**TestCase 카드 — Definition List 패턴 도입**
- Header zone (제목 + 뱃지 + 액션 + 생성일) / Body zone (DL 본문) 영역 분리
- 라벨을 secondary color 로 약화시켜 본문 값이 주인공이 되는 Inverted Hierarchy
- Steps 를 표 형식으로 구조화 (`[번호 뱃지] | ACTION | STEP EXPECTED`)
- Final Expected Result 만 green accent 로 강조 → "최종 결과는 여기" 즉시 인지

**Segment — 다중 Root + 형제 정렬 순서**
- Product 직속 자식으로 여러 Segment 를 둘 수 있게 (Product 이름 중복 제거)
- 같은 부모 하위 형제 Segment 의 정렬 순서를 사용자가 변경 가능 (DnD 또는 화살표)

**TestCase 페이지 — UI 양식 통일**
- Product Test Suite 진입 시 잔존 헤더 제거
- 좌우 여백을 다른 페이지(VersionListPage, TestRunListPage 등)와 동일하게 통일

### QA 실무에서의 활용

| 시나리오 | 기존 | v18 이후 |
|---------|------|---------|
| TestCase 카드 스캔 | 라벨/값 평면 나열, 스크롤로 천천히 읽음 | DL 패턴으로 한눈에 구조 파악 |
| 최종 검증점 인지 | Expected Result 가 Steps 위에 있어 흐름 어색 | Steps 다음 green accent 로 명확 |
| Steps 상세 확인 | 평문 번호 매김 | 표 형식 (번호 / ACTION / STEP EXPECTED) |
| Product 하위 기능 정리 | `My Senior > My Senior > FAQ` (이름 중복) | `My Senior > FAQ`, `My Senior > Chat` (직속 형제) |
| 같은 레벨 Segment 순서 | 변경 불가, 추가 순서대로 노출 | 사용자가 직접 정렬 |
| 페이지 진입 시 첫인상 | 헤더 잔존, 여백 불일치 | 다른 페이지와 양식 통일 |

### 핵심 가치

1. **인지 속도** — Definition List + Inverted Hierarchy 로 핵심 정보가 먼저 눈에 들어옴
2. **정보 흐름의 자연스러움** — Description → Preconditions → Steps → Final Expected Result 순으로 "무엇을 → 어떤 상태에서 → 어떻게 → 최종적으로" 의 자연어 흐름 일치
3. **트리 구조 자유도** — 강제 단일 Root 제약 제거, 형제 정렬 자유도 부여
4. **시각적 일관성** — Test Suite 페이지가 다른 도메인 페이지와 동일한 양식 공유

---

# 요구사항

### UI / BreadCrumb Header 정리

Product Test Suite 진입 시 다른 페이지들과 양식을 통일해야 합니다.

- 유저 시나리오
1. Companies 리스트 진입 시 상단에 "Product Test Suite" Breadcrumb 만 노출 (잔존 큰 헤더 제거)
2. Product 진입 시에도 동일한 Breadcrumb 양식 유지
3. 좌우 여백이 다른 페이지(VersionListPage, TestRunListPage)와 동일하게 통일

- 참고
1. `Breadcrumb.tsx` 는 이미 적절히 동작 중 — 페이지별 추가 헤더가 중복 노출되는 부분만 정리
2. 기존 `<h1>{product.name}</h1>` 같은 페이지 타이틀은 유지하되 위치/스타일을 다른 페이지와 맞춤

### Test Case 카드 가독성 개선

평면 나열된 TC 카드를 Definition List 패턴으로 재구성하여 정보 위계를 부여해야 합니다.

- 현재 문제점
1. Description, Preconditions, Steps, Expected Result 가 동일한 시각적 무게로 평면 나열되어 정보 구획이 흐림
2. 섹션 간 여백 부족으로 시선의 휴식 지점이 없음
3. Steps 영역에서 번호와 액션·기대결과가 평문으로 나열되어 즉각적 인지가 어려움
4. 메타 정보(Created)가 본문 영역에 노출되어 핵심 정보를 희석시킴
5. **Expected Result 위치 오류**: Steps 보다 위에 위치 → Steps 다음으로 이동 필요

- 유저 시나리오
1. TC 카드 펼침 시 Header zone 과 Body zone 이 `border-bottom` 으로 명확히 구획됨
2. Body zone 은 라벨(120px 고정폭, uppercase, secondary color) + 값 grid 로 구성
3. Steps 는 `[번호 원형 뱃지] | ACTION | STEP EXPECTED` 의 3열 grid 로 구조화
4. Final Expected Result 는 좌측 3px green accent border + green background + 체크 아이콘으로 강조
5. Created 일자는 Header 우측 하단에 11px tertiary color 로 약화 배치

- 참고
1. 라벨을 의도적으로 약화시켜 본문 값이 주인공이 되도록 하는 Inverted Hierarchy 패턴 적용
2. Final Expected Result 만 색을 부여하여 카드 스캔 시 "최종 결과는 여기" 즉시 인지
3. 현재 `TestCasePage.tsx` 에 인라인된 카드 렌더링 로직을 `TestCaseCard.tsx` 로 추출
4. Steps 표 형식 부분은 `TestCaseSteps.tsx` 로 분리

### Segment 다중 Root 지원

Product 직속 자식으로 여러 Segment 를 둘 수 있어야 합니다.

- 유저 시나리오
1. Product `My Senior` 하위에서 SegmentTreePicker 로 새 Segment 추가 시 부모 선택 없이 (parent_id = null) 생성 가능
2. Tree 뷰에서 Product 직속 자식으로 `FAQ`, `Chat` 이 형제 노드로 노출
3. 기존에 단일 Root 로 묶여있던 Segment 도 부모를 null 로 변경 가능 (Reparent API 재활용)

- 참고
1. SegmentEntity 는 이미 `parent_id` nullable 구조 — DB 스키마 변경 불필요
2. 현재 SegmentServiceImpl 에서 Root 생성을 막는 별도 검증 없음 — UI 에서 부모 강제 선택을 풀기만 하면 됨
3. SegmentTreeView 의 렌더링은 이미 `parent_id IS NULL` 인 Segment 를 최상위로 그림 — 다중 Root 도 자동 지원

### 같은 레벨 Segment 정렬 순서 변경

같은 부모 하위 형제 Segment 의 정렬 순서를 사용자가 변경할 수 있어야 합니다.

- 유저 시나리오
1. Tree 뷰에서 Segment 카드를 DnD 로 같은 레벨 내에서 위/아래로 드래그하여 순서 변경
2. 또는 Segment 옆 화살표 (▲ ▼) 버튼으로 순서 이동
3. 새 Segment 추가 시 기본적으로 형제 중 마지막에 추가됨

- 참고
1. 현재 SegmentEntity 에 정렬 컬럼이 없음 — `order_index INT` 추가 필요
2. 같은 부모 하위에서 `(parent_id, order_index)` 로 정렬 (parent_id NULL 인 Root 그룹은 product_id 기준)
3. Reorder API 는 Phase 의 `reorderTestRuns` 패턴을 참고 (기존 `version_phase` 가 한 번 적용한 적 있는 패턴)
4. DnD 동작은 기존 SegmentTreeView 의 DnD (parent 변경) 와 호환되어야 함 — 같은 부모 내 reorder vs 다른 부모로 reparent 구분

---

## 현재 코드 분석 (Context)

### TestCasePage.tsx — 카드 렌더링 인라인 + 헤더 중복

- 파일: `frontend/src/pages/features/TestCasePage.tsx` (820 lines)

**현재 구조:**
```tsx
// 라인 605-641
<div className="flex flex-col h-full bg-gray-50">
  <Breadcrumb company={...} product={...} />
  <div className="flex-1 overflow-auto p-6">
    <div className="mb-6 flex items-start justify-between gap-4">
      <h1 className="text-3xl font-bold mb-2">{product.name}</h1>  // 잔존 큰 헤더
      <p className="text-gray-600">Test Cases</p>
      ...
    </div>

// 라인 100-210 (PathTreeGroup 내부)
<div className="p-4 cursor-pointer hover:bg-gray-50 transition">
  <h4 className="font-bold">{tc.title}</h4>
  // 뱃지 3개 (priority/testType/status)
</div>
{expandedId === tc.id && (
  <div className="p-4 bg-gray-50 border-t text-sm">
    <label className="font-bold">Description:</label>
    <p>{tc.description}</p>
    <label className="font-bold">Preconditions:</label>
    <p>{tc.preconditions}</p>
    <label className="font-bold">Steps:</label>
    <ol className="list-decimal">...</ol>
    <label className="font-bold">Expected Result:</label>  // ← Steps 위에 있음
    ...
  </div>
)}
```

**문제:**
- TC 카드 렌더링이 PathTreeGroup 컴포넌트 내부에 인라인 — 재사용/테스트 어려움
- `<h1>{product.name}</h1>` 가 Breadcrumb 와 중복 (Product 이름이 두 번 노출)
- `p-6` 좌우 패딩이 다른 페이지와 다를 가능성 존재 (확인 필요)
- Definition List 구조 부재 — 라벨/값이 모두 `<label> + <p>` 평면 나열
- Expected Result 가 코드 순서상 Steps 다음에 오지만, 실제로는 카드 펼침 시 위쪽에서 보이는 케이스 일부 존재 (요구사항에서 지적된 부분)

### SegmentEntity.java — order 컬럼 부재

- 파일: `backend/src/main/java/com/myqaweb/feature/SegmentEntity.java`

**현재 필드:**
```java
@Entity @Table(name = "segment")
public class SegmentEntity {
    Long id;
    String name;                    // VARCHAR(200)
    ProductEntity product;          // FK product_id NOT NULL
    SegmentEntity parent;           // FK parent_id (nullable, self-ref)
}
```

**부재 필드:**
- `orderIndex` — 같은 부모 하위 형제 Segment 의 정렬 순서 저장 불가

**다중 Root 지원 현황:**
- `parent_id` 가 nullable 이므로 DB 레벨에서는 이미 다중 Root 지원
- SegmentServiceImpl.createSegment 도 `request.parentId() == null` 케이스를 정상 처리
- 즉 백엔드는 이미 다중 Root 가능 — UI 에서 부모 선택을 강제하지 않도록 풀기만 하면 됨

### SegmentTreeView.tsx — 정렬 기준 미정

- 파일: `frontend/src/components/features/SegmentTreeView.tsx` (647 lines)

**현재 정렬:**
- 같은 부모 하위 자식들을 어떤 기준으로 정렬하는지 명시적 정렬 로직 없음 (DB insert 순서 = id 오름차순)
- DnD 는 parent 변경(reparent)만 지원, 같은 부모 내 순서 변경은 미지원

**필요 변경:**
- 자식 노드 정렬 시 `orderIndex` 사용
- DnD 동작 분기:
  - 다른 부모로 드롭 → `reparent` API 호출 (기존 동작 유지)
  - 같은 부모 내 다른 위치로 드롭 → `reorder` API 호출 (신규)

### Breadcrumb.tsx — 정상 동작

- 파일: `frontend/src/components/features/Breadcrumb.tsx`

이미 `Product Test Suite > {Company} > {Product}` 양식으로 잘 동작 중. 페이지 측에서 중복 헤더만 정리하면 됨.

### 기존 Reorder 패턴 — VersionPhase 참고

VersionPhase 가 이미 `orderIndex` + reorder API 패턴을 사용 중이므로 그대로 차용 가능:

| 항목 | VersionPhase | Segment (신규) |
|------|--------------|----------------|
| 정렬 컬럼 | `order_index INT` | `order_index INT` |
| Repository 메서드 | `findAllByVersionIdOrderByOrderIndexAsc` | `findAllByProductIdAndParentIdOrderByOrderIndexAsc` |
| Reorder API | `PATCH /api/versions/{id}/phases/reorder` | `PATCH /api/segments/reorder` |
| Body | `{ phaseIds: [3,1,2] }` | `{ segmentIds: [5,3,7] }` (같은 부모 내) |

---

## 구현 계획

### PR 분리 전략

요구사항을 3 개 PR 로 분리하여 리뷰 단위를 작게 유지한다.

| PR | 요구사항 | 범위 | 예상 변경 라인 |
|----|---------|------|---------------|
| **PR-A** | UI / BreadCrumb Header 정리 | Frontend only — 헤더 중복 제거, 패딩 통일 | ~50 |
| **PR-B** | TestCase 카드 가독성 개선 | Frontend only — 컴포넌트 추출 + DL 패턴 + Steps 표 + Final Expected 강조 | ~600 |
| **PR-C** | Segment 다중 Root + 형제 정렬 | Backend (DB migration + entity + reorder API) + Frontend (TreeView DnD 분기) | ~700 |

각 PR 은 독립 머지 가능. PR-C 가 가장 무거우므로 마지막에 진행.

### 변경 범위 (전체)

| 구분 | 내용 |
|------|------|
| DB Migration | 1 개 — segment 테이블에 `order_index` 추가 + 기존 데이터 backfill |
| Backend 기존 코드 | SegmentEntity 필드 1 개 추가, SegmentDto 확장, ServiceImpl reorder 로직 |
| Backend 신규 | Reorder API endpoint 1 개 |
| Frontend 신규 | TestCaseCard.tsx, TestCaseSteps.tsx 컴포넌트 추출 |
| Frontend 수정 | TestCasePage.tsx 헤더 정리, SegmentTreeView.tsx DnD 분기, SegmentTreePicker 부모 선택 optional |

### 4-Agent Pipeline 적용

각 PR 은 `.claude/agents/` 정의된 4-Agent Pipeline 을 끝까지 실행한다. Agent-D 가 통과하기 전까지 PR 생성 금지.

| Agent | 파일 | 책임 |
|-------|------|------|
| Agent-A | `.claude/agents/code-implementor.md` | 코드 구현 |
| Agent-B | `.claude/agents/unit-test-writer.md` | 단위/통합 테스트 (Backend JUnit + Frontend Vitest) |
| Agent-C | `.claude/agents/e2e-test-writer.md` | Playwright E2E 테스트 |
| Agent-D | `.claude/agents/build-verifier.md` | Backend build → docker compose up → E2E 전체 → docker compose down |

각 PR 의 Step 은 A → B → C → D 순서로 진행하며, 어느 단계든 실패 시 다음 단계로 넘어가지 않는다.

---

## PR-A: UI / BreadCrumb Header 정리

### Step A-1 — Agent-A 코드 구현

**파일:** `frontend/src/pages/features/TestCasePage.tsx`

**변경:**
```tsx
// 변경 전 (라인 612-641)
<div className="flex-1 overflow-auto p-6">
  <div className="mb-6 flex items-start justify-between gap-4">
    <div>
      <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
      <p className="text-gray-600">Test Cases</p>
      ...

// 변경 후 — Breadcrumb 가 이미 Product 이름을 노출하므로 페이지 헤더 슬림화
<div className="flex-1 overflow-auto p-6 max-w-7xl mx-auto w-full">
  {(statusFilter || jobIdFilter !== null) && (
    <div className="mb-4 flex items-center gap-2 text-xs text-gray-600">
      ...필터 표시만 유지
    </div>
  )}
```

**다른 페이지 양식 확인:**
- `CompanyListPage.tsx`, `ProductListPage.tsx`, `VersionListPage.tsx`, `TestRunListPage.tsx` 의 컨테이너 패딩 / max-width 확인 후 동일 적용
- 통일 후보: `p-6 max-w-7xl mx-auto w-full` 또는 `px-8 py-6`

**Step A-1 체크리스트 (Agent-A):**
- [x] CompanyListPage / ProductListPage / VersionListPage / TestRunListPage 의 컨테이너 클래스 비교
- [x] 통일 클래스 결정 (`max-w-7xl mx-auto w-full` — TestCasePage 2-column 레이아웃 고려)
- [x] TestCasePage 의 `<h1>{product.name}</h1>` + `<p>Test Cases</p>` 제거 (Breadcrumb 으로 대체)
- [x] 컨테이너 패딩/max-width 통일 적용
- [x] CompanyListPage 의 자기 참조 `<Breadcrumb />` 제거 (스코프 확장 — 사용자 1차 요구사항 반영)
- [x] tc-page-container / company-list-container `data-testid` 부여

---

### Step A-2 — Agent-B 단위 테스트 (Vitest)

**파일:** `frontend/src/pages/features/__tests__/TestCasePage.test.tsx` (신규 또는 확장)

**대상 시나리오:**
```ts
describe('TestCasePage 헤더 양식', () => {
  it('Breadcrumb 외 별도의 큰 페이지 헤더(<h1>{product.name}</h1>)를 노출하지 않는다', () => {
    render(<TestCasePage />, { wrapper: TestRouterWrapper });
    // Breadcrumb 의 product.name 은 1회만 노출되어야 함
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
  });

  it('컨테이너가 통일된 max-width 와 패딩 클래스를 갖는다', () => {
    const { container } = render(<TestCasePage />);
    const main = container.querySelector('[data-testid="tc-page-container"]');
    expect(main).toHaveClass('max-w-7xl');
  });
});
```

**Step A-2 체크리스트 (Agent-B):**
- [x] TestCasePage 헤더 단순화 검증 단위 테스트 (`__tests__/TestCasePage.test.tsx` 3 시나리오)
- [x] 컨테이너 클래스 통일 검증 (`max-w-7xl` 검증)
- [x] CompanyListPage 자기 참조 Breadcrumb 제거 검증 (`__tests__/CompanyListPage.test.tsx` 3 시나리오)
- [x] Vitest 60/60 통과
- [x] `npm run lint` 0 warnings

---

### Step A-3 — Agent-C E2E 테스트 (Playwright)

**파일:** `qa/ui/test-suite-layout.spec.ts` (신규)

**셀렉터 사전 확인:** Agent-C 는 `frontend/src/pages/features/TestCasePage.tsx` 와 `frontend/src/components/features/Breadcrumb.tsx` 의 실제 JSX 를 Read 한 뒤 셀렉터 작성.

**시나리오:**
```ts
test.describe('Test Suite 페이지 레이아웃', () => {
  test('Product Test Suite 진입 시 Breadcrumb 만 노출되고 중복 헤더가 없다', async ({ page }) => {
    await loginAndNavigate(page, '/features/companies/1/products/1');

    // Breadcrumb 영역 (nav.bg-gray-100)
    const breadcrumb = page.locator('nav').filter({ hasText: 'Product Test Suite' });
    await expect(breadcrumb).toBeVisible();

    // 동일 Product 이름이 페이지 본문 큰 헤더로 중복 노출되지 않음
    const productNameInBreadcrumb = await breadcrumb.locator('text=My Senior').count();
    const productNameAsH1 = await page.locator('h1', { hasText: 'My Senior' }).count();
    expect(productNameInBreadcrumb).toBe(1);
    expect(productNameAsH1).toBe(0);
  });

  test('컨테이너 좌우 패딩이 다른 페이지와 동일하다', async ({ page }) => {
    // VersionListPage 와 TestCasePage 의 메인 컨테이너 max-width 비교
    await loginAndNavigate(page, '/features/companies/1/products/1/versions');
    const versionContainer = await page.locator('[data-testid="version-list-container"]').boundingBox();

    await page.goto('/features/companies/1/products/1');
    const tcContainer = await page.locator('[data-testid="tc-page-container"]').boundingBox();

    expect(tcContainer?.x).toBe(versionContainer?.x);
    expect(tcContainer?.width).toBe(versionContainer?.width);
  });
});
```

**Step A-3 체크리스트 (Agent-C):**
- [x] 대상 TSX 파일 Read 후 실제 셀렉터 사용 (nav.bg-gray-100, h1.text-3xl, data-testid)
- [x] test-suite-layout.spec.ts 신규 작성 (3 시나리오)
- [x] 헤더 중복 없음 검증 (CompanyListPage / TestCasePage 양쪽)
- [x] max-w-7xl 클래스 적용 검증
- [x] 기존 product-panel.spec.ts:68 (구 헤더 기대) 를 새 레이아웃에 맞게 업데이트

---

### Step A-4 — Agent-D 빌드 & 검증

**명령:**
```bash
# 1. Frontend lint + tests
cd /Users/yeongmi/dev/qa/my-atlas/frontend && npm run lint && npm test

# 2. Backend (변경 없지만 회귀 방지)
cd /Users/yeongmi/dev/qa/my-atlas/backend && ./gradlew clean build

# 3. 풀스택 기동
cd /Users/yeongmi/dev/qa/my-atlas && docker compose up -d --build && sleep 10

# 4. E2E 전체 (필터 없이)
cd qa && npx playwright test

# 5. 새 spec 개별 실행 확인 (did not run 방지)
npx playwright test ui/test-suite-layout.spec.ts

# Teardown
cd .. && docker compose down
```

**Step A-4 검증 포인트:**
- [x] Frontend lint 0 warnings
- [x] Vitest 60/60 통과 (CompanyListPage 3 + TestCasePage 3 신규 시나리오 포함)
- [x] Backend `./gradlew clean build` SUCCESS (1m 22s, JaCoCo 70%+)
- [x] E2E 전체 318 passed / 24 skipped
- [x] test-suite-layout.spec.ts 3 시나리오 모두 실제 실행 (did not run 없음)
- [x] product-panel.spec.ts:68 회귀 수정 후 통과
- [x] 잔존 3 failures: `loginRequired` toggle DB 상태 leak (registry_v17.1 noted 사전 회귀, PR-A 무관)
- [x] docker compose down 으로 teardown 완료

**Agent-D 통과 — PR-A 생성 가능 (User 승인 후 `gh pr create`).**

---

## PR-B: TestCase 카드 가독성 개선

### Step B-1 — Agent-A 코드 구현 (TestCaseCard 컴포넌트 추출)

**신규 파일:**

| 파일 | 책임 |
|------|------|
| `frontend/src/components/features/TestCaseCard.tsx` | TC 카드 단일 — Header zone + Body zone (DL) |
| `frontend/src/components/features/TestCaseSteps.tsx` | Steps 표 형식 (`[번호] | ACTION | STEP EXPECTED`) |

**TestCaseCard 구조:**
```tsx
interface TestCaseCardProps {
  testCase: TestCase;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (tc: TestCase) => void;
  onDelete: (tc: { id: number; title: string }) => void;
}

export const TestCaseCard: React.FC<TestCaseCardProps> = ({ ... }) => {
  return (
    <article className="bg-white rounded-lg shadow ..." data-testid="tc-card">
      {/* Header zone */}
      <header className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-medium">{testCase.title}</h4>
            <div className="flex gap-1.5 mt-2">
              <PriorityBadge priority={testCase.priority} />
              <TestTypeBadge type={testCase.testType} />
              <StatusBadge status={testCase.status} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <button onClick={onEdit}>Edit</button>
              <button onClick={onDelete}>Delete</button>
            </div>
            <span className="text-[11px] text-gray-400">
              Created: {formatDate(testCase.createdAt)}
            </span>
          </div>
        </div>
      </header>

      {/* Body zone */}
      {isExpanded && (
        <div className="p-4">
          <dl className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-4">
            {testCase.description && (
              <>
                <dt className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                  Description
                </dt>
                <dd className="text-sm leading-relaxed">{testCase.description}</dd>
              </>
            )}
            {testCase.preconditions && (
              <>
                <dt className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                  Preconditions
                </dt>
                <dd className="text-sm leading-relaxed">{testCase.preconditions}</dd>
              </>
            )}
          </dl>

          {/* Steps — 표 형식 (별도 컴포넌트) */}
          {testCase.steps && testCase.steps.length > 0 && (
            <TestCaseSteps steps={testCase.steps} images={testCase.images} />
          )}

          {/* Final Expected Result — green accent */}
          {testCase.expectedResult && (
            <div className="mt-4 border-l-[3px] border-green-600 bg-green-50 p-3.5 rounded-md">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircleIcon className="w-4 h-4 text-green-700" />
                <span className="text-xs uppercase tracking-wide font-medium text-green-800">
                  Final Expected Result
                </span>
              </div>
              <div className="text-sm leading-relaxed">
                <ImageRefText text={testCase.expectedResult} images={testCase.images} />
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
};
```

**TestCaseSteps 구조:**
```tsx
interface TestCaseStepsProps {
  steps: TestCaseStep[];
  images?: TestCaseImage[];
}

export const TestCaseSteps: React.FC<TestCaseStepsProps> = ({ steps, images }) => {
  return (
    <section className="mt-4 bg-gray-50 rounded-md p-3">
      <header className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2 px-1">
        Steps
      </header>
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[32px_1fr_1fr] gap-3 p-3 bg-white rounded border border-gray-100"
          >
            <div className="flex items-start">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
                {idx + 1}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wide text-gray-400 block mb-1">Action</span>
              <span className="text-sm">
                <ImageRefText text={step.action} images={images} />
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wide text-gray-400 block mb-1">Step Expected</span>
              <span className="text-sm text-gray-700">
                <ImageRefText text={step.expected} images={images} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
```

**TestCasePage 변경:**
- `PathTreeGroup` 내부의 카드 렌더링 인라인을 `<TestCaseCard ... />` 호출로 치환
- `expandedId` state 와 toggle 콜백을 prop 으로 전달

**Step B-1 체크리스트 (Agent-A):**
- [ ] TestCaseCard.tsx 신규 — Header / Body 영역 구조화 (`<header>` + `<dl>`)
- [ ] TestCaseSteps.tsx 신규 — 표 형식 grid layout
- [ ] PriorityBadge / TestTypeBadge / StatusBadge 헬퍼 또는 인라인 추출
- [ ] CheckCircleIcon 등 아이콘 컴포넌트 (lucide-react 또는 heroicons 활용)
- [ ] TestCasePage 의 PathTreeGroup 내부 카드 렌더링을 TestCaseCard 호출로 교체
- [ ] `data-testid="tc-card"` 유지 (E2E 테스트 호환)
- [ ] Final Expected Result 가 Steps 다음에 위치하도록 코드 순서 보장
- [ ] `data-testid="tc-body"`, `data-testid="tc-final-expected"` 등 E2E 식별자 추가

---

### Step B-2 — Agent-B 단위 테스트 (Vitest)

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `frontend/src/components/features/__tests__/TestCaseCard.test.tsx` | TC 카드 컴포넌트 단위 테스트 |
| `frontend/src/components/features/__tests__/TestCaseSteps.test.tsx` | Steps 표 형식 단위 테스트 |

**TestCaseCard 시나리오:**
```tsx
describe('TestCaseCard', () => {
  const baseTC: TestCase = {
    id: 1, title: 'Login flow', priority: 'HIGH', testType: 'FUNCTIONAL',
    status: 'ACTIVE', description: 'desc', preconditions: 'pre',
    steps: [{ action: 'click', expected: 'opened' }],
    expectedResult: 'logged in', images: [], createdAt: '2026-04-27', path: [],
  };

  it('Header zone 에 제목/뱃지/Edit/Delete 가 노출되고 Body 는 닫힌 상태', () => {
    render(<TestCaseCard testCase={baseTC} isExpanded={false} ... />);
    expect(screen.getByText('Login flow')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.queryByText('desc')).not.toBeInTheDocument();
  });

  it('펼친 상태에서 Body 가 Definition List 구조로 렌더링된다', () => {
    render(<TestCaseCard testCase={baseTC} isExpanded={true} ... />);
    const dl = screen.getByRole('definition').closest('dl');
    expect(dl).toBeInTheDocument();
    expect(within(dl!).getByText('Description')).toBeInTheDocument();
    expect(within(dl!).getByText('Preconditions')).toBeInTheDocument();
  });

  it('Final Expected Result 가 Steps 컴포넌트 다음에 위치한다', () => {
    render(<TestCaseCard testCase={baseTC} isExpanded={true} ... />);
    const stepsEl = screen.getByTestId('tc-steps');
    const finalEl = screen.getByTestId('tc-final-expected');
    expect(stepsEl.compareDocumentPosition(finalEl)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('Final Expected Result 영역에 green accent class 가 적용된다', () => {
    render(<TestCaseCard testCase={baseTC} isExpanded={true} ... />);
    const finalEl = screen.getByTestId('tc-final-expected');
    expect(finalEl).toHaveClass('border-green-600');
    expect(finalEl).toHaveClass('bg-green-50');
  });

  it('expectedResult 가 빈 값이면 Final Expected Result 영역을 렌더링하지 않는다', () => {
    render(<TestCaseCard testCase={{ ...baseTC, expectedResult: '' }} isExpanded={true} ... />);
    expect(screen.queryByTestId('tc-final-expected')).not.toBeInTheDocument();
  });

  it('Edit/Delete 버튼 클릭 시 콜백을 호출한다', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<TestCaseCard testCase={baseTC} isExpanded={true} onEdit={onEdit} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith(baseTC);
    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalled();
  });
});
```

**TestCaseSteps 시나리오:**
```tsx
describe('TestCaseSteps', () => {
  const steps = [
    { action: 'click button', expected: 'modal opens' },
    { action: 'enter text', expected: 'text appears' },
  ];

  it('각 step 이 [번호 뱃지] | ACTION | STEP EXPECTED 의 3열 grid 로 렌더된다', () => {
    render(<TestCaseSteps steps={steps} />);
    const rows = screen.getAllByTestId('tc-step-row');
    expect(rows).toHaveLength(2);
    rows.forEach((row, idx) => {
      expect(within(row).getByText(String(idx + 1))).toBeInTheDocument();
      expect(within(row).getByText('Action')).toBeInTheDocument();
      expect(within(row).getByText('Step Expected')).toBeInTheDocument();
    });
  });

  it('번호 뱃지가 1부터 순차적으로 부여된다', () => {
    render(<TestCaseSteps steps={steps} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
```

**Step B-2 체크리스트 (Agent-B):**
- [ ] TestCaseCard.test.tsx 6 시나리오
- [ ] TestCaseSteps.test.tsx 2 시나리오
- [ ] `npm test` 통과 (커버리지 신규 컴포넌트 80%+ 목표)
- [ ] `npm run lint` 0 warnings

---

### Step B-3 — Agent-C E2E 테스트 (Playwright)

**셀렉터 사전 확인:** Agent-C 는 `frontend/src/components/features/TestCaseCard.tsx`, `TestCaseSteps.tsx` 의 실제 JSX 를 Read 한 뒤 `data-testid` 셀렉터 작성. 추측 금지.

**파일:** `qa/ui/test-case-card.spec.ts` (신규)

**시나리오:**
```ts
test.describe('TestCase 카드 가독성 (DL 패턴)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page, '/features/companies/1/products/1');
    // 첫 TC 카드 펼치기
    await page.locator('[data-testid="tc-card"]').first().click();
  });

  test('펼친 카드의 Body 가 <dl>/<dt>/<dd> 시맨틱 태그로 구성된다', async ({ page }) => {
    const card = page.locator('[data-testid="tc-card"]').first();
    await expect(card.locator('dl')).toBeVisible();
    await expect(card.locator('dt', { hasText: 'Description' })).toBeVisible();
    await expect(card.locator('dt', { hasText: 'Preconditions' })).toBeVisible();
  });

  test('Steps 영역이 표 형식 grid (3열) 로 렌더된다', async ({ page }) => {
    const stepRow = page.locator('[data-testid="tc-step-row"]').first();
    await expect(stepRow).toBeVisible();
    await expect(stepRow).toHaveCSS('display', 'grid');
    // 3열: 번호 뱃지 / ACTION / STEP EXPECTED
    await expect(stepRow.locator('text=Action')).toBeVisible();
    await expect(stepRow.locator('text=Step Expected')).toBeVisible();
  });

  test('Final Expected Result 가 Steps 다음에 위치하고 green accent 가 적용된다', async ({ page }) => {
    const card = page.locator('[data-testid="tc-card"]').first();
    const steps = card.locator('[data-testid="tc-steps"]');
    const finalExpected = card.locator('[data-testid="tc-final-expected"]');

    await expect(steps).toBeVisible();
    await expect(finalExpected).toBeVisible();

    // DOM 순서 검증: Steps 가 먼저, Final Expected 가 그 다음
    const stepsBox = await steps.boundingBox();
    const finalBox = await finalExpected.boundingBox();
    expect(finalBox!.y).toBeGreaterThan(stepsBox!.y);

    // green accent
    await expect(finalExpected).toHaveCSS('border-left-color', 'rgb(22, 163, 74)');
  });

  test('Header zone 에 Created 일자가 11px tertiary color 로 노출된다', async ({ page }) => {
    const card = page.locator('[data-testid="tc-card"]').first();
    const created = card.locator('text=/Created:/');
    await expect(created).toBeVisible();
    // Body 영역 안에는 Created 가 없어야 함 (Header 로 이동)
    const body = card.locator('[data-testid="tc-body"]');
    await expect(body.locator('text=/Created:/')).toHaveCount(0);
  });
});
```

**Step B-3 체크리스트 (Agent-C):**
- [ ] TestCaseCard.tsx, TestCaseSteps.tsx Read 후 실제 셀렉터 작성
- [ ] test-case-card.spec.ts 4 시나리오
- [ ] DOM 순서 (Steps → Final Expected) 검증 포함
- [ ] CSS 검증 (display: grid, border-left-color) 포함

---

### Step B-4 — Agent-D 빌드 & 검증

**명령:**
```bash
cd /Users/yeongmi/dev/qa/my-atlas/frontend && npm run lint && npm test
cd /Users/yeongmi/dev/qa/my-atlas/backend && ./gradlew clean build
cd /Users/yeongmi/dev/qa/my-atlas && docker compose up -d --build && sleep 10
cd qa && npx playwright test
npx playwright test ui/test-case-card.spec.ts
cd .. && docker compose down
```

**Step B-4 검증 포인트:**
- [ ] Frontend lint 0 warnings
- [ ] Vitest 신규 테스트 8 건 (TestCaseCard 6 + TestCaseSteps 2) 통과
- [ ] Backend build SUCCESS
- [ ] E2E 전체 0 failed
- [ ] test-case-card.spec.ts 4 시나리오 모두 실제 실행 (did not run 0 건)
- [ ] 기존 segment-dnd / test-run / version 등 회귀 없음
- [ ] docker compose down 으로 teardown

**Agent-D 통과 후에만 PR-B 생성.**

---

## PR-C: Segment 다중 Root + 형제 정렬 순서

### Step C-1 — Agent-A 코드 구현

PR-C 의 Agent-A 는 4 개 영역(DB / Backend / Frontend types & api / Frontend components)을 모두 작성한다. 영역별로 구분하여 진행하되 한 PR 으로 묶는다.

#### C-1-1 DB Migration: segment.order_index 추가

**신규 파일:** `backend/src/main/resources/db/migration/V{타임스탬프}__add_segment_order_index.sql`

```sql
-- 1. order_index 컬럼 추가 (NOT NULL, default 0)
ALTER TABLE segment ADD COLUMN order_index INT NOT NULL DEFAULT 0;

-- 2. 기존 데이터 backfill — 같은 (product_id, parent_id) 그룹 내에서 id 순으로 0..N 부여
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY product_id, COALESCE(parent_id, -1)
               ORDER BY id ASC
           ) - 1 AS rn
    FROM segment
)
UPDATE segment s
SET order_index = ranked.rn
FROM ranked
WHERE s.id = ranked.id;

-- 3. 인덱스 (조회 성능)
CREATE INDEX idx_segment_parent_order
    ON segment(product_id, parent_id, order_index);
```

**설계 근거:**
- `order_index INT NOT NULL DEFAULT 0` — 신규 row 도 안전하게 기본값 부여
- `COALESCE(parent_id, -1)` — Root Segment 그룹(parent_id IS NULL)도 동일 product 내에서 order_index 부여
- `ROW_NUMBER() OVER (PARTITION BY ...)` — 같은 부모 그룹 내 id 오름차순으로 backfill (기존 정렬 유지)
- Composite 인덱스 — `findAllByProductIdAndParentIdOrderByOrderIndexAsc` 최적화

**C-1-1 체크리스트:**
- [ ] 타임스탬프 기반 마이그레이션 파일 생성 (V{YYYYMMDD}{HHmm} 양식)
- [ ] segment 테이블에 order_index 추가 + DEFAULT 0
- [ ] 기존 데이터 backfill (PARTITION BY 로 그룹 내 순번)
- [ ] Composite 인덱스 생성
- [ ] Flyway 적용 후 모든 row 의 order_index 가 같은 부모 그룹 내에서 unique 한지 검증

#### C-1-2 Backend: SegmentEntity + Repository + Reorder API

**SegmentEntity 변경:**
```java
@Entity @Table(name = "segment")
@Data @NoArgsConstructor @AllArgsConstructor
public class SegmentEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductEntity product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private SegmentEntity parent;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;
}
```

**SegmentRepository 추가 메서드:**
```java
public interface SegmentRepository extends JpaRepository<SegmentEntity, Long> {
    List<SegmentEntity> findAllByParentId(Long parentId);

    // 신규
    List<SegmentEntity> findAllByProductIdAndParentIdIsNullOrderByOrderIndexAsc(Long productId);
    List<SegmentEntity> findAllByParentIdOrderByOrderIndexAsc(Long parentId);

    @Query("SELECT COALESCE(MAX(s.orderIndex), -1) FROM SegmentEntity s "
         + "WHERE s.product.id = :productId "
         + "AND (:parentId IS NULL AND s.parent IS NULL OR s.parent.id = :parentId)")
    Integer findMaxOrderIndex(@Param("productId") Long productId, @Param("parentId") Long parentId);
}
```

**SegmentDto.ReorderRequest 추가:**
```java
public record ReorderRequest(
    @NotNull Long productId,
    Long parentId,                  // null = Root 그룹
    @NotEmpty List<Long> segmentIds // 변경된 순서대로
) {}
```

**SegmentServiceImpl 변경:**

createSegment — 새 Segment 의 orderIndex 를 같은 그룹의 max + 1 로 설정:
```java
@Override
public SegmentResponse createSegment(CreateRequest request) {
    SegmentEntity entity = new SegmentEntity();
    entity.setName(request.name());
    entity.setProduct(productRepository.findById(request.productId())
        .orElseThrow(() -> new IllegalArgumentException(...)));

    if (request.parentId() != null) {
        SegmentEntity parent = segmentRepository.findById(request.parentId())
            .orElseThrow(() -> new IllegalArgumentException(...));
        if (!parent.getProduct().getId().equals(request.productId())) {
            throw new IllegalArgumentException(...);
        }
        entity.setParent(parent);
    }

    // 신규: orderIndex = 같은 그룹의 max + 1
    Integer maxOrder = segmentRepository.findMaxOrderIndex(
        request.productId(), request.parentId());
    entity.setOrderIndex(maxOrder + 1);

    return toResponse(segmentRepository.save(entity));
}
```

reorder — 신규 메서드:
```java
@Override
@Transactional
public void reorder(ReorderRequest request) {
    // 1. 모든 segmentIds 가 같은 (productId, parentId) 그룹에 속하는지 검증
    List<SegmentEntity> segments = segmentRepository.findAllById(request.segmentIds());
    if (segments.size() != request.segmentIds().size()) {
        throw new IllegalArgumentException("Some segments not found");
    }
    for (SegmentEntity s : segments) {
        if (!s.getProduct().getId().equals(request.productId())) {
            throw new IllegalArgumentException("Segment " + s.getId() + " is not in product " + request.productId());
        }
        Long actualParentId = s.getParent() != null ? s.getParent().getId() : null;
        if (!Objects.equals(actualParentId, request.parentId())) {
            throw new IllegalArgumentException("Segment " + s.getId() + " has different parent");
        }
    }

    // 2. 요청된 순서대로 orderIndex 재할당
    Map<Long, SegmentEntity> byId = segments.stream()
        .collect(Collectors.toMap(SegmentEntity::getId, s -> s));
    for (int i = 0; i < request.segmentIds().size(); i++) {
        SegmentEntity s = byId.get(request.segmentIds().get(i));
        s.setOrderIndex(i);
    }
    segmentRepository.saveAll(segments);
}
```

**SegmentController 추가 endpoint:**
```java
@PatchMapping("/reorder")
public ResponseEntity<ApiResponse<Void>> reorder(@Valid @RequestBody ReorderRequest request) {
    segmentService.reorder(request);
    return ResponseEntity.ok(ApiResponse.success(null));
}
```

**기존 응답 스키마 — orderIndex 노출:**
```java
public record SegmentResponse(
    Long id, String name, Long productId, Long parentId,
    Integer orderIndex   // 신규
) {}
```

기존 GET endpoint 들은 자동으로 `findAllByProductId` → `OrderByOrderIndexAsc` 로 변경하여 정렬된 응답 반환.

**C-1-2 체크리스트:**
- [ ] SegmentEntity 에 orderIndex 필드 추가 (`@Column(name="order_index", nullable=false)`)
- [ ] SegmentRepository — Order 메서드 + findMaxOrderIndex 추가
- [ ] SegmentDto — ReorderRequest 추가, SegmentResponse 에 orderIndex 노출
- [ ] SegmentServiceImpl.createSegment — max + 1 로 orderIndex 설정
- [ ] SegmentServiceImpl.reorder — 신규 메서드 (그룹 검증 + 일괄 saveAll)
- [ ] SegmentController.reorder — PATCH 엔드포인트
- [ ] SegmentServiceImpl.getByProductId — OrderByOrderIndexAsc 정렬 적용

#### C-1-3 Frontend: TreeView DnD 분기 + Picker 부모 optional

**SegmentTreePicker 변경 (다중 Root 지원):**
- 부모 선택 dropdown 의 첫 옵션을 "(Root — Product 직속)" 로 추가
- parentId 가 null 인 경우에도 SegmentService.createSegment 호출 시 그대로 전달

**SegmentTreeView DnD 분기:**

기존: `onDrop` 시 무조건 `reparent` API 호출.

신규:
```tsx
const handleDrop = async (
  draggedSegmentId: number,
  targetSegmentId: number | null,  // null = Root 영역
  dropPosition: 'inside' | 'before' | 'after'
) => {
  const dragged = segments.find(s => s.id === draggedSegmentId);
  if (!dragged) return;

  if (dropPosition === 'inside') {
    // 다른 부모로 이동 → reparent
    if (dragged.parentId !== targetSegmentId) {
      await segmentApi.reparent(draggedSegmentId, targetSegmentId);
    }
  } else {
    // 같은 레벨 내 순서 변경 → reorder
    const target = segments.find(s => s.id === targetSegmentId);
    if (!target) return;
    if (dragged.parentId !== target.parentId) {
      // 다른 그룹으로 이동 후 정렬 변경 — reparent 후 reorder
      await segmentApi.reparent(draggedSegmentId, target.parentId);
    }
    // 같은 그룹의 형제들 + dragged 를 새 순서로 reorder
    const siblings = segments
      .filter(s => s.parentId === target.parentId && s.id !== draggedSegmentId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const targetIdx = siblings.findIndex(s => s.id === targetSegmentId);
    const insertIdx = dropPosition === 'before' ? targetIdx : targetIdx + 1;
    siblings.splice(insertIdx, 0, dragged);
    await segmentApi.reorder({
      productId: dragged.productId,
      parentId: target.parentId,
      segmentIds: siblings.map(s => s.id),
    });
  }

  // refetch
  await reloadSegments();
};
```

**SegmentTreeView 자식 정렬:**
```tsx
const childrenOf = (parentId: number | null): Segment[] =>
  segments
    .filter(s => s.parentId === parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
```

**api/features.ts 추가:**
```ts
export const segmentApi = {
  // ...기존
  reorder: async (req: { productId: number; parentId: number | null; segmentIds: number[] }) => {
    const res = await apiClient.patch('/api/segments/reorder', req);
    return res.data.data;
  },
};
```

**types/features.ts:**
```ts
export interface Segment {
  id: number;
  name: string;
  productId: number;
  parentId: number | null;
  orderIndex: number;   // 신규
}
```

**C-1-3 체크리스트:**
- [ ] types/features.ts — Segment 에 orderIndex 추가
- [ ] api/features.ts — segmentApi.reorder 추가
- [ ] SegmentTreePicker — "(Root)" 옵션 추가, parentId null 허용
- [ ] SegmentTreeView — childrenOf() 가 orderIndex 기준 정렬
- [ ] SegmentTreeView DnD — `inside` (reparent) vs `before/after` (reorder) 분기
- [ ] DnD 드롭 인디케이터 시각화 (위/아래 라인 vs 영역 하이라이트)
- [ ] 같은 그룹 내 reorder 후 즉시 refetch / optimistic update

---

### Step C-2 — Agent-B 단위 + 통합 테스트

#### Backend Unit Test (Mockito)

**파일:** `backend/src/test/java/com/myqaweb/feature/SegmentServiceTest.java` (확장)

```java
@ExtendWith(MockitoExtension.class)
class SegmentServiceTest {
    @Mock private SegmentRepository segmentRepository;
    @Mock private ProductRepository productRepository;
    @InjectMocks private SegmentServiceImpl service;

    @Test
    void createSegment_setsOrderIndexFromMaxPlusOne() {
        // Arrange
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(segmentRepository.findMaxOrderIndex(1L, null)).thenReturn(2);
        when(segmentRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        // Act
        SegmentResponse res = service.createSegment(new CreateRequest("FAQ", 1L, null));

        // Assert
        ArgumentCaptor<SegmentEntity> captor = ArgumentCaptor.forClass(SegmentEntity.class);
        verify(segmentRepository).save(captor.capture());
        assertEquals(3, captor.getValue().getOrderIndex());
    }

    @Test
    void createSegment_firstRootInProduct_orderIndexIsZero() {
        when(segmentRepository.findMaxOrderIndex(1L, null)).thenReturn(-1);
        // ... orderIndex == 0 검증
    }

    @Test
    void reorder_throwsWhenSegmentBelongsToDifferentProduct() {
        SegmentEntity s = makeSegment(10L, otherProduct, null);
        when(segmentRepository.findAllById(List.of(10L))).thenReturn(List.of(s));

        assertThrows(IllegalArgumentException.class, () ->
            service.reorder(new ReorderRequest(1L, null, List.of(10L))));
    }

    @Test
    void reorder_throwsWhenSegmentHasDifferentParent() {
        SegmentEntity s = makeSegment(10L, product, otherParent);
        when(segmentRepository.findAllById(List.of(10L))).thenReturn(List.of(s));

        assertThrows(IllegalArgumentException.class, () ->
            service.reorder(new ReorderRequest(1L, null, List.of(10L))));
    }

    @Test
    void reorder_assignsOrderIndexInRequestedOrder() {
        SegmentEntity s1 = makeSegment(10L, product, null);
        SegmentEntity s2 = makeSegment(20L, product, null);
        SegmentEntity s3 = makeSegment(30L, product, null);
        when(segmentRepository.findAllById(List.of(30L, 10L, 20L)))
            .thenReturn(List.of(s1, s2, s3));

        service.reorder(new ReorderRequest(1L, null, List.of(30L, 10L, 20L)));

        assertEquals(0, s3.getOrderIndex());
        assertEquals(1, s1.getOrderIndex());
        assertEquals(2, s2.getOrderIndex());
        verify(segmentRepository).saveAll(anyList());
    }

    @Test
    void reorder_throwsWhenSegmentIdMissing() {
        when(segmentRepository.findAllById(List.of(99L))).thenReturn(List.of());
        assertThrows(IllegalArgumentException.class, () ->
            service.reorder(new ReorderRequest(1L, null, List.of(99L))));
    }
}
```

#### Backend Controller Test (@WebMvcTest)

**파일:** `backend/src/test/java/com/myqaweb/feature/SegmentControllerTest.java` (확장)

```java
@Test
void reorder_returnsOk() throws Exception {
    mockMvc.perform(patch("/api/segments/reorder")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"productId": 1, "parentId": null, "segmentIds": [3,1,2]}
            """))
        .andExpect(status().isOk());
    verify(segmentService).reorder(any());
}

@Test
void reorder_returnsBadRequest_whenSegmentIdsEmpty() throws Exception {
    mockMvc.perform(patch("/api/segments/reorder")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"productId\":1,\"segmentIds\":[]}"))
        .andExpect(status().isBadRequest());
}
```

#### Backend Integration Test (Testcontainers)

**파일:** `backend/src/test/java/com/myqaweb/feature/SegmentReorderIntegrationTest.java` (신규)

```java
@SpringBootTest
@Testcontainers
@AutoConfigureMockMvc
class SegmentReorderIntegrationTest {
    // pgvector container
    // 실제 DB 에서 reorder 후 같은 그룹 내 order_index unique 검증
    // 마이그레이션 backfill 결과 검증
}
```

#### Frontend Unit Test (Vitest)

**파일:** `frontend/src/components/features/__tests__/SegmentTreeView.test.tsx` (확장)

```tsx
describe('SegmentTreeView 정렬 + DnD 분기', () => {
  it('childrenOf() 가 orderIndex 기준으로 정렬된 형제 노드를 반환한다', () => {
    const segments = [
      { id: 1, name: 'B', orderIndex: 1, parentId: null, productId: 1 },
      { id: 2, name: 'A', orderIndex: 0, parentId: null, productId: 1 },
    ];
    render(<SegmentTreeView segments={segments} ... />);
    const items = screen.getAllByTestId('segment-node');
    expect(items[0]).toHaveTextContent('A');
    expect(items[1]).toHaveTextContent('B');
  });

  it('DnD inside drop 시 reparent API 가 호출된다', async () => {
    const reparent = vi.spyOn(segmentApi, 'reparent');
    // ...drop 시뮬레이션
    expect(reparent).toHaveBeenCalledWith(2, 1);
  });

  it('DnD before/after drop 시 reorder API 가 호출된다', async () => {
    const reorder = vi.spyOn(segmentApi, 'reorder');
    // ...drop 시뮬레이션
    expect(reorder).toHaveBeenCalledWith({
      productId: 1, parentId: null, segmentIds: [2, 1, 3]
    });
  });
});
```

**Step C-2 체크리스트 (Agent-B):**
- [ ] SegmentServiceTest — createSegment orderIndex (2 케이스), reorder (4 케이스) = 6 시나리오
- [ ] SegmentControllerTest — reorder 정상 + validation 실패 = 2 시나리오
- [ ] SegmentReorderIntegrationTest — Testcontainers pgvector 로 마이그레이션 + reorder E2E
- [ ] SegmentTreeView.test.tsx — 정렬 + DnD 분기 = 3 시나리오
- [ ] `./gradlew test` 통과, JaCoCo 70%+
- [ ] `npm test` 통과

---

### Step C-3 — Agent-C E2E 테스트 (Playwright)

**셀렉터 사전 확인:** Agent-C 는 `frontend/src/components/features/SegmentTreeView.tsx`, `SegmentTreePicker.tsx` 의 실제 JSX 와 `data-testid` 를 Read 한 뒤 셀렉터 작성.

**파일:**

| 파일 | 역할 |
|------|------|
| `qa/api/segment-reorder.spec.ts` (신규) | Reorder API 검증 |
| `qa/ui/segment-dnd.spec.ts` (확장) | 다중 Root 생성 + 같은 레벨 DnD reorder 시나리오 |

**API 테스트 시나리오 (qa/api/segment-reorder.spec.ts):**
```ts
test.describe('PATCH /api/segments/reorder', () => {
  test('정상 reorder 시 응답 200 + 조회 시 변경된 순서로 반환', async ({ request }) => {
    const productId = await createProduct(request);
    const a = await createSegment(request, { productId, name: 'A' });
    const b = await createSegment(request, { productId, name: 'B' });
    const c = await createSegment(request, { productId, name: 'C' });

    await request.patch('/api/segments/reorder', {
      data: { productId, parentId: null, segmentIds: [c.id, a.id, b.id] }
    }).then(r => expect(r.status()).toBe(200));

    const list = await request.get(`/api/segments?productId=${productId}`).then(r => r.json());
    expect(list.data.map(s => s.id)).toEqual([c.id, a.id, b.id]);
  });

  test('다른 부모를 가진 segmentIds 가 섞인 경우 400', async ({ request }) => {
    // ...
  });

  test('다른 product 의 segmentIds 가 섞인 경우 400', async ({ request }) => {
    // ...
  });

  test('빈 segmentIds 는 400', async ({ request }) => {
    await request.patch('/api/segments/reorder', {
      data: { productId: 1, parentId: null, segmentIds: [] }
    }).then(r => expect(r.status()).toBe(400));
  });
});
```

**UI 테스트 시나리오 (qa/ui/segment-dnd.spec.ts 확장):**
```ts
test('Product 직속 자식으로 다중 Root Segment 생성 가능', async ({ page }) => {
  await loginAndNavigate(page, '/features/companies/1/products/99');
  await page.locator('[data-testid="add-segment-btn"]').click();
  // SegmentTreePicker 에서 (Root) 옵션 선택
  await page.locator('[data-testid="parent-select"]').selectOption({ label: '(Root)' });
  await page.fill('[data-testid="segment-name-input"]', 'FAQ');
  await page.click('[data-testid="segment-create-confirm"]');

  // 두 번째 root
  await page.locator('[data-testid="add-segment-btn"]').click();
  await page.locator('[data-testid="parent-select"]').selectOption({ label: '(Root)' });
  await page.fill('[data-testid="segment-name-input"]', 'Chat');
  await page.click('[data-testid="segment-create-confirm"]');

  // Tree view 의 root level 에 FAQ, Chat 형제로 노출
  const rootItems = page.locator('[data-testid="segment-tree-root"] > [data-testid="segment-node"]');
  await expect(rootItems).toHaveCount(2);
  await expect(rootItems.nth(0)).toHaveText('FAQ');
  await expect(rootItems.nth(1)).toHaveText('Chat');
});

test('같은 부모 하위 형제 Segment 의 DnD 순서 변경', async ({ page }) => {
  // FAQ, Chat 이 root 에 있을 때 Chat 을 FAQ 위로 드래그
  const faq = page.locator('[data-testid="segment-node"]', { hasText: 'FAQ' });
  const chat = page.locator('[data-testid="segment-node"]', { hasText: 'Chat' });
  await chat.dragTo(faq, { targetPosition: { x: 0, y: 0 } });  // before drop

  // 새로 고침해도 순서 유지
  await page.reload();
  const items = page.locator('[data-testid="segment-tree-root"] > [data-testid="segment-node"]');
  await expect(items.nth(0)).toHaveText('Chat');
  await expect(items.nth(1)).toHaveText('FAQ');
});

test('DnD 가 reparent vs reorder 를 정확히 구분한다', async ({ page }) => {
  // inside drop → reparent (다른 부모 하위로 이동)
  // before drop → reorder (같은 부모 내 순서 변경)
  // 네트워크 요청을 가로채 reparent vs reorder API 호출 확인
});
```

**Step C-3 체크리스트 (Agent-C):**
- [ ] SegmentTreeView.tsx, SegmentTreePicker.tsx Read 후 셀렉터 작성
- [ ] segment-reorder.spec.ts (API) — 4 시나리오
- [ ] segment-dnd.spec.ts (UI) — 다중 Root + reorder DnD + reparent vs reorder 분기 = 3 시나리오 추가
- [ ] 기존 segment-dnd 시나리오 회귀 없음

---

### Step C-4 — Agent-D 빌드 & 검증

**명령:**
```bash
# 1. Backend build + tests + JaCoCo
cd /Users/yeongmi/dev/qa/my-atlas/backend && ./gradlew clean build

# 2. Frontend lint + tests
cd /Users/yeongmi/dev/qa/my-atlas/frontend && npm run lint && npm test

# 3. 풀스택 기동 (마이그레이션 자동 적용)
cd /Users/yeongmi/dev/qa/my-atlas && docker compose up -d --build && sleep 15

# 4. 마이그레이션 적용 확인
docker compose exec -T db psql -U myqaweb -d myqaweb -c "\d segment"

# 5. E2E 전체
cd qa && npx playwright test

# 6. 신규 spec 개별 실행
npx playwright test api/segment-reorder.spec.ts
npx playwright test ui/segment-dnd.spec.ts

# Teardown
cd .. && docker compose down
```

**Step C-4 검증 포인트:**
- [ ] Backend `./gradlew clean build` SUCCESS
- [ ] JaCoCo 70%+ 유지 (Segment 도메인 신규 로직 80%+ 목표)
- [ ] Frontend lint 0 warnings, vitest 통과
- [ ] DB 마이그레이션 정상 적용 (segment 테이블에 order_index 컬럼 + 인덱스 존재)
- [ ] E2E 전체 0 failed
- [ ] segment-reorder.spec.ts 4 시나리오 모두 실제 실행
- [ ] segment-dnd.spec.ts 신규 3 시나리오 모두 실제 실행 (did not run 0)
- [ ] 기존 회귀 0 (test-case-card, test-suite-layout, version, test-run 등)
- [ ] docker compose down

**Agent-D 통과 후에만 PR-C 생성.**

---

## 변경 요약

### 신규 파일

**Backend:**

| 파일 | PR | 내용 |
|------|----|------|
| `db/migration/V{ts}__add_segment_order_index.sql` | PR-C | segment.order_index 추가 + backfill + composite index |

**Backend Tests:**

| 파일 | PR | 내용 |
|------|----|------|
| `test/feature/SegmentReorderIntegrationTest.java` | PR-C | Testcontainers pgvector 로 마이그레이션 + reorder E2E 검증 |

**Frontend:**

| 파일 | PR | 내용 |
|------|----|------|
| `components/features/TestCaseCard.tsx` | PR-B | TC 카드 단일 — Header zone + Body zone (DL 패턴) |
| `components/features/TestCaseSteps.tsx` | PR-B | Steps 표 형식 (3열 grid) |

**Frontend Tests (Vitest):**

| 파일 | PR | 내용 |
|------|----|------|
| `pages/features/__tests__/TestCasePage.test.tsx` | PR-A | 헤더 중복 없음 / 컨테이너 통일 검증 |
| `components/features/__tests__/TestCaseCard.test.tsx` | PR-B | DL 구조 / Final Expected 위치 / green accent / 콜백 = 6 시나리오 |
| `components/features/__tests__/TestCaseSteps.test.tsx` | PR-B | 3열 grid + 번호 뱃지 = 2 시나리오 |
| `components/features/__tests__/SegmentTreeView.test.tsx` | PR-C | orderIndex 정렬 + DnD 분기 (reparent vs reorder) = 3 시나리오 |

**E2E (Playwright):**

| 파일 | PR | 내용 |
|------|----|------|
| `qa/ui/test-suite-layout.spec.ts` | PR-A | Breadcrumb 외 헤더 중복 없음 + 다른 페이지와 컨테이너 동일 |
| `qa/ui/test-case-card.spec.ts` | PR-B | DL 구조 / Steps 표 / Final Expected 위치 + green accent / Created 위치 |
| `qa/api/segment-reorder.spec.ts` | PR-C | Reorder API 정상/검증실패 = 4 시나리오 |

### 수정 파일

**Backend:**

| 파일 | PR | 변경 내용 |
|------|----|-----------|
| `feature/SegmentEntity.java` | PR-C | orderIndex 필드 추가 |
| `feature/SegmentDto.java` | PR-C | ReorderRequest 추가, SegmentResponse 에 orderIndex 노출 |
| `feature/SegmentRepository.java` | PR-C | OrderBy 메서드 + findMaxOrderIndex 추가 |
| `feature/SegmentServiceImpl.java` | PR-C | createSegment 에 orderIndex 설정, reorder 메서드 신규, getBy* 정렬 |
| `feature/SegmentController.java` | PR-C | PATCH /api/segments/reorder 엔드포인트 |

**Backend Tests:**

| 파일 | PR | 변경 내용 |
|------|----|-----------|
| `test/feature/SegmentServiceTest.java` | PR-C | createSegment orderIndex (2) + reorder (4) = 6 시나리오 추가 |
| `test/feature/SegmentControllerTest.java` | PR-C | reorder 정상 + validation 실패 = 2 시나리오 추가 |

**Frontend:**

| 파일 | PR | 변경 내용 |
|------|----|-----------|
| `pages/features/TestCasePage.tsx` | PR-A / PR-B | (A) 헤더 중복 제거, 패딩 통일 / (B) TestCaseCard 호출로 카드 렌더링 위임 |
| `components/features/SegmentTreePicker.tsx` | PR-C | (Root) 옵션 추가, parentId nullable |
| `components/features/SegmentTreeView.tsx` | PR-C | childrenOf() 정렬, DnD 분기 (reparent vs reorder) |
| `types/features.ts` | PR-C | Segment.orderIndex 추가 |
| `api/features.ts` | PR-C | segmentApi.reorder 추가 |

**E2E:**

| 파일 | PR | 변경 내용 |
|------|----|-----------|
| `qa/ui/segment-dnd.spec.ts` | PR-C | 다중 Root 생성 + 같은 레벨 DnD reorder + reparent vs reorder 분기 = 3 시나리오 추가 |

---

## PR 진행 순서 및 머지 전략

| 순서 | PR | Base | Agent Pipeline | 머지 전략 | 리뷰 포커스 |
|------|----|------|----------------|---------|-------------|
| 1 | PR-A — UI / Header 정리 | develop | A-1 → A-2 → A-3 → A-4 통과 후 PR | Squash | 시각적 회귀, 다른 페이지와의 일관성 |
| 2 | PR-B — TC 카드 가독성 | develop | B-1 → B-2 → B-3 → B-4 통과 후 PR | Squash | DL 구조, Final Expected 강조, 컴포넌트 분리 |
| 3 | PR-C — Segment Root + 정렬 | develop | C-1 → C-2 → C-3 → C-4 통과 후 PR | Squash | DB 마이그레이션, DnD 분기 정확성, E2E 안정성 |

**머지 게이트 (각 PR 공통):**
- ❌ Agent-D 가 통과하지 않으면 PR 생성 금지 (CLAUDE.md 의 absolute rule)
- ❌ E2E "did not run" 테스트가 있으면 통과로 간주하지 않음
- ❌ Agent-A→B→C→D 중 어느 단계든 실패 시 다음 단계로 넘어가지 않음
- ✅ User 승인 후 `gh pr create` (Claude 가 PR 생성), 머지는 User 가 직접

**머지 후 절차:**
- 각 PR 머지 후 `./scripts/wt.sh sync registry` 로 worktree 동기화
- PR-A, PR-B 는 Frontend only — develop 머지 후 즉시 다음 PR 가능
- PR-C 는 DB 마이그레이션 포함 — 머지 후 메인 DB 마이그레이션 적용 확인 필수
- 모든 PR 머지 후 develop → main 릴리즈 PR 생성 (User 판단)

---

## 기대 효과

### 정량
- TC 카드 펼침 후 핵심 정보(Final Expected Result) 인지 시간: 평균 3 초 → 1 초 이내
- Segment 트리 정리에 필요한 클릭 수: 다중 Root 한 번에 만들 때 5 클릭 → 2 클릭
- 같은 레벨 정렬 변경 가능 여부: 불가 → DnD 1 회 가능

### 정성
- "정보가 다 있는데 안 읽힌다" 라는 QA 피드백 해소
- Segment 구조가 사용자의 멘탈 모델(Product = 카테고리, Segment = 기능 단위)과 일치
- Test Suite 페이지가 다른 도메인 페이지와 같은 양식으로 보여 학습 곡선 완화
