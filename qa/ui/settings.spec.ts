import { test, expect } from '@playwright/test';
import { loginAsAdminInBrowser } from '../helpers/api-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Settings UI E2E', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForSelector('h1:has-text("Settings")');
  });

  test('Settings page renders 3 sections', async ({ page }) => {
    await expect(page.locator('text=User Management')).toBeVisible();
    await expect(page.locator('text=AI Settings')).toBeVisible();
    await expect(page.locator('text=Session Settings')).toBeVisible();
  });

  test('User table shows users with roles', async ({ page }) => {
    // Table header
    await expect(page.locator('th:has-text("Username")')).toBeVisible();
    await expect(page.locator('th:has-text("Role")')).toBeVisible();
    // At least one ADMIN role badge exists in the table
    await expect(page.locator('span:has-text("ADMIN")').first()).toBeVisible();
  });

  test('Register User button toggles form', async ({ page }) => {
    await page.click('button:has-text("Register User")');
    await expect(page.locator('input[placeholder="Username"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Password"]')).toBeVisible();

    // Cancel
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('input[placeholder="Username"]')).not.toBeVisible();
  });

  test('AI toggle switch is visible', async ({ page }) => {
    await expect(page.locator('text=AI Features')).toBeVisible();
    // Toggle button (rounded-full)
    const toggle = page.locator('button.rounded-full');
    await expect(toggle).toBeVisible();
  });

  test('Session timeout select has options', async ({ page }) => {
    const select = page.locator('select');
    await expect(select).toBeVisible();
    await expect(select.locator('option')).toHaveCount(4);
  });

  test('Settings nav is hidden for USER role', async ({ page }) => {
    // Set localStorage as USER
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate(() => {
      localStorage.setItem('my-atlas-token', 'fake-token-for-nav-check');
      localStorage.setItem('my-atlas-user', JSON.stringify({ username: 'testuser', role: 'USER' }));
    });
    await page.goto(`${BASE_URL}/senior`);
    // Settings link should NOT be visible for USER
    await expect(page.locator('a[href="/settings"]')).not.toBeVisible();
  });
});
