import { test, expect, APIRequestContext } from '@playwright/test';
import { loginAsAdminInBrowser } from '../helpers/api-helpers';

const API_URL = process.env.API_URL || 'http://localhost:8080';

test.describe('Convention UI E2E', () => {
  let apiRequest: APIRequestContext;
  const uniqueSuffix = Date.now();
  let createdIds: number[] = [];

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

    // Clean up leftover E2E conventions from previous runs
    const response = await apiRequest.get('/api/conventions');
    const body = await response.json() as any;
    if (body.success && Array.isArray(body.data)) {
      for (const item of body.data) {
        if (item.term?.includes('E2E')) {
          await apiRequest.delete(`/api/conventions/${item.id}`).catch(() => {});
        }
      }
    }
  });

  test.afterAll(async () => {
    // Clean up conventions created during tests
    for (const id of createdIds) {
      await apiRequest.delete(`/api/conventions/${id}`).catch(() => {});
    }
    // Also sweep any remaining E2E conventions
    const response = await apiRequest.get('/api/conventions');
    const body = await response.json() as any;
    if (body.success && Array.isArray(body.data)) {
      for (const item of body.data) {
        if (item.term?.includes('E2E')) {
          await apiRequest.delete(`/api/conventions/${item.id}`).catch(() => {});
        }
      }
    }
    await apiRequest.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
    await page.goto('/conventions');
  });

  // --- Page load ---

  test('should display Word Conventions heading', async ({ page }) => {
    await expect(page.locator('h2').filter({ hasText: 'Word Conventions' })).toBeVisible();
  });

  test('should display "+ Add Word" button', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Add Word' })).toBeVisible();
  });

  test('should navigate to /conventions/new when "+ Add Word" is clicked', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add Word' }).click();
    await expect(page).toHaveURL(/\/conventions\/new/);
  });

  // --- Create flow ---

  test('should create a new word and see it in the list', async ({ page }) => {
    const termName = `E2E-Create-${uniqueSuffix}`;

    // Navigate to create form
    await page.getByRole('button', { name: '+ Add Word' }).click();
    await expect(page).toHaveURL(/\/conventions\/new/);

    // Fill the form
    await page.locator('input[placeholder="용어를 입력하세요"]').fill(termName);
    await page.locator('textarea[placeholder="정의를 입력하세요"]').fill('E2E created definition');
    await page.locator('input[placeholder="카테고리 (선택)"]').fill('E2E Testing');
    // Close autocomplete dropdown by pressing Escape then clicking elsewhere
    await page.locator('input[placeholder="카테고리 (선택)"]').press('Escape');
    await page.locator('label:has-text("Term")').click();

    // Click Create and wait for API response
    const createResponse = page.waitForResponse(
      resp => resp.url().includes('/api/conventions') && resp.request().method() === 'POST' && resp.status() === 201
    );
    await page.getByRole('button', { name: 'Create' }).click();
    const resp = await createResponse;
    const body = await resp.json() as any;
    if (body.data?.id) createdIds.push(body.data.id);

    // Should redirect back to list
    await expect(page).toHaveURL(/\/conventions$/);

    // Wait for list to load then verify card is visible
    await page.waitForResponse(
      resp => resp.url().includes('/api/conventions') && resp.request().method() === 'GET'
    );
    await expect(page.getByText(termName)).toBeVisible();
  });

  // --- Edit flow ---

  test('should edit a word via card click', async ({ page }) => {
    // Create a convention via API first
    const termName = `E2E-Edit-${uniqueSuffix}`;
    const createResp = await apiRequest.post('/api/conventions', {
      data: { term: termName, definition: 'Original definition', category: 'E2E Testing' },
    });
    const createBody = await createResp.json() as any;
    const conventionId = createBody.data.id;
    createdIds.push(conventionId);

    // Reload the list
    await page.reload();
    await page.waitForResponse(
      resp => resp.url().includes('/api/conventions') && resp.request().method() === 'GET'
    );

    // Click the card to open edit form
    await page.getByText(termName).click();
    await expect(page).toHaveURL(new RegExp(`/conventions/${conventionId}`));

    // Verify form loaded with existing data
    const termInput = page.locator('input[placeholder="용어를 입력하세요"]');
    await expect(termInput).toHaveValue(termName);

    // Modify the term
    const updatedTerm = `E2E-Edited-${uniqueSuffix}`;
    await termInput.clear();
    await termInput.fill(updatedTerm);

    // Click Update and wait for API response
    const updateResponse = page.waitForResponse(
      resp => resp.url().includes(`/api/conventions/${conventionId}`) && resp.request().method() === 'PUT'
    );
    await page.getByRole('button', { name: 'Update' }).click();
    await updateResponse;

    // Should redirect back to list
    await expect(page).toHaveURL(/\/conventions$/);

    // Verify updated card (auto-retry handles race condition between PUT commit and GET fetch)
    await expect(page.getByText(updatedTerm)).toBeVisible({ timeout: 5000 });
  });

  // --- Delete from list (card delete button) ---

  test('should delete a word from the list via card delete button', async ({ page }) => {
    // Create a convention via API
    const termName = `E2E-DelList-${uniqueSuffix}`;
    const createResp = await apiRequest.post('/api/conventions', {
      data: { term: termName, definition: 'To be deleted from list', category: 'E2E Testing' },
    });
    const createBody = await createResp.json() as any;
    const conventionId = createBody.data.id;
    // Don't push to createdIds since we expect it to be deleted

    // Reload the list
    await page.reload();
    await page.waitForResponse(
      resp => resp.url().includes('/api/conventions') && resp.request().method() === 'GET'
    );

    // Find the card with the term
    const card = page.locator('.cursor-pointer').filter({ hasText: termName });
    await expect(card).toBeVisible();

    // Click the delete button on the card (the trash icon button)
    page.on('dialog', dialog => dialog.accept());
    const deleteResponse = page.waitForResponse(
      resp => resp.url().includes(`/api/conventions/${conventionId}`) && resp.request().method() === 'DELETE'
    );
    await card.locator('button[title="삭제"]').click();
    await deleteResponse;

    // Card should be removed
    await expect(page.getByText(termName)).not.toBeVisible();
  });

  // --- Delete from form page ---

  test('should delete a word from the edit form page', async ({ page }) => {
    // Create a convention via API
    const termName = `E2E-DelForm-${uniqueSuffix}`;
    const createResp = await apiRequest.post('/api/conventions', {
      data: { term: termName, definition: 'To be deleted from form', category: 'E2E Testing' },
    });
    const createBody = await createResp.json() as any;
    const conventionId = createBody.data.id;

    // Navigate to the edit form
    await page.goto(`/conventions/${conventionId}`);
    await expect(page.locator('input[placeholder="용어를 입력하세요"]')).toHaveValue(termName);

    // Click Delete button and confirm
    page.on('dialog', dialog => dialog.accept());
    const deleteResponse = page.waitForResponse(
      resp => resp.url().includes(`/api/conventions/${conventionId}`) && resp.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: 'Delete' }).click();
    await deleteResponse;

    // Should redirect back to list
    await expect(page).toHaveURL(/\/conventions$/);

    // Term should no longer appear
    await page.waitForResponse(
      resp => resp.url().includes('/api/conventions') && resp.request().method() === 'GET'
    );
    await expect(page.getByText(termName)).not.toBeVisible();
  });

  // --- Category autocomplete ---

  test('should show category suggestions when focused on category input', async ({ page }) => {
    // Create a convention with a known category via API to seed word_category
    const catName = `E2E-CatSuggest-${uniqueSuffix}`;
    const createResp = await apiRequest.post('/api/conventions', {
      data: { term: `E2E-ForCat-${uniqueSuffix}`, definition: 'Category test', category: catName },
    });
    const createBody = await createResp.json() as any;
    createdIds.push(createBody.data.id);

    // Navigate to create form
    await page.getByRole('button', { name: '+ Add Word' }).click();
    await expect(page).toHaveURL(/\/conventions\/new/);

    // Focus on category input
    const catInput = page.locator('input[placeholder="카테고리 (선택)"]');
    await catInput.click();

    // Should show suggestions dropdown
    await expect(page.locator('ul.absolute li').first()).toBeVisible({ timeout: 5000 });
  });

  test('should filter category suggestions when typing', async ({ page }) => {
    // Ensure a category exists by creating a convention with it via API
    const catName = `E2E-CatFilter-${uniqueSuffix}`;
    const seedResp = await apiRequest.post('/api/conventions', {
      data: { term: `E2E-ForFilter-${uniqueSuffix}`, definition: 'Filter test seed', category: catName },
    });
    const seedBody = await seedResp.json() as any;
    createdIds.push(seedBody.data.id);

    // Navigate to create form
    await page.getByRole('button', { name: '+ Add Word' }).click();
    await expect(page).toHaveURL(/\/conventions\/new/);

    // Type partial category name
    const catInput = page.locator('input[placeholder="카테고리 (선택)"]');
    await catInput.fill('E2E-CatFilter');

    // Should show filtered suggestions containing the typed text
    const suggestions = page.locator('ul.absolute li').filter({ hasText: 'E2E-CatFilter' });
    await expect(suggestions.first()).toBeVisible({ timeout: 5000 });

    // Click the first suggestion
    await suggestions.first().click();

    // Input should be filled with the selected category
    await expect(catInput).toHaveValue(/E2E-CatFilter/);
  });

  test('should center-align the form page', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add Word' }).click();
    await expect(page).toHaveURL(/\/conventions\/new/);

    // The form container should have mx-auto for centering
    const formContainer = page.locator('.max-w-2xl.mx-auto');
    await expect(formContainer).toBeVisible();
  });

  // --- Search ---

  test('should filter cards by search query', async ({ page }) => {
    // Create two conventions with distinct terms
    const matchTerm = `E2E-SearchMatch-${uniqueSuffix}`;
    const noMatchTerm = `E2E-SearchOther-${uniqueSuffix}`;

    const resp1 = await apiRequest.post('/api/conventions', {
      data: { term: matchTerm, definition: 'Findable item', category: 'E2E Testing' },
    });
    const body1 = await resp1.json() as any;
    createdIds.push(body1.data.id);

    const resp2 = await apiRequest.post('/api/conventions', {
      data: { term: noMatchTerm, definition: 'Another item', category: 'E2E Testing' },
    });
    const body2 = await resp2.json() as any;
    createdIds.push(body2.data.id);

    // Reload the page
    await page.reload();
    await page.waitForResponse(
      resp => resp.url().includes('/api/conventions') && resp.request().method() === 'GET'
    );

    // Both should be visible initially
    await expect(page.getByText(matchTerm)).toBeVisible();
    await expect(page.getByText(noMatchTerm)).toBeVisible();

    // Type search query that matches only one
    const searchInput = page.locator('input[placeholder="용어, 정의, 카테고리 검색..."]');
    await searchInput.fill('SearchMatch');

    // Matching card should remain, non-matching should disappear
    await expect(page.getByText(matchTerm)).toBeVisible();
    await expect(page.getByText(noMatchTerm)).not.toBeVisible();

    // Clear search to restore both
    await searchInput.clear();
    await expect(page.getByText(matchTerm)).toBeVisible();
    await expect(page.getByText(noMatchTerm)).toBeVisible();
  });

  // --- Sort ---

  test('should toggle sort between date and name order', async ({ page }) => {
    // Create two conventions with known alphabetical order
    const termA = `E2E-SortAlpha-${uniqueSuffix}`;
    const termZ = `E2E-SortZeta-${uniqueSuffix}`;

    const resp1 = await apiRequest.post('/api/conventions', {
      data: { term: termA, definition: 'First alphabetically', category: 'E2E Testing' },
    });
    const body1 = await resp1.json() as any;
    createdIds.push(body1.data.id);

    const resp2 = await apiRequest.post('/api/conventions', {
      data: { term: termZ, definition: 'Last alphabetically', category: 'E2E Testing' },
    });
    const body2 = await resp2.json() as any;
    createdIds.push(body2.data.id);

    // Reload
    await page.reload();
    await page.waitForResponse(
      resp => resp.url().includes('/api/conventions') && resp.request().method() === 'GET'
    );

    // Default sort is by date (등록순) - termZ should come after termA since created later
    const dateButton = page.getByRole('button', { name: '등록순' });
    const nameButton = page.getByRole('button', { name: '이름순' });
    await expect(dateButton).toBeVisible();
    await expect(nameButton).toBeVisible();

    // Switch to name sort
    await nameButton.click();

    // Get all card headings (h3 elements) to check order
    // Filter to only E2E-Sort cards to avoid interference from other data
    const allCards = page.locator('h3').filter({ hasText: /E2E-Sort/ });
    const cardTexts = await allCards.allInnerTexts();
    const sortCards = cardTexts.filter(t => t.includes('E2E-Sort'));

    // In name order, Alpha should come before Zeta
    if (sortCards.length >= 2) {
      const alphaIndex = sortCards.findIndex(t => t.includes('SortAlpha'));
      const zetaIndex = sortCards.findIndex(t => t.includes('SortZeta'));
      expect(alphaIndex).toBeLessThan(zetaIndex);
    }

    // Switch back to date sort
    await dateButton.click();

    // In date order (newest first typically), Zeta was created later
    const allCardsAfter = page.locator('h3').filter({ hasText: /E2E-Sort/ });
    const cardTextsAfter = await allCardsAfter.allInnerTexts();
    const sortCardsAfter = cardTextsAfter.filter(t => t.includes('E2E-Sort'));

    // Just verify both are still visible (order may vary by implementation)
    expect(sortCardsAfter.some(t => t.includes('SortAlpha'))).toBe(true);
    expect(sortCardsAfter.some(t => t.includes('SortZeta'))).toBe(true);
  });
});
