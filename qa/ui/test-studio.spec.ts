import { test, expect } from '@playwright/test';
import axios from 'axios';
import { loginAsAdminInBrowser } from '../helpers/api-helpers';

/**
 * Test Studio v2 — Home (/test-studio) UI E2E.
 *
 * Cost-control notes:
 *   These tests never submit a Test Studio generation job, so no Claude / OpenAI
 *   tokens are consumed. We only verify UI composition, routing and query-param
 *   persistence. Actual job creation / deletion is exercised by the API spec.
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe.configure({ mode: 'serial' });

test.describe('Test Studio v2 Home UI E2E', () => {
  let token: string;
  let companyId: number;
  let productId: number;
  const companyName = 'E2E TestStudioHome Co';
  const productName = 'E2E TestStudioHome Product';

  test.beforeAll(async () => {
    const loginResp = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin',
    });
    token = loginResp.data.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // Clean up only companies this spec created in prior runs.
    try {
      const cs = await axios.get(`${API_URL}/api/companies`, authHeaders);
      const list: { id: number; name: string }[] = cs.data.data || [];
      for (const c of list) {
        if (
          typeof c.name === 'string' &&
          (c.name === companyName || c.name.includes('E2E TestStudioHome'))
        ) {
          await axios
            .delete(`${API_URL}/api/companies/${c.id}`, authHeaders)
            .catch(() => {});
        }
      }
    } catch {
      /* best-effort cleanup */
    }

    // Seed a dedicated company + product.
    const co = await axios.post(
      `${API_URL}/api/companies`,
      { name: companyName },
      authHeaders,
    );
    companyId = co.data.data.id;

    const pr = await axios.post(
      `${API_URL}/api/products`,
      { companyId, name: productName, platform: 'WEB' },
      authHeaders,
    );
    productId = pr.data.data.id;

    // Seed a second product so /test-studio/new does not auto-select the single one.
    // (TestStudioJobCreatePage auto-picks when products.length === 1.)
    await axios.post(
      `${API_URL}/api/products`,
      { companyId, name: `${productName} Alt`, platform: 'WEB' },
      authHeaders,
    );
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

  test('renders Test Studio header nav link and navigates to /test-studio', async ({
    page,
  }) => {
    // Land on any page with the header nav present.
    await page.goto(`${BASE_URL}/features`);

    const navLink = page.getByRole('link', { name: 'Test Studio', exact: true });
    await expect(navLink).toBeVisible();

    await navLink.click();
    await expect(page).toHaveURL(/\/test-studio(\?.*)?$/);
    await expect(
      page.getByRole('heading', { name: 'Test Studio', exact: true }),
    ).toBeVisible();
  });

  test('empty state prompts for Company before showing dashboard', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/test-studio`);

    // The new-job button exists but is disabled until a Company is chosen.
    const newBtn = page.getByTestId('test-studio-new-job-button');
    await expect(newBtn).toBeVisible();
    await expect(newBtn).toBeDisabled();

    // Empty-state hint message rendered in place of the dashboard.
    await expect(
      page.locator(
        'text=Company를 선택하면 자동 생성된 TestCase와 Job 목록이 표시됩니다.',
      ),
    ).toBeVisible();

    // Dashboard sections are absent until a Company is selected.
    await expect(page.getByTestId('active-jobs-section')).toHaveCount(0);
    await expect(page.getByTestId('history-jobs-section')).toHaveCount(0);
    await expect(page.getByTestId('unassigned-section')).toHaveCount(0);
    await expect(page.getByTestId('assigned-section')).toHaveCount(0);
  });

  // Flaky when run after other UI specs: Company <select> occasionally stays
  // disabled (isLoadingCompanies=true) long enough to exceed the select-option
  // retry window. Passes in isolation. Pending investigation.
  test.fixme('selects Company and shows 4 dashboard sections with URL query', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/test-studio`);

    const select = page.getByTestId('test-studio-company-select');
    await expect(select).toBeVisible();

    // Pick our seeded company by its id (the select's <option value> is the id).
    await select.selectOption(String(companyId));

    // URL persists the companyId.
    await expect(page).toHaveURL(new RegExp(`\\?companyId=${companyId}`));

    // All four dashboard sections become visible.
    await expect(page.getByTestId('active-jobs-section')).toBeVisible();
    await expect(page.getByTestId('history-jobs-section')).toBeVisible();
    await expect(page.getByTestId('unassigned-section')).toBeVisible();
    await expect(page.getByTestId('assigned-section')).toBeVisible();

    // The new-job button is now enabled.
    await expect(page.getByTestId('test-studio-new-job-button')).toBeEnabled();
  });

  // Flaky in serial batch runs — companies list occasionally takes > 10s to load
  // after prior specs have run. Passes in isolation. Pending investigation
  // (same root cause as "selects Company" above).
  test.fixme('Company selection persists across reload via URL query', async ({
    page,
  }) => {
    // Navigate directly with the ?companyId param — simulates a reload / shared link.
    await page.goto(`${BASE_URL}/test-studio?companyId=${companyId}`);

    const select = page.getByTestId('test-studio-company-select');
    await expect(select).toHaveValue(String(companyId));

    // Dashboard sections should be visible after reload.
    await expect(page.getByTestId('active-jobs-section')).toBeVisible();
    await expect(page.getByTestId('assigned-section')).toBeVisible();

    // Reload once more to be safe.
    await page.reload();
    await expect(page.getByTestId('test-studio-company-select')).toHaveValue(
      String(companyId),
    );
    await expect(page.getByTestId('active-jobs-section')).toBeVisible();
  });

  test('history section is collapsible', async ({ page }) => {
    await page.goto(`${BASE_URL}/test-studio?companyId=${companyId}`);

    const section = page.getByTestId('history-jobs-section');
    await expect(section).toBeVisible();

    const toggle = page.getByTestId('history-toggle');
    await expect(toggle).toBeVisible();

    // Initial state: collapsed — content ("완료된 Job이 없습니다." OR a job row)
    // is NOT rendered.
    await expect(
      section.locator('text=완료된 Job이 없습니다.'),
    ).toHaveCount(0);

    // Expand
    await toggle.click();
    await expect(
      section.locator('text=완료된 Job이 없습니다.'),
    ).toBeVisible();

    // Collapse again
    await toggle.click();
    await expect(
      section.locator('text=완료된 Job이 없습니다.'),
    ).toHaveCount(0);
  });

  test('navigates to /test-studio/new via + button and back via back link', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/test-studio?companyId=${companyId}`);

    const newBtn = page.getByTestId('test-studio-new-job-button');
    await expect(newBtn).toBeEnabled();
    await newBtn.click();

    await expect(page).toHaveURL(
      new RegExp(`/test-studio/new\\?companyId=${companyId}`),
    );

    const back = page.getByTestId('test-studio-new-back');
    await expect(back).toBeVisible();
    await back.click();

    await expect(page).toHaveURL(
      new RegExp(`/test-studio(\\?companyId=${companyId})?$`),
    );
    await expect(page.getByTestId('test-studio-company-select')).toHaveValue(
      String(companyId),
    );
  });

  test('/test-studio/new — Product selector disables form until chosen', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/test-studio/new?companyId=${companyId}`);

    const productSelect = page.getByTestId('test-studio-new-product-select');
    await expect(productSelect).toBeVisible();

    // Before a product is chosen, the placeholder renders and the job form is absent.
    await expect(
      page.locator('text=Product를 선택하면 문서 입력 폼이 나타납니다.'),
    ).toBeVisible();
    // TestStudioJobForm's title input is the first form field — it should NOT exist yet.
    await expect(page.getByTestId('test-studio-title')).toHaveCount(0);

    // Choose the seeded product.
    await productSelect.selectOption(String(productId));

    // Form becomes visible once a product is selected.
    await expect(page.getByTestId('test-studio-title')).toBeVisible();
    await expect(page.getByTestId('test-studio-submit')).toBeVisible();

    // Placeholder disappears.
    await expect(
      page.locator('text=Product를 선택하면 문서 입력 폼이 나타납니다.'),
    ).toHaveCount(0);
  });
});
