# Feature Registry — 공통 경로 그룹핑 UI 개선, TestRun 경로 시각화 (v16)

> 변경 유형: 기능 개선  
> 작성일: 2026-04-16  
> 버전: v16  
> 상태: 완료

---

# 요구사항

### 공통 경로 그룹핑 UI 개선

🔍 As-Is (현재 상태)
모든 TC 카드 위에 결제 단말기 > 결제 > IC카드 결제와 같이 풀 경로가 반복 노출됨
공통 상위 경로(결제 단말기 > 결제)가 카테고리마다 중복되어 가독성 저하
계층 깊이(depth)가 시각적으로 표현되지 않음 — 모든 카드가 동일한 들여쓰기 레벨

현재 화면 구조
```
결제 단말기 > 결제 > IC카드 결제
  [Card] IC카드 정상 결제
  [Card] IC카드 중간 제거 시 롤백

결제 단말기 > 결제 > NFC 결제
  [Card] NFC 결제 (삼성페이)

결제 단말기 > 결제 > QR 결제
  [Card] QR 결제 (토스페이)

결제 단말기 > 결제 > 금액 검증
  [Card] 금액 0원 입력 차단
```

🎯 To-Be (목표 상태)
공통 prefix를 최상단에 1회만 표시
Leaf 카테고리(IC카드 결제, NFC 결제 등)를 하위 그룹 헤더로 분리
들여쓰기 및 좌측 vertical guideline으로 계층 시각화

개선된 구조
```
📁 결제 단말기 > 결제
   │
   ├─ 📂 IC카드 결제
   │     [Card] IC카드 정상 결제
   │     [Card] IC카드 중간 제거 시 롤백
   │
   ├─ 📂 NFC 결제
   │     [Card] NFC 결제 (삼성페이)
   │
   ├─ 📂 QR 결제
   │     [Card] QR 결제 (토스페이)
   │
   └─ 📂 금액 검증
         [Card] 금액 0원 입력 차단
```

### TestRun List에서 경로 UI 개선
TestCase를 펼쳐보는건 아래에 표시 되나 전체적으로 Segement들이 눈에 띄지 않습니다.

---

## 현재 코드 분석 (Context)

### TestCasePage.tsx — 경로 그룹핑 (현재)

- 파일: `frontend/src/pages/features/TestCasePage.tsx`

**그룹핑 로직 (L72-117):**
```typescript
// L82-95: DFS 순서로 segment tree 탐색 → dfsPathOrder 배열 생성
const dfsPathOrder = useMemo(() => {
  const order: string[] = [];
  const dfs = (parentId: number | null, path: number[]) => {
    const children = childrenMap.get(parentId) || [];
    for (const child of children) {
      const currentPath = [...path, child.id];
      order.push(currentPath.join(','));
      dfs(child.id, currentPath);
    }
  };
  dfs(null, []);
  return order;
}, [childrenMap]);

// L98-117: TC를 path(segment ID 배열)로 그룹핑, DFS 순서로 정렬
const groupedTestCases = useMemo(() => {
  const groups = new Map<string, TestCase[]>();
  testCases.forEach((tc) => {
    const key = tc.path.join(',');
    groups.set(key, [...(groups.get(key) || []), tc]);
  });
  // DFS 순서로 정렬
  return sortedKeys.map((key) => ({
    path: key.split(',').map(Number),
    testCases: groups.get(key)!,
  }));
}, [testCases, dfsPathOrder]);
```

**경로 이름 해석 (L119-124):**
```typescript
const resolvePathNames = (path: number[]): string => {
  return path.map((id) => segments.find((s) => s.id === id)?.name || '?').join(' > ');
};
```

**렌더링 (L362-371) — 플랫 구조, 풀 경로 반복:**
```tsx
{groupedTestCases.map((group) => (
  <div key={group.path.join('-')} id={`section-${group.path.join('-')}`}>
    <h3 className="text-sm font-semibold text-gray-600 mb-2 border-b pb-1">
      {resolvePathNames(group.path)}   {/* ← 매번 풀 경로 표시 */}
    </h3>
    <div className="space-y-3">
      {group.testCases.map((tc) => ( ... ))}  {/* TC 카드 */}
    </div>
  </div>
))}
```

