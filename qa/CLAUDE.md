# QA: Playwright E2E & API Tests

This file governs all QA testing. **Always reference this when writing E2E or API tests in `/qa`.**

---

## 🎯 Test Structure

### Directories

```
qa/
├── api/                 # API-only E2E tests (no UI)
│   ├── company.spec.ts
│   ├── product.spec.ts
│   ├── segment.spec.ts
│   └── ...
├── ui/                  # UI E2E tests (with Playwright browser)
│   ├── company-panel.spec.ts
│   ├── feature-panel.spec.ts
│   └── ...
├── helpers/             # Shared utilities
│   ├── api-helpers.ts   # API request helpers
│   └── ui-helpers.ts    # UI interaction helpers
├── test-results/        # Test execution reports (git-ignored)
├── playwright.config.ts # Playwright configuration
└── package.json
```

### Technology Stack

| Component | Tool |
|-----------|------|
| **Test Framework** | Playwright 1.40+ |
| **Language** | TypeScript |
| **Assertions** | Playwright's `expect()` |
| **Environment** | Node.js 18+ |

---

## 🚀 Running Tests

### All Tests

```bash
cd /Users/yeongmi/dev/qa/my-atlas/qa
npx playwright test
```

### API Tests Only

```bash
npx playwright test api/
```

### UI Tests Only

```bash
npx playwright test ui/
```

### Specific Test File

```bash
npx playwright test api/company.spec.ts
```

### With UI (Watch Mode)

```bash
npx playwright test --ui
```

### Debug Mode

```bash
npx playwright test --debug
```

---

## ⚠️ CRITICAL: Seed Data Protection

### ❌ NEVER Do This

- **Delete seed data companies in tests** — `my-atlas`, `Product Test Suite`, etc. are shared dev resources
- **Run unconditional cleanup on ALL companies** — only clean up E2E-created test data
- **Assume empty DB state** — dev DB contains seed data + manual test data from other developers

### ✅ Always Do This

- **Name test companies with "E2E" or "Test" prefix** — enables safe cleanup filtering
  ```ts
  const response = await request.post('/api/companies', {
    data: { name: 'E2E Test Corp' },  // ✅ GOOD
  });
  ```

- **Use `beforeAll` for E2E cleanup** — remove only test-named companies from previous runs
  ```ts
  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({ baseURL: API_URL });
    
    // Clean up only E2E test companies from previous runs
    const allCompanies = await request.get('/api/companies');
    const list = (await allCompanies.json() as any).data || [];
    for (const company of list) {
      if (company.name.includes('E2E') || company.name.includes('Test')) {
        await request.delete(`/api/companies/${company.id}`);
      }
    }
  });
  ```

- **Use `afterAll` for test-created resource cleanup**
  ```ts
  test.afterAll(async () => {
    // Delete only companies created IN THIS TEST
    if (companyId) {
      await request.delete(`/api/companies/${companyId}`).catch(() => {});
    }
  });
  ```

- **Test API structure, not empty state** — shared DB will have data
  ```ts
  // ✅ GOOD: Test the shape, not the count
  test('GET /api/companies - returns company list', async () => {
    const response = await request.get('/api/companies');
    expect(response.status()).toBe(200);
    const body = await response.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);  // ← shape, not length
  });

  // ❌ BAD: Assumes empty state
  test('GET /api/companies - returns empty array', async () => {
    // ... delete ALL companies ...
    expect(body.data.length).toBe(0);  // ← assumes empty
  });
  ```

---

## 📝 Test Writing Guidelines

### API Tests (`api/*.spec.ts`)

1. **Setup:** Use `test.beforeAll` to create request context and clean E2E-named companies
2. **Create:** Generate test data with "E2E" or "Test" in names
3. **Assert:** Validate API responses (status, body shape, content)
4. **Cleanup:** Use `test.afterAll` to delete only resources created in this test
5. **Isolation:** Each test should be independent; use variables to track IDs

**Example:**

```ts
import { test, expect, APIRequestContext } from '@playwright/test';

let request: APIRequestContext;
const API_URL = process.env.API_URL || 'http://localhost:8080';

test.beforeAll(async ({ playwright }) => {
  request = await playwright.request.newContext({ baseURL: API_URL });
  
  // Clean up only E2E test companies from previous runs
  const allCompanies = await request.get('/api/companies');
  const list = (await allCompanies.json() as any).data || [];
  for (const company of list) {
    if (company.name.includes('E2E') || company.name.includes('Test')) {
      await request.delete(`/api/companies/${company.id}`);
    }
  }
});

test.afterAll(async () => {
  await request.dispose();
});

test.describe('Company API', () => {
  let testCompanyId: number;

  test('POST /api/companies - create new company', async () => {
    const response = await request.post('/api/companies', {
      data: { name: 'E2E Test Corp' },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as any;
    expect(body.data.name).toBe('E2E Test Corp');
    testCompanyId = body.data.id;
  });

  test('GET /api/companies - includes created company', async () => {
    const response = await request.get('/api/companies');
    const body = await response.json() as any;
    const company = body.data.find((c: any) => c.id === testCompanyId);
    expect(company).toBeDefined();
  });

  test.afterAll(async () => {
    // Cleanup: delete ONLY the company created in this test
    if (testCompanyId) {
      await request.delete(`/api/companies/${testCompanyId}`).catch(() => {});
    }
  });
});
```

