import { test, expect } from '@playwright/test';
import {
  cleanupAllTestData,
  createTestCompany,
  activateCompany,
  createTestProduct,
  loginAsAdminInBrowser,
} from '../helpers/api-helpers';
import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:8080';

test.describe('TestCase 카드 가독성 (PR-B — DL 패턴)', () => {
  let companyId: number;
  let productId: number;
  let token: string;

  test.beforeAll(async () => {
    await cleanupAllTestData();
    const company = await createTestCompany('E2E TC Card Co');
    companyId = company.id;
    await activateCompany(companyId);
    const product = await createTestProduct(companyId, 'E2E TC Card Product');
    productId = product.id;

    // 로그인 토큰 확보 후 segment + testcase 직접 생성
    const login = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin',
    });
    token = login.data.data.token;

    const segRes = await axios.post(
      `${API_URL}/api/segments`,
      { name: 'E2E Login Flow', productId, parentId: null },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const segmentId = segRes.data.data.id;

    await axios.post(
      `${API_URL}/api/test-cases`,
      {
        productId,
        path: [segmentId],
        title: 'E2E Login Flow Test Case',
        description: 'Verify login redirects to dashboard',
        preconditions: 'User has registered account',
        steps: [
          { order: 0, action: 'Navigate to /login', expected: 'Login form visible' },
          { order: 1, action: 'Enter credentials', expected: 'Submit button enabled' },
          { order: 2, action: 'Click Submit', expected: 'Redirected' },
        ],
        expectedResults: [
          'User lands on /dashboard with active session',
          'Session token is stored in cookie',
        ],
        priority: 'HIGH',
        testType: 'FUNCTIONAL',
        status: 'ACTIVE',
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  });

  test.afterAll(async () => {
    await cleanupAllTestData();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
    await page.goto(`${BASE_URL}/features/companies/${companyId}/products/${productId}`);
    // 첫 TC 카드 펼치기
    const card = page.locator('[data-testid="tc-card"]').first();
    await card.locator('header').click();
  });

  test('펼친 카드의 Body 가 <dl>/<dt>/<dd> 시맨틱 태그로 구성된다', async ({ page }) => {
    const card = page.locator('[data-testid="tc-card"]').first();
    const body = card.locator('[data-testid="tc-body"]');
    await expect(body).toBeVisible();

    const dl = body.locator('dl');
    await expect(dl).toBeVisible();
    await expect(dl.locator('dt', { hasText: 'Description' })).toBeVisible();
    await expect(dl.locator('dt', { hasText: 'Preconditions' })).toBeVisible();
  });

  test('Steps 영역이 표 형식 grid (3열) 로 렌더된다', async ({ page }) => {
    const stepRow = page.locator('[data-testid="tc-step-row"]').first();
    await expect(stepRow).toBeVisible();
    await expect(stepRow).toHaveCSS('display', 'grid');
    // Action / Step Expected 라벨 확인
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

    // green accent 클래스 확인
    const className = await finalExpected.getAttribute('class');
    expect(className).toContain('border-green-600');
    expect(className).toContain('bg-green-50');

    // "Final Expected Result" 라벨
    await expect(finalExpected.locator('text=Final Expected Result')).toBeVisible();
  });

  test('Header zone 에 Created 일자가 노출되며 Body 영역에는 없다', async ({ page }) => {
    const card = page.locator('[data-testid="tc-card"]').first();
    const header = card.locator('header');
    await expect(header.locator('text=/Created:/')).toBeVisible();

    // Body 안에는 Created 가 없어야 함 (Header 로 이동)
    const body = card.locator('[data-testid="tc-body"]');
    await expect(body.locator('text=/Created:/')).toHaveCount(0);
  });

  test('Final Expected Result 가 다중 항목일 때 ol > li 형태로 모두 노출된다', async ({ page }) => {
    const card = page.locator('[data-testid="tc-card"]').first();
    const list = card.locator('[data-testid="tc-final-expected-list"]');
    const items = card.locator('[data-testid="tc-final-expected-item"]');

    // ol 태그 검증
    await expect(list).toBeVisible();
    expect(await list.evaluate((el) => el.tagName)).toBe('OL');

    // beforeAll 에서 expectedResults 2 개를 입력했으므로 2 개 항목 노출
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('User lands on /dashboard with active session');
    await expect(items.nth(1)).toContainText('Session token is stored in cookie');
  });
});
