import { test, expect } from '@playwright/test';
import { FeaturesPage } from '../pages/features-page';
import {
  createTestCompany,
  deleteCompany,
  cleanupAllTestData,
} from '../helpers/api-helpers';

test.describe('Features Page - Product Panel', () => {
  let featuresPage: FeaturesPage;
  let companyId: number;
  let companyName: string;

  test.beforeEach(async ({ page }) => {
    featuresPage = new FeaturesPage(page);

    // Create test data via API FIRST, before navigating to the page
    const company = await createTestCompany('E2E Product Panel Company');
    companyId = company.id;
    companyName = company.name;

    // Then navigate so the page loads with data already in DB
    await featuresPage.goto();

    // Select the company
    await featuresPage.selectCompany(companyName);
  });

  test.afterEach(async () => {
    await cleanupAllTestData();
  });

  test('should enable Product panel after company is selected', async ({ page }) => {
    const productNameInput = featuresPage.productNameInput;
    const platformSelect = featuresPage.productPlatformSelect;

    await expect(productNameInput).toBeEnabled();
    await expect(platformSelect).toBeEnabled();
  });

  test('should add a WEB product', async () => {
    const productName = 'E2E Web Product';
    await featuresPage.addProduct(productName, 'WEB', 'Test web product');

    const productExists = await featuresPage.productList.getByText(productName).isVisible();
    expect(productExists).toBe(true);

    // Check for platform badge (exact match to avoid matching "Web" in product name)
    const webBadge = await featuresPage.productPanel
      .locator(`text=${productName}`)
      .locator('xpath=..')
      .getByText('WEB', { exact: true })
      .isVisible();
    expect(webBadge).toBe(true);
  });

  test('should add a MOBILE product', async () => {
    const productName = 'E2E Mobile Product';
    await featuresPage.addProduct(productName, 'MOBILE', 'Test mobile product');

    const productExists = await featuresPage.productList.getByText(productName).isVisible();
    expect(productExists).toBe(true);

    const mobileBadge = await featuresPage.productPanel
      .locator(`text=${productName}`)
      .locator('xpath=..')
      .getByText('MOBILE', { exact: true })
      .isVisible();
    expect(mobileBadge).toBe(true);
  });

  test('should display both products after adding two products', async () => {
    const productName1 = 'E2E Product 1';
    const productName2 = 'E2E Product 2';

    await featuresPage.addProduct(productName1, 'WEB');
    await featuresPage.addProduct(productName2, 'MOBILE');

    const product1Exists = await featuresPage.productList.getByText(productName1).isVisible();
    const product2Exists = await featuresPage.productList.getByText(productName2).isVisible();

    expect(product1Exists).toBe(true);
    expect(product2Exists).toBe(true);
  });

  test('should highlight selected product with blue border', async () => {
    const productName = 'E2E Select Product';
    await featuresPage.addProduct(productName, 'WEB');

    await featuresPage.selectProduct(productName);

    const selectedProduct = featuresPage.productPanel.locator(`text=${productName}`).locator('xpath=..');
    const borderClass = await selectedProduct.getAttribute('class');

    expect(borderClass).toContain('border-blue-600');
  });

  test('should delete product when confirmed', async () => {
    const productName = 'E2E Delete Product';
    await featuresPage.addProduct(productName, 'WEB');

    // Verify product exists
    let productExists = await featuresPage.productList.getByText(productName).isVisible();
    expect(productExists).toBe(true);

    await featuresPage.deleteProduct(productName);

    // Verify product is removed
    productExists = await featuresPage.productList.getByText(productName).isVisible();
    expect(productExists).toBe(false);
  });

  test('should show placeholder when no product is selected', async ({ page }) => {
    // Add a product but don't select it
    const productName = 'E2E Product No Select';
    await featuresPage.addProduct(productName, 'WEB');

    // Create another company (without products) and reload page to load it
    const company2 = await createTestCompany('E2E Product Panel Company 2');
    await featuresPage.goto();  // Reload to fetch new company from API
    await featuresPage.selectCompany(company2.name);

    const isEmpty = await featuresPage.isFeaturePanelEmpty();
    expect(isEmpty).toBe(true);

    // Cleanup
    await deleteCompany(company2.id);
  });
});
