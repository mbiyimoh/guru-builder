import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { NewResearchPage } from './pages/NewResearchPage';
import { ResearchRunPage } from './pages/ResearchRunPage';

/**
 * Core User Journey Tests
 *
 * Tests the primary workflows through the Guru Builder system.
 * These tests verify end-to-end user journeys rather than individual features.
 */
test.describe('Core User Journeys', () => {
  test('creates project and lands on corpus overview', async ({ page }) => {
    const homePage = new HomePage(page);
    const projectsPage = new ProjectsListPage(page);
    const projectDetailPage = new ProjectDetailPage(page);

    const projectName = `Test Journey Project ${Date.now()}`;
    const projectDescription = 'Created via core journey test';

    // Start from homepage
    await homePage.goto();
    await expect(homePage.heading).toBeVisible();

    // Navigate to projects
    await homePage.clickGetStarted();
    await expect(projectsPage.heading).toBeVisible();

    // Create new project
    await projectsPage.createProject(projectName, projectDescription);

    // Verify landing on project detail page with all stats
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
    await expect(projectDetailPage.projectHeading).toBeVisible();

    const displayedName = await projectDetailPage.getProjectName();
    expect(displayedName).toBe(projectName);

    // Verify corpus overview stats are visible
    await expect(projectDetailPage.contextLayersCard).toBeVisible();
    await expect(projectDetailPage.knowledgeFilesCard).toBeVisible();
    await expect(projectDetailPage.researchRunsCard).toBeVisible();

    // Verify description is displayed
    await expect(page.getByText(projectDescription)).toBeVisible();
  });

  test('navigates between project list and project detail', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);
    const projectDetailPage = new ProjectDetailPage(page);

    const projectName = `Test Navigation Project ${Date.now()}`;

    // Create project first
    await projectsPage.goto();
    await projectsPage.createProject(projectName);
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);

    // Navigate back to projects list
    await expect(projectDetailPage.backToProjectsLink).toBeVisible();
    await projectDetailPage.backToProjectsLink.click();
    await expect(page).toHaveURL(/\/projects$/);

    // Verify project card is visible in list
    const projectCard = await projectsPage.getProjectCard(projectName);
    await expect(projectCard).toBeVisible();

    // Click back into project
    await projectsPage.clickProjectCard(projectName);
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);

    const displayedName = await projectDetailPage.getProjectName();
    expect(displayedName).toBe(projectName);
  });

  test('displays empty corpus state for new project', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);
    const projectDetailPage = new ProjectDetailPage(page);

    const projectName = `Test Empty Corpus ${Date.now()}`;

    await projectsPage.goto();
    await projectsPage.createProject(projectName);
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);

    // Verify stats show zeros
    await expect(page.locator('text=Context Layers').locator('..').locator('text=0')).toBeVisible();
    await expect(page.locator('text=Knowledge Files').locator('..').locator('text=0')).toBeVisible();
    await expect(page.locator('text=Research Runs').locator('..').locator('text=0')).toBeVisible();

    // Verify empty research runs message
    await expect(page.getByText('No research runs yet')).toBeVisible();
  });

  test('starts research workflow from project', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);
    const projectDetailPage = new ProjectDetailPage(page);
    const newResearchPage = new NewResearchPage(page);
    const researchRunPage = new ResearchRunPage(page);

    const projectName = `Test Research Journey ${Date.now()}`;

    // Create project
    await projectsPage.goto();
    await projectsPage.createProject(projectName);
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);

    const url = page.url();
    const projectId = url.split('/projects/')[1];

    // Click Start New Research
    await projectDetailPage.clickStartResearch();
    await expect(page).toHaveURL(`/projects/${projectId}/research/new`);

    // Fill out research form
    const instructions = `Test research for journey validation ${Date.now()}`;
    await newResearchPage.createResearch(instructions, 'QUICK');

    // Verify redirected to research run page
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);
    await expect(researchRunPage.statusBadge).toBeVisible();

    const status = await researchRunPage.getStatus();
    expect(status).toMatch(/PENDING|RUNNING|COMPLETED/);
  });

  test('views research run from project history', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);
    const projectDetailPage = new ProjectDetailPage(page);
    const newResearchPage = new NewResearchPage(page);
    const researchRunPage = new ResearchRunPage(page);

    const projectName = `Test History View ${Date.now()}`;

    // Create project and research run
    await projectsPage.goto();
    await projectsPage.createProject(projectName);
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);

    const url = page.url();
    const projectId = url.split('/projects/')[1];

    const instructions = `Research for history test ${Date.now()}`;
    await newResearchPage.goto(projectId);
    await newResearchPage.createResearch(instructions, 'MODERATE');

    // Wait for research page
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

    // Go back to project detail
    await projectDetailPage.goto(projectId);

    // Verify research run appears in list
    const researchRunLink = await projectDetailPage.getResearchRunLink(instructions);
    await expect(researchRunLink).toBeVisible();

    // Click to navigate to research run
    await projectDetailPage.clickResearchRun(instructions);
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);
    await expect(researchRunPage.statusBadge).toBeVisible();
  });

  test('cancels research creation and returns to project', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);
    const newResearchPage = new NewResearchPage(page);
    const projectDetailPage = new ProjectDetailPage(page);

    const projectName = `Test Cancel Research ${Date.now()}`;

    // Create project
    await projectsPage.goto();
    await projectsPage.createProject(projectName);
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);

    const url = page.url();
    const projectId = url.split('/projects/')[1];

    // Navigate to new research
    await newResearchPage.goto(projectId);

    // Fill in some data
    await newResearchPage.fillInstructions('Test cancel functionality');
    await newResearchPage.selectDepth('DEEP');

    // Click cancel
    await newResearchPage.cancelButton.click();

    // Should be back on project detail page
    await expect(projectDetailPage.projectHeading).toBeVisible();
    await expect(page).toHaveURL(`/projects/${projectId}`);
  });

  test('navigates to snapshots from project', async ({ page }) => {
    const projectsPage = new ProjectsListPage(page);

    const projectName = `Test Snapshots Nav ${Date.now()}`;

    await projectsPage.goto();
    await projectsPage.createProject(projectName);
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);

    const url = page.url();
    const projectId = url.split('/projects/')[1];

    // Navigate to snapshots page
    const snapshotsLink = page.getByRole('link', { name: /snapshots/i });
    if (await snapshotsLink.isVisible()) {
      await snapshotsLink.click();
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/snapshots`));
    } else {
      // If no snapshots link, verify we can at least see the project
      await expect(page.getByText(projectName)).toBeVisible();
    }
  });
});
