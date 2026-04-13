import { test, expect } from '@playwright/test';
import { FeaturesPage } from '../pages/features-page';
import {
  createTestCompany,
  createTestProduct,
  cleanupAllTestData,
  loginAsAdminInBrowser,
} from '../helpers/api-helpers';

test.describe('Product List Page', () => {
  let featuresPage: FeaturesPage;
  let companyId: number;

  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
    featuresPage = new FeaturesPage(page);

    const company = await createTestCompany('E2E Product Page Company');
    companyId = company.id;
  });

  test.afterEach(async () => {
    await cleanupAllTestData();
  });

  test('should show search bar, sort dropdown, and Add New card', async ({ page }) => {
    await featuresPage.gotoCompany(companyId);

    await expect(page.locator('input[placeholder="Search products..."]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
    await expect(page.locator('text=Add New').first()).toBeVisible();
  });

  test('should add a WEB product via modal', async ({ page }) => {
    await featuresPage.gotoCompany(companyId);

    const productName = 'E2E Web Product';
    await featuresPage.addProduct(productName);

    const productExists = await page.getByText(productName).isVisible();
    expect(productExists).toBe(true);

    // Check for platform badge
    const webBadge = await page.locator('span').filter({ hasText: 'WEB' }).first().isVisible();
    expect(webBadge).toBe(true);
  });

  test('should display products created via API', async ({ page }) => {
    await createTestProduct(companyId, 'API Product 1', 'WEB');
    await createTestProduct(companyId, 'API Product 2', 'MOBILE');

    await featuresPage.gotoCompany(companyId);

    const p1 = await page.getByText('API Product 1').isVisible();
    const p2 = await page.getByText('API Product 2').isVisible();
    expect(p1).toBe(true);
    expect(p2).toBe(true);
  });

  test('should delete product via confirm dialog', async ({ page }) => {
    await createTestProduct(companyId, 'E2E Delete Product');

    await featuresPage.gotoCompany(companyId);

    let productExists = await page.getByText('E2E Delete Product').isVisible();
    expect(productExists).toBe(true);

    await featuresPage.deleteProduct('E2E Delete Product');

    productExists = await page.getByText('E2E Delete Product').isVisible();
    expect(productExists).toBe(false);
  });

  test('should navigate to test cases on product click', async ({ page }) => {
    await createTestProduct(companyId, 'E2E Navigate Product');

    await featuresPage.gotoCompany(companyId);

    await page.getByText('E2E Navigate Product').click();
    await page.waitForLoadState('networkidle');

    // Should be on test case page
    await expect(page.locator('h1').filter({ hasText: 'E2E Navigate Product' })).toBeVisible();
    await expect(page.locator('p.text-gray-600').filter({ hasText: 'Test Cases' })).toBeVisible();
  });

  test('should show empty state when no products exist', async ({ page }) => {
    await featuresPage.gotoCompany(companyId);

    const emptyText = await page.getByText(/No products yet/).isVisible();
    expect(emptyText).toBe(true);
  });
});
