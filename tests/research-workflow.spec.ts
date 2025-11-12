import { test, expect } from '@playwright/test';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { NewResearchPage } from './pages/NewResearchPage';
import { ResearchRunPage } from './pages/ResearchRunPage';

test.describe('Research Workflow', () => {
  let projectId: string;
  let projectName: string;

  test.beforeEach(async ({ page }) => {
    // Create a test project for research tests
    const projectsPage = new ProjectsListPage(page);
    projectName = `Research Test Project ${Date.now()}`;

    await projectsPage.goto();
    await projectsPage.createProject(projectName);

    // Wait for navigation and extract project ID from URL
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
    const url = page.url();
    projectId = url.split('/projects/')[1];
  });

  test('should navigate to new research page from project detail', async ({ page }) => {
    const projectDetailPage = new ProjectDetailPage(page);
    const newResearchPage = new NewResearchPage(page);

    // Should be on project detail page from beforeEach
    await expect(projectDetailPage.projectHeading).toBeVisible();

    // Click Start Research button
    await projectDetailPage.clickStartResearch();

    // Verify we're on the new research page
    await expect(newResearchPage.heading).toBeVisible();
    await expect(page).toHaveURL(`/projects/${projectId}/research/new`);
  });

  test('should display new research form with all elements', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);

    await newResearchPage.goto(projectId);

    // Verify all form elements are visible
    await expect(newResearchPage.heading).toBeVisible();
    await expect(newResearchPage.instructionsInput).toBeVisible();
    await expect(newResearchPage.quickDepthRadio).toBeVisible();
    await expect(newResearchPage.moderateDepthRadio).toBeVisible();
    await expect(newResearchPage.deepDepthRadio).toBeVisible();
    await expect(newResearchPage.cancelButton).toBeVisible();
    await expect(newResearchPage.startResearchButton).toBeVisible();

    // Verify moderate is selected by default
    await expect(newResearchPage.moderateDepthRadio).toBeChecked();
  });

  test('should validate required instructions field', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);

    await newResearchPage.goto(projectId);

    // Try to submit without instructions
    await newResearchPage.startResearchButton.click();

    // Should still be on the form page due to HTML5 validation
    await expect(newResearchPage.heading).toBeVisible();
  });

  test('should create research run with quick depth', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);
    const researchRunPage = new ResearchRunPage(page);

    await newResearchPage.goto(projectId);

    const instructions = `Test quick research ${Date.now()}`;
    await newResearchPage.createResearch(instructions, 'QUICK');

    // Should navigate to research run page
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

    // Verify we're on research run page
    await expect(researchRunPage.statusBadge).toBeVisible();

    // Status should be PENDING, RUNNING, or COMPLETED (in POC mode)
    const status = await researchRunPage.getStatus();
    expect(status).toMatch(/PENDING|RUNNING|COMPLETED/);
  });

  test('should create research run with moderate depth', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);
    const researchRunPage = new ResearchRunPage(page);

    await newResearchPage.goto(projectId);

    const instructions = `Test moderate research ${Date.now()}`;
    await newResearchPage.createResearch(instructions, 'MODERATE');

    // Should navigate to research run page
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

    // Verify research run was created
    await expect(researchRunPage.statusBadge).toBeVisible();
    const status = await researchRunPage.getStatus();
    expect(status).toMatch(/PENDING|RUNNING|COMPLETED/);
  });

  test('should create research run with deep depth', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);
    const researchRunPage = new ResearchRunPage(page);

    await newResearchPage.goto(projectId);

    const instructions = `Test deep research ${Date.now()}`;
    await newResearchPage.createResearch(instructions, 'DEEP');

    // Should navigate to research run page
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

    // Verify research run was created
    await expect(researchRunPage.statusBadge).toBeVisible();
    const status = await researchRunPage.getStatus();
    expect(status).toMatch(/PENDING|RUNNING|COMPLETED/);
  });

  test('should display research run in project detail page', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);
    const projectDetailPage = new ProjectDetailPage(page);

    const instructions = `Research to verify listing ${Date.now()}`;

    // Create research run
    await newResearchPage.goto(projectId);
    await newResearchPage.createResearch(instructions, 'MODERATE');

    // Navigate back to project detail
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);
    await projectDetailPage.goto(projectId);

    // Verify research run appears in the list
    const researchRunLink = await projectDetailPage.getResearchRunLink(instructions);
    await expect(researchRunLink).toBeVisible();

    // Verify it has a status badge
    const status = await projectDetailPage.getResearchRunStatus(instructions);
    expect(status).toBeTruthy();
    expect(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']).toContain(status?.trim());
  });

  test('should cancel research creation and return to project', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);
    const projectDetailPage = new ProjectDetailPage(page);

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

  test('should navigate to research run from project detail', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);
    const projectDetailPage = new ProjectDetailPage(page);
    const researchRunPage = new ResearchRunPage(page);

    const instructions = `Research for navigation test ${Date.now()}`;

    // Create research run
    await newResearchPage.goto(projectId);
    await newResearchPage.createResearch(instructions, 'QUICK');

    // Navigate back to project
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

    await projectDetailPage.goto(projectId);

    // Click on research run
    await projectDetailPage.clickResearchRun(instructions);

    // Should be on research run page
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);
    await expect(researchRunPage.statusBadge).toBeVisible();
  });

  test('should display research depth in research form', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);

    await newResearchPage.goto(projectId);

    // Verify all depth options have descriptive text
    await expect(page.getByText(/Quick \(1-2 minutes\)/i)).toBeVisible();
    await expect(page.getByText(/Moderate \(3-5 minutes\)/i)).toBeVisible();
    await expect(page.getByText(/Deep \(5-10 minutes\)/i)).toBeVisible();

    // Verify source count information
    await expect(page.getByText(/~5 sources/i)).toBeVisible();
    await expect(page.getByText(/~10 sources/i)).toBeVisible();
    await expect(page.getByText(/~20 sources/i)).toBeVisible();
  });
});
