import { test, expect } from '@playwright/test';
import { loginAsAdminInBrowser } from '../helpers/api-helpers';
                                                                                                                                                                                                                                                                                          
  test.describe('Senior Page', () => {
                                                                                                                                                                                                                                                                                          
    test.beforeEach(async ({ page }) => {                           
    await loginAsAdminInBrowser(page);
      await page.goto('/senior');
    });

    // --- Page load ---

    test('should display My Senior heading on page load', async ({ page }) => {                                                                                                                                                                                                           
      await expect(page.locator('h2').filter({ hasText: 'My Senior' })).toBeVisible();
    });                                                                                                                                                                                                                                                                                   
                                                                    
    test('should show FAQ view as default entry', async ({ page }) => {
      // FAQ is the default view - wait for FAQ list to load
   
      // Header should show "Chat" button for switching to chat                                                                                                                                                                                                                           
      await expect(page.getByRole('button', { name: /Chat/ })).toBeVisible();
      // Search bar should be visible (FAQ view has a search input)                                                                                                                                                                                                                       
      await expect(page.locator('input[type="text"]')).toBeVisible();
    });                                                                                                                                                                                                                                                                                   
                                                                                                                                                                                                                                                                                          
    // --- View navigation ---
                                                                                                                                                                                                                                                                                          
    test('should switch to Chat view when Chat button clicked', async ({ page }) => {
      await page.getByRole('button', { name: /Chat/ }).click();

      // Chat view should show the input area
      await expect(page.locator('textarea')).toBeVisible();
      // Header should show "FAQ" button to go back                                                                                                                                                                                                                                       
      await expect(page.getByRole('button', { name: /FAQ/ })).toBeVisible();
    });                                                                                                                                                                                                                                                                                   
                                                                    
    test('should switch to KB Management view when KB button clicked', async ({ page }) => {                                                                                                                                                                                              
      // KB feature is not yet implemented in Senior page
      // This test will be enabled when KB integration is added                                                                                                                                                                                                                           
      test.skip();                                                  
    });

    test('should navigate between FAQ and Chat views', async ({ page }) => {
      // Default is FAQ, switch to Chat
      await page.getByRole('button', { name: /Chat/ }).click();                                                                                                                                                                                                                           
      await expect(page.locator('textarea')).toBeVisible();
                                                                                                                                                                                                                                                                                          
      // Switch back to FAQ                                         
      const faqResponse = page.waitForResponse(
        resp => resp.url().includes("/api/senior/faq") && resp.request().method() === "GET"
      );
      await page.getByRole("button", { name: /FAQ/ }).click();
      await faqResponse;
      await expect(page.locator('input[type="text"]')).toBeVisible();
    });                                                                                                                                                                                                                                                                                   
                                                                    
    // --- KB Management sub-views ---                                                                                                                                                                                                                                                    
                                                                    
    test('should switch between KB Articles and Company Features sub-views', async ({ page }) => {
      // KB feature is not yet implemented in Senior page
      // This test will be enabled when KB integration is added
      test.skip();
    });

    // --- Chat Session Sidebar ---

    test('should show session sidebar in Chat view', async ({ page }) => {
      await page.getByRole('button', { name: /Chat/ }).click();
      // Session sidebar should be visible with "새 채팅" button
      await expect(page.getByRole('button', { name: /새 채팅/ })).toBeVisible();
    });

    test('should start new chat when clicking 새 채팅', async ({ page }) => {
      await page.getByRole('button', { name: /Chat/ }).click();
      await page.getByRole('button', { name: /새 채팅/ }).click();
      // Chat area should show empty state
      await expect(page.locator('textarea')).toBeVisible();
      await expect(page.getByText('Ask your Senior QA any question...')).toBeVisible();
    });

    // --- Markdown rendering ---

    test('should render chat input and send button in Chat view', async ({ page }) => {
      await page.getByRole('button', { name: /Chat/ }).click();
      await expect(page.locator('textarea')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
      // Send button should be disabled when input is empty
      await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
    });
  });                                                                                                                                                                                                                                                                                     