**문제점:**
- 모든 그룹 헤더에 풀 경로가 반복 노출 (e.g., `결제 단말기 > 결제 > IC카드 결제`)
- 공통 prefix 중복 → 가독성 저하
- 계층 depth 시각화 없음 — 모든 헤더가 동일 레벨
- Scroll Spy 유지 필요: `id="section-${path.join('-')}"` + IntersectionObserver (L150-183)

### TestRunDetailPage.tsx — 경로 표시 (현재)

- 파일: `frontend/src/pages/features/TestRunDetailPage.tsx`

**그룹핑 로직 (L83-99):**
```typescript
const groupedTestCases = useMemo(() => {
  const groups = new Map<string, TestCase[]>();
  included.forEach((tc) => {
    const key = tc.path?.length > 0 ? resolvePath(tc.path) : 'Unassigned';
    groups.set(key, [...(groups.get(key) || []), tc]);
  });
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}, [testRun, allTestCases, segmentMap]);
```

**렌더링 (L236-249) — 플랫 구조:**
```tsx
{groupedTestCases.map(([pathName, tcs]) => (
  <div key={pathName} className="border border-gray-200 rounded-lg overflow-hidden">
    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
      <span className="text-sm font-medium text-gray-600">{pathName}</span>
      <span className="text-xs text-gray-400 ml-2">({tcs.length})</span>
    </div>
    {/* TC rows */}
  </div>
))}
```

**문제점:**
- 그룹핑 키가 문자열 pathName → 경로 ID 기반 트리 구조 불가
- 헤더가 `bg-gray-50 text-gray-600`으로 눈에 띄지 않음
- 계층 depth 시각화 없음, vertical guideline 없음

### VersionPhaseDetailPage.tsx — 결과 그룹핑 (현재)

- 파일: `frontend/src/pages/features/VersionPhaseDetailPage.tsx`

**그룹핑 로직 (L93-115):**
```typescript
const groupedResults = useMemo(() => {
  const tcMap = new Map<number, TestCase>();
  testCases.forEach((tc) => tcMap.set(tc.id, tc));

  const groups = new Map<string, { pathName: string; path: number[]; results: TestResult[] }>();
  for (const result of results) {
    const tc = tcMap.get(result.testCaseId);
    const path = tc?.path || [];
    const pathKey = path.length > 0 ? path.join('-') : 'unassigned';
    const pathName = path.length > 0 ? resolvePathNames(path) : '경로 없음';
    // ...
  }
  return Array.from(groups.entries())
    .sort(([, a], [, b]) => a.pathName.localeCompare(b.pathName));
}, [results, testCases, resolvePathNames]);
```

**렌더링 (L274-282) — 플랫 구조:**
```tsx
{groupedResults.map(([pathKey, group]) => (
  <div key={pathKey}>
    <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-300">
      <span className="text-sm font-semibold text-indigo-700">
        {group.pathName}   {/* ← 매번 풀 경로 표시 */}
      </span>
      <span className="text-xs text-gray-500">({group.results.length})</span>
    </div>
    {/* TestResult rows */}
  </div>
))}
```

**문제점:**
- TestCasePage와 동일: 풀 경로 반복, depth 시각화 없음
- 헤더가 `text-indigo-700`으로 색상은 있으나 계층 구분 없음
- 테스트 수행 중 어떤 Segment 하위인지 맥락 파악 어려움

### 공통 비교

| 항목 | TestCasePage | TestRunDetailPage | VersionPhaseDetailPage |
|------|-------------|-------------------|----------------------|
| 그룹 키 | 숫자 path `[3,5,7]` | 문자열 pathName | 숫자 path `3-5-7` |
| 그룹 데이터 | `TestCase[]` | `TestCase[]` | `TestResult[]` |
| 정렬 | DFS 순서 | 알파벳 순 | 알파벳 순 |
| 헤더 | `text-gray-600 border-b` | `bg-gray-50 text-gray-600` | `text-indigo-700 border-b` |
| 카운트 | 없음 | `(N)` 표시 | `(N)` 표시 |
| Depth 시각화 | 없음 | 없음 | 없음 |
| Scroll Spy | 있음 (IntersectionObserver) | 없음 | 없음 |

