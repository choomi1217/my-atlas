import { test, expect } from '@playwright/test';

test.describe('Resume Page UI E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('should navigate to /resume via GNB', async ({ page }) => {
    await page.getByRole('link', { name: 'Resume' }).click();
    await expect(page).toHaveURL(/\/resume/);
  });

  test('should display resume header', async ({ page }) => {
    await page.goto('/resume');
    await expect(page.locator('h1').filter({ hasText: '조영미' })).toBeVisible();
    await expect(page.getByText('QA Engineer')).toBeVisible();
  });

  test('should switch tabs between 자기소개서 and 경력기술서', async ({ page }) => {
    await page.goto('/resume');

    // Default: 자기소개서 (Introduce section)
    await expect(page.getByText('Introduce')).toBeVisible();

    // Switch to 경력기술서
    await page.getByRole('button', { name: '경력기술서' }).click();
    await expect(page.getByText('QA Experience')).toBeVisible();

    // Switch back
    await page.getByRole('button', { name: '자기소개서' }).click();
    await expect(page.getByText('Introduce')).toBeVisible();
  });

  test('should redirect to /login when accessing /resume without auth', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('my-atlas-token');
      localStorage.removeItem('my-atlas-user');
    });
    await page.goto('/resume');
    await expect(page).toHaveURL(/\/login/);
  });
});
