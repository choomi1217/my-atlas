import { test, expect } from '@playwright/test';

test.describe('Login Page UI E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure logged-out state
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.removeItem('my-atlas-token');
      localStorage.removeItem('my-atlas-user');
    });
    await page.goto('/login');
  });

  // --- Page rendering ---

  test('should display login page with username and password fields', async ({ page }) => {
    // Title
    await expect(page.locator('h1').filter({ hasText: 'my-atlas' })).toBeVisible();
    // Subtitle
    await expect(page.getByText('QA Knowledge Hub')).toBeVisible();
    // Username input
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('label[for="username"]')).toHaveText('Username');
    // Password input
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('label[for="password"]')).toHaveText('Password');
    // Login button
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  // --- Successful login ---

  test('should redirect to / after successful login', async ({ page }) => {
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('admin');

    const loginResponse = page.waitForResponse(
      resp => resp.url().includes('/api/auth/login') && resp.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Login' }).click();
    await loginResponse;

    // Should redirect to / (overview page)
    await expect(page).toHaveURL(/\/$/);
    // GNB should be visible with logo
    await expect(page.locator('header').getByText('my-atlas')).toBeVisible();
  });

  // --- Failed login ---

  test('should show error message on failed login', async ({ page }) => {
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('wrongpassword');

    await page.getByRole('button', { name: 'Login' }).click();

    // Error message should appear
    await expect(page.getByText('Invalid username or password')).toBeVisible();
    // Should remain on login page
    await expect(page).toHaveURL(/\/login/);
  });

  // --- Logout ---

  test('should logout and redirect to /login when Logout is clicked', async ({ page }) => {
    // First, login
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/$/);

    // Click Logout button in GNB
    await page.getByRole('button', { name: 'Logout' }).click();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
    // Login form should be visible again
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  // --- Protected route redirect ---

  test('should redirect to /login when accessing protected route without auth', async ({ page }) => {
    // Clear any stored auth
    await page.evaluate(() => {
      localStorage.removeItem('my-atlas-token');
      localStorage.removeItem('my-atlas-user');
    });

    // Try to navigate to a protected route
    await page.goto('/senior');

    // Should be redirected to /login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('#username')).toBeVisible();
  });
});