---

## 구현 계획

### 변경 범위

| 구분 | 내용 |
|------|------|
| Backend | **변경 없음** — 순수 프론트엔드 작업 |
| DB Migration | **변경 없음** |
| Frontend | TestCasePage.tsx, TestRunDetailPage.tsx, VersionPhaseDetailPage.tsx 렌더링 로직 변경 |
| 신규 파일 | 없음 (인라인 구현) |

---

### Step 1 — PathTree 구축 로직 (TestCasePage)

**목표:** 기존 플랫 `groupedTestCases` 배열을 Trie(경로 트리) 구조로 변환 + 단일 자식 체인 압축

**PathTreeNode 인터페이스 (TestCasePage 내부에 정의):**
```typescript
interface PathTreeNode {
  segmentIds: number[];     // 압축된 segment ID 체인 (e.g., [3, 5])
  segmentNames: string[];   // 대응하는 이름 체인 (e.g., ['결제 단말기', '결제'])
  children: PathTreeNode[];
  testCases: TestCase[];    // 이 정확한 경로의 TC (leaf에만 존재)
  fullPath: number[];       // 루트부터의 전체 경로 (scroll spy ID용)
}
```

**트리 구축 알고리즘:**
```
1. 기존 groupedTestCases 순회 (DFS 순서 유지)
2. 각 path를 Trie에 삽입 — segment ID 기준으로 자식 노드 탐색/생성
3. leaf 노드에 testCases 할당
4. 경로 압축: 자식 1개 + TC 0개인 노드 → 자식과 병합
   - while (node.children.length === 1 && node.testCases.length === 0)
   - segmentIds/Names를 자식과 합침
5. 재귀적으로 모든 서브트리에 적용
```

**압축 예시:**
```
Before: [결제 단말기] → [결제] → [IC카드 결제 (TC 2개)]
                              → [NFC 결제 (TC 1개)]
After:  [결제 단말기 > 결제] → [IC카드 결제 (TC 2개)]
                             → [NFC 결제 (TC 1개)]
```

**엣지 케이스 처리:**
- path가 없는 TC → 기존처럼 무시 (L101: `if (!tc.path || tc.path.length === 0) return`)
- 깊이 1 경로 (e.g., `[3]`) → 압축 없이 단일 노드
- 동일 prefix 다른 깊이 혼합 → 트리 구조가 자연스럽게 처리

- [x] PathTreeNode 인터페이스 정의
- [x] buildPathTree 함수 구현 (useMemo 내부)
- [x] compressPathTree 함수 구현 (단일 자식 체인 압축)
- [x] 기존 groupedTestCases와 동일 DFS 순서 보장

---

### Step 2 — TestCasePage 계층형 렌더링

**목표:** 플랫 리스트 → 재귀적 트리 렌더링, vertical guideline + depth 들여쓰기

**렌더링 구조:**
```tsx
{/* 기존 L362-371 영역을 대체 */}
{pathTree.map((node) => (
  <PathTreeGroup
    key={node.fullPath.join('-')}
    node={node}
    depth={0}
    renderTestCase={renderTestCase}  {/* 기존 TC 카드 렌더 함수 재사용 */}
  />
))}
```

