import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the Wizard Profile Creation Page (/projects/new/profile)
 */
export class WizardProfilePage {
  readonly page: Page;

  // Page header
  readonly pageHeading: Locator;
  readonly pageDescription: Locator;

  // Mode tabs
  readonly chatTab: Locator;
  readonly voiceTab: Locator;
  readonly documentTab: Locator;

  // Chat mode elements
  readonly chatTextarea: Locator;
  readonly chatSendButton: Locator;
  readonly synthesizeButton: Locator;

  // Voice mode elements
  readonly voiceComingSoonMessage: Locator;

  // Document mode elements
  readonly documentUploadInput: Locator;
  readonly documentUploadButton: Locator;

  // Preview step elements
  readonly previewSection: Locator;
  readonly projectNameInput: Locator;
  readonly backButton: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page header
    this.pageHeading = page.getByRole('heading', { name: 'Create Your Guru Profile' });
    this.pageDescription = page.getByText('Describe your teaching assistant');

    // Mode tabs
    this.chatTab = page.getByRole('tab', { name: /Chat Interview/i });
    this.voiceTab = page.getByRole('tab', { name: /Voice Recording/i });
    this.documentTab = page.getByRole('tab', { name: /Import Document/i });

    // Chat mode elements
    this.chatTextarea = page.getByPlaceholder(/tell me about/i);
    this.chatSendButton = page.getByRole('button', { name: /send/i });
    this.synthesizeButton = page.getByRole('button', { name: /synthesize/i });

    // Voice mode elements
    this.voiceComingSoonMessage = page.getByText('Voice Recording Coming Soon');

    // Document mode elements
    this.documentUploadInput = page.locator('input[type="file"]');
    this.documentUploadButton = page.getByRole('button', { name: /upload|parse/i });

    // Preview step elements
    this.previewSection = page.locator('[data-testid="profile-preview"]');
    this.projectNameInput = page.getByLabel(/project name/i);
    this.backButton = page.getByRole('button', { name: /back/i });
    this.saveButton = page.getByRole('button', { name: /save|create/i });
  }

  async goto() {
    await this.page.goto('/projects/new/profile');
  }

  async selectChatMode() {
    await this.chatTab.click();
  }

  async selectVoiceMode() {
    await this.voiceTab.click();
  }

  async selectDocumentMode() {
    await this.documentTab.click();
  }

  async isVoiceComingSoonVisible() {
    return this.voiceComingSoonMessage.isVisible();
  }

  async uploadDocument(filePath: string) {
    await this.documentUploadInput.setInputFiles(filePath);
  }

  async setProjectName(name: string) {
    await this.projectNameInput.fill(name);
  }

  async saveProject() {
    await this.saveButton.click();
  }

  async getCurrentTab(): Promise<string | null> {
    const selectedTab = this.page.locator('[role="tab"][aria-selected="true"]');
    return selectedTab.textContent();
  }

  // ============================================
  // Chat Mode Interaction Methods (for Tier 3 tests)
  // ============================================

  /** Get the chat input textarea */
  get chatInput(): Locator {
    return this.page.locator('textarea').first();
  }

  /** Get the send button (with send icon) */
  get sendButton(): Locator {
    return this.page.locator('button').filter({ has: this.page.locator('svg.lucide-send') });
  }

  /** Get the "Thinking..." indicator */
  get thinkingIndicator(): Locator {
    return this.page.getByText('Thinking...');
  }

  /** Get the "Generate Profile" button */
  get generateProfileButton(): Locator {
    return this.page.getByRole('button', { name: /generate profile/i });
  }

  /**
   * Send a chat message and wait for the AI response
   * @param message The message to send
   */
  async sendChatMessage(message: string): Promise<void> {
    await this.chatInput.fill(message);
    await this.sendButton.click();
  }

  /**
   * Wait for the AI "Thinking..." indicator to appear and disappear
   */
  async waitForAIResponse(): Promise<void> {
    await expect(this.thinkingIndicator).toBeVisible({ timeout: 5000 });
    await expect(this.thinkingIndicator).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Click the "Generate Profile" button (waits for it to be visible first)
   */
  async clickGenerateProfile(): Promise<void> {
    await expect(this.generateProfileButton).toBeVisible({ timeout: 10000 });
    await this.generateProfileButton.click();
  }
}
