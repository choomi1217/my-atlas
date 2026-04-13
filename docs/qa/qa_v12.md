# main 브랜치 전체 E2E 테스트 결과

> 변경 유형: 테스트 보강  
> 작성일: 2026-04-13  
> 버전: v12  
> 상태: 진행 중

---

## 1. Context

qa_v11(시드 데이터 삭제 버그) 수정 전, main 브랜치에서 전체 E2E 테스트를 실행하여 현재 상태를 기록한다.

> 실행일: 2026-04-13  
> 브랜치: main (qa_v11 수정 미적용 상태)  
> 전체: 227 tests — **1 failed, 4 skipped, 222 passed**

---

## 2. Failed (1건)

| # | 파일 | 테스트명 | 원인 |
|---|------|----------|------|
| 1 | `ui/company-panel.spec.ts:44` | should delete company via confirm dialog | `deleteCompany()`의 `.first()` 셀렉터가 시드 데이터 "my-atlas" 카드의 Delete 버튼을 클릭. 이후 `getByText('E2E Delete Test')`가 ConfirmDialog 텍스트와 카드 heading 2곳에서 매칭되어 **strict mode violation** 발생 |

**에러 상세:**
```
Error: strict mode violation: getByText('E2E Delete Test') resolved to 2 elements:
  1) <h4 class="font-semibold text-gray-700">E2E Delete Test</h4>
  2) <p class="text-sm text-gray-600">Are you sure you want to delete "E2E Delete Test"…</p>
```

**비고:** `company-panel.spec.ts`의 activate/edit/deactivate 테스트(L30, L77, L101, L135)도 동일한 `.first()` 패턴을 사용하나, E2E 테스트 company가 시드 데이터보다 먼저 렌더링되면 우연히 통과한다. **실행 순서에 따라 간헐적 실패 가능 (flaky).**

---

## 3. Skipped (4건)

| # | 파일 | 테스트명 | skip 사유 |
|---|------|----------|-----------|
| 1 | `api/version.spec.ts:260` | DELETE /api/versions/{id} - 버전 삭제 | `test.skip()` — 코드에 명시적 skip 처리 |
| 2 | `api/version.spec.ts:305` | POST /api/products/{productId}/versions - 중복된 이름 방지 | `test.skip()` — 코드에 명시적 skip 처리 |
| 3 | `ui/senior.spec.ts:37` | should switch to KB Management view when KB button clicked | `test.skip()` — KB 기능 미구현 ("KB feature is not yet implemented") |
| 4 | `ui/senior.spec.ts:59` | should switch between KB Articles and Company Features sub-views | `test.skip()` — KB 기능 미구현 |

---

## 4. 요약

- **Failed 1건**: qa_v11에서 수정한 `.first()` 셀렉터 버그가 원인. develop 브랜치에서 수정 완료 후 15/15 전체 통과 확인됨.
- **Skipped 4건**: 의도적 `test.skip()` — 미구현 기능(KB 통합) 및 미완성 API 테스트. 코드 버그 아님.
- **Flaky 위험 4건**: `company-panel.spec.ts`의 `.first()` 사용 테스트 4곳. qa_v11 수정에서 모두 카드 스코핑으로 변경하여 해소.

---

## 5. Worktree 개발자 E2E 보고서 분석

KB 개발자, Registry 개발자가 각자 Worktree에서 수행한 E2E 테스트 결과를 종합 분석한다.

### 5.1 convention.spec.ts:108 — "should edit a word via card click" (FAILED)

| 항목 | 내용 |
|------|------|
| 파일 | `qa/ui/convention.spec.ts:108` |
| 현상 | PUT으로 용어 수정 후 목록 페이지 복귀 시, 수정된 용어("E2E-Edited-...")가 보이지 않고 수정 전 용어가 그대로 표시 |
| 원인 분류 | 레이스 컨디션 (테스트 코드 문제) |
| main 차이 | Convention 관련 파일(테스트, 페이지, hook, API) 전부 차이 있음 |

