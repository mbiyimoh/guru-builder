import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';

test.describe('Project Creation Flow', () => {
  test('should navigate to homepage and display main content', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goto();

    // Verify homepage is visible
    await expect(homePage.heading).toBeVisible();
    await expect(homePage.getStartedButton).toBeVisible();
  });

  test('should navigate from home to projects page', async ({ page }) => {
    const homePage = new HomePage(page);
    const projectsPage = new ProjectsListPage(page);

    await homePage.goto();
    await homePage.clickGetStarted();

    // Verify we're on the projects page
    await expect(projectsPage.heading).toBeVisible();
    await expect(page).toHaveURL(/\/projects$/);
  });

  test('should display empty projects state when no projects exist', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);

    await projectsPage.goto();

    // Check if empty state is visible (might not be if there are existing projects)
    const hasProjects = await projectsPage.hasProjects();

    if (!hasProjects) {
      await expect(projectsPage.emptyStateMessage).toBeVisible();
      // Should have New Project button in empty state
      await expect(projectsPage.newProjectButton).toHaveCount(2); // One in header, one in empty state
    }
  });

  test('should open new project modal when clicking New Project button', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);

    await projectsPage.goto();
    await projectsPage.clickNewProject();

    // Verify modal is open
    await expect(projectsPage.modalHeading).toBeVisible();
    await expect(projectsPage.projectNameInput).toBeVisible();
    await expect(projectsPage.projectDescriptionInput).toBeVisible();
    await expect(projectsPage.createProjectSubmitButton).toBeVisible();
    await expect(projectsPage.cancelButton).toBeVisible();
  });

  test('should validate required fields in project creation form', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);

    await projectsPage.goto();
    await projectsPage.clickNewProject();

    // Try to submit without filling name (HTML5 validation should prevent this)
    await projectsPage.createProjectSubmitButton.click();

    // The form should not submit - we should still see the modal
    await expect(projectsPage.modalHeading).toBeVisible();
  });

  test('should successfully create a new project with name only', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);
    const projectDetailPage = new ProjectDetailPage(page);

    const projectName = `Test Project ${Date.now()}`;

    await projectsPage.goto();
    await projectsPage.createProject(projectName);

    // Wait for navigation to project detail page
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);

    // Verify we're on the project detail page
    await expect(projectDetailPage.projectHeading).toBeVisible();
    const displayedName = await projectDetailPage.getProjectName();
    expect(displayedName).toBe(projectName);

    // Verify project stats cards are visible
    await expect(projectDetailPage.contextLayersCard).toBeVisible();
    await expect(projectDetailPage.knowledgeFilesCard).toBeVisible();
    await expect(projectDetailPage.researchRunsCard).toBeVisible();
  });

  test('should successfully create a new project with name and description', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);
    const projectDetailPage = new ProjectDetailPage(page);

    const projectName = `Test Project with Desc ${Date.now()}`;
    const projectDescription = 'This is a test project created by automated E2E tests';

    await projectsPage.goto();
    await projectsPage.createProject(projectName, projectDescription);

    // Wait for navigation to project detail page
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);

    // Verify project was created
    await expect(projectDetailPage.projectHeading).toBeVisible();
    const displayedName = await projectDetailPage.getProjectName();
    expect(displayedName).toBe(projectName);

    // Verify description is displayed (if the UI shows it)
    await expect(page.getByText(projectDescription)).toBeVisible();
  });

  test('should navigate back to projects list from project detail', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);
    const projectDetailPage = new ProjectDetailPage(page);

    const projectName = `Test Project Navigation ${Date.now()}`;

    await projectsPage.goto();
    await projectsPage.createProject(projectName);

    // Wait for project detail page
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
    await expect(projectDetailPage.backToProjectsLink).toBeVisible();

    // Click back to projects
    await projectDetailPage.backToProjectsLink.click();

    // Verify we're back on projects list
    await expect(projectsPage.heading).toBeVisible();
    await expect(page).toHaveURL(/\/projects$/);

    // Verify the newly created project appears in the list
    const projectCard = await projectsPage.getProjectCard(projectName);
    await expect(projectCard).toBeVisible();
  });

  test('should display new project in projects list after creation', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);
    const projectDetailPage = new ProjectDetailPage(page);

    const projectName = `List Test Project ${Date.now()}`;

    // Create project
    await projectsPage.goto();
    await projectsPage.createProject(projectName);

    // Navigate back to projects list
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
    await projectDetailPage.backToProjectsLink.click();

    // Verify project appears in list
    const projectCard = await projectsPage.getProjectCard(projectName);
    await expect(projectCard).toBeVisible();

    // Click on project card to navigate to detail page
    await projectsPage.clickProjectCard(projectName);
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);

    // Verify we're on the correct project page
    const displayedName = await projectDetailPage.getProjectName();
    expect(displayedName).toBe(projectName);
  });
});
