import { Page, Locator } from '@playwright/test';

/**
 * Page Object for the Wizard Artifacts Page (/projects/new/artifacts)
 */
export class WizardArtifactsPage {
  readonly page: Page;

  readonly pageHeading: Locator;
  readonly pageDescription: Locator;

  readonly teachingArtifactsHeading: Locator;
  readonly mentalModelCard: Locator;
  readonly curriculumCard: Locator;
  readonly drillSeriesCard: Locator;

  readonly mentalModelGenerateButton: Locator;
  readonly curriculumGenerateButton: Locator;
  readonly drillSeriesGenerateButton: Locator;

  readonly mentalModelViewButton: Locator;
  readonly curriculumViewButton: Locator;
  readonly drillSeriesViewButton: Locator;

  readonly testGuruHeading: Locator;
  readonly testChatCard: Locator;
  readonly testChatInput: Locator;
  readonly testChatSendButton: Locator;

  readonly publishingHeading: Locator;
  readonly publishButton: Locator;

  readonly backToProjectButton: Locator;
  readonly finishButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.pageHeading = page.getByRole('heading', { name: 'Teaching Artifacts & Testing' });
    this.pageDescription = page.getByText(/Generate your guru's teaching materials/);

    this.teachingArtifactsHeading = page.getByRole('heading', { name: 'Teaching Artifacts' });

    this.mentalModelCard = page.locator('[class*="Card"]').filter({ hasText: 'Mental Model' });
    this.curriculumCard = page.locator('[class*="Card"]').filter({ hasText: 'Curriculum' });
    this.drillSeriesCard = page.locator('[class*="Card"]').filter({ hasText: 'Drill Series' });

    this.mentalModelGenerateButton = this.mentalModelCard.getByRole('button', { name: /Generate|Regenerate/ });
    this.curriculumGenerateButton = this.curriculumCard.getByRole('button', { name: /Generate|Regenerate/ });
    this.drillSeriesGenerateButton = this.drillSeriesCard.getByRole('button', { name: /Generate|Regenerate/ });

    this.mentalModelViewButton = this.mentalModelCard.getByRole('button', { name: /View Mental Model/ });
    this.curriculumViewButton = this.curriculumCard.getByRole('button', { name: /View Curriculum/ });
    this.drillSeriesViewButton = this.drillSeriesCard.getByRole('button', { name: /View Drill Series/ });

    this.testGuruHeading = page.getByRole('heading', { name: 'Test Your Guru' });
    this.testChatCard = page.locator('[class*="Card"]').filter({ hasText: 'Interactive Chat Testing' });
    this.testChatInput = page.getByPlaceholder(/message|type/i);
    this.testChatSendButton = page.getByRole('button', { name: /send/i });

    this.publishingHeading = page.getByRole('heading', { name: 'Publishing' });
    this.publishButton = page.getByRole('button', { name: /Publish/i });

    this.backToProjectButton = page.getByRole('button', { name: /Back to Project/i });
    this.finishButton = page.getByRole('button', { name: /Finish/i });
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/new/artifacts?projectId=${projectId}`);
  }

  async isMentalModelComplete(): Promise<boolean> {
    const badge = this.mentalModelCard.locator('text=Complete');
    return badge.isVisible();
  }

  async isCurriculumComplete(): Promise<boolean> {
    const badge = this.curriculumCard.locator('text=Complete');
    return badge.isVisible();
  }

  async isDrillSeriesComplete(): Promise<boolean> {
    const badge = this.drillSeriesCard.locator('text=Complete');
    return badge.isVisible();
  }

  async isMentalModelGenerating(): Promise<boolean> {
    const badge = this.mentalModelCard.locator('text=Generating');
    return badge.isVisible();
  }

  async isCurriculumGenerating(): Promise<boolean> {
    const badge = this.curriculumCard.locator('text=Generating');
    return badge.isVisible();
  }

  async isDrillSeriesGenerating(): Promise<boolean> {
    const badge = this.drillSeriesCard.locator('text=Generating');
    return badge.isVisible();
  }

  async generateMentalModel() {
    await this.mentalModelGenerateButton.click();
  }

  async generateCurriculum() {
    await this.curriculumGenerateButton.click();
  }

  async generateDrillSeries() {
    await this.drillSeriesGenerateButton.click();
  }

  async isCurriculumGenerateEnabled(): Promise<boolean> {
    return this.curriculumGenerateButton.isEnabled();
  }

  async isDrillSeriesGenerateEnabled(): Promise<boolean> {
    return this.drillSeriesGenerateButton.isEnabled();
  }

  async hasArtifactCards(): Promise<boolean> {
    const mentalModelVisible = await this.mentalModelCard.isVisible();
    const curriculumVisible = await this.curriculumCard.isVisible();
    const drillSeriesVisible = await this.drillSeriesCard.isVisible();
    return mentalModelVisible && curriculumVisible && drillSeriesVisible;
  }

  async hasTestChat(): Promise<boolean> {
    return this.testChatCard.isVisible();
  }

  async finish() {
    await this.finishButton.click();
  }
}
