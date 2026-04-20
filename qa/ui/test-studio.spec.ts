import { test, expect, Page } from '@playwright/test';
import axios from 'axios';
import { loginAsAdminInBrowser } from '../helpers/api-helpers';

const API_URL = process.env.API_URL || 'http://localhost:8080';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

const VALID_STATUS_REGEX = /^(PENDING|PROCESSING|DONE|FAILED)$/;

/**
 * Test Studio UI E2E tests.
 *
 * Cost-control notes:
 *   - Only the "submits a Markdown job and appears in list" test triggers a
 *     real AI generation. Content is kept short to minimize Claude token use.
 *   - "deletes a job from the list" seeds the job via API (reusing the same
 *     Claude call that the earlier test already made would require cross-test
 *     state; instead this test accepts one additional Claude call and keeps
 *     content short).
 *   - Oversize-content test does NOT submit — it merely verifies the submit
 *     button is disabled by client-side validation (no backend / AI call).
 */

test.describe.configure({ mode: 'serial' });

test.describe('Test Studio UI E2E', () => {
  let token: string;
  let companyId: number;
  let productId: number;

  test.beforeAll(async () => {
    // Login via API to get admin token (used for seed/cleanup)
    const loginResp = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin',
    });
    token = loginResp.data.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // Clean up E2E/TestStudio companies from previous runs
    try {
      const cs = await axios.get(`${API_URL}/api/companies`, authHeaders);
      const list: { id: number; name: string }[] = cs.data.data || [];
      for (const c of list) {
        if (
          typeof c.name === 'string' &&
          (c.name.includes('E2E') || c.name.includes('TestStudio'))
        ) {
          try {
            await axios.delete(`${API_URL}/api/companies/${c.id}`, authHeaders);
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore — best-effort cleanup */
    }

    // Seed company + product for this spec
    const co = await axios.post(
      `${API_URL}/api/companies`,
      { name: 'E2E TestStudio UI Co' },
      authHeaders,
    );
    companyId = co.data.data.id;

    const pr = await axios.post(
      `${API_URL}/api/products`,
      {
        companyId,
        name: 'E2E TestStudio UI Product',
        platform: 'WEB',
      },
      authHeaders,
    );
    productId = pr.data.data.id;
  });

  test.afterAll(async () => {
    if (companyId && token) {
      try {
        await axios.delete(`${API_URL}/api/companies/${companyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* ignore */
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
  });

  const studioUrl = () =>
    `${BASE_URL}/features/companies/${companyId}/products/${productId}/test-studio`;

  const testCaseUrl = () =>
    `${BASE_URL}/features/companies/${companyId}/products/${productId}`;

  test('renders page with breadcrumb and form', async ({ page }) => {
    await page.goto(studioUrl());

    await expect(page.getByRole('heading', { name: 'Test Studio' })).toBeVisible();
    await expect(page.getByTestId('test-studio-title')).toBeVisible();
    await expect(page.getByTestId('test-studio-source-markdown')).toBeVisible();
    await expect(page.getByTestId('test-studio-source-pdf')).toBeVisible();
    // Markdown textarea renders by default (MARKDOWN is the default source type)
    await expect(page.getByTestId('test-studio-content')).toBeVisible();
    await expect(page.getByTestId('test-studio-submit')).toBeVisible();

    // Breadcrumb shows the seeded company + product names
    await expect(page.locator('text=E2E TestStudio UI Co')).toBeVisible();
    await expect(page.locator('text=E2E TestStudio UI Product')).toBeVisible();
  });

  test('submits a Markdown job and appears in list', async ({ page }) => {
    await page.goto(studioUrl());

    await page.getByTestId('test-studio-title').fill('E2E UI NFC PRD');
    // MARKDOWN is default but explicitly check to make intent clear
    await page.getByTestId('test-studio-source-markdown').check();
    await page
      .getByTestId('test-studio-content')
      .fill('# NFC 결제\n사용자가 카드를 태그하면 결제 완료.');

    await page.getByTestId('test-studio-submit').click();

    // A job row should appear reasonably fast (server returns 201 immediately —
    // async generation is kicked off, but the list is populated right away).
    const row = page.getByTestId('test-studio-job-row').first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    const badge = row.getByTestId('job-status-badge');
    await expect(badge).toBeVisible();

    const status = await badge.getAttribute('data-status');
    expect(status).toMatch(VALID_STATUS_REGEX);
  });

  test('disables submit when markdown content exceeds max length', async ({
    page,
  }) => {
    await page.goto(studioUrl());

    await page.getByTestId('test-studio-title').fill('E2E UI Oversize');
    await page.getByTestId('test-studio-source-markdown').check();

    const oversize = 'a'.repeat(100_001);
    // Use locator.fill (sets the value directly; faster than typing 100k chars)
    await page.getByTestId('test-studio-content').fill(oversize);

    // Form logic: submit is disabled when `content.length > 100_000`
    await expect(page.getByTestId('test-studio-submit')).toBeDisabled();
  });

  test('navigates to Test Studio from TestCase page via nav link', async ({
    page,
  }) => {
    await page.goto(testCaseUrl());

    const navLink = page.getByTestId('test-studio-nav-link');
    await expect(navLink).toBeVisible();
    await navLink.click();

    await expect(page).toHaveURL(/\/test-studio$/);
    await expect(page.getByTestId('test-studio-title')).toBeVisible();
    await expect(page.getByTestId('test-studio-submit')).toBeVisible();
  });

  test('deletes a job from the list', async ({ page }) => {
    // Seed a job via the API so this test doesn't depend on a previous UI test
    const form = new FormData();
    form.append('productId', String(productId));
    form.append('sourceType', 'MARKDOWN');
    form.append('title', 'E2E UI Delete Target');
    form.append('content', '# 삭제 대상\nshort content for delete test');

    const createResp = await axios.post(
      `${API_URL}/api/test-studio/jobs`,
      form,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const seededJobId: number = createResp.data.data.jobId;

    await page.goto(studioUrl());

    const row = page.locator(
      `[data-testid="test-studio-job-row"][data-job-id="${seededJobId}"]`,
    );
    await expect(row).toBeVisible({ timeout: 10_000 });

    // handleDelete uses window.confirm — auto-accept before click
    page.once('dialog', (dialog) => {
      dialog.accept().catch(() => {});
    });

    await row.getByTestId('test-studio-delete').click();

    await expect(row).toHaveCount(0, { timeout: 10_000 });
  });
});
