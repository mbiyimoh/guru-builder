import { Page, Locator } from '@playwright/test';

/**
 * Page Object for the Wizard Readiness Page (/projects/new/readiness)
 */
export class WizardReadinessPage {
  readonly page: Page;

  readonly pageHeading: Locator;
  readonly pageDescription: Locator;

  readonly overallScoreCard: Locator;
  readonly overallScoreValue: Locator;
  readonly profileCompletenessValue: Locator;
  readonly knowledgeCoverageValue: Locator;
  readonly progressBar: Locator;

  readonly criticalGapsCard: Locator;
  readonly criticalGapsHeading: Locator;
  readonly criticalGapItems: Locator;

  readonly suggestedImprovementsCard: Locator;
  readonly suggestedImprovementsHeading: Locator;
  readonly suggestedGapItems: Locator;

  readonly dimensionCoverageCard: Locator;
  readonly dimensionCoverageHeading: Locator;
  readonly dimensionRows: Locator;

  readonly addMoreResearchButton: Locator;
  readonly continueToArtifactsButton: Locator;
  readonly notReadyMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    this.pageHeading = page.getByRole('heading', { name: 'Readiness Assessment' });
    this.pageDescription = page.getByText('Evaluate if your guru is ready');

    this.overallScoreCard = page.locator('[class*="border-green"], [class*="border-amber"]').first();
    this.overallScoreValue = page.locator('.text-4xl, .text-5xl').filter({ hasText: /\d+/ });
    this.profileCompletenessValue = page.getByText('Profile Completeness').locator('..').locator('.text-xl, .text-2xl');
    this.knowledgeCoverageValue = page.getByText('Knowledge Coverage').locator('..').locator('.text-xl, .text-2xl');
    this.progressBar = page.locator('[role="progressbar"]').first();

    this.criticalGapsCard = page.locator('[class*="border-red"]');
    this.criticalGapsHeading = page.getByText('Critical Gaps');
    this.criticalGapItems = page.locator('[class*="border-red"] .rounded-lg.border');

    this.suggestedImprovementsCard = page.locator('[class*="border-amber"]').last();
    this.suggestedImprovementsHeading = page.getByText('Suggested Improvements');
    this.suggestedGapItems = page.locator('[class*="border-amber"] .rounded-lg.border');

    this.dimensionCoverageCard = page.locator('text=Dimension Coverage').locator('..');
    this.dimensionCoverageHeading = page.getByRole('heading', { name: 'Dimension Coverage' });
    this.dimensionRows = page.locator('[role="progressbar"]');

    this.addMoreResearchButton = page.getByRole('button', { name: /Add More Research/i });
    this.continueToArtifactsButton = page.getByRole('button', { name: /Continue to Content Creation/i });
    this.notReadyMessage = page.getByText(/Complete critical gaps/);
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/new/readiness?projectId=${projectId}`);
  }

  async getOverallScore(): Promise<number> {
    const text = await this.overallScoreValue.textContent();
    return parseInt(text || '0', 10);
  }

  async isReady(): Promise<boolean> {
    return this.continueToArtifactsButton.isEnabled();
  }

  async hasCriticalGaps(): Promise<boolean> {
    return this.criticalGapsHeading.isVisible();
  }

  async hasSuggestedImprovements(): Promise<boolean> {
    return this.suggestedImprovementsHeading.isVisible();
  }

  async clickResearchDimension(dimensionName: string) {
    const button = this.page.getByRole('button', { name: 'Research This' }).filter({
      has: this.page.locator(`text=${dimensionName}`),
    });
    await button.first().click();
  }

  async continueToArtifacts() {
    await this.continueToArtifactsButton.click();
  }

  async addMoreResearch() {
    await this.addMoreResearchButton.click();
  }

  async getDimensionCount(): Promise<number> {
    return this.dimensionRows.count();
  }
}
