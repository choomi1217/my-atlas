import { test, expect } from '@playwright/test';
import { loginAsAdminInBrowser } from '../helpers/api-helpers';

test.describe('My Senior Page (v7 — Chat-First Hybrid)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
    await page.goto('/senior');
    // Wait for FAQ data load
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/senior/faq') && resp.request().method() === 'GET'
    );
  });

  // --- Hero Section ---

  test('Hero Section is visible with headline + input + submit', async ({ page }) => {
    const hero = page.getByTestId('senior-hero');
    await expect(hero).toBeVisible();
    await expect(hero.getByText('무엇을 도와드릴까요?')).toBeVisible();
    await expect(hero.getByText(/QA 시니어에게 질문하거나/)).toBeVisible();
    await expect(page.getByTestId('senior-hero-input')).toBeVisible();
    await expect(page.getByTestId('senior-hero-submit')).toBeVisible();
  });

  test('Hero submit button is disabled when input is empty', async ({ page }) => {
    await expect(page.getByTestId('senior-hero-submit')).toBeDisabled();
  });

  test('Hero input + submit navigates to /senior/chat?q=... and triggers Chat', async ({ page }) => {
    await page.getByTestId('senior-hero-input').fill('테스트 질문입니다');
    await page.getByTestId('senior-hero-submit').click();

    await expect(page).toHaveURL(/\/senior\/chat/);
    // Verify ChatView is rendered
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('Hero input Enter key navigates to /senior/chat', async ({ page }) => {
    const input = page.getByTestId('senior-hero-input');
    await input.fill('엔터로 전송');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/senior\/chat/);
  });

  // --- Recommended Chips ---

  test('Recommended Chips section renders if there are pinned KB items', async ({ page }) => {
    // Check pinned count via API; if zero, skip
    const faqResp = await page.request.get('/api/senior/faq');
    const faqs = (await faqResp.json()).data || [];
    if (faqs.length === 0) {
      test.info().annotations.push({ type: 'skip-reason', description: 'No pinned KB to render chips' });
      return;
    }

    const chips = page.getByTestId('senior-recommended-chips');
    await expect(chips).toBeVisible();
    await expect(chips.getByText('추천 질문')).toBeVisible();
    // At least one chip should be visible
    const chipButtons = chips.locator('button');
    expect(await chipButtons.count()).toBeGreaterThan(0);
  });

  test('Clicking a chip navigates to /senior/chat?q=...', async ({ page }) => {
    const faqResp = await page.request.get('/api/senior/faq');
    const faqs = (await faqResp.json()).data || [];
    if (faqs.length === 0) return;

    const firstChip = page.getByTestId('senior-recommended-chips').locator('button').first();
    await firstChip.click();
    await expect(page).toHaveURL(/\/senior\/chat\?q=/);
  });

  // --- FAQ Section ---

  test('FAQ Section renders with title + search + show-all', async ({ page }) => {
    const section = page.getByTestId('senior-faq-section');
    await expect(section).toBeVisible();
    await expect(section.getByText('자주 묻는 질문')).toBeVisible();
    await expect(page.getByTestId('senior-faq-search')).toBeVisible();
    await expect(page.getByTestId('senior-faq-show-all')).toBeVisible();
  });

  test('FAQ Search filters cards by title/content', async ({ page }) => {
    const faqResp = await page.request.get('/api/senior/faq');
    const faqs = (await faqResp.json()).data || [];
    if (faqs.length === 0) return;

    // Search with a string unlikely to appear
    await page.getByTestId('senior-faq-search').fill('zzz_no_match_xyz_unique');
    await expect(page.getByText('검색 결과가 없습니다.')).toBeVisible();
  });

  test('FAQ "전체보기" navigates to /senior/faq', async ({ page }) => {
    await page.getByTestId('senior-faq-show-all').click();
    await expect(page).toHaveURL(/\/senior\/faq$/);
  });

  test('FAQ Card displays snippet when collapsed', async ({ page }) => {
    const faqResp = await page.request.get('/api/senior/faq');
    const faqs = (await faqResp.json()).data || [];
    if (faqs.length === 0) return;

    const firstId = faqs[0].id;
    const snippet = page.getByTestId(`faq-snippet-${firstId}`);
    await expect(snippet).toBeVisible();
  });

  test('FAQ Card click expands inline to show full content (no navigation)', async ({ page }) => {
    const faqResp = await page.request.get('/api/senior/faq');
    const faqs = (await faqResp.json()).data || [];
    if (faqs.length === 0) return;

    const firstId = faqs[0].id;
    const card = page.getByTestId(`faq-card-${firstId}`);
    await card.click();

    // Expanded content visible, URL unchanged
    await expect(page.getByTestId(`faq-content-${firstId}`)).toBeVisible();
    await expect(page).toHaveURL(/\/senior$/);
  });

  test('FAQ Card "Chat에서 더 물어보기" → /senior/chat?q=...', async ({ page }) => {
    const faqResp = await page.request.get('/api/senior/faq');
    const faqs = (await faqResp.json()).data || [];
    if (faqs.length === 0) return;

    const firstId = faqs[0].id;
    const card = page.getByTestId(`faq-card-${firstId}`);
    await card.click(); // Expand
    await page.getByTestId(`faq-send-to-chat-${firstId}`).click();
    await expect(page).toHaveURL(/\/senior\/chat\?q=/);
  });

  // --- KB Management entry point removed ---

  test('SeniorPage does not show KB Management entry (v7 — moved to /kb)', async ({ page }) => {
    // KB Management view was removed from SeniorPage in v7
    await expect(page.getByText('KB Articles')).not.toBeVisible();
    await expect(page.getByText('Company Features')).not.toBeVisible();
  });
});

test.describe('Senior Chat Page (v7 — /senior/chat)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminInBrowser(page);
  });

  test('direct navigation to /senior/chat shows ChatView', async ({ page }) => {
    await page.goto('/senior/chat');
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.getByTestId('senior-chat-back')).toBeVisible();
  });

  test('?q= query param triggers auto-send of first message', async ({ page }) => {
    await page.goto('/senior/chat?q=' + encodeURIComponent('자동 발송 테스트'));
    // Wait for the user message to appear in chat
    await expect(page.getByText('자동 발송 테스트').first()).toBeVisible({ timeout: 10000 });
  });

  test('Back button returns to /senior', async ({ page }) => {
    await page.goto('/senior/chat');
    await page.getByTestId('senior-chat-back').click();
    await expect(page).toHaveURL(/\/senior$/);
  });

  test('Session sidebar visible with "+ 새 채팅" button', async ({ page }) => {
    await page.goto('/senior/chat');
    await expect(page.getByRole('button', { name: /새 채팅/ })).toBeVisible();
  });

  test('Chat input is visible and Send is disabled when empty', async ({ page }) => {
    await page.goto('/senior/chat');
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
  });
});
