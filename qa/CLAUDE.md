# QA: Playwright E2E & API Tests

This file governs all QA testing. **Always reference this when writing E2E or API tests in `/qa`.**

> 디렉토리 구조·설치된 패키지·실행 명령은 레포 트리와 `package.json` / `playwright.config.ts`가 소유한다.
> 여기에는 **규칙과 함정**만 둔다.

---

## ⚠️ CRITICAL: Seed Data Protection

공유 dev DB를 사용하므로, 테스트가 seed 데이터를 지우면 다른 개발자 작업까지 파괴된다.

### ❌ NEVER Do This

- **Delete seed data companies in tests** — `my-atlas`, `Product Test Suite` 등은 공유 dev 리소스
- **Run unconditional cleanup on ALL companies** — E2E가 만든 데이터만 정리할 것
- **Assume empty DB state** — dev DB에는 seed 데이터 + 다른 개발자의 수동 테스트 데이터가 있다

### ✅ Always Do This

- **테스트 회사명에 "E2E" 또는 "Test" 접두어를 넣는다** — 안전한 cleanup 필터링이 가능해진다
  ```ts
  data: { name: 'E2E Test Corp' }   // ✅
  ```
- **`beforeAll` cleanup은 E2E/Test 이름을 가진 것만 삭제한다** (이전 실행 잔여물 정리)
- **`afterAll`은 이 테스트가 생성한 리소스만 삭제한다** — id를 변수로 추적
- **빈 상태가 아니라 구조를 검증한다** — 공유 DB에는 항상 데이터가 있다
  ```ts
  expect(Array.isArray(body.data)).toBe(true);  // ✅ shape
  expect(body.data.length).toBe(0);             // ❌ empty state 가정
  ```

---

## 🔧 Helper Functions

공용 헬퍼는 `qa/helpers/api-helpers.ts`에 있다. **새 헬퍼를 만들기 전에 이 파일을 먼저 읽을 것** —
company/product/segment/version/testcase 생성·조회·삭제와 `cleanupAllTestData()`가 이미 존재한다.

- **E2E는 인증이 필요하다.** `loginAsAdmin()`, `loginAs()`, `registerUser()`,
  `loginAsAdminInBrowser(page)`, `clearAuthToken()`을 사용한다 — 직접 토큰을 다루지 말 것.
- 중복 구현 금지, cleanup 동작 일관성 유지.

---

## 📝 Test Writing Guidelines

### API Tests (`api/*.spec.ts`)
1. **Setup:** `test.beforeAll`에서 request context 생성 + E2E 이름 회사 정리
2. **Create:** 테스트 데이터 이름에 "E2E" 또는 "Test" 포함
3. **Assert:** status / body shape / content 검증
4. **Cleanup:** `test.afterAll`에서 이 테스트가 만든 리소스만 삭제
5. **Isolation:** 각 테스트는 독립적으로, id는 변수로 추적

### UI Tests (`ui/*.spec.ts`)
1. **Setup:** `test.beforeAll`에서 E2E 회사 정리, `test.beforeEach`에서 페이지 이동
2. **Interact:** Playwright 셀렉터 사용
3. **Assert:** 가시성·텍스트·상태 검증
4. **Cleanup:** `test.afterEach`에서 `cleanupAllTestData()`

**셀렉터 규칙:** 추측으로 HTML 태그를 쓰지 않는다 — 대상 TSX 파일을 읽고 실제 DOM
(태그, className, `data-testid`)을 확인한 뒤 셀렉터를 작성한다.

---

## 🎯 Test Naming Conventions

| Category | Format | Example |
|----------|--------|---------|
| **API test file** | `{domain}.spec.ts` | `company.spec.ts`, `product.spec.ts` |
| **UI test file** | `{feature}-panel.spec.ts` | `company-panel.spec.ts`, `feature-panel.spec.ts` |
| **Test suite** | `test.describe('{API/Feature} {Function}')` | `'Company API'`, `'Company Panel UI'` |
| **Test case** | `test('{HTTP method} {endpoint} - {assertion}')` | `'POST /api/companies - creates company'` |
| **Test company** | Include "E2E" or "Test" | `'E2E Test Corp'`, `'Test Company A'` |

---

## 📋 Pre-Commit Checklist

Before pushing E2E test changes:

- ✅ All test companies named with "E2E" or "Test"
- ✅ `beforeAll` cleanup removes only E2E-named companies
- ✅ `afterAll` removes only resources created in this test
- ✅ Tests do NOT delete `my-atlas` or other seed companies
- ✅ Tests run locally: `npx playwright test`
- ✅ No hardcoded wait times — use `waitFor()` / `expect().toBeVisible()` instead of `waitForTimeout()`
- ✅ No flaky assertions on text that may change

---

## 🚨 Common Pitfalls

| ❌ | ✅ |
|----|----|
| 조회한 전체 company를 순회 삭제 (seed `my-atlas`까지 삭제됨) | 이름에 "E2E"/"Test" 포함된 것만 필터링 삭제 |
| `expect(body.data.length).toBe(0)` — 빈 상태 가정 | `expect(Array.isArray(body.data)).toBe(true)` — 구조 검증 |
| `await page.waitForTimeout(2000)` — flaky, 느림 | `await expect(locator).toBeVisible()` — 조건 기반 대기 |
| 추측으로 만든 셀렉터 | TSX를 읽고 확인한 실제 DOM 기반 셀렉터 |

---

## 📚 Further Reading

- Playwright docs: https://playwright.dev
- Testing best practices: https://playwright.dev/docs/best-practices
- Root project context: `/my-atlas/CLAUDE.md`
