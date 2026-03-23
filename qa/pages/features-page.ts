import { Page, Locator } from '@playwright/test';

export class FeaturesPage {
  readonly page: Page;

  // Company list page selectors
  readonly companyGrid: Locator;

  // Product list page selectors
  readonly productGrid: Locator;

  // TestCase page selectors
  readonly pathSection: Locator;
  readonly testCaseList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.companyGrid = page.locator('.max-w-6xl');
    this.productGrid = page.locator('.max-w-6xl');
    this.pathSection = page.locator('.max-w-6xl');
    this.testCaseList = page.locator('.space-y-3');
  }

  /**
   * Navigate to features page (company list)
   */
  async goto() {
    await this.page.goto('/features');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to a specific company's products
   */
  async gotoCompany(companyId: number) {
    await this.page.goto(`/features/companies/${companyId}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to test cases page for a product
   */
  async gotoTestCases(companyId: number, productId: number) {
    await this.page.goto(
      `/features/companies/${companyId}/products/${productId}`
    );
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Select a company by clicking on it
   */
  async selectCompany(name: string) {
    await this.page.locator(`text=${name}`).first().click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Select a product by clicking on it
   */
  async selectProduct(name: string) {
    await this.page.locator(`text=${name}`).first().click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click Add Test Case button
   */
  async clickAddTestCase() {
    await this.page.getByRole('button', { name: /Add Test Case/i }).click();
  }

  /**
   * Fill and submit test case form
   */
  async addTestCase(title: string) {
    await this.clickAddTestCase();
    await this.page.locator('input[placeholder="Test case title..."]').fill(title);

    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/test-cases') && resp.request().method() === 'POST',
      { timeout: 30000 }
    );
    await this.page.getByRole('button', { name: /Create Test Case/i }).click();
    await responsePromise;
  }

  /**
   * Click AI Generate Draft button
   */
  async clickGenerateDraft() {
    await this.page.getByRole('button', { name: /AI Generate Draft/i }).click();
  }

  /**
   * Check if a test case with given title is visible
   */
  async isTestCaseVisible(title: string): Promise<boolean> {
    return this.page.locator(`text=${title}`).isVisible();
  }

  /**
   * Delete a test case by title
   */
  async deleteTestCase(title: string) {
    this.page.once('dialog', dialog => dialog.accept());
    const card = this.page.locator('.bg-white.border.rounded-lg')
      .filter({ hasText: title })
      .first();
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/test-cases/') && resp.request().method() === 'DELETE'
    );
    await card.getByRole('button', { name: /Delete/i }).click();
    await responsePromise;
  }

  /**
   * Switch view mode
   */
  async switchToTreeView() {
    await this.page.getByRole('button', { name: /Tree View/i }).click();
  }

  async switchToInputView() {
    await this.page.getByRole('button', { name: /Input View/i }).click();
  }
}