**PathTreeGroup 컴포넌트 (TestCasePage 내부 함수):**
```tsx
function PathTreeGroup({ node, depth, renderTestCase }) {
  const displayName = node.segmentNames.join(' > ');

  return (
    <div>
      {/* 그룹 헤더 */}
      <div className={`flex items-center gap-2 ${depth > 0 ? 'mt-3' : 'mt-0'}`}>
        {/* depth에 따른 아이콘 차별화 */}
        <span>{depth === 0 ? '📁' : '📂'}</span>
        <span className="text-sm font-semibold text-gray-700">{displayName}</span>
        {node.testCases.length > 0 && (
          <span className="text-xs text-gray-400">({node.testCases.length})</span>
        )}
      </div>

      {/* Vertical guideline + 들여쓰기 */}
      <div className="ml-3 pl-4 border-l-2 border-gray-200">
        {/* TC 카드 (leaf) — scroll spy ID 유지 */}
        {node.testCases.length > 0 && (
          <div id={`section-${node.fullPath.join('-')}`} className="space-y-3 mt-2">
            {node.testCases.map(renderTestCase)}
          </div>
        )}

        {/* 자식 노드 재귀 */}
        {node.children.map((child) => (
          <PathTreeGroup key={child.fullPath.join('-')} node={child} depth={depth + 1} ... />
        ))}
      </div>
    </div>
  );
}
```

**Scroll Spy 호환성:**
- `id="section-${node.fullPath.join('-')}"` 유지 → IntersectionObserver 그대로 동작
- leaf 노드(TC 보유)에만 section ID 부여
- SegmentTreeView 클릭 → 해당 section으로 스크롤 (기존 로직 유지)

**시각 디자인:**
- depth 0: `📁` 아이콘 + `font-semibold text-gray-700` + `border-b`
- depth 1+: `📂` 아이콘 + `font-medium text-gray-600`
- Vertical guideline: `border-l-2 border-gray-200` (좌측 세로선)
- 들여쓰기: `ml-3 pl-4` (depth마다 누적)

- [x] 기존 플랫 렌더링을 PathTreeGroup 재귀 렌더링으로 교체
- [x] Scroll Spy section ID 호환성 유지
- [x] TC 카드 렌더 로직은 기존 코드 그대로 재사용 (extract → PathTreeGroup 컴포넌트)
- [x] depth별 시각 차별화 (아이콘, 색상, guideline)
- [x] 빈 그룹 / path 없는 TC 엣지 케이스 검증

---

### Step 3 — TestRunDetailPage 경로 트리 UI 개선

**목표:** TestCasePage와 동일한 트리 그룹핑을 TestRunDetailPage에도 적용

**변경 대상:** `frontend/src/pages/features/TestRunDetailPage.tsx`

**현재 문제:**
- 그룹 키가 문자열 pathName → 숫자 기반 path로 변경 필요
- 헤더가 `bg-gray-50 text-gray-600`으로 Segment가 눈에 띄지 않음

**변경 사항:**

1. **그룹핑 키 변경** — 문자열 pathName → 숫자 path 배열
```typescript
// Before (L91-92):
const key = tc.path?.length > 0 ? resolvePath(tc.path) : 'Unassigned';

// After:
const key = tc.path?.length > 0 ? tc.path.join(',') : '';
```

2. **PathTree 구축** — Step 1과 동일한 로직 적용
3. **재귀적 렌더링** — Step 2와 유사 (단, TC 카드 렌더 함수는 TestRunDetailPage 고유)

**시각 차별화:**
- Segment 헤더 강조: `bg-indigo-50 text-indigo-800 font-semibold border-l-4 border-indigo-400`
- Vertical guideline: TestCasePage와 동일 패턴
- TC 카운트 배지 유지: `({tcs.length})`

- [x] 그룹핑 키를 숫자 path 기반으로 변경
- [x] PathTree 구축 로직 적용 (Step 1과 동일 알고리즘)
- [x] 재귀적 트리 렌더링 적용
- [x] Segment 헤더 시각 강조 (indigo 계열)
- [x] 기존 TC 펼침(expandedTcId) 기능 유지
- [x] Unassigned(경로 없음) TC 별도 처리

---

### Step 4 — VersionPhaseDetailPage 경로 트리 UI 개선

**목표:** Phase 실행 화면에도 동일한 트리 그룹핑 적용 — 테스트 수행 시 Segment 계층 맥락 제공

**변경 대상:** `frontend/src/pages/features/VersionPhaseDetailPage.tsx`

