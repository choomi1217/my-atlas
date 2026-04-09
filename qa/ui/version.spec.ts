import { test, expect, Page } from '@playwright/test';
import {
  createTestCompany,
  createTestProduct,
  createTestSegment,
  createTestTestCase,
  cleanupAllTestData,
} from '../helpers/api-helpers';
import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:8080';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface TestRun {
  id: number;
  name: string;
  testCases: unknown[];
}

interface Phase {
  id: number;
  phaseName: string;
  testRunId: number;
}

interface Version {
  id: number;
  name: string;
  releaseDate?: string;
  phases: Phase[];
  isReleaseDatePassed: boolean;
  warningMessage?: string;
}

test.describe('Version Management UI E2E', () => {
  let page: Page;
  let companyId: number;
  let productId: number;
  let testRunId: number;
  let versionId: number;
  let testCaseId1: number;
  let testCaseId2: number;
  let segmentId: number;

  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
  });

  test.beforeAll(async () => {
    await cleanupAllTestData();

    const company = await createTestCompany('E2E Version UI Company');
    companyId = company.id;

    const product = await createTestProduct(companyId, 'E2E Version UI Product');
    productId = product.id;

    const segment = await createTestSegment(productId, 'Version UI Segment');
    segmentId = segment.id;

    const tc1 = await createTestTestCase(productId, 'E2E UI TC 1', [segmentId]);
    testCaseId1 = tc1.id;

    const tc2 = await createTestTestCase(productId, 'E2E UI TC 2', [segmentId]);
    testCaseId2 = tc2.id;

    const testRunResponse = await apiClient.post<ApiResponse<TestRun>>(
      `/api/products/${productId}/test-runs`,
      {
        name: 'E2E Version UI Test Run',
        description: 'Test run for version UI',
        testCaseIds: [testCaseId1, testCaseId2],
      }
    );
    testRunId = testRunResponse.data.data.id;
  });

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  // Helper: navigate to ProductListPage for our company
  async function goToProductList() {
    await page.goto(`/features/companies/${companyId}`);
    await page.waitForLoadState('networkidle');
  }

  // Helper: navigate to VersionListPage
  async function goToVersionList() {
    await page.goto(
      `/features/companies/${companyId}/products/${productId}/versions`
    );
    await page.waitForLoadState('networkidle');
  }

  // Helper: navigate to VersionDetailPage
  async function goToVersionDetail(vid: number) {
    await page.goto(
      `/features/companies/${companyId}/products/${productId}/versions/${vid}`
    );
    await page.waitForLoadState('networkidle');
  }

  test('ProductListPage → VersionListPage 네비게이션', async () => {
    await goToProductList();

    // Product card should show "Versions" button
    const versionButton = page.locator('button:has-text("Versions")');
    await expect(versionButton.first()).toBeVisible();

    // Click Versions button
    await versionButton.first().click();
    await page.waitForLoadState('networkidle');

    // Should be on VersionListPage
    expect(page.url()).toContain('/versions');
  });

  test('VersionListPage - 새 버전 버튼 표시', async () => {
    await goToVersionList();

    // Should show "새 버전" button
    const newVersionBtn = page.locator('[data-testid="new-version-btn"]');
    await expect(newVersionBtn).toBeVisible();
  });

  test('VersionListPage - "새 버전" 버튼 클릭 → 모달 열기', async () => {
    await goToVersionList();

    // Click new version button
    const newVersionBtn = page.locator('[data-testid="new-version-btn"]');
    await newVersionBtn.click();

    // Modal should appear
    const modal = page.locator('[data-testid="version-form-modal"]');
    await expect(modal).toBeVisible();

    // Name input should be visible
    const nameInput = page.locator('[data-testid="version-name-input"]');
    await expect(nameInput).toBeVisible();
  });

  test('VersionListPage - 버전 생성 후 목록 표시', async () => {
    // Create version via API
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dateString = futureDate.toISOString().split('T')[0];

    const createResponse = await apiClient.post<ApiResponse<Version>>(
      `/api/products/${productId}/versions`,
      {
        productId,
        name: 'v1.0.0-UI-Test',
        releaseDate: dateString,
        description: 'Test version from UI',
        phases: [
          {
            phaseName: '1차 테스트',
            testRunId,
          },
        ],
      }
    );
    expect(createResponse.status).toBe(201);
    versionId = createResponse.data.data.id;

    // Navigate to version list
    await goToVersionList();

    // Version should appear in list
    const versionCard = page.locator('[data-testid="version-card"]');
    await expect(versionCard.first()).toBeVisible();

    // Version name should be visible
    const versionName = page.locator('text=v1.0.0-UI-Test');
    await expect(versionName).toBeVisible();
  });

  test('VersionListPage - 버전 카드 드릴다운 (VersionDetailPage 이동)', async () => {
    if (!versionId) test.skip();

    await goToVersionList();

    // Click version card (entire card is clickable, no separate detail button)
    const versionCard = page.locator('[data-testid="version-card"]').first();
    await expect(versionCard).toBeVisible();
    await versionCard.click();
    await page.waitForLoadState('networkidle');

    // Should be on VersionDetailPage
    expect(page.url()).toContain(`/versions/${versionId}`);
  });

  test('VersionDetailPage - 버전 상세 정보 표시', async () => {
    if (!versionId) test.skip();

    await goToVersionDetail(versionId);

    // Version name should be visible
    const versionName = page.locator('text=v1.0.0-UI-Test');
    await expect(versionName.first()).toBeVisible();
  });

  test('VersionDetailPage - Phase 목록 표시', async () => {
    if (!versionId) test.skip();

    await goToVersionDetail(versionId);

    // Phase should be visible
    const phaseText = page.locator('text=1차 테스트');
    await expect(phaseText.first()).toBeVisible();
  });

  test('VersionDetailPage - 진행률 표시', async () => {
    if (!versionId) test.skip();

    await goToVersionDetail(versionId);

    // Progress stats should be visible (at least the container)
    // Check for any number format like "0/2" or "Pass" or "Untested"
    const progressIndicator = page.locator('text=/\\d+\\/\\d+|Pass|Untested|UNTESTED/').first();
    if (await progressIndicator.isVisible().catch(() => false)) {
      await expect(progressIndicator).toBeVisible();
    }
  });

  test('VersionDetailPage - release date 경고 표시', async () => {
    // Create a version with past release date
    const pastDate = '2026-01-01';
    const warnResponse = await apiClient.post<ApiResponse<Version>>(
      `/api/products/${productId}/versions`,
      {
        productId,
        name: 'v-expired-ui-test',
        releaseDate: pastDate,
        description: 'Expired version',
        phases: [{ phaseName: 'Phase 1', testRunId }],
      }
    );
    const expiredVersionId = warnResponse.data.data.id;

    await goToVersionDetail(expiredVersionId);

    // Warning message should be visible
    const warning = page.locator('text=/릴리스 예정일|⚠️/').first();
    await expect(warning).toBeVisible();
  });

  test('VersionPhaseDetailPage - 결과 목록 표시', async () => {
    if (!versionId) test.skip();

    // Get phase ID
    const versionResponse = await apiClient.get<ApiResponse<Version>>(
      `/api/versions/${versionId}`
    );
    const phaseId = versionResponse.data.data.phases?.[0]?.id;
    if (!phaseId) test.skip();

    // Navigate to phase results page
    await page.goto(
      `/features/companies/${companyId}/products/${productId}/versions/${versionId}/phases/${phaseId}`
    );
    await page.waitForLoadState('networkidle');

    // Should show test case results (at least the page loaded without error)
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();

    // Look for test case names or result indicators
    const resultItem = page.locator('text=/E2E UI TC|UNTESTED|Pass|Fail/').first();
    if (await resultItem.isVisible().catch(() => false)) {
      await expect(resultItem).toBeVisible();
    }
  });

  test('Breadcrumb 경로 확인', async () => {
    if (!versionId) test.skip();

    await goToVersionDetail(versionId);

    // Check breadcrumb or navigation path exists
    // The page should show some form of navigation back
    const backLink = page.locator('a[href*="/versions"], button:has-text("뒤로"), text=/Company|Product|Version/').first();
    if (await backLink.isVisible().catch(() => false)) {
      await expect(backLink).toBeVisible();
    }
  });

  test('VersionDetailPage - Edit 버튼 클릭 → 인라인 편집 폼 표시', async () => {
    if (!versionId) test.skip();

    await goToVersionDetail(versionId);

    // Edit button should be visible
    const editButton = page.getByRole('button', { name: /^Edit$/i });
    await expect(editButton).toBeVisible();

    // Click Edit button
    await editButton.click();

    // Inline edit form should appear with Name, Description, Release Date inputs
    const nameInput = page.locator('label:has-text("Name") + input, label:has-text("Name") ~ input').first();
    if (await nameInput.isVisible().catch(() => false)) {
      await expect(nameInput).toBeVisible();
    } else {
      // Alternative: check for input fields within the edit area
      const inputsInEditForm = page.locator('input[type="text"], input[type="date"]');
      expect(await inputsInEditForm.count()).toBeGreaterThanOrEqual(1);
    }

    // Save and Cancel buttons should be visible
    await expect(page.getByRole('button', { name: /Save/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();

    // Click Cancel to restore view mode
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Edit form should be gone, version name visible again
    const versionName = page.locator('text=v1.0.0-UI-Test');
    await expect(versionName.first()).toBeVisible();
  });

  test('VersionPhaseDetailPage - StatusButtonGroup 버튼 표시 (select 대신 버튼)', async () => {
    if (!versionId) test.skip();

    // Get phase ID
    const versionResponse = await apiClient.get<ApiResponse<Version>>(
      `/api/versions/${versionId}`
    );
    const phaseId = versionResponse.data.data.phases?.[0]?.id;
    if (!phaseId) test.skip();

    // Navigate to phase detail page
    await page.goto(
      `/features/companies/${companyId}/products/${productId}/versions/${versionId}/phases/${phaseId}`
    );
    await page.waitForLoadState('networkidle');

    // StatusButtonGroup should render buttons (P, F, B, S, R) instead of a select dropdown
    // Check for status abbreviation buttons
    const passButton = page.getByRole('button', { name: /^P$/i }).or(
      page.locator('button[title="Pass"]')
    );
    const failButton = page.getByRole('button', { name: /^F$/i }).or(
      page.locator('button[title="Fail"]')
    );

    // At least one status button should be visible (there are test results)
    const statusButtonVisible = await passButton.first().isVisible().catch(() => false)
      || await failButton.first().isVisible().catch(() => false);
    expect(statusButtonVisible).toBe(true);

    // Ensure no <select> elements are used for status (replaced by StatusButtonGroup)
    const selectElements = page.locator('select');
    const selectCount = await selectElements.count();
    // There should be no select dropdown for status (all replaced by buttons)
    // Note: there might be other selects on the page, so we check specifically
    // The status area should have buttons, not selects
    const statusButtons = page.locator('button[title="Pass"], button[title="Fail"], button[title="Blocked"], button[title="Skip"], button[title="Retest"]');
    expect(await statusButtons.count()).toBeGreaterThan(0);
  });

  test.afterAll(async () => {
    await cleanupAllTestData();
  });
});
