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
   * Click the "+" Add New card to open Add Company modal
   */
  async openAddCompanyModal() {
    await this.page.locator('text=Add New').first().click();
  }

  /**
   * Add a company via the modal
   */
  async addCompany(name: string) {
    await this.openAddCompanyModal();
    await this.page.locator('input[placeholder="Company name..."]').fill(name);

    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/companies') && resp.request().method() === 'POST'
    );
    await this.page.getByRole('button', { name: /^Create$/i }).click();
    await responsePromise;
  }

  /**
   * Click the "+" Add New card to open Add Product modal
   */
  async openAddProductModal() {
    await this.page.locator('text=Add New').first().click();
  }

  /**
   * Add a product via the modal
   */
  async addProduct(name: string, platform?: string) {
    await this.openAddProductModal();
    await this.page.locator('input[placeholder="Product name..."]').fill(name);

    if (platform) {
      await this.page.locator('.fixed select').selectOption(platform);
    }

    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/products') && resp.request().method() === 'POST'
    );
    await this.page.getByRole('button', { name: /^Create$/i }).click();
    await responsePromise;
  }

  /**
   * Click a segment node in the TreeView to select it
   */
  async selectSegmentInTree(segmentName: string) {
    await this.page
      .locator('.bg-white.border.rounded.p-2')
      .locator(`text=${segmentName}`)
      .first()
      .click();
  }

  /**
   * Click Add Test Case button to open the modal
   */
  async clickAddTestCase() {
    await this.page.getByRole('button', { name: /Add Test Case/i }).click();
  }

  /**
   * Fill and submit test case form via modal (requires a path to be selected first)
   */
  async addTestCase(title: string) {
    await this.clickAddTestCase();

    // Fill title in the modal
    const modal = this.page.locator('.fixed.inset-0');
    await modal.locator('input[placeholder="Test case title..."]').fill(title);

    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/test-cases') && resp.request().method() === 'POST',
      { timeout: 30000 }
    );
    const createBtn = modal.getByRole('button', { name: /^Create$/i });
    await createBtn.scrollIntoViewIfNeeded();
    await createBtn.click();
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
   * Delete a test case by title (clicks Delete button, then confirms in ConfirmDialog)
   */
  async deleteTestCase(title: string) {
    const card = this.page.locator('.bg-white.border.rounded-lg')
      .filter({ hasText: title })
      .first();
    await card.getByRole('button', { name: /Delete/i }).click();

    // Confirm in the ConfirmDialog modal
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/test-cases/') && resp.request().method() === 'DELETE'
    );
    await this.page.locator('.fixed.inset-0').getByRole('button', { name: /^Delete$/i }).click();
    await responsePromise;
  }

  /**
   * Delete a company (clicks Delete button, then confirms in ConfirmDialog)
   */
  async deleteCompany() {
    await this.page.getByRole('button', { name: /Delete/i }).first().click();

    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/companies/') && resp.request().method() === 'DELETE'
    );
    await this.page.locator('.fixed.inset-0').getByRole('button', { name: /^Delete$/i }).click();
    await responsePromise;
  }

  /**
   * Delete a product (clicks Delete button, then confirms in ConfirmDialog)
   */
  async deleteProduct() {
    await this.page.getByRole('button', { name: /Delete/i }).first().click();

    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/products/') && resp.request().method() === 'DELETE'
    );
    await this.page.locator('.fixed.inset-0').getByRole('button', { name: /^Delete$/i }).click();
    await responsePromise;
  }

  /**
   * Create a root path via the empty-state UI
   */
  async createRootPath(name: string) {
    await this.page.getByRole('button', { name: /Root Path 등록/i }).click();
    await this.page.locator('input[placeholder="Path 이름 입력..."]').fill(name);

    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/segments') && resp.request().method() === 'POST',
      { timeout: 10000 }
    );
    await this.page.locator('button:has-text("✓")').click();
    await responsePromise;
  }

  /**
   * Add a child path via the "+" button on a segment node
   */
  async addChildPath(parentSegmentName: string, childName: string) {
    const nodeRow = this.page
      .locator('.bg-white.border.rounded.p-2')
      .locator(`text=${parentSegmentName}`)
      .first()
      .locator('..');

    await nodeRow.hover();
    await nodeRow.locator('button:has-text("+")').click();

    await this.page.locator('input[placeholder="Path 이름 입력..."]').fill(childName);

    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/segments') && resp.request().method() === 'POST',
      { timeout: 10000 }
    );
    await this.page.locator('button:has-text("✓")').click();
    await responsePromise;
  }

  /**
   * Check if the "Root Path 등록" button is visible (empty state)
   */
  async isEmptyTreeState(): Promise<boolean> {
    return this.page.getByRole('button', { name: /Root Path 등록/i }).isVisible();
  }

  /**
   * Check if a segment is visible in the tree
   */
  async isSegmentVisible(name: string): Promise<boolean> {
    return this.page
      .locator('.bg-white.border.rounded.p-2')
      .locator(`text=${name}`)
      .isVisible();
  }
}
