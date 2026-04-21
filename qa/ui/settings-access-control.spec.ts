import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { loginAsAdminInBrowser } from '../helpers/api-helpers';

/**
 * Platform v9 — Settings > Access Control UI E2E
 *
 * Covers:
 *  - AccessControlSection rendering + 로그인 필수 토글 (aria-pressed)
 *  - Rate limit input validation (0 → error, 59 → error)
 *  - Rate limit save flow + persistence (re-fetch after reload)
 *  - Login Page "로그인 없이 둘러보기" button conditional visibility
 *  - Layout header shows "Login" link when anonymous
 *
 * Settings backup/restore handled via API context in beforeAll/afterAll.
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

interface OriginalSettings {
  aiEnabled: boolean;
  loginRequired: boolean;
  aiRateLimitPerIp: number;
  aiRateLimitWindowSeconds: number;
}

let adminApi: APIRequestContext;
let adminToken: string;
let originalSettings: OriginalSettings;

async function forceLoginRequired(value: boolean) {
  const resp = await adminApi.patch('/api/settings', { data: { loginRequired: value } });
  expect(resp.status()).toBe(200);
}

async function logoutInBrowser(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(() => {
    localStorage.removeItem('my-atlas-token');
    localStorage.removeItem('my-atlas-user');
  });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ playwright }) => {
  const base = await playwright.request.newContext({ baseURL: API_URL });
  const loginResp = await base.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin' },
  });
  expect(loginResp.status()).toBe(200);
  adminToken = (await loginResp.json() as any).data.token;
  await base.dispose();

  adminApi = await playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${adminToken}` },
  });

  const before = await adminApi.get('/api/settings');
  const body = await before.json() as any;
  originalSettings = {
    aiEnabled: body.data.aiEnabled,
    loginRequired: body.data.loginRequired,
    aiRateLimitPerIp: body.data.aiRateLimitPerIp,
    aiRateLimitWindowSeconds: body.data.aiRateLimitWindowSeconds,
  };
});

test.afterAll(async () => {
  try {
    if (adminApi && originalSettings) {
      await adminApi.patch('/api/settings', {
        data: {
          loginRequired: originalSettings.loginRequired,
          aiRateLimitPerIp: originalSettings.aiRateLimitPerIp,
          aiRateLimitWindowSeconds: originalSettings.aiRateLimitWindowSeconds,
        },
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to restore settings in afterAll:', err);
  }
  if (adminApi) await adminApi.dispose();
});

test.describe('Platform v9 — Settings UI / AccessControlSection', () => {
  test.beforeEach(async () => {
    // Ensure loginRequired=true so ADMIN flow is predictable at start of each test
    await forceLoginRequired(true);
  });

  test('Access Control section renders with toggle + rate-limit inputs + 저장 button', async ({ page }) => {
    await loginAsAdminInBrowser(page);
    await page.goto(`${BASE_URL}/settings`);

    await expect(page.locator('h2', { hasText: 'Access Control' })).toBeVisible();

    const toggle = page.locator('[aria-label="로그인 필수 토글"]');
    await expect(toggle).toBeVisible();

    // Two rate-limit inputs (max requests + window)
    const numberInputs = page.locator('input[type="number"]').filter({
      has: page.locator('xpath=ancestor::section[.//h2[text()="Access Control"]]'),
    });
    await expect(numberInputs).toHaveCount(2);

    // Save button
    await expect(page.getByRole('button', { name: /^(저장|저장 중\.\.\.)$/ })).toBeVisible();
  });

  test('로그인 필수 토글 click flips aria-pressed', async ({ page }) => {
    await loginAsAdminInBrowser(page);
    await page.goto(`${BASE_URL}/settings`);

    const toggle = page.locator('[aria-label="로그인 필수 토글"]');
    await expect(toggle).toBeVisible();

    // Given beforeEach sets loginRequired=true, aria-pressed must start at "true"
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // Await the PATCH /api/settings response so state has settled server-side
    const patchPromise = page.waitForResponse(
      resp =>
        resp.url().endsWith('/api/settings') &&
        resp.request().method() === 'PATCH' &&
        resp.status() === 200,
    );
    await toggle.click();
    await patchPromise;

    // Auto-retrying assertion — waits up to actionTimeout for aria-pressed to flip
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('Rate limit — invalid 최대 요청 수 (0) shows Korean error', async ({ page }) => {
    await loginAsAdminInBrowser(page);
    await page.goto(`${BASE_URL}/settings`);

    const section = page.locator('section', { has: page.locator('h2:has-text("Access Control")') });

    // First input = max requests
    const maxRequestsInput = section.locator('input[type="number"]').nth(0);
    await maxRequestsInput.fill('0');

    await section.getByRole('button', { name: /^저장/ }).click();

    await expect(section.locator('p.text-red-500')).toBeVisible();
    await expect(section.locator('p.text-red-500')).toHaveText(
      '최대 요청 수는 1~1000 사이여야 합니다.',
    );
  });

  test('Rate limit — invalid 윈도우 (59) shows Korean error', async ({ page }) => {
    await loginAsAdminInBrowser(page);
    await page.goto(`${BASE_URL}/settings`);

    const section = page.locator('section', { has: page.locator('h2:has-text("Access Control")') });

    // Second input = window seconds
    const windowInput = section.locator('input[type="number"]').nth(1);
    await windowInput.fill('59');

    // Set max requests to valid value so only window triggers the error
    const maxRequestsInput = section.locator('input[type="number"]').nth(0);
    await maxRequestsInput.fill('30');

    await section.getByRole('button', { name: /^저장/ }).click();

    await expect(section.locator('p.text-red-500')).toBeVisible();
    await expect(section.locator('p.text-red-500')).toHaveText(
      '윈도우(초)는 60~86400 사이여야 합니다.',
    );
  });

  test('Rate limit — valid values save successfully, error clears', async ({ page }) => {
    await loginAsAdminInBrowser(page);
    await page.goto(`${BASE_URL}/settings`);

    const section = page.locator('section', { has: page.locator('h2:has-text("Access Control")') });
    const maxRequestsInput = section.locator('input[type="number"]').nth(0);
    const windowInput = section.locator('input[type="number"]').nth(1);

    await maxRequestsInput.fill('42');
    await windowInput.fill('120');

    const patchPromise = page.waitForResponse(
      resp =>
        resp.url().endsWith('/api/settings') &&
        resp.request().method() === 'PATCH' &&
        resp.status() === 200,
    );
    await section.getByRole('button', { name: /^저장/ }).click();
    await patchPromise;

    // No error message visible
    await expect(section.locator('p.text-red-500')).toHaveCount(0);

    // Saved values persist after reload
    await page.reload();
    const reloadedSection = page.locator('section', {
      has: page.locator('h2:has-text("Access Control")'),
    });
    await expect(reloadedSection.locator('input[type="number"]').nth(0)).toHaveValue('42');
    await expect(reloadedSection.locator('input[type="number"]').nth(1)).toHaveValue('120');
  });
});

test.describe('Platform v9 — LoginPage + Layout anonymous UX', () => {
  test('loginRequired=false → /login shows "로그인 없이 둘러보기" button', async ({ page }) => {
    await forceLoginRequired(false);
    await logoutInBrowser(page);

    await page.goto(`${BASE_URL}/login`);
    // AuthContext calls GET /api/settings/public on mount — wait for it
    await page.waitForResponse(
      resp => resp.url().endsWith('/api/settings/public') && resp.status() === 200,
    );

    const browseBtn = page.getByRole('button', { name: '로그인 없이 둘러보기' });
    await expect(browseBtn).toBeVisible();
  });

  test('"로그인 없이 둘러보기" click navigates to /features', async ({ page }) => {
    await forceLoginRequired(false);
    await logoutInBrowser(page);

    await page.goto(`${BASE_URL}/login`);
    await page.waitForResponse(
      resp => resp.url().endsWith('/api/settings/public') && resp.status() === 200,
    );

    const browseBtn = page.getByRole('button', { name: '로그인 없이 둘러보기' });
    await expect(browseBtn).toBeVisible();
    await browseBtn.click();

    await expect(page).toHaveURL(/\/features/);
  });

  test('Anonymous on /features — header shows Login link, no Settings link', async ({ page }) => {
    await forceLoginRequired(false);
    await logoutInBrowser(page);

    await page.goto(`${BASE_URL}/features`);
    await page.waitForResponse(
      resp => resp.url().endsWith('/api/settings/public') && resp.status() === 200,
    );

    // Login link visible in header
    await expect(page.locator('header').getByRole('link', { name: 'Login' })).toBeVisible();

    // Settings link should NOT be rendered for anonymous users
    await expect(page.locator('header a[href="/settings"]')).toHaveCount(0);
  });

  test('loginRequired=true → /login hides "로그인 없이 둘러보기" button', async ({ page }) => {
    await forceLoginRequired(true);
    await logoutInBrowser(page);

    await page.goto(`${BASE_URL}/login`);
    await page.waitForResponse(
      resp => resp.url().endsWith('/api/settings/public') && resp.status() === 200,
    );

    // Button should not exist
    await expect(page.getByRole('button', { name: '로그인 없이 둘러보기' })).toHaveCount(0);
    // Standard login form still there
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });
});
