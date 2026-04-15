import { test, expect, Page } from '@playwright/test';
import {
  createTestCompany,
  createTestProduct,
  createTestSegment,
  createTestTestCase,
  cleanupAllTestData,
  loginAsAdminInBrowser,
} from '../helpers/api-helpers';
import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:8080';
const FRONTEND_URL = 'http://localhost:5173';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface TestRun {
  id: number;
  name: string;
  description?: string;
  testCaseCount: number;
  testCases: { id: number; title: string }[];
}

test.describe.serial('TestRun UI E2E', () => {
  let page: Page;
  let companyId: number;
  let productId: number;
  let segmentId: number;
  let testCaseId1: number;
  let testCaseId2: number;
  let testRunId: number;

  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
  });

  test.beforeAll(async () => {
    // Login and set token on local apiClient
    const loginResp = await apiClient.post('/api/auth/login', { username: 'admin', password: 'admin' });
    const token = loginResp.data.data.token;
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    await cleanupAllTestData();

    const company = await createTestCompany('E2E TestRun UI Company');
    companyId = company.id;

    const product = await createTestProduct(companyId, 'E2E TestRun UI Product');
    productId = product.id;

    const segment = await createTestSegment(productId, 'E2E TestRun UI Segment');
    segmentId = segment.id;

    const tc1 = await createTestTestCase(productId, 'E2E TR UI TC 1', [segmentId]);
    testCaseId1 = tc1.id;

    const tc2 = await createTestTestCase(productId, 'E2E TR UI TC 2', [segmentId]);
    testCaseId2 = tc2.id;

    // Create a test run via API for list/detail tests
    const testRunResponse = await apiClient.post<ApiResponse<TestRun>>(
      `/api/products/${productId}/test-runs`,
      {
        name: 'E2E TestRun Detail Suite',
        description: 'Test run for UI E2E testing',
        testCaseIds: [testCaseId1, testCaseId2],
      }
    );
    testRunId = testRunResponse.data.data.id;
  });

  test.beforeEach(async ({ page: newPage }) => {
    page = newPage;
    await loginAsAdminInBrowser(page);
  });

  // Helper: navigate to TestRunListPage
  async function goToTestRunList() {
    await page.goto(
      `${FRONTEND_URL}/features/companies/${companyId}/products/${productId}/test-runs`
    );
    await page.waitForLoadState('networkidle');
  }

  // Helper: navigate to TestRunDetailPage
  async function goToTestRunDetail(trId: number) {
    await page.goto(
      `${FRONTEND_URL}/features/companies/${companyId}/products/${productId}/test-runs/${trId}`
    );
    await page.waitForLoadState('networkidle');
  }

  test('TestRunListPage - "Test Runs" heading 표시', async () => {
    await goToTestRunList();

    const heading = page.locator('h1:has-text("Test Runs")');
    await expect(heading).toBeVisible();
  });

  test('TestRunListPage - "+ New Test Run" button 표시', async () => {
    await goToTestRunList();

    const newBtn = page.getByRole('button', { name: /\+ New Test Run/i });
    await expect(newBtn).toBeVisible();
  });

  test('TestRunListPage - TestRun 카드 클릭 → DetailPage 이동', async () => {
    await goToTestRunList();

    // Wait for the test run card text to appear and click it
    const cardText = page.getByText('E2E TestRun Detail Suite');
    await expect(cardText).toBeVisible({ timeout: 10000 });
    await cardText.click();
    await page.waitForLoadState('networkidle');

    // Should navigate to detail page
    expect(page.url()).toContain(`/test-runs/${testRunId}`);
  });

  test('TestRunDetailPage - TestRun 이름 표시', async () => {
    await goToTestRunDetail(testRunId);

    const heading = page.locator('h1:has-text("E2E TestRun Detail Suite")');
    await expect(heading).toBeVisible();
  });

  test('TestRunDetailPage - Edit/Delete 버튼 표시', async () => {
    await goToTestRunDetail(testRunId);

    const editBtn = page.getByRole('button', { name: 'Edit' });
    const deleteBtn = page.getByRole('button', { name: 'Delete' });

    await expect(editBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();
  });

  test('TestRunDetailPage - Edit 클릭 → 인라인 편집 모드 진입', async () => {
    await goToTestRunDetail(testRunId);

    // Click Edit button
    const editBtn = page.getByRole('button', { name: 'Edit' });
    await editBtn.click();

    // Should show "Edit Test Run" heading
    const editHeading = page.locator('h1:has-text("Edit Test Run")');
    await expect(editHeading).toBeVisible();

    // Name input should be visible with current value
    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('E2E TestRun Detail Suite');

    // Save and Cancel buttons should be visible
    const saveBtn = page.getByRole('button', { name: 'Save' });
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await expect(saveBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();
  });

  test('TestRunDetailPage - Edit 모드에서 이름 수정 후 Save (BUG-1 verification)', async () => {
    await goToTestRunDetail(testRunId);

    // Enter edit mode
    await page.getByRole('button', { name: 'Edit' }).click();

    // Clear and type new name
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.clear();
    await nameInput.fill('E2E TestRun Updated Name');

    // Wait for PATCH response on save
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/test-runs/') && resp.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: 'Save' }).click();
    await responsePromise;

    // Should exit edit mode and show updated name in h1
    const updatedHeading = page.locator('h1:has-text("E2E TestRun Updated Name")');
    await expect(updatedHeading).toBeVisible();

    // Edit and Delete buttons should be visible again (read mode)
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('TestRunDetailPage - TC 행 클릭 → 상세 정보 확장/축소', async () => {
    await goToTestRunDetail(testRunId);

    // Find a test case row and click it to expand
    const tcRow = page.locator('tr:has-text("E2E TR UI TC"), [data-testid*="tc-row"], li:has-text("E2E TR UI TC")').first();
    await expect(tcRow).toBeVisible({ timeout: 10000 });
    await tcRow.click();

    // Expanded content should be visible (look for step details, description, or expected result)
    const expandedContent = page.locator('text=/Steps|Expected Result|Description|Priority|Test Type/i').first();
    await expect(expandedContent).toBeVisible({ timeout: 5000 });

    // Click again to collapse
    await tcRow.click();

    // Expanded content should no longer be visible
    await expect(expandedContent).not.toBeVisible({ timeout: 5000 });
  });

  test('TestRunDetailPage - Delete 클릭 → ConfirmDialog 표시', async () => {
    await goToTestRunDetail(testRunId);

    // Click Delete button
    await page.getByRole('button', { name: 'Delete' }).click();

    // ConfirmDialog should appear
    const dialog = page.locator('.fixed.inset-0');
    await expect(dialog).toBeVisible();

    // Dialog should show "Delete Test Run" title
    const dialogTitle = page.locator('h3:has-text("Delete Test Run")');
    await expect(dialogTitle).toBeVisible();

    // Confirm and Cancel buttons should be in the dialog
    const confirmBtn = dialog.getByRole('button', { name: 'Delete' });
    const cancelBtn = dialog.getByRole('button', { name: 'Cancel' });
    await expect(confirmBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();
  });

  test.afterAll(async () => {
    await cleanupAllTestData();
  });
});