**현재 문제:**
- `groupedResults`가 플랫 구조 — `{ pathName, path, results }` 배열
- 풀 경로가 매 그룹 헤더마다 반복
- 테스트 수행 중 "이 TC가 어떤 Segment 하위인지" 계층 파악 어려움

**변경 사항:**

1. **그룹핑 데이터를 PathTree로 변환**
   - 기존 `groupedResults`의 `path: number[]` 활용 (이미 숫자 path 보유)
   - TestResult[] 기반 트리 구축 (TC가 아닌 Result를 그룹핑)

2. **PathTree 구축** — Step 1과 동일한 알고리즘, 단 노드 데이터가 `TestResult[]`
```typescript
interface ResultPathTreeNode {
  segmentIds: number[];
  segmentNames: string[];
  children: ResultPathTreeNode[];
  results: TestResult[];    // ← TestCase[] 대신 TestResult[]
  fullPath: number[];
}
```

3. **재귀적 렌더링** — Step 2와 동일 패턴
   - Segment 헤더: `text-indigo-700` (기존 색상 유지) + depth 들여쓰기
   - Vertical guideline: `border-l-2 border-indigo-200`
   - Result 행 렌더: 기존 `StatusButtonGroup`, 펼침, 티켓, 댓글 모두 유지

**기존 기능 보존:**
- `expandedResultId` 상태 — 펼침/접힘 그대로 동작
- `handleStatusChange` — FAIL 시 티켓 다이얼로그 자동 오픈
- `comments`, `tickets` lazy loading — 펼침 시 로드
- `liveStats` 계산 — 기존 results 기반으로 변경 없음

- [x] groupedResults → ResultPathTree 변환 로직 추가
- [x] 재귀적 트리 렌더링 적용
- [x] Segment 헤더에 indigo 계열 + depth 들여쓰기
- [x] 기존 Result 행 렌더 로직 (StatusButtonGroup, 펼침, 티켓, 댓글) 그대로 재사용
- [x] 경로 없음('unassigned') Result 별도 처리

---

### Step 5 — 검증

**Frontend Lint:**
```bash
cd frontend && npm run lint   # 0 warnings 필수
```

**시각적 검증 항목:**

| 시나리오 | 기대 결과 |
|---------|----------|
| 공통 prefix 3단계 경로 (A > B > C, A > B > D) | A > B가 1회 표시, C/D가 하위 |
| 단일 경로 (A > B > C만 존재) | 전체 압축: `A > B > C` 단일 헤더 |
| depth 1 경로 ([A]) | 압축 없이 A 표시, TC 바로 아래 |
| 혼합 depth (A > B, A > B > C) | A > B에 TC + 자식 C 둘 다 표시 |
| 다른 루트 (A > B, X > Y) | 별도 루트로 분리 표시 |
| path 없는 TC | 무시 (기존 동작 유지) |
| Scroll Spy | SegmentTreeView 클릭 → 해당 섹션 스크롤, 스크롤 시 트리 하이라이트 |
| TestRun Detail에서 Segment 시각화 | 계층형 헤더 + indigo 강조 + vertical line |
| Phase 실행 화면 (VersionPhaseDetailPage) | 계층형 Segment 그룹 + depth 들여쓰기 |
| Phase 실행 — FAIL 시 티켓 다이얼로그 | 트리 구조 변경 후에도 정상 동작 |
| Phase 실행 — 펼침/댓글/티켓 | 기존 기능 모두 정상 |

**Agent-D 빌드 검증 단계:**
```bash
# Step 1: Backend build + tests
cd backend && ./gradlew clean build

# Step 2: Full stack 기동
cd /Users/yeongmi/dev/qa/my-atlas && docker compose up -d --build && sleep 10

# Step 3: E2E tests (전체)
cd qa && npx playwright test

# Teardown
cd /Users/yeongmi/dev/qa/my-atlas && docker compose down
```

- [x] Frontend lint 0 warnings
- [x] Backend build 성공 (BUILD SUCCESSFUL, 179 tests passed)
- [x] E2E 전체 통과 (262 passed, 4 skipped, 0 failed)
- [ ] 시각적 검증 항목 전수 확인 (유저 확인 필요)
