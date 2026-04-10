import { test, expect } from '@playwright/test';
import { FeaturesPage } from '../pages/features-page';
import { cleanupAllTestData } from '../helpers/api-helpers';

test.describe('Company List Page', () => {
  let featuresPage: FeaturesPage;

  test.beforeEach(async ({ page }) => {
    featuresPage = new FeaturesPage(page);
    await featuresPage.goto();
  });

  test.afterEach(async () => {
    await cleanupAllTestData();
  });

  test('should display Companies heading on page load', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: 'Companies' })).toBeVisible();
  });

  test('should add a company via modal', async ({ page }) => {
    const companyName = 'E2E Test Company';
    await featuresPage.addCompany(companyName);

    const companyExists = await page.getByText(companyName).isVisible();
    expect(companyExists).toBe(true);
  });

  test('should activate company and show Active badge', async ({ page }) => {
    const companyName = 'E2E Activate Test';
    await featuresPage.addCompany(companyName);

    const activatePromise = page.waitForResponse(resp =>
      resp.url().includes('/activate') && resp.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: /Activate/i }).first().click();
    await activatePromise;

    const activeBadge = await page.getByText('Active', { exact: true }).isVisible();
    expect(activeBadge).toBe(true);
  });

  test('should delete company via confirm dialog', async ({ page }) => {
    const companyName = 'E2E Delete Test';
    await featuresPage.addCompany(companyName);

    // Verify company exists
    let companyExists = await page.getByText(companyName).isVisible();
    expect(companyExists).toBe(true);

    // Delete company via ConfirmDialog
    await featuresPage.deleteCompany();

    // Verify company is removed
    companyExists = await page.getByText(companyName).isVisible();
    expect(companyExists).toBe(false);
  });

  test('should navigate to products on company click', async ({ page }) => {
    const companyName = 'E2E Navigate Test';
    await featuresPage.addCompany(companyName);

    // Click on company card
    await page.getByText(companyName).click();
    await page.waitForLoadState('networkidle');

    // Should be on product list page
    await expect(page.locator('h1').filter({ hasText: companyName })).toBeVisible();
    await expect(page.locator('p.text-gray-600').filter({ hasText: 'Products' })).toBeVisible();
  });

  test('should show + New Company button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /New Company/i })).toBeVisible();
  });

  test('should show hero card layout for active company', async ({ page }) => {
    // Create and activate a company
    const companyName = 'E2E Hero Active Company';
    await featuresPage.addCompany(companyName);

    // Activate the company
    const activatePromise = page.waitForResponse(resp =>
      resp.url().includes('/activate') && resp.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: /Activate/i }).first().click();
    await activatePromise;

    // Active company should be rendered as hero card with Active badge
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    // Hero card should show the company name
    await expect(page.getByText(companyName)).toBeVisible();
    // Hero card has border-indigo-300 class (larger card)
    const heroCard = page.locator('.border-indigo-300').first();
    await expect(heroCard).toBeVisible();
    // Hero card should show Edit Name and Deactivate buttons
    await expect(page.getByRole('button', { name: /Edit Name/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Deactivate/i })).toBeVisible();
  });

  test('should allow inline name editing via Edit Name button', async ({ page }) => {
    const companyName = 'E2E Edit Name Test';
    await featuresPage.addCompany(companyName);

    // Activate the company so it shows as hero card with Edit Name button
    const activatePromise = page.waitForResponse(resp =>
      resp.url().includes('/activate') && resp.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: /Activate/i }).first().click();
    await activatePromise;

    // Click Edit Name button
    await page.getByRole('button', { name: /Edit Name/i }).click();

    // Input field should appear with the current name
    const editInput = page.locator('input[type="text"]').first();
    await expect(editInput).toBeVisible();
    await expect(editInput).toHaveValue(companyName);

    // Change the name
    const newName = 'E2E Edit Name Updated';
    await editInput.fill(newName);

    // Click Save
    const savePromise = page.waitForResponse(resp =>
      resp.url().includes('/api/companies/') && resp.request().method() === 'PUT'
    );
    await page.getByRole('button', { name: /Save/i }).click();
    await savePromise;

    // Verify updated name is displayed
    await expect(page.getByText(newName)).toBeVisible();
  });

  test('should deactivate active company via Deactivate button', async ({ page }) => {
    const companyName = 'E2E Deactivate Test';
    await featuresPage.addCompany(companyName);

    // Activate the company first
    const activatePromise = page.waitForResponse(resp =>
      resp.url().includes('/activate') && resp.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: /Activate/i }).first().click();
    await activatePromise;

    // Verify it is active (hero card visible)
    await expect(page.getByText('Active', { exact: true })).toBeVisible();

    // Click Deactivate button
    const deactivatePromise = page.waitForResponse(resp =>
      resp.url().includes('/deactivate') && resp.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: /Deactivate/i }).click();
    await deactivatePromise;

    // After deactivation, no active company hero card — should show "No active company" placeholder
    await expect(page.getByText('No active company')).toBeVisible();
  });
});
