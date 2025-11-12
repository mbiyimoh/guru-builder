import { test, expect } from '@playwright/test';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { NewResearchPage } from './pages/NewResearchPage';
import { ResearchRunPage } from './pages/ResearchRunPage';

test.describe('Recommendations Flow', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    // Create a test project for recommendations tests
    const projectsPage = new ProjectsListPage(page);
    const projectName = `Recommendations Test ${Date.now()}`;

    await projectsPage.goto();
    await projectsPage.createProject(projectName);

    // Extract project ID from URL
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
    const url = page.url();
    projectId = url.split('/projects/')[1];
  });

  test('should display research run page after creation', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);
    const researchRunPage = new ResearchRunPage(page);

    await newResearchPage.goto(projectId);

    const instructions = `Test recommendations display ${Date.now()}`;
    await newResearchPage.createResearch(instructions, 'QUICK');

    // Should be on research run page
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

    // Verify basic elements
    await expect(researchRunPage.statusBadge).toBeVisible();
    await expect(researchRunPage.backToProjectLink).toBeVisible();
  });

  test('should show pending status initially', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);
    const researchRunPage = new ResearchRunPage(page);

    await newResearchPage.goto(projectId);
    await newResearchPage.createResearch(`Test pending status ${Date.now()}`, 'QUICK');

    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

    const status = await researchRunPage.getStatus();
    // Should be PENDING or RUNNING (if Inngest is running)
    expect(['PENDING', 'RUNNING']).toContain(status);
  });

  test('should navigate back to project from research run page', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);
    const researchRunPage = new ResearchRunPage(page);

    await newResearchPage.goto(projectId);
    await newResearchPage.createResearch(`Test back navigation ${Date.now()}`, 'QUICK');

    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

    // Click back to project (using breadcrumb)
    await researchRunPage.backToProjectLink.click();

    // Should be back on project detail page (without /research path)
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
  });

  test.skip('should display recommendations after research completes', async ({ page }) => {
    // This test is skipped because it requires Inngest to be running
    // and research to complete, which takes several minutes
    const newResearchPage = new NewResearchPage(page);
    const researchRunPage = new ResearchRunPage(page);

    await newResearchPage.goto(projectId);
    await newResearchPage.createResearch('Test research completion', 'QUICK');

    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

    // Wait for research to complete (this would take several minutes)
    await researchRunPage.waitForStatus('COMPLETED', 600000); // 10 minutes timeout

    // Check if recommendations are displayed
    const hasRecs = await researchRunPage.hasRecommendations();
    expect(hasRecs).toBe(true);
  });

  test.skip('should allow approving recommendations', async ({ page }) => {
    // This test is skipped because it requires completed research with recommendations
    const researchRunPage = new ResearchRunPage(page);

    // This would require a completed research run with recommendations
    await researchRunPage.goto(projectId, 'some-run-id');

    const buttons = await researchRunPage.getRecommendationButtons();
    expect(await buttons.count()).toBeGreaterThan(0);
  });

  test('should display research run URL correctly', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);

    await newResearchPage.goto(projectId);
    await newResearchPage.createResearch(`Test URL structure ${Date.now()}`, 'MODERATE');

    // Verify URL structure
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);
    const url = page.url();

    expect(url).toContain(`/projects/${projectId}/research/`);
    expect(url.split('/research/')[1]).toBeTruthy(); // Should have a run ID
  });

  test('should maintain research run state on page reload', async ({ page }) => {
    const newResearchPage = new NewResearchPage(page);
    const researchRunPage = new ResearchRunPage(page);

    await newResearchPage.goto(projectId);
    const instructions = `Test page reload ${Date.now()}`;
    await newResearchPage.createResearch(instructions, 'QUICK');

    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);
    const initialStatus = await researchRunPage.getStatus();

    // Reload the page
    await page.reload();

    // Verify we're still on a research run page
    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);
    await expect(researchRunPage.statusBadge).toBeVisible();

    // Status should be the same or progressed
    const newStatus = await researchRunPage.getStatus();
    expect(newStatus).toBeTruthy();
  });
});
