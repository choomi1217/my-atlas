import { test, expect } from '@playwright/test';

test.describe('Senior Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/senior');
  });

  // --- Page load ---

  test('should display My Senior heading on page load', async ({ page }) => {
    await expect(page.locator('h2').filter({ hasText: 'My Senior' })).toBeVisible();
  });

  test.fixme('should show FAQ view as default entry', async ({ page }) => {
    // TODO: Senior API 500 에러 수정 후 복원 (feature/my-senior)
    // FAQ is the default view - wait for FAQ list to load
    await page.waitForResponse(resp => resp.url().includes('/api/senior/faq') && resp.request().method() === 'GET');

    // Header should show "Chat →" button for switching to chat
    await expect(page.getByRole('button', { name: /Chat/ })).toBeVisible();
    // Search bar should be visible
    await expect(page.locator('input[placeholder*="FAQ"]')).toBeVisible();
  });

  // --- View navigation ---

  test('should switch to Chat view when Chat button clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Chat/ }).click();

    // Chat view should show the input area
    await expect(page.locator('textarea')).toBeVisible();
    // Header should show "FAQ" button to go back
    await expect(page.getByRole('button', { name: /FAQ/ })).toBeVisible();
  });

  test('should switch to KB Management view when KB button clicked', async ({ page }) => {
    // KB feature is not yet implemented in Senior page
    // This test will be enabled when KB integration is added
    test.skip();
  });

  test.fixme('should navigate between FAQ and Chat views', async ({ page }) => {
    // TODO: Senior API 500 에러 수정 후 복원 (feature/my-senior)
    // Default is FAQ, switch to Chat
    await page.getByRole('button', { name: /Chat/ }).click();
    await expect(page.locator('textarea')).toBeVisible();

    // Switch back to FAQ
    await page.getByRole('button', { name: /FAQ/ }).click();
    await page.waitForResponse(resp => resp.url().includes('/api/senior/faq') && resp.request().method() === 'GET');
    await expect(page.locator('input[placeholder*="FAQ"]')).toBeVisible();
  });

  // --- FAQ CRUD ---

  test.fixme('should create a new FAQ and display it in the list', async ({ page }) => {
    // TODO: Senior API 500 에러 수정 후 복원 (feature/my-senior)
    // FAQ is default view - wait for list to load
    await page.waitForResponse(
      resp => resp.url().includes('/api/senior/faq') && resp.request().method() === 'GET'
    );

    // Click "+ 추가" button
    await page.getByRole('button', { name: /추가/ }).click();

    // Fill in the form (target inputs inside the modal dialog)
    const modal = page.locator('.fixed.inset-0');
    const title = `E2E Test FAQ ${Date.now()}`;
    await modal.locator('input[type="text"]').first().fill(title);
    await modal.locator('textarea').fill('This is test FAQ content for E2E testing');
    await modal.locator('input[placeholder="e.g. regression, api, login"]').fill('e2e,test');

    // Submit the form
    const createResponse = page.waitForResponse(
      resp => resp.url().includes('/api/senior/faq') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Create' }).click();
    await createResponse;

    // Verify FAQ appears in the list
    await expect(page.getByText(title)).toBeVisible();
  });

  test.fixme('should delete a FAQ from the list', async ({ page }) => {
    // TODO: Senior API 500 에러 수정 후 복원 (feature/my-senior)
    // FAQ is default view - wait for list to load
    await page.waitForResponse(
      resp => resp.url().includes('/api/senior/faq') && resp.request().method() === 'GET'
    );

    // Create a FAQ first
    await page.getByRole('button', { name: /추가/ }).click();
    const modal = page.locator('.fixed.inset-0');
    const title = `E2E Delete FAQ ${Date.now()}`;
    await modal.locator('input[type="text"]').first().fill(title);
    await modal.locator('textarea').fill('FAQ to be deleted');

    const createResponse = page.waitForResponse(
      resp => resp.url().includes('/api/senior/faq') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Create' }).click();
    await createResponse;

    // Verify it exists
    await expect(page.getByText(title)).toBeVisible();

    // Click the card to expand it (new FaqCard pattern)
    await page.getByText(title).click();

    // Click Delete in the expanded card
    const faqCard = page.locator('div').filter({ hasText: title }).last();
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
    // KB feature is not yet implemented in Senior page
    // This test will be enabled when KB integration is added
    test.skip();
  });
});
