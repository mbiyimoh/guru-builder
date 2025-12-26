import { Page, Locator } from '@playwright/test';

/**
 * ProjectsListPage - Page Object for /projects
 *
 * Updated for new navigation flow: "New Guru" button navigates to
 * /projects/new/profile wizard instead of opening a modal.
 */
export class ProjectsListPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly newGuruButton: Locator;
  readonly emptyStateMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Projects', level: 1 });
    // Updated: Button now says "New Guru" and navigates to wizard
    this.newGuruButton = page.getByRole('button', { name: /New Guru/i });
    this.emptyStateMessage = page.getByText(/No projects/i);
  }

  async goto() {
    await this.page.goto('/projects');
  }

  /**
   * Clicks the "New Guru" button and waits for navigation to profile wizard
   */
  async clickNewGuru() {
    // Use .first() because there might be two buttons (one in header, one in empty state)
    await this.newGuruButton.first().click();
    // Wait for navigation to profile wizard
    await this.page.waitForURL(/\/projects\/new\/profile/);
  }

  /**
   * @deprecated Modal-based project creation no longer exists.
   * Use clickNewGuru() and complete the wizard flow instead.
   */
  async clickNewProject() {
    await this.clickNewGuru();
  }

  /**
   * Creates a project through the wizard flow.
   * This replaces the old modal-based creation.
   *
   * @param name - Used as part of the brain dump description
   * @param description - Additional description text (optional)
   */
  async createProject(name: string, description?: string) {
    await this.clickNewGuru();

    // Fill in the chat mode with a description based on name
    const textarea = this.page.locator('textarea').first();
    const fullDescription = description
      ? `${name} - ${description}`
      : `Test Guru for ${name} - teaches programming concepts to beginners`;
    await textarea.fill(fullDescription);

    // Click Continue/Synthesize to proceed
    const continueButton = this.page.getByRole('button', { name: /Continue|Synthesize/i });
    await continueButton.click();

    // Wait for synthesis and preview step
    await this.page.waitForSelector('input', { timeout: 30000 });

    // Fill in project name
    const projectNameInput = this.page.locator('input').first();
    await projectNameInput.fill(name);

    // Click Save to create the project
    const saveButton = this.page.getByRole('button', { name: /Save|Create/i });
    await saveButton.click();

    // Wait for redirect to project page
    await this.page.waitForURL(/\/projects\/[^/]+/, { timeout: 30000 });
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
