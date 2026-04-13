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
    const workExpButton = page.getByRole('button', { name: '경력기술서' });
    await expect(workExpButton).toBeVisible();
    await expect(workExpButton).toHaveClass(/font-bold/);

    await expect(page.getByText('QA Experience')).toBeVisible();
    await expect(page.getByText('Studio XID')).toBeVisible();
  });

  // --- Tab switching: intro ---

  test('should switch to 자기소개서 tab on click', async ({ page }) => {
    await page.getByRole('button', { name: '자기소개서' }).click();

    // Introduce section
    await expect(page.getByText('Introduce')).toBeVisible();
    await expect(page.getByText('안녕하세요. 조영미입니다.')).toBeVisible();

    // Timeline section
    await expect(page.getByText('Timeline')).toBeVisible();

    // Contact section
    await expect(page.getByText('Contact')).toBeVisible();

    // 경력기술서 content should NOT be visible
    await expect(page.getByText('QA Experience')).not.toBeVisible();
  });

  // --- Tab switching: back to work-exp ---

  test('should switch back to 경력기술서 tab', async ({ page }) => {
    await page.getByRole('button', { name: '자기소개서' }).click();
    await expect(page.getByText('Introduce')).toBeVisible();

    await page.getByRole('button', { name: '경력기술서' }).click();
    await expect(page.getByText('QA Experience')).toBeVisible();
    await expect(page.getByText('Studio XID')).toBeVisible();

    await expect(page.getByText('Introduce')).not.toBeVisible();
  });

  // --- Work-exp content ---

  test('should display all sections in 경력기술서', async ({ page }) => {
    await expect(page.getByText('QA Experience')).toBeVisible();
    await expect(page.getByText('Studio XID')).toBeVisible();

    await expect(page.getByText('Development Experience')).toBeVisible();
    await expect(page.getByText('NFLUX')).toBeVisible();
    await expect(page.getByText('도로명주소단')).toBeVisible();

    await expect(page.getByText('Side Project')).toBeVisible();
    await expect(page.getByText('my-atlas').first()).toBeVisible();

    await expect(page.getByText('Skills')).toBeVisible();
    await expect(page.getByText('Test Automation')).toBeVisible();
  });

  // --- Intro: Introduce ---

  test('should display self-introduction in 자기소개서', async ({ page }) => {
    await page.getByRole('button', { name: '자기소개서' }).click();

    await expect(page.getByText('안녕하세요. 조영미입니다.')).toBeVisible();
    await expect(page.getByText(/QA로 전향한 엔지니어/)).toBeVisible();
  });

  // --- Intro: Timeline ---

  test('should display career timeline with key items', async ({ page }) => {
    await page.getByRole('button', { name: '자기소개서' }).click();

    await expect(page.getByText('대전보건대학교 컴퓨터정보과')).toBeVisible();
    await expect(page.getByText('도로명주소단')).toBeVisible();
    await expect(page.getByText('정보처리기사')).toBeVisible();
    await expect(page.getByText('SQLD')).toBeVisible();
    await expect(page.getByText('NFLUX')).toBeVisible();
    await expect(page.getByText('Studio XID (QA)')).toBeVisible();
  });

  // --- Intro: Contact ---

  test('should display contact information', async ({ page }) => {
    await page.getByRole('button', { name: '자기소개서' }).click();

    await expect(page.getByText('010-4449-6558')).toBeVisible();
    await expect(page.getByText('whdudal1217@naver.com')).toBeVisible();
    await expect(page.getByText('choomi1217.github.io')).toBeVisible();
    await expect(page.getByText('github.com/choomi1217')).toBeVisible();
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
