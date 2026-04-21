import { test, expect } from '@playwright/test';
import { FeaturesPage } from '../pages/features-page';
import {
  createTestCompany,
  createTestProduct,
  createTestSegment,
  createTestTestCase,
  cleanupAllTestData,
  loginAsAdminInBrowser,
} from '../helpers/api-helpers';

test.describe('Test Case Page', () => {
  let featuresPage: FeaturesPage;
  let companyId: number;
  let productId: number;

  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
    featuresPage = new FeaturesPage(page);

    const company = await createTestCompany('E2E TC Page Company');
    companyId = company.id;

    const product = await createTestProduct(companyId, 'E2E TC Page Product');
    productId = product.id;
  });

  test.afterEach(async () => {
    await cleanupAllTestData();
  });

  test('should display empty tree state with Root Path button', async () => {
    await featuresPage.gotoTestCases(companyId, productId);

    const isEmpty = await featuresPage.isEmptyTreeState();
    expect(isEmpty).toBe(true);
  });

  test('should display test cases created via API', async () => {
    const seg = await createTestSegment(productId, 'Main');
    await createTestTestCase(productId, 'API Created TC', [seg.id]);

    await featuresPage.gotoTestCases(companyId, productId);

    await expect(featuresPage.page.locator('h4:has-text("API Created TC")').first()).toBeVisible();
  });

  test('should show segments in tree view', async () => {
    const seg = await createTestSegment(productId, 'Main');
    await createTestSegment(productId, 'Login', seg.id);

    await featuresPage.gotoTestCases(companyId, productId);

    await expect(featuresPage.page.locator('.bg-white.border.rounded.p-2').locator('text=Main')).toBeVisible();
  });

  test('should delete a test case via confirm dialog', async () => {
    const seg = await createTestSegment(productId, 'Main');
    await createTestTestCase(productId, 'E2E Delete TC', [seg.id]);

    await featuresPage.gotoTestCases(companyId, productId);

    await expect(featuresPage.page.locator('h4:has-text("E2E Delete TC")').first()).toBeVisible();

    await featuresPage.deleteTestCase('E2E Delete TC');

    await expect(featuresPage.page.locator('h4:has-text("E2E Delete TC")')).not.toBeVisible();
  });

  test('should show path on test case card', async () => {
    const seg1 = await createTestSegment(productId, 'Main');
    const seg2 = await createTestSegment(productId, 'Login', seg1.id);
    await createTestTestCase(productId, 'TC With Path', [seg1.id, seg2.id]);

    await featuresPage.gotoTestCases(companyId, productId);

    // Path should be displayed as segment tree group heading (PathTreeGroup header)
    const pathHeading = featuresPage.page.locator('span.font-semibold', { hasText: 'Main > Login' });
    await expect(pathHeading).toBeVisible();
  });

  test('should select segment and add test case via modal', async () => {
    const seg = await createTestSegment(productId, 'Main');

    await featuresPage.gotoTestCases(companyId, productId);

    // Select segment in tree
    await featuresPage.selectSegmentInTree('Main');

    // Verify selected path is shown in the right panel breadcrumb
    const pathBreadcrumb = featuresPage.page.locator('.font-medium.text-indigo-700.truncate');
    await expect(pathBreadcrumb).toContainText('Main');

    // Add test case via modal - should use the selected path
    await featuresPage.addTestCase('TC With Selected Path');

    await expect(featuresPage.page.locator('h4:has-text("TC With Selected Path")').first()).toBeVisible();
  });

  test('should highlight selected segment node in tree', async ({ page }) => {
    const seg1 = await createTestSegment(productId, 'Main');
    const seg2 = await createTestSegment(productId, 'Login', seg1.id);

    await featuresPage.gotoTestCases(companyId, productId);

    // Click on "Login" node (child of Main)
    await featuresPage.selectSegmentInTree('Login');

    // Selected node (Login) should have indigo-100 background
    const loginNode = page
      .locator('.flex.items-center.gap-1.py-1.px-2.rounded')
      .filter({ hasText: 'Login' })
      .first();
    await expect(loginNode).toHaveClass(/bg-indigo-100/);

    // Ancestor node (Main) should have indigo-50 background
    const mainNode = page
      .locator('.flex.items-center.gap-1.py-1.px-2.rounded')
      .filter({ hasText: 'Main' })
      .first();
    await expect(mainNode).toHaveClass(/bg-indigo-50/);
  });

  test('should show priority color bar on test case cards', async ({ page }) => {
    const seg = await createTestSegment(productId, 'Main');
    await createTestTestCase(productId, 'E2E High Priority TC', [seg.id], 'HIGH');

    await featuresPage.gotoTestCases(companyId, productId);

    // Card with HIGH priority should have red left border
    const card = page
      .locator('.bg-white.border.rounded-lg')
      .filter({ hasText: 'E2E High Priority TC' })
      .first();
    await expect(card).toHaveClass(/border-l-red-400/);
  });

  test('should show action buttons only on card hover', async ({ page }) => {
    const seg = await createTestSegment(productId, 'Main');
    await createTestTestCase(productId, 'E2E Hover TC', [seg.id]);

    await featuresPage.gotoTestCases(companyId, productId);

    const card = page
      .locator('.bg-white.border.rounded-lg')
      .filter({ hasText: 'E2E Hover TC' })
      .first();

    // Buttons should be hidden by default (opacity-0)
    const buttonGroup = card.locator('.opacity-0');
    await expect(buttonGroup).toBeAttached();

    // Hover on card — buttons should become visible
    await card.hover();
    const visibleButtons = card.locator('.group-hover\\:opacity-100');
    await expect(visibleButtons).toBeAttached();
  });

  test('should show path breadcrumb placeholder when no path selected', async () => {
    await createTestSegment(productId, 'Main');

    await featuresPage.gotoTestCases(companyId, productId);

    // No path selected initially — should show placeholder
    const placeholder = featuresPage.page.getByText('Select a path from the tree');
    await expect(placeholder).toBeVisible();
  });
});
