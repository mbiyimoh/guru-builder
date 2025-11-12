import { Page, Locator } from '@playwright/test';

export class ProjectsListPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly newProjectButton: Locator;
  readonly projectNameInput: Locator;
  readonly projectDescriptionInput: Locator;
  readonly createProjectSubmitButton: Locator;
  readonly cancelButton: Locator;
  readonly modalHeading: Locator;
  readonly emptyStateMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Projects', level: 1 });
    this.newProjectButton = page.getByRole('button', { name: /New Project/i });
    this.projectNameInput = page.getByLabel(/Project Name/i);
    this.projectDescriptionInput = page.getByLabel(/Description/i);
    this.createProjectSubmitButton = page.getByRole('button', { name: /Create Project/i });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.modalHeading = page.getByRole('heading', { name: 'Create New Project' });
    this.emptyStateMessage = page.getByText(/No projects/i);
  }

  async goto() {
    await this.page.goto('/projects');
  }

  async clickNewProject() {
    // Use .first() because there might be two buttons (one in header, one in empty state)
    await this.newProjectButton.first().click();
  }

  async fillProjectForm(name: string, description?: string) {
    await this.projectNameInput.fill(name);
    if (description) {
      await this.projectDescriptionInput.fill(description);
    }
  }

  async submitProjectForm() {
    await this.createProjectSubmitButton.click();
  }

  async createProject(name: string, description?: string) {
    await this.clickNewProject();
    await this.fillProjectForm(name, description);
    await this.submitProjectForm();
  }

  async getProjectCard(projectName: string) {
    return this.page.getByRole('link').filter({ hasText: projectName });
  }

  async clickProjectCard(projectName: string) {
    const card = await this.getProjectCard(projectName);
    await card.click();
  }

  async hasProjects() {
    const emptyState = await this.emptyStateMessage.isVisible().catch(() => false);
    return !emptyState;
  }
}
