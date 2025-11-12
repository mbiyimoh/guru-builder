import { Page, Locator } from '@playwright/test';

export class ResearchRunPage {
  readonly page: Page;
  readonly backToProjectLink: Locator;
  readonly statusBadge: Locator;
  readonly instructionsHeading: Locator;
  readonly researchReport: Locator;
  readonly recommendationsList: Locator;

  constructor(page: Page) {
    this.page = page;
    // The page uses breadcrumbs, find the link that goes back to the project
    this.backToProjectLink = page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link').nth(1);
    this.statusBadge = page.locator('span').filter({ hasText: /PENDING|RUNNING|COMPLETED|FAILED/i }).first();
    this.instructionsHeading = page.locator('h1').first();
    this.researchReport = page.locator('text=Research Report').first();
    this.recommendationsList = page.locator('[data-testid="recommendations-list"]');
  }

  async goto(projectId: string, runId: string) {
    await this.page.goto(`/projects/${projectId}/research/${runId}`);
  }

  async getStatus() {
    return await this.statusBadge.textContent();
  }

  async waitForStatus(expectedStatus: string, timeout: number = 30000) {
    await this.page.waitForFunction(
      (status) => {
        const badge = document.querySelector('span');
        return badge?.textContent?.includes(status);
      },
      expectedStatus,
      { timeout }
    );
  }

  async hasRecommendations() {
    return await this.page.getByText(/recommendations/i).isVisible().catch(() => false);
  }

  async getRecommendationButtons() {
    return this.page.getByRole('button').filter({ hasText: /Approve|Reject/i });
  }
}
