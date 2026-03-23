import { test, expect } from '@playwright/test';
import { FeaturesPage } from '../pages/features-page';
import {
  createTestCompany,
  createTestProduct,
  createTestSegment,
  createTestTestCase,
  cleanupAllTestData,
} from '../helpers/api-helpers';

test.describe('Test Case Page', () => {
  let featuresPage: FeaturesPage;
  let companyId: number;
  let productId: number;

  test.beforeEach(async ({ page }) => {
    featuresPage = new FeaturesPage(page);

    const company = await createTestCompany('E2E TC Page Company');
    companyId = company.id;

    const product = await createTestProduct(companyId, 'E2E TC Page Product');
    productId = product.id;
  });

  test.afterEach(async () => {
    await cleanupAllTestData();
  });

  test('should display empty test case list', async () => {
    await featuresPage.gotoTestCases(companyId, productId);

    const emptyText = await featuresPage.page
      .getByText(/No test cases yet/)
      .isVisible();
    expect(emptyText).toBe(true);
  });

  test('should add a test case and display it', async () => {
    await featuresPage.gotoTestCases(companyId, productId);

    await featuresPage.addTestCase('E2E New Test Case');

    const tcExists = await featuresPage.isTestCaseVisible('E2E New Test Case');
    expect(tcExists).toBe(true);
  });

  test('should display test cases created via API', async () => {
    const seg = await createTestSegment(productId, 'Main');
    await createTestTestCase(productId, 'API Created TC', [seg.id]);

    await featuresPage.gotoTestCases(companyId, productId);

    const tcExists = await featuresPage.isTestCaseVisible('API Created TC');
    expect(tcExists).toBe(true);
  });

  test('should delete a test case', async () => {
    await createTestTestCase(productId, 'E2E Delete TC');

    await featuresPage.gotoTestCases(companyId, productId);

    let tcExists = await featuresPage.isTestCaseVisible('E2E Delete TC');
    expect(tcExists).toBe(true);

    await featuresPage.deleteTestCase('E2E Delete TC');

    tcExists = await featuresPage.isTestCaseVisible('E2E Delete TC');
    expect(tcExists).toBe(false);
  });

  test('should toggle between input and tree view', async () => {
    await createTestSegment(productId, 'Main');

    await featuresPage.gotoTestCases(companyId, productId);

    // Default is input view
    await featuresPage.switchToTreeView();

    // Tree view should show segments
    const treeVisible = await featuresPage.page
      .locator('text=Main')
      .isVisible();
    expect(treeVisible).toBe(true);

    // Switch back to input view
    await featuresPage.switchToInputView();
  });

  test('should show path on test case card', async () => {
    const seg1 = await createTestSegment(productId, 'Main');
    const seg2 = await createTestSegment(productId, 'Login', seg1.id);
    await createTestTestCase(productId, 'TC With Path', [seg1.id, seg2.id]);

    await featuresPage.gotoTestCases(companyId, productId);

    // Path should be displayed on card
    const pathText = await featuresPage.page
      .locator('text=Main > Login')
      .isVisible();
    expect(pathText).toBe(true);
  });
});
