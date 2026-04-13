import { test, expect } from '@playwright/test';

test.describe('Resume Page UI E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/senior/);

    // Navigate to Resume
    await page.getByRole('link', { name: 'Resume' }).click();
    await expect(page).toHaveURL(/\/resume/);
  });

  // --- Navigation ---

  test('should navigate to /resume via sidebar', async ({ page }) => {
    await expect(page).toHaveURL(/\/resume/);
  });

  // --- Header ---

  test('should display resume header with name and role', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: '조영미' })).toBeVisible();
    await expect(page.getByText('QA Engineer')).toBeVisible();
    await expect(page.getByText('4Y 4M')).toBeVisible();
  });

  // --- Default tab ---

  test('should show 경력기술서 tab as active by default', async ({ page }) => {
    // 경력기술서 button should have active styling (font-bold)
    const workExpButton = page.getByRole('button', { name: '경력기술서' });
    await expect(workExpButton).toBeVisible();
    await expect(workExpButton).toHaveClass(/font-bold/);

    // QA Experience section should be visible
    await expect(page.getByText('QA Experience')).toBeVisible();
    await expect(page.getByText('Studio XID')).toBeVisible();
  });

  // --- Tab switching: intro ---

  test('should switch to 자기소개서 tab on click', async ({ page }) => {
    await page.getByRole('button', { name: '자기소개서' }).click();

    // Intro content should be visible
    await expect(page.getByText('About Me')).toBeVisible();
    await expect(page.getByText('지원 동기')).toBeVisible();
    await expect(page.getByText('QA로의 전환')).toBeVisible();
    await expect(page.getByText('강점')).toBeVisible();
    await expect(page.getByText('앞으로의 방향')).toBeVisible();

    // 경력기술서 content should NOT be visible
    await expect(page.getByText('QA Experience')).not.toBeVisible();
  });

  // --- Tab switching: back to work-exp ---

  test('should switch back to 경력기술서 tab', async ({ page }) => {
    // Switch to intro first
    await page.getByRole('button', { name: '자기소개서' }).click();
    await expect(page.getByText('About Me')).toBeVisible();

    // Switch back to work-exp
    await page.getByRole('button', { name: '경력기술서' }).click();
    await expect(page.getByText('QA Experience')).toBeVisible();
    await expect(page.getByText('Studio XID')).toBeVisible();

    // Intro content should NOT be visible
    await expect(page.getByText('About Me')).not.toBeVisible();
  });

  // --- Work-exp content ---

  test('should display all sections in 경력기술서', async ({ page }) => {
    // QA Experience
    await expect(page.getByText('QA Experience')).toBeVisible();
    await expect(page.getByText('Studio XID')).toBeVisible();

    // Development Experience
    await expect(page.getByText('Development Experience')).toBeVisible();
    await expect(page.getByText('NFLUX')).toBeVisible();
    await expect(page.getByText('도로명주소단')).toBeVisible();

    // Side Project
    await expect(page.getByText('Side Project')).toBeVisible();
    await expect(page.getByText('my-atlas').first()).toBeVisible();

    // Skills
    await expect(page.getByText('Skills')).toBeVisible();
    await expect(page.getByText('Test Automation')).toBeVisible();
  });

  // --- Intro content ---

  test('should display all cards in 자기소개서', async ({ page }) => {
    await page.getByRole('button', { name: '자기소개서' }).click();

    await expect(page.getByText('지원 동기')).toBeVisible();
    await expect(page.getByText('QA로의 전환')).toBeVisible();
    await expect(page.getByText('강점')).toBeVisible();
    await expect(page.getByText('앞으로의 방향')).toBeVisible();
  });

  // --- Protected route ---

  test('should redirect to /login when accessing /resume without auth', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('my-atlas-token');
      localStorage.removeItem('my-atlas-user');
    });
    await page.goto('/resume');
    await expect(page).toHaveURL(/\/login/);
  });
});
