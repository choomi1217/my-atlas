import { Page, Locator } from '@playwright/test';

export class FeaturesPage {
  readonly page: Page;

  // Company panel selectors (left column, w-64)
  readonly companyPanel: Locator;
  readonly companyNameInput: Locator;
  readonly companyListContainer: Locator;

  // Product panel selectors (middle column, w-80)
  readonly productPanel: Locator;
  readonly productNameInput: Locator;
  readonly productPlatformSelect: Locator;
  readonly productDescInput: Locator;
  readonly productListContainer: Locator;

  // Feature panel selectors (right column, flex-1)
  readonly featurePanel: Locator;
  readonly featurePathInput: Locator;
  readonly featureNameInput: Locator;
  readonly featureDescTextarea: Locator;
  readonly featurePromptTextarea: Locator;
  readonly featureListContainer: Locator;

  // Backwards-compatible aliases for tests
  readonly companyList: Locator;
  readonly productList: Locator;
  readonly featureList: Locator;

  constructor(page: Page) {
    this.page = page;

    // Company panel (left column with width w-64)
    this.companyPanel = page.locator('div.w-64').first();
    this.companyNameInput = this.companyPanel.locator('input[placeholder="New company..."]');
    this.companyListContainer = this.companyPanel.locator('div.overflow-y-auto');

    // Product panel (middle column with width w-80)
    this.productPanel = page.locator('div.w-80').first();
    this.productNameInput = this.productPanel.locator('input[placeholder="Product name..."]');
    this.productPlatformSelect = this.productPanel.locator('select').first();
    this.productDescInput = this.productPanel.locator('input[placeholder="Description (optional)..."]');
    this.productListContainer = this.productPanel.locator('div.flex-1.overflow-y-auto');

    // Feature panel (right column with flex-1)
    // Find the panel that is NOT w-64 and NOT w-80 (the flex-1 panel on the right)
    this.featurePanel = page.locator('div.flex-1.bg-gray-50').first();
    this.featurePathInput = this.featurePanel.locator('input[placeholder*="Path"]');
    this.featureNameInput = this.featurePanel.locator('input[placeholder="Feature name..."]');
    this.featureDescTextarea = this.featurePanel.locator('textarea[placeholder="Description..."]');
    this.featurePromptTextarea = this.featurePanel.locator('textarea[placeholder="Prompt text for AI..."]');
    this.featureListContainer = this.featurePanel.locator('div.overflow-y-auto.p-4');

    // Backwards-compatible aliases
    this.companyList = this.companyListContainer;
    this.productList = this.productListContainer;
    this.featureList = this.featureListContainer;
  }

  /**
   * Navigate to features page
   */
  async goto() {
    await this.page.goto('/features');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Add a company by filling name and pressing Enter
   */
  async addCompany(name: string) {
    await this.companyNameInput.fill(name);
    // Set up response listener BEFORE sending request
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/api/companies') && resp.request().method() === 'POST'
    );
    await this.companyNameInput.press('Enter');
    await responsePromise;
  }

  /**
   * Select a company by name (click on the company in the list)
   */
  async selectCompany(name: string) {
    // Click on the font-medium div which has the onClick handler (setSelectedCompany)
    // The outer wrapper div does NOT have onClick, only the inner name div does
    const nameDiv = this.companyListContainer
      .locator('div.font-medium')
      .filter({ hasText: name })
      .first();
    await nameDiv.click({ timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Activate a company (click Activate button)
   */
  async activateCompany(name: string) {
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/activate') && resp.request().method() === 'PATCH'
    );
    // Find company card and click its Activate button
    const companyCard = this.companyListContainer
      .locator('div')
      .filter({ hasText: name })
      .first();
    await companyCard.getByRole('button', { name: /Activate/i }).click({ timeout: 10000 });
    await responsePromise;
  }

  /**
   * Delete a company (click delete button and accept confirm dialog)
   */
  async deleteCompany(name: string) {
    this.page.once('dialog', dialog => dialog.accept());
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/api/companies/') && resp.request().method() === 'DELETE'
    );
    // Find company card and click its Delete button
    const companyCard = this.companyListContainer
      .locator('div')
      .filter({ hasText: name })
      .first();
    await companyCard.getByRole('button', { name: /Delete/i }).click({ timeout: 10000 });
    await responsePromise;
  }

  /**
   * Dismiss delete confirmation (click cancel on dialog)
   */
  async cancelDelete() {
    this.page.once('dialog', dialog => dialog.dismiss());
  }

  /**
   * Check if product panel shows placeholder
   */
  async isProductPanelEmpty(): Promise<boolean> {
    const placeholder = this.productPanel.getByText(/Select a company/i);
    return placeholder.isVisible();
  }

  /**
   * Add a product
   */
  async addProduct(name: string, platform: string = 'WEB', description: string = '') {
    await this.productNameInput.fill(name);
    await this.productPlatformSelect.selectOption(platform);
    if (description) {
      await this.productDescInput.fill(description);
    }
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/api/products') && resp.request().method() === 'POST'
    );
    // Find and click Add Product button in product panel
    const addButton = this.productPanel.getByRole('button', { name: /Add Product/i });
    await addButton.click({ timeout: 10000 });
    await responsePromise;
  }

