import { Page, Locator } from '@playwright/test';

export class ProjectDetailPage {
  readonly page: Page;
  readonly projectHeading: Locator;
  readonly backToProjectsLink: Locator;
  readonly startResearchButton: Locator;
  readonly contextLayersCard: Locator;
  readonly knowledgeFilesCard: Locator;
  readonly researchRunsCard: Locator;
  readonly noResearchRunsMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.projectHeading = page.locator('h1').first();
    this.backToProjectsLink = page.getByRole('link', { name: /Back to Projects/i });
    this.startResearchButton = page.getByRole('link', { name: /Start Research/i });
    this.contextLayersCard = page.getByRole('heading', { name: 'Context Layers' });
    this.knowledgeFilesCard = page.getByRole('heading', { name: 'Knowledge Files' });
    this.researchRunsCard = page.getByRole('heading', { name: 'Research Runs' });
    this.noResearchRunsMessage = page.getByText(/No research runs yet/i);
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}`);
  }

  async getProjectName() {
    return await this.projectHeading.textContent();
  }

  async clickStartResearch() {
    await this.startResearchButton.click();
  }

  async hasResearchRuns() {
    const noRuns = await this.noResearchRunsMessage.isVisible().catch(() => false);
    return !noRuns;
  }

  async getResearchRunLink(instructions: string) {
    return this.page.getByRole('link').filter({ hasText: instructions });
  }

  async clickResearchRun(instructions: string) {
    const link = await this.getResearchRunLink(instructions);
    await link.click();
  }

  async getResearchRunStatus(instructions: string) {
    const runRow = this.page.locator('a').filter({ hasText: instructions });
    const statusBadge = runRow.locator('span').filter({ hasText: /PENDING|RUNNING|COMPLETED|FAILED/i });
    return await statusBadge.textContent();
  }
}