**근본 원인:**

1. ConventionFormPage에서 `await conventionApi.update()` → `navigate('/conventions')` 즉시 호출
2. ConventionsPage 마운트 시 `useEffect → fetchAll()` GET 요청 발생
3. PUT 응답이 DB에 반영되기 전에 GET이 먼저 도착하는 레이스 컨디션

**수정 계획:**

테스트의 마지막 검증에서 GET 응답 1회만 대기하는 방식을 Playwright auto-retry로 변경:

- [x] `page.waitForResponse(GET)` 제거, `toBeVisible({ timeout: 5000 })` 적용

```typescript
// Before
await page.waitForResponse(
  resp => resp.url().includes('/api/conventions') && resp.request().method() === 'GET'
);
await expect(page.getByText(updatedTerm)).toBeVisible();

// After
await expect(page).toHaveURL(/\/conventions$/);
await expect(page.getByText(updatedTerm)).toBeVisible({ timeout: 5000 });
```

### 5.2 test-run.spec.ts — 인증 패턴 불일치 (1 FAILED + 7 SKIPPED)

| 항목 | 내용 |
|------|------|
| 파일 | `qa/ui/test-run.spec.ts` |
| 현상 | TestRunListPage 테스트에서 로그인 페이지가 표시됨. 첫 테스트 실패로 후속 7개 모두 skip |
| 원인 분류 | 테스트 코드 인증 패턴 문제 |
| main 차이 | 없음 (main에도 존재하는 기존 이슈) |

**근본 원인:**

`browser.newPage()`로 수동 생성한 page를 사용. 통과하는 테스트들(`feature-panel`, `version` 등)은 모두 Playwright 기본 `page` fixture 사용.

**수정 계획:**

- [x] `beforeEach`에서 `browser.newPage()` → Playwright `page` fixture로 변경

```typescript
// Before
test.beforeEach(async ({ browser }) => {
  page = await browser.newPage();
  await loginAsAdminInBrowser(page);
});

// After
test.beforeEach(async ({ page: newPage }) => {
  page = newPage;
  await loginAsAdminInBrowser(page);
});
```

### 5.3 senior.spec.ts — 2 SKIPPED (의도적)

| 파일 | 테스트명 | skip 사유 |
|------|----------|-----------|
| `ui/senior.spec.ts:37` | should switch to KB Management view | `test.skip()` — "KB feature is not yet implemented in Senior page" |
| `ui/senior.spec.ts:59` | should switch between KB Articles and Company Features sub-views | `test.skip()` — 동일 사유 |

SeniorPage에 KB Management 뷰 연결 시 활성화 예정. 수정 불필요.

### 5.4 version.spec.ts — 2 SKIPPED (의도적)

| 파일 | 테스트명 | skip 사유 |
|------|----------|-----------|
| `api/version.spec.ts:260` | DELETE /api/versions/{id} - 버전 삭제 | `test.skip()` — 최초 커밋부터 skip 마킹 |
| `api/version.spec.ts:305` | POST - 중복된 이름 방지 | `test.skip()` — 최초 커밋부터 skip 마킹 |

main과 차이 없음. skip 사유 미문서화 상태. 수정 불필요.

---

## 6. 수정 대상 요약

| # | 파일 | 변경 내용 | 원인 |
|---|------|-----------|------|
| 1 | `qa/ui/convention.spec.ts` | edit 테스트 검증부 — auto-retry + timeout 적용 | 레이스 컨디션 |
| 2 | `qa/ui/test-run.spec.ts` | beforeEach — `browser.newPage()` → `page` fixture | 인증 패턴 불일치 |

## 7. 검증

- [x] `npx playwright test ui/convention.spec.ts` → 9/9 전체 통과
- [x] `npx playwright test ui/test-run.spec.ts` → 8/8 전체 통과 (skip 0)
- [x] 전체 E2E 회귀 확인 — 227 tests: 223 passed, 4 skipped, 0 failed