### UI Tests (`ui/*.spec.ts`)

1. **Setup:** `test.beforeEach` navigates to page; `test.beforeAll` cleans E2E companies
2. **Interact:** Use Playwright selectors (`page.click()`, `page.fill()`, etc.)
3. **Assert:** Verify UI state (visibility, text, classes)
4. **Cleanup:** Use `test.afterEach` with `cleanupAllTestData()` helper to remove test companies

**Example:**

```ts
import { test, expect, Page } from '@playwright/test';
import { cleanupAllTestData } from '../helpers/api-helpers';

test.describe('Company Panel UI', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Clean up only E2E test companies from previous runs
    await cleanupAllTestData();
  });

  test.beforeEach(async ({ page: newPage }) => {
    page = newPage;
    await page.goto('http://localhost:5173/features');
  });

  test('should create company via form', async () => {
    await page.click('button:has-text("Add New")');
    await page.fill('input[placeholder="Company name"]', 'E2E Test Company');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=E2E Test Company')).toBeVisible();
  });

  test.afterEach(async () => {
    // Remove only E2E/Test-named companies
    await cleanupAllTestData();
  });
});
```

---

## 🔧 Helper Functions

### API Helpers (`qa/helpers/api-helpers.ts`)

```ts
// Get all companies
export async function getAllCompanies(): Promise<Company[]> {
  // Implementation
}

// Create E2E-named company
export async function createTestCompany(name: string = 'E2E Test'): Promise<Company> {
  // Implementation
}

// Delete company by ID
export async function deleteCompany(id: number): Promise<void> {
  // Implementation
}

// Clean up ALL E2E/Test-named companies
export async function cleanupAllTestData(): Promise<void> {
  const companies = await getAllCompanies();
  for (const company of companies) {
    if (company.name.includes('E2E') || company.name.includes('Test')) {
      await deleteCompany(company.id);
    }
  }
}
```

Use these helpers to avoid code duplication and ensure consistent cleanup behavior.

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

## 🔍 Assertions Best Practices

### API Response Assertions

```ts
// Check structure
expect(response.status()).toBe(200);
expect(response.headers()['content-type']).toContain('application/json');

// Check body
const body = await response.json() as any;
expect(body.success).toBe(true);
expect(body.data).toBeDefined();
expect(Array.isArray(body.data)).toBe(true);

// Check specific fields
expect(body.data[0].name).toEqual('E2E Test Corp');
expect(body.data[0].id).toBeGreaterThan(0);
```

### UI Assertions

```ts
// Visibility
await expect(page.locator('text=Company Name')).toBeVisible();
await expect(page.locator('button')).toHaveCount(3);

// State
await expect(page.locator('input[name="company"]')).toHaveValue('My Company');
await expect(page.locator('.error')).toHaveText('Required field');

// Not present
await expect(page.locator('.modal')).not.toBeVisible();
```

---

## 🐛 Debugging Tests

### View Test Output

```bash
npx playwright test --reporter=html
# Opens HTML report with full logs and screenshots
```

### Debug a Single Test

```bash
npx playwright test api/company.spec.ts --debug
# Launches Playwright Inspector — step through test line by line
```

### Slow Motion (Debug)

```bash
npx playwright test --headed --slow-mo=1000
# Runs in browser with 1s delay between actions
```

### Print Debug Info

```ts
test('example', async ({ page }) => {
  console.log('Current URL:', page.url());
  console.log('Response:', await response.json());
});
// View in console output after test runs
```

---

## 📋 Pre-Commit Checklist

Before pushing E2E test changes:

- ✅ All test companies named with "E2E" or "Test"
- ✅ `beforeAll` cleanup removes only E2E-named companies
- ✅ `afterAll` removes only resources created in this test
- ✅ Tests do NOT delete `my-atlas` or other seed companies
- ✅ Tests run locally: `npx playwright test`
- ✅ No hardcoded wait times — use `waitFor()` instead of `sleep()`
- ✅ No flaky assertions on text that may change

---

## 🚨 Common Pitfalls

### ❌ Deleting All Companies
```ts
// BAD: Deletes seed data
const companies = await request.get('/api/companies');
for (const company of (await companies.json()).data) {
  await request.delete(`/api/companies/${company.id}`);  // Deletes my-atlas!
}
```

### ✅ Filtered Cleanup
```ts
// GOOD: Only deletes E2E/Test companies
const companies = await request.get('/api/companies');
for (const company of (await companies.json()).data) {
  if (company.name.includes('E2E') || company.name.includes('Test')) {
    await request.delete(`/api/companies/${company.id}`);
  }
}
```

### ❌ Assuming Empty State
```ts
// BAD: Fails if any data exists
expect(body.data.length).toBe(0);
```

### ✅ Testing Structure
```ts
// GOOD: Works with any data
expect(Array.isArray(body.data)).toBe(true);
```

### ❌ Hardcoded Waits
```ts
// BAD: Flaky and slow
await page.waitForTimeout(2000);
```

### ✅ Condition-Based Waits
```ts
// GOOD: Fast and reliable
await expect(page.locator('.modal')).toBeVisible();
```

---

## 📚 Further Reading

- Playwright docs: https://playwright.dev
- Testing best practices: https://playwright.dev/docs/best-practices
- Root project context: `/my-atlas/CLAUDE.md`
