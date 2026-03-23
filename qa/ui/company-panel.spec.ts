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

  test('should add a company when name is entered', async ({ page }) => {
    const companyName = 'E2E Test Company';
    await page.locator('input[placeholder="Company name..."]').fill(companyName);

    const responsePromise = page.waitForResponse(resp =>
      resp.url().includes('/api/companies') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /Add Company/i }).click();
    await responsePromise;

    const companyExists = await page.getByText(companyName).isVisible();
    expect(companyExists).toBe(true);
  });

  test('should activate company and show Active badge', async ({ page }) => {
    const companyName = 'E2E Activate Test';
    await page.locator('input[placeholder="Company name..."]').fill(companyName);

    const createPromise = page.waitForResponse(resp =>
      resp.url().includes('/api/companies') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /Add Company/i }).click();
    await createPromise;

    const activatePromise = page.waitForResponse(resp =>
      resp.url().includes('/activate') && resp.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: /Activate/i }).first().click();
    await activatePromise;

    const activeBadge = await page.getByText('Active').isVisible();
    expect(activeBadge).toBe(true);
  });

  test('should delete company when confirmed', async ({ page }) => {
    const companyName = 'E2E Delete Test';
    await page.locator('input[placeholder="Company name..."]').fill(companyName);

    const createPromise = page.waitForResponse(resp =>
      resp.url().includes('/api/companies') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /Add Company/i }).click();
    await createPromise;

    // Verify company exists
    let companyExists = await page.getByText(companyName).isVisible();
    expect(companyExists).toBe(true);

    // Delete company
    page.once('dialog', dialog => dialog.accept());
    const deletePromise = page.waitForResponse(resp =>
      resp.url().includes('/api/companies/') && resp.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: /Delete/i }).first().click();
    await deletePromise;

    // Verify company is removed
    companyExists = await page.getByText(companyName).isVisible();
    expect(companyExists).toBe(false);
  });

  test('should navigate to products on company click', async ({ page }) => {
    const companyName = 'E2E Navigate Test';
    await page.locator('input[placeholder="Company name..."]').fill(companyName);

    const createPromise = page.waitForResponse(resp =>
      resp.url().includes('/api/companies') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /Add Company/i }).click();
    await createPromise;

    // Click on company card
    await page.getByText(companyName).click();
    await page.waitForLoadState('networkidle');

    // Should be on product list page
    await expect(page.locator('h1').filter({ hasText: companyName })).toBeVisible();
    await expect(page.locator('p.text-gray-600').filter({ hasText: 'Products' })).toBeVisible();
  });
});
