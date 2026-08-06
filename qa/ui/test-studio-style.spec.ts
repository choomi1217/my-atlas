import { test, expect } from '@playwright/test';
import axios from 'axios';
import { loginAsAdminInBrowser } from '../helpers/api-helpers';

/**
 * Test Studio v2.5 — Style settings UI E2E (/test-studio/style).
 *
 * Cost-control: no generation job is submitted, so no Claude/OpenAI tokens are consumed.
 * Verifies set creation, example CRUD (reused TC form), Sample fallback, and aux config.
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe.configure({ mode: 'serial' });

test.describe('Test Studio Style UI E2E', () => {
  let token: string;
  let companyId: number;
  const companyName = 'E2E TestStudioStyleUI Co';

  test.beforeAll(async () => {
    const loginResp = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin',
    });
    token = loginResp.data.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    try {
      const cs = await axios.get(`${API_URL}/api/companies`, authHeaders);
      const list: { id: number; name: string }[] = cs.data.data || [];
      for (const c of list) {
        if (typeof c.name === 'string' && c.name.includes('E2E TestStudioStyleUI')) {
          await axios
            .delete(`${API_URL}/api/companies/${c.id}`, authHeaders)
            .catch(() => {});
        }
      }
    } catch {
      /* best-effort */
    }

    const co = await axios.post(
      `${API_URL}/api/companies`,
      { name: companyName },
      authHeaders,
    );
    companyId = co.data.data.id;
  });

  test.afterAll(async () => {
    if (companyId) {
      await axios
        .delete(`${API_URL}/api/companies/${companyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => {});
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
  });

  test('Home header "스타일 설정" button navigates to the style page', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/test-studio?companyId=${companyId}`);
    const styleBtn = page.getByTestId('test-studio-style-button');
    await expect(styleBtn).toBeVisible();
    await styleBtn.click();
    await expect(page).toHaveURL(/\/test-studio\/style(\?.*)?$/);
    await expect(
      page.getByRole('heading', { name: '스타일 설정', exact: true }),
    ).toBeVisible();
  });

  test('Sample is the default active set with fallback message', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/test-studio/style?companyId=${companyId}`);
    // Default selection = Sample (empty value)
    await expect(page.getByTestId('style-profile-select')).toHaveValue('');
    await expect(page.getByTestId('style-sample-notice')).toBeVisible();
    // No examples section while Sample is active.
    await expect(page.getByTestId('style-examples-section')).toHaveCount(0);
  });

  test('create a set, add an example via the reused TC form', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/test-studio/style?companyId=${companyId}`);

    // Create a new style set (auto-selected after creation).
    await page.getByTestId('style-create-input').fill('E2E 결제팀 스타일');
    await page.getByTestId('style-create-button').click();

    // Examples section appears for the newly selected set.
    await expect(page.getByTestId('style-examples-section')).toBeVisible();
    await expect(page.getByTestId('style-add-example-button')).toBeVisible();

    // Add an example TC.
    await page.getByTestId('style-add-example-button').click();
    await expect(page.getByTestId('style-example-modal')).toBeVisible();
    await page
      .getByTestId('style-example-title-input')
      .fill('[결제] IC카드 승인 실패');
    await page.getByTestId('style-example-save').click();

    // Row appears; modal closes.
    await expect(page.getByTestId('style-example-modal')).toHaveCount(0);
    const row = page.getByTestId('style-example-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('[결제] IC카드 승인 실패');

    // The select box reflects the set with its example count.
    await expect(page.getByTestId('style-profile-select')).toContainText(
      'E2E 결제팀 스타일 (1)',
    );
  });

  test('switching back to Sample hides the examples section', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/test-studio/style?companyId=${companyId}`);
    // The set created above should be selected; switch to Sample.
    await page.getByTestId('style-profile-select').selectOption('');
    await expect(page.getByTestId('style-sample-notice')).toBeVisible();
    await expect(page.getByTestId('style-examples-section')).toHaveCount(0);
  });

  test('changing an aux config enum persists', async ({ page }) => {
    await page.goto(`${BASE_URL}/test-studio/style?companyId=${companyId}`);
    const toneSelect = page.getByTestId('style-config-tone');
    await toneSelect.selectOption('FORMAL');
    // Reload — the value should have persisted server-side.
    await page.goto(`${BASE_URL}/test-studio/style?companyId=${companyId}`);
    await expect(page.getByTestId('style-config-tone')).toHaveValue('FORMAL');
  });
});
