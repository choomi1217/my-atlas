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

  test('should display empty tree state with Root Path button', async () => {
    await featuresPage.gotoTestCases(companyId, productId);

    const isEmpty = await featuresPage.isEmptyTreeState();
    expect(isEmpty).toBe(true);
  });

  test('should display test cases created via API', async () => {
    const seg = await createTestSegment(productId, 'Main');
    await createTestTestCase(productId, 'API Created TC', [seg.id]);

    await featuresPage.gotoTestCases(companyId, productId);

    const tcExists = await featuresPage.isTestCaseVisible('API Created TC');
    expect(tcExists).toBe(true);
  });

  test('should show segments in tree view', async () => {
    const seg = await createTestSegment(productId, 'Main');
    await createTestSegment(productId, 'Login', seg.id);

    await featuresPage.gotoTestCases(companyId, productId);

    const mainVisible = await featuresPage.isSegmentVisible('Main');
    expect(mainVisible).toBe(true);
  });

  test('should delete a test case via confirm dialog', async () => {
    const seg = await createTestSegment(productId, 'Main');
    await createTestTestCase(productId, 'E2E Delete TC', [seg.id]);

    await featuresPage.gotoTestCases(companyId, productId);

    let tcExists = await featuresPage.isTestCaseVisible('E2E Delete TC');
    expect(tcExists).toBe(true);

    await featuresPage.deleteTestCase('E2E Delete TC');

    tcExists = await featuresPage.isTestCaseVisible('E2E Delete TC');
    expect(tcExists).toBe(false);
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

  test('should select segment and add test case via modal', async () => {
    const seg = await createTestSegment(productId, 'Main');

    await featuresPage.gotoTestCases(companyId, productId);

    // Select segment in tree
    await featuresPage.selectSegmentInTree('Main');

    // Verify selected path is shown
    const selectedText = await featuresPage.page
      .getByText(/Selected: Main/)
      .isVisible();
    expect(selectedText).toBe(true);

    // Add test case via modal - should use the selected path
    await featuresPage.addTestCase('TC With Selected Path');

    const tcExists = await featuresPage.isTestCaseVisible('TC With Selected Path');
    expect(tcExists).toBe(true);
  });
});
