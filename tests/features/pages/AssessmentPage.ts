import { Page, Locator, expect } from '@playwright/test';

export class AssessmentPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly contextLayersCount: Locator;
  readonly viewHistoryLink: Locator;
  readonly backToProjectLink: Locator;

  // Dice roll input section
  readonly diceRollInput: Locator;
  readonly setProblemButton: Locator;
  readonly errorMessage: Locator;

  // Guru analysis section
  readonly guruAnalysisHeading: Locator;
  readonly asciiBoard: Locator;
  readonly chatMessagesArea: Locator;
  readonly askGuruButton: Locator;
  readonly thinkingIndicator: Locator;

  // Ground truth section
  readonly groundTruthHeading: Locator;
  readonly checkAnswerButton: Locator;
  readonly bestMovesSection: Locator;
  readonly loadingTruthIndicator: Locator;

  // Star rating section
  readonly rateResponseSection: Locator;
  readonly starButtons: Locator;
  readonly ratingConfirmation: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { name: /Self-Assessment:/i });
    this.contextLayersCount = page.getByText(/\d+ context layers loaded/i);
    this.viewHistoryLink = page.getByRole('link', { name: 'View History' });
    this.backToProjectLink = page.getByRole('link', { name: 'Back to Project' });

    // Dice roll input section
    this.diceRollInput = page.getByPlaceholder('e.g., 3-1');
    this.setProblemButton = page.getByRole('button', { name: 'Set Problem' });
    this.errorMessage = page.locator('p.text-red-600');

    // Guru analysis section
    this.guruAnalysisHeading = page.getByRole('heading', { name: 'Guru Analysis' });
    this.asciiBoard = page.locator('.font-mono.text-xs.whitespace-pre');
    this.chatMessagesArea = page.locator('.h-64.overflow-y-auto');
    this.askGuruButton = page.getByRole('button', { name: /Ask Guru|Thinking\.\.\./i });
    this.thinkingIndicator = page.getByText('Guru is thinking...');

    // Ground truth section
    this.groundTruthHeading = page.getByRole('heading', {
      name: 'Ground Truth (GNU Backgammon)',
    });
    this.checkAnswerButton = page.getByRole('button', { name: /Check Answer|Loading\.\.\./i });
    this.bestMovesSection = page.getByText('Best Moves (ranked by equity):');
    this.loadingTruthIndicator = page.getByRole('button', { name: 'Loading...' });

    // Star rating section
    this.rateResponseSection = page.getByText('Rate this response:');
    this.starButtons = page.getByRole('button', { name: /Rate \d stars/i });
    this.ratingConfirmation = page.getByText(/Rated \d\/5/);
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/assessment`);
  }

  async setDiceRoll(roll: string) {
    await this.diceRollInput.fill(roll);
    await this.setProblemButton.click();
  }

  async askGuru() {
    await this.askGuruButton.click();
  }

  async waitForGuruResponse(timeout: number = 60000) {
    // Wait for the guru to start responding
    await this.thinkingIndicator.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      // If thinking indicator doesn't appear, the response might already be there
    });

    // Wait for the response to complete (thinking indicator disappears)
    await this.thinkingIndicator.waitFor({ state: 'hidden', timeout });

    // Ensure we have at least one assistant message
    const assistantMessages = this.chatMessagesArea.locator('.bg-gray-100');
    await expect(assistantMessages.first()).toBeVisible({ timeout: 5000 });
  }

  async getGuruResponseText(): Promise<string> {
    const assistantMessages = this.chatMessagesArea.locator('.bg-gray-100 p');
    const count = await assistantMessages.count();
    if (count === 0) return '';

    const text = await assistantMessages.first().textContent();
    return text || '';
  }

  async checkAnswer() {
    await this.checkAnswerButton.click();
  }

  async waitForGroundTruth(timeout: number = 30000) {
    // Wait for loading to complete
    await this.page
      .getByRole('button', { name: 'Check Answer' })
      .waitFor({ state: 'visible', timeout });

    // Wait for best moves to appear
    await this.bestMovesSection.waitFor({ state: 'visible', timeout });
  }

  async getBestMovesCount(): Promise<number> {
    const moves = this.page.locator('.font-mono.text-sm').filter({ hasText: /^\d+\./ });
    return moves.count();
  }

  async rateResponse(stars: number) {
    if (stars < 1 || stars > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const starButton = this.page.getByRole('button', { name: `Rate ${stars} stars` });
    await starButton.click();

    // Wait for rating to be saved
    await this.ratingConfirmation.waitFor({ state: 'visible', timeout: 10000 });
  }

  async isRatingSectionVisible(): Promise<boolean> {
    return this.rateResponseSection.isVisible();
  }

  async getUserMessage(): Promise<string | null> {
    const userMessages = this.chatMessagesArea.locator('.bg-blue-100 p');
    const count = await userMessages.count();
    if (count === 0) return null;

    return userMessages.first().textContent();
  }

  async getErrorMessage(): Promise<string | null> {
    const isVisible = await this.errorMessage.isVisible();
    if (!isVisible) return null;

    return this.errorMessage.textContent();
  }

  async isAsciiBoardVisible(): Promise<boolean> {
    return this.asciiBoard.isVisible();
  }

  async navigateToHistory() {
    await this.viewHistoryLink.click();
  }

  async navigateBackToProject() {
    await this.backToProjectLink.click();
  }

  async hasContextAuditDetails(): Promise<boolean> {
    const responseText = await this.getGuruResponseText();
    return responseText.includes('Context Audit Details');
  }

  async getCurrentDiceRoll(): Promise<string> {
    const boardText = await this.asciiBoard.textContent();
    // Extract dice roll from the board display if present
    const match = boardText?.match(/Dice:\s*(\d-\d)/);
    return match ? match[1] : '';
  }
}
