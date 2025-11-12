import { Page, Locator } from '@playwright/test';

export class NewResearchPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly backToProjectLink: Locator;
  readonly instructionsInput: Locator;
  readonly quickDepthRadio: Locator;
  readonly moderateDepthRadio: Locator;
  readonly deepDepthRadio: Locator;
  readonly cancelButton: Locator;
  readonly startResearchButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Start New Research' });
    this.backToProjectLink = page.getByRole('link', { name: /Back to Project/i });
    this.instructionsInput = page.getByLabel(/Research Instructions/i);
    this.quickDepthRadio = page.getByRole('radio', { name: /Quick/i });
    this.moderateDepthRadio = page.getByRole('radio', { name: /Moderate/i });
    this.deepDepthRadio = page.getByRole('radio', { name: /Deep/i });
    this.cancelButton = page.getByRole('link', { name: 'Cancel' });
    this.startResearchButton = page.getByRole('button', { name: /Start Research/i });
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/research/new`);
  }

  async fillInstructions(instructions: string) {
    await this.instructionsInput.fill(instructions);
  }

  async selectDepth(depth: 'QUICK' | 'MODERATE' | 'DEEP') {
    switch (depth) {
      case 'QUICK':
        await this.quickDepthRadio.check();
        break;
      case 'MODERATE':
        await this.moderateDepthRadio.check();
        break;
      case 'DEEP':
        await this.deepDepthRadio.check();
        break;
    }
  }

  async submitResearch() {
    await this.startResearchButton.click();
  }

  async createResearch(instructions: string, depth: 'QUICK' | 'MODERATE' | 'DEEP' = 'MODERATE') {
    await this.fillInstructions(instructions);
    await this.selectDepth(depth);
    await this.submitResearch();
  }
}
