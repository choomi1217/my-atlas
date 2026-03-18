import { test, expect } from '@playwright/test';
import { FeaturesPage } from '../pages/features-page';
import { cleanupAllTestData } from '../helpers/api-helpers';

test.describe('Features Page - Company Panel', () => {
  let featuresPage: FeaturesPage;

  test.beforeEach(async ({ page }) => {
    featuresPage = new FeaturesPage(page);
    await featuresPage.goto();
  });

  test.afterEach(async () => {
    // Clean up all test data
    await cleanupAllTestData();
  });

  test('should display three panels on page load', async ({ page }) => {
    // Check company panel
    await expect(page.locator('.w-64')).toBeVisible();
    await expect(page.locator('text=Companies').first()).toBeVisible();

    // Check product panel
    await expect(page.locator('.w-80')).toBeVisible();
    await expect(page.locator('text=Products')).toBeVisible();

    // Check feature panel
    await expect(page.locator('.flex-1.bg-gray-50')).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Features' })).toBeVisible();
  });

  test('should add a company when name is entered and Enter is pressed', async () => {
    const companyName = 'E2E Test Company';
    await featuresPage.addCompany(companyName);

    const companyExists = await featuresPage.companyList.getByText(companyName).isVisible();
    expect(companyExists).toBe(true);
  });

  test('should activate company and show Active badge', async () => {
    const companyName = 'E2E Activate Test';
    await featuresPage.addCompany(companyName);

    await featuresPage.activateCompany(companyName);

    const activeBadge = await featuresPage.companyPanel
      .locator(`text=${companyName}`)
      .locator('xpath=..')
      .getByText('Active')
      .isVisible();
    expect(activeBadge).toBe(true);
  });

  test('should show placeholder when no company is selected', async () => {
    const isEmpty = await featuresPage.isProductPanelEmpty();
    expect(isEmpty).toBe(true);
  });

  test('should delete company when confirmed', async () => {
    const companyName = 'E2E Delete Test';
    await featuresPage.addCompany(companyName);

    // Verify company exists
    let companyExists = await featuresPage.companyList.getByText(companyName).isVisible();
    expect(companyExists).toBe(true);

    await featuresPage.deleteCompany(companyName);

    // Verify company is removed
    companyExists = await featuresPage.companyList.getByText(companyName).isVisible();
    expect(companyExists).toBe(false);
  });

  test('should not delete company when confirmation is dismissed', async ({ page }) => {
    const companyName = 'E2E No Delete Test';
    await featuresPage.addCompany(companyName);

    // Setup: dismiss the dialog
    page.once('dialog', dialog => dialog.dismiss());

    const deleteButton = featuresPage.companyPanel
      .locator(`text=${companyName}`)
      .locator('xpath=..')
      .getByRole('button', { name: /Delete/i });
    await deleteButton.click();

    // Verify company still exists
    const companyExists = await featuresPage.companyList.getByText(companyName).isVisible();
    expect(companyExists).toBe(true);
  });
});