  /**
   * Select a product by name
   */
  async selectProduct(name: string) {
    const productCard = this.productListContainer
      .locator('div.border')
      .filter({ hasText: name })
      .first();
    await productCard.click({ timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Delete a product
   */
  async deleteProduct(name: string) {
    this.page.once('dialog', dialog => dialog.accept());
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/api/products/') && resp.request().method() === 'DELETE'
    );
    const productCard = this.productListContainer
      .locator('div.border')
      .filter({ hasText: name })
      .first();
    await productCard.getByRole('button', { name: /Delete/i }).click({ timeout: 10000 });
    await responsePromise;
  }

  /**
   * Check if feature panel shows placeholder
   */
  async isFeaturePanelEmpty(): Promise<boolean> {
    const placeholder = this.featurePanel.getByText(/Select a product/i);
    return placeholder.isVisible();
  }

  /**
   * Add a feature
   */
  async addFeature(path: string, name: string, description: string = '', promptText: string = '') {
    await this.featurePathInput.fill(path);
    await this.featureNameInput.fill(name);
    if (description) {
      await this.featureDescTextarea.fill(description);
    }
    if (promptText) {
      await this.featurePromptTextarea.fill(promptText);
    }

    // Set up response listener BEFORE clicking button
    // Embedding can take >10s, so use a 60 second timeout
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/features') && resp.request().method() === 'POST',
      { timeout: 60000 }
    );

    const addButton = this.featurePanel.getByRole('button', { name: /Add Feature/i }).first();
    await addButton.click({ timeout: 10000 });
    await responsePromise;

    // Wait for embedding to complete
    await this.page.waitForLoadState('networkidle', { timeout: 60000 });
  }

  /**
   * Click Edit button on a feature
   */
  async editFeature(name: string) {
    const featureCard = this.featureListContainer
      .locator('div')
      .filter({ hasText: name })
      .first();
    await featureCard.getByRole('button', { name: /Edit/i }).click({ timeout: 10000 });
  }

  /**
   * Save edited feature (change name and click Save)
   */
  async saveFeatureEdit(newName: string) {
    // In edit mode, the input has placeholder "Name..."
    const editNameInput = this.featurePanel.locator('input[placeholder="Name..."]');
    await editNameInput.clear();
    await editNameInput.fill(newName);

    // Re-embedding can take >10s, so use 60 second timeout
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/features') && resp.request().method() === 'PUT',
      { timeout: 60000 }
    );
    const saveButton = this.featurePanel.getByRole('button', { name: /Save/i });
    await saveButton.click({ timeout: 10000 });
    await responsePromise;
  }

  /**
   * Cancel feature edit
   */
  async cancelFeatureEdit() {
    const cancelButton = this.featurePanel.getByRole('button', { name: /Cancel/i });
    await cancelButton.click({ timeout: 10000 });
  }

  /**
   * Delete a feature
   */
  async deleteFeature(name: string) {
    this.page.once('dialog', dialog => dialog.accept());
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/api/features/') && resp.request().method() === 'DELETE'
    );
    const featureCard = this.featureListContainer
      .locator('div')
      .filter({ hasText: name })
      .first();
    await featureCard.getByRole('button', { name: /Delete/i }).click({ timeout: 10000 });
    await responsePromise;
  }

  /**
   * Check if feature is being created (loading state)
   */
  async isFeatureCreating(): Promise<boolean> {
    const button = this.featurePanel.getByRole('button', { name: /Creating \(embedding\.\.\.\)/i });
    return button.isVisible();
  }

  /**
   * Wait for feature to finish creating
   */
  async waitForFeatureCreation() {
    // Wait for "Add Feature" button to reappear (not "Creating (embedding...)")
    // Use selector instead of waitForFunction since we can't use locators in waitForFunction
    await this.page.waitForSelector('button:has-text("Add Feature")', { timeout: 60000 });
  }

  /**
   * Get all company names from the list
   */
  async getCompanyNames(): Promise<string[]> {
    const companies = await this.companyListContainer.locator('div').all();
    const names: string[] = [];
    for (const company of companies) {
      const text = await company.textContent();
      if (text && !text.includes('Active') && !text.includes('Delete')) {
        names.push(text.trim());
      }
    }
    return names;
  }

  /**
   * Get all product names from the list
   */
  async getProductNames(): Promise<string[]> {
    const products = await this.productListContainer.locator('div.border').all();
    const names: string[] = [];
    for (const product of products) {
      const text = await product.textContent();
      if (text && !text.includes('WEB') && !text.includes('MOBILE') && !text.includes('Delete')) {
        names.push(text.trim());
      }
    }
    return names;
  }

  /**
   * Get all feature names from the list
   */
  async getFeatureNames(): Promise<string[]> {
    const features = await this.featureListContainer.locator('div').all();
    const names: string[] = [];
    for (const feature of features) {
      const text = await feature.textContent();
      if (text && !text.includes('›') && !text.includes('Delete')) {
        const lines = text.split('\n');
        if (lines.length > 0) {
          names.push(lines[0].trim());
        }
      }
    }
    return names;
  }
}
