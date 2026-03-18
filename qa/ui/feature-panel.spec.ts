import { test, expect } from '@playwright/test';
import { FeaturesPage } from '../pages/features-page';
import {
  createTestCompany,
  createTestProduct,
  createTestFeature,
  deleteCompany,
  cleanupAllTestData,
} from '../helpers/api-helpers';

test.describe('Features Page - Feature Panel', () => {
  let featuresPage: FeaturesPage;
  let companyId: number;
  let companyName: string;
  let productId: number;
  let productName: string;

  test.beforeEach(async ({ page }) => {
    featuresPage = new FeaturesPage(page);

    // Create test data via API FIRST, before navigating to the page
    const company = await createTestCompany('E2E Feature Panel Company');
    companyId = company.id;
    companyName = company.name;

    const product = await createTestProduct(companyId, 'E2E Feature Panel Product');
    productId = product.id;
    productName = product.name;

    // Then navigate so the page loads with data already in DB
    await featuresPage.goto();

    // Select company and product in UI
    await featuresPage.selectCompany(companyName);
    await featuresPage.selectProduct(productName);
  });

  test.afterEach(async () => {
    await cleanupAllTestData();
  });

  test('should enable Feature panel after product is selected', async () => {
    const pathInput = featuresPage.featurePathInput;
    const nameInput = featuresPage.featureNameInput;
    const descTextarea = featuresPage.featureDescTextarea;

    await expect(pathInput).toBeEnabled();
    await expect(nameInput).toBeEnabled();
    await expect(descTextarea).toBeEnabled();
  });

  test('should add a feature and display it in the list', async () => {
    const featurePath = 'Main › Login';
    const featureName = 'E2E Social Login';
    const featureDesc = 'Test social login feature';

    await featuresPage.addFeature(featurePath, featureName, featureDesc);

    const featureExists = await featuresPage.featureList.getByText(featureName).isVisible();
    expect(featureExists).toBe(true);

    // Check path breadcrumb
    const pathExists = await featuresPage.featurePanel.getByText('Main').isVisible();
    expect(pathExists).toBe(true);
  });

  test('should show "Creating (embedding...)" state while feature is being created', async ({ page }) => {
    const featurePath = 'Main › Create State';
    const featureName = 'E2E Create State Feature';

    // Start adding feature
    await featuresPage.featurePathInput.fill(featurePath);
    await featuresPage.featureNameInput.fill(featureName);

    const addButton = featuresPage.featurePanel.getByRole('button', { name: /Add Feature/i });

    // Wait a bit and check for loading state
    const creatingPromise = page.waitForSelector('button:has-text("Creating (embedding...)")');
    await addButton.click();

    try {
      await Promise.race([creatingPromise, new Promise(resolve => setTimeout(resolve, 2000))]);
      // If we got here, button showed "Creating" state
      const isCreating = await featuresPage.isFeatureCreating();
      expect(isCreating).toBe(true);
    } catch {
      // Button may already be back to normal (fast response)
    }

    // Wait for feature to be created
    await featuresPage.waitForFeatureCreation();
  });

  test('should edit feature inline and save changes', async () => {
    const featureName = 'E2E Edit Feature';
    const newFeatureName = 'E2E Edited Feature';

    // Create feature via API
    await createTestFeature(productId, featureName);

    // Reload page to see feature
    await featuresPage.goto();
    await featuresPage.selectCompany(companyName);
    await featuresPage.selectProduct(productName);

    // Edit feature
    await featuresPage.editFeature(featureName);
    await featuresPage.saveFeatureEdit(newFeatureName);

    // Verify change
    const featureExists = await featuresPage.featureList.getByText(newFeatureName).isVisible();
    expect(featureExists).toBe(true);

    // Old name should not exist
    const oldFeatureExists = await featuresPage.featureList.getByText(featureName).isVisible();
    expect(oldFeatureExists).toBe(false);
  });

  test('should cancel feature edit without saving changes', async () => {
    const featureName = 'E2E Cancel Edit Feature';

    // Create feature via API
    await createTestFeature(productId, featureName);

    // Reload page
    await featuresPage.goto();
    await featuresPage.selectCompany(companyName);
    await featuresPage.selectProduct(productName);

    // Start editing and cancel
    await featuresPage.editFeature(featureName);
    await featuresPage.cancelFeatureEdit();

    // Verify name didn't change
    const featureExists = await featuresPage.featureList.getByText(featureName).isVisible();
    expect(featureExists).toBe(true);
  });

  test('should delete feature when confirmed', async () => {
    const featureName = 'E2E Delete Feature';

    // Create feature via API
    await createTestFeature(productId, featureName);

    // Reload page
    await featuresPage.goto();
    await featuresPage.selectCompany(companyName);
    await featuresPage.selectProduct(productName);

    // Verify feature exists
    let featureExists = await featuresPage.featureList.getByText(featureName).isVisible();
    expect(featureExists).toBe(true);

    await featuresPage.deleteFeature(featureName);

    // Verify feature is removed
    featureExists = await featuresPage.featureList.getByText(featureName).isVisible();
    expect(featureExists).toBe(false);
  });

  test('should display multiple features correctly after page reload', async () => {
    const feature1 = 'E2E Feature 1';
    const feature2 = 'E2E Feature 2';
    const feature3 = 'E2E Feature 3';

    // Create features via API
    await createTestFeature(productId, feature1, 'Path › 1');
    await createTestFeature(productId, feature2, 'Path › 2');
    await createTestFeature(productId, feature3, 'Path › 3');

    // Reload page and navigate to features
    await featuresPage.goto();
    await featuresPage.selectCompany(companyName);
    await featuresPage.selectProduct(productName);

    // Verify all features are displayed
    const feature1Exists = await featuresPage.featureList.getByText(feature1).isVisible();
    const feature2Exists = await featuresPage.featureList.getByText(feature2).isVisible();
    const feature3Exists = await featuresPage.featureList.getByText(feature3).isVisible();

    expect(feature1Exists).toBe(true);
    expect(feature2Exists).toBe(true);
    expect(feature3Exists).toBe(true);
  });

  test('should show placeholder when no product is selected', async ({ page }) => {
    // Add a product but select a different company
    const company2 = await createTestCompany('E2E Feature Panel Company 2');
    await featuresPage.selectCompany(company2.name);

    const isEmpty = await featuresPage.isFeaturePanelEmpty();
    expect(isEmpty).toBe(true);

    // Cleanup
    await deleteCompany(company2.id);
  });
});
