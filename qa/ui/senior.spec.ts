import { test, expect } from '@playwright/test';

test.describe('Senior Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/senior');
  });

  // --- Page load ---

  test('should display My Senior heading on page load', async ({ page }) => {
    await expect(page.locator('h2').filter({ hasText: 'My Senior' })).toBeVisible();
  });

  test('should show Chat tab as active by default', async ({ page }) => {
    const chatTab = page.getByRole('button', { name: 'Chat', exact: true });
    await expect(chatTab).toBeVisible();
    await expect(chatTab).toHaveClass(/border-indigo-600/);
  });

  // --- Tab navigation ---

  test('should switch to FAQ tab when clicked', async ({ page }) => {
    await page.getByRole('button', { name: 'FAQ', exact: true }).click();

    // Wait for FAQ API call to complete
    await page.waitForResponse(resp => resp.url().includes('/api/senior/faq') && resp.request().method() === 'GET');

    await expect(page.getByRole('button', { name: '+ New FAQ' })).toBeVisible();
  });

  test('should switch to KB Management tab when clicked', async ({ page }) => {
    await page.getByRole('button', { name: 'KB Management' }).click();

    await expect(page.getByRole('button', { name: 'KB Articles' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Company Features' })).toBeVisible();
  });

  test('should switch between all three tabs', async ({ page }) => {
    // Click FAQ tab
    await page.getByRole('button', { name: 'FAQ', exact: true }).click();
    await expect(page.getByRole('button', { name: 'FAQ', exact: true })).toHaveClass(/border-indigo-600/);

    // Click KB Management tab
    await page.getByRole('button', { name: 'KB Management' }).click();
    await expect(page.getByRole('button', { name: 'KB Management' })).toHaveClass(/border-indigo-600/);

    // Click Chat tab
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Chat', exact: true })).toHaveClass(/border-indigo-600/);
  });

  // --- FAQ CRUD ---

  test('should create a new FAQ and display it in the list', async ({ page }) => {
    // Navigate to FAQ tab and wait for API
    const faqListResponse = page.waitForResponse(
      resp => resp.url().includes('/api/senior/faq') && resp.request().method() === 'GET'
    );
    await page.getByRole('button', { name: 'FAQ', exact: true }).click();
    await faqListResponse;

    // Click "New FAQ" button
    await page.getByRole('button', { name: '+ New FAQ' }).click();

    // Fill in the form
    const title = `E2E Test FAQ ${Date.now()}`;
    await page.locator('input[type="text"]').first().fill(title);
    await page.locator('textarea').fill('This is test FAQ content for E2E testing');
    await page.locator('input[placeholder="e.g. regression, api, login"]').fill('e2e,test');

    // Submit the form
    const createResponse = page.waitForResponse(
      resp => resp.url().includes('/api/senior/faq') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Create' }).click();
    await createResponse;

    // Verify FAQ appears in the list
    await expect(page.getByText(title)).toBeVisible();
  });

  test('should delete a FAQ from the list', async ({ page }) => {
    // Navigate to FAQ tab and wait for API
    const faqListResponse = page.waitForResponse(
      resp => resp.url().includes('/api/senior/faq') && resp.request().method() === 'GET'
    );
    await page.getByRole('button', { name: 'FAQ', exact: true }).click();
    await faqListResponse;

    // Create a FAQ first
    await page.getByRole('button', { name: '+ New FAQ' }).click();
    const title = `E2E Delete FAQ ${Date.now()}`;
    await page.locator('input[type="text"]').first().fill(title);
    await page.locator('textarea').fill('FAQ to be deleted');

    const createResponse = page.waitForResponse(
      resp => resp.url().includes('/api/senior/faq') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Create' }).click();
    await createResponse;

    // Verify it exists
    await expect(page.getByText(title)).toBeVisible();

    // Find the card containing our FAQ title and click Delete inside it
    const faqCard = page.locator('div').filter({ hasText: title }).last();
    page.once('dialog', dialog => dialog.accept());
    const deleteResponse = page.waitForResponse(
      resp => resp.url().includes('/api/senior/faq/') && resp.request().method() === 'DELETE'
    );
    await faqCard.getByRole('button', { name: 'Delete' }).click();
    await deleteResponse;

    // Verify FAQ is removed
    await expect(page.getByText(title)).not.toBeVisible();
  });

  // --- KB Management sub-views ---

  test('should switch between KB Articles and Company Features sub-views', async ({ page }) => {
    await page.getByRole('button', { name: 'KB Management' }).click();

    const kbArticlesBtn = page.getByRole('button', { name: 'KB Articles' });
    await expect(kbArticlesBtn).toHaveClass(/bg-indigo-100/);

    await page.getByRole('button', { name: 'Company Features' }).click();
    const companyFeaturesBtn = page.getByRole('button', { name: 'Company Features' });
    await expect(companyFeaturesBtn).toHaveClass(/bg-indigo-100/);

    await page.getByRole('button', { name: 'KB Articles' }).click();
    await expect(kbArticlesBtn).toHaveClass(/bg-indigo-100/);
  });
});
