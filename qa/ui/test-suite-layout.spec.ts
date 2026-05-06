import { test, expect } from '@playwright/test';
import {
  cleanupAllTestData,
  createTestCompany,
  activateCompany,
  createTestProduct,
  loginAsAdminInBrowser,
} from '../helpers/api-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Test Suite 페이지 레이아웃 (PR-A)', () => {
  let companyId: number;
  let productId: number;

  test.beforeAll(async () => {
    await cleanupAllTestData();
    const company = await createTestCompany('E2E Layout Test Co');
    companyId = company.id;
    await activateCompany(companyId);
    const product = await createTestProduct(companyId, 'E2E Layout Test Product');
    productId = product.id;
  });

  test.afterAll(async () => {
    await cleanupAllTestData();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
  });

  test('CompanyListPage 진입 시 자기 참조 Breadcrumb 가 노출되지 않는다', async ({ page }) => {
    await page.goto(`${BASE_URL}/features`);

    // Companies 타이틀은 정상 노출
    await expect(page.locator('h1', { hasText: 'Companies' })).toBeVisible();

    // company-list-container testid 적용 확인
    await expect(page.locator('[data-testid="company-list-container"]')).toBeVisible();

    // Breadcrumb 요소가 없어야 함 — Companies 타이틀 위에 "Product Test Suite" 헤더가 잔존하지 않음
    const breadcrumbNav = page.locator('nav.bg-gray-100').filter({ hasText: 'Product Test Suite' });
    await expect(breadcrumbNav).toHaveCount(0);
  });

  test('TestCasePage 진입 시 Breadcrumb 외 별도의 큰 헤더가 없다', async ({ page }) => {
    await page.goto(`${BASE_URL}/features/companies/${companyId}/products/${productId}`);

    // tc-page-container testid 적용 확인
    await expect(page.locator('[data-testid="tc-page-container"]')).toBeVisible();

    // Breadcrumb 은 정상 노출 (product 컨텍스트 포함)
    const breadcrumb = page.locator('nav.bg-gray-100');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText('Product Test Suite');
    await expect(breadcrumb).toContainText('E2E Layout Test Product');

    // 본문 영역에 product.name 을 가진 <h1> 가 더 이상 존재하지 않음
    const h1Elements = page.locator('h1', { hasText: 'E2E Layout Test Product' });
    await expect(h1Elements).toHaveCount(0);

    // 기존 큰 헤더 클래스(text-3xl font-bold) 의 <h1> 자체가 페이지에 없어야 함
    await expect(page.locator('h1.text-3xl')).toHaveCount(0);
  });

  test('TestCasePage 컨테이너에 max-w-7xl 클래스가 적용되어 있다', async ({ page }) => {
    await page.goto(`${BASE_URL}/features/companies/${companyId}/products/${productId}`);

    const container = page.locator('[data-testid="tc-page-container"]');
    await expect(container).toBeVisible();

    // 내부 max-w-7xl wrapper 가 존재하는지 확인
    const innerWrapper = container.locator('.max-w-7xl');
    await expect(innerWrapper).toBeVisible();
  });
});
