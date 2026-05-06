import { test, expect, APIRequestContext } from '@playwright/test';
import { loginAsAdminInBrowser } from '../helpers/api-helpers';

const API_URL = process.env.API_URL || 'http://localhost:8080';

test.describe('Knowledge Base UI E2E', () => {
  let apiRequest: APIRequestContext;
  const testTitle = `E2E KB Article ${Date.now()}`;
  const testContent = '## E2E Heading\n\nThis is **bold** and `code` content for testing.';
  let createdKbId: number | null = null;

  test.beforeAll(async ({ playwright }) => {
    // Login to get admin token for API calls
    const loginCtx = await playwright.request.newContext({ baseURL: API_URL });
    const loginResp = await loginCtx.post('/api/auth/login', { data: { username: 'admin', password: 'admin' } });
    const token = (await loginResp.json() as any).data.token;
    await loginCtx.dispose();

    apiRequest = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
  });

  test.afterAll(async () => {
    // Clean up any KB entries created during tests
    if (createdKbId) {
      await apiRequest.delete(`/api/kb/${createdKbId}`).catch(() => {});
    }
    // Also clean up any leftover E2E entries
    const response = await apiRequest.get('/api/kb');
    const body = await response.json() as any;
    if (body.success && Array.isArray(body.data)) {
      for (const item of body.data) {
        if (item.title?.includes('E2E')) {
          await apiRequest.delete(`/api/kb/${item.id}`).catch(() => {});
        }
      }
    }
    await apiRequest.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
    await page.goto('/kb');
  });

  // --- Navigation ---

  test('should display Knowledge Base heading on page load', async ({ page }) => {
    await expect(page.locator('h2').filter({ hasText: 'Knowledge Base' })).toBeVisible();
  });

  test('should navigate to write page when "+ 직접 작성" is clicked', async ({ page }) => {
    await page.getByRole('button', { name: '+ 직접 작성' }).click();
    await expect(page).toHaveURL(/\/kb\/write/);
    await expect(page.locator('h2').filter({ hasText: '새 글 작성' })).toBeVisible();
  });

  test('should show Markdown editor on write page', async ({ page }) => {
    await page.goto('/kb/write');
    // MDEditor renders a container with data-color-mode attribute
    await expect(page.locator('[data-color-mode="light"]')).toBeVisible();
    // Title input
    await expect(page.locator('input[placeholder="제목을 입력하세요"]')).toBeVisible();
    // Save button
    await expect(page.getByRole('button', { name: '저장' })).toBeVisible();
    // Cancel button
    await expect(page.getByRole('button', { name: '취소' })).toBeVisible();
  });

  // --- Create flow ---

  test('should create a KB entry via write page and redirect to detail page', async ({ page }) => {
    await page.goto('/kb/write');

    // Fill in the form
    await page.locator('input[placeholder="제목을 입력하세요"]').fill(testTitle);
    await page.locator('input[placeholder*="카테고리"]').fill('E2E Testing');
    // Tags input removed in v6 — only category remains

    // Type content into MDEditor textarea
    const editorTextarea = page.locator('.w-md-editor-text-input');
    await editorTextarea.fill(testContent);

    // Click save and wait for API response
    const createResponse = page.waitForResponse(
      resp => resp.url().includes('/api/kb') && resp.request().method() === 'POST' && resp.status() === 201
    );
    await page.getByRole('button', { name: '저장' }).click();
    const resp = await createResponse;
    const body = await resp.json() as any;
    createdKbId = body.data?.id;

    // Should redirect to detail page /kb/:id
    await expect(page).toHaveURL(/\/kb\/\d+/);
  });

  // --- Detail page ---

  test('should display content on detail page', async ({ page }) => {
    // Ensure we have a KB entry to view
    if (!createdKbId) {
      const resp = await apiRequest.post('/api/kb', {
        data: { title: testTitle, content: testContent, category: 'E2E Testing' },
      });
      const body = await resp.json() as any;
      createdKbId = body.data.id;
    }

    await page.goto(`/kb/${createdKbId}`);

    // Title should be visible
    await expect(page.locator('h1').filter({ hasText: testTitle })).toBeVisible();
    // Category badge
    await expect(page.getByText('E2E Testing')).toBeVisible();
    // "직접 작성" badge (manual source)
    await expect(page.getByText('직접 작성')).toBeVisible();
    // Back link
    await expect(page.getByText('목록으로')).toBeVisible();
    // Edit button (수정)
    await expect(page.getByRole('button', { name: '수정' })).toBeVisible();
  });

  // --- Edit flow ---

  test('should navigate to edit page from detail page and save changes', async ({ page }) => {
    if (!createdKbId) {
      const resp = await apiRequest.post('/api/kb', {
        data: { title: testTitle, content: testContent, category: 'E2E Testing' },
      });
      const body = await resp.json() as any;
      createdKbId = body.data.id;
    }

    await page.goto(`/kb/${createdKbId}`);

    // Click edit button
    await page.getByRole('button', { name: '수정' }).click();
    await expect(page).toHaveURL(new RegExp(`/kb/edit/${createdKbId}`));

    // Edit page header
    await expect(page.locator('h2').filter({ hasText: '글 수정' })).toBeVisible();

    // Title input should have existing value
    const titleInput = page.locator('input[placeholder="제목을 입력하세요"]');
    await expect(titleInput).toHaveValue(testTitle);

    // Update the title
    const updatedTitle = `E2E KB Updated ${Date.now()}`;
    await titleInput.clear();
    await titleInput.fill(updatedTitle);

    // Save and wait for API response
    const updateResponse = page.waitForResponse(
      resp => resp.url().includes(`/api/kb/${createdKbId}`) && resp.request().method() === 'PUT'
    );
    await page.getByRole('button', { name: '저장' }).click();
    await updateResponse;

    // Should redirect back to detail page
    await expect(page).toHaveURL(new RegExp(`/kb/${createdKbId}`));
    // Updated title should be visible
    await expect(page.locator('h1').filter({ hasText: updatedTitle })).toBeVisible();
  });

  // --- Card navigation ---

  test('should navigate to detail page when card is clicked on list page', async ({ page }) => {
    // Ensure we have a KB entry
    if (!createdKbId) {
      const resp = await apiRequest.post('/api/kb', {
        data: { title: testTitle, content: testContent, category: 'E2E Testing' },
      });
      const body = await resp.json() as any;
      createdKbId = body.data.id;
    }

    // Wait for KB cards to render
    const card = page.locator('.cursor-pointer').filter({ hasText: /E2E/ }).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/kb\/\d+/);
    // Detail page should have the title in h1 (not the sidebar h1)
    await expect(page.locator('h1.text-3xl')).toBeVisible();
  });

  // --- Card content ---

  test('should not show content preview or edit/delete buttons on cards', async ({ page }) => {
    // Ensure we have a KB entry
    if (!createdKbId) {
      const resp = await apiRequest.post('/api/kb', {
        data: {
          title: testTitle,
          content: '## This is a heading\n\nSome **bold** text and `code` here.',
          category: 'E2E Testing',
        },
      });
      const body = await resp.json() as any;
      createdKbId = body.data.id;
    }

    // Wait for the KB list to load
    await page.waitForResponse(
      resp => resp.url().includes('/api/kb') && resp.request().method() === 'GET'
    );

    // Find a card with E2E content
    const card = page.locator('.cursor-pointer').filter({ hasText: /E2E/ }).first();
    await expect(card).toBeVisible();

    // Card should NOT have content preview text
    const cardText = await card.innerText();
    expect(cardText).not.toContain('This is a heading');
    expect(cardText).not.toContain('bold');

    // Card should NOT have Edit/Delete buttons
    await expect(card.locator('text=Edit')).not.toBeVisible();
    await expect(card.locator('text=Delete')).not.toBeVisible();
  });

  // --- Search & Sort UI ---

  test('should show search input and sort dropdown', async ({ page }) => {
    await expect(page.locator('input[placeholder*="검색"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
  });

  test('should filter results when typing in search', async ({ page }) => {
    // Ensure we have an entry
    if (!createdKbId) {
      const resp = await apiRequest.post('/api/kb', {
        data: { title: testTitle, content: testContent, category: 'E2E Testing' },
      });
      const body = await resp.json() as any;
      createdKbId = body.data.id;
    }

    // Type a search query
    const searchInput = page.locator('input[placeholder*="검색"]');
    await searchInput.fill('E2E');

    // Wait for debounced search to fire
    await page.waitForResponse(
      resp => resp.url().includes('/api/kb') && resp.url().includes('search=E2E')
    );

    // Should still show E2E items
    await expect(page.locator('.cursor-pointer').first()).toBeVisible({ timeout: 5000 });
  });

  // --- Tags removed ---

  test('should not show tags input on write page', async ({ page }) => {
    await page.goto('/kb/write');
    await expect(page.locator('input[placeholder*="태그"]')).not.toBeVisible();
  });

  // --- Pin/Unpin UI (v7 — migrated from KbManagementView) ---

  test.describe('KB Pin/Unpin UI (v7)', () => {
    let pinTestId: number;

    test.beforeAll(async () => {
      // Create a dedicated test KB via API
      const resp = await apiRequest.post('/api/kb', {
        data: {
          title: 'E2E Pin UI Test KB',
          content: 'Used for pin/unpin UI test',
          category: 'Testing',
        },
      });
      const body = await resp.json() as any;
      pinTestId = body.data.id;
      // Make sure it's unpinned at start
      await apiRequest.patch(`/api/kb/${pinTestId}/unpin`).catch(() => {});
    });

    test.afterAll(async () => {
      if (pinTestId) {
        await apiRequest.patch(`/api/kb/${pinTestId}/unpin`).catch(() => {});
        await apiRequest.delete(`/api/kb/${pinTestId}`).catch(() => {});
      }
    });

    test('Pin toggle button is visible on /kb page', async ({ page }) => {
      await page.goto('/kb');
      await page.waitForResponse((resp) => resp.url().includes('/api/kb') && resp.request().method() === 'GET');
      const toggle = page.getByTestId(`kb-pin-toggle-${pinTestId}`);
      await expect(toggle).toBeVisible();
    });

    test('clicking Pin toggle pins the entry', async ({ page }) => {
      await page.goto('/kb');
      await page.waitForResponse((resp) => resp.url().includes('/api/kb') && resp.request().method() === 'GET');

      const toggle = page.getByTestId(`kb-pin-toggle-${pinTestId}`);
      await toggle.click();

      // Wait for pin API
      await page.waitForResponse(
        (resp) => resp.url().includes(`/api/kb/${pinTestId}/pin`) && resp.request().method() === 'PATCH'
      );

      // "FAQ 고정됨" indicator should appear
      await expect(page.getByText('📌 FAQ 고정됨')).toBeVisible({ timeout: 5000 });
    });

    test('clicking Pin toggle on already-pinned unpins the entry', async ({ page }) => {
      // Ensure pinned via API
      await apiRequest.patch(`/api/kb/${pinTestId}/pin`).catch(() => {});

      await page.goto('/kb');
      await page.waitForResponse((resp) => resp.url().includes('/api/kb') && resp.request().method() === 'GET');

      const toggle = page.getByTestId(`kb-pin-toggle-${pinTestId}`);
      await toggle.click();

      await page.waitForResponse(
        (resp) => resp.url().includes(`/api/kb/${pinTestId}/unpin`) && resp.request().method() === 'PATCH'
      );
    });
  });
});
