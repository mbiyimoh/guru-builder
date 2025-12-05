import { test, expect } from '@playwright/test';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { NewResearchPage } from './pages/NewResearchPage';
import { ResearchRunPage } from './pages/ResearchRunPage';

/**
 * Research & Recommendations Tests
 *
 * Tests the research workflow including creating research runs,
 * monitoring status, and viewing/managing recommendations.
 */
test.describe('Research & Recommendations', () => {
  let projectId: string;
  const projectName = `Test Research Recs ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    // Create a shared test project for research tests
    const context = await browser.newContext();
    const page = await context.newPage();
    const projectsPage = new ProjectsListPage(page);

    await projectsPage.goto();
    await projectsPage.createProject(projectName, 'Research recommendations test project');

    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
    const url = page.url();
    const match = url.match(/\/projects\/([a-zA-Z0-9-]+)$/);
    if (match) {
      projectId = match[1];
    }

    await context.close();
  });

  test.describe('Research Creation', () => {
    test('creates research with quick depth', async ({ page }) => {
      const newResearchPage = new NewResearchPage(page);
      const researchRunPage = new ResearchRunPage(page);

      await newResearchPage.goto(projectId);

      // Verify form elements
      await expect(newResearchPage.heading).toBeVisible();
      await expect(newResearchPage.instructionsInput).toBeVisible();

      // Fill form
      const instructions = `Quick research test ${Date.now()}`;
      await newResearchPage.createResearch(instructions, 'QUICK');

      // Verify redirect to research run page
      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);
      await expect(researchRunPage.statusBadge).toBeVisible();

      const status = await researchRunPage.getStatus();
      expect(status).toMatch(/PENDING|RUNNING|COMPLETED/);
    });

    test('creates research with moderate depth (default)', async ({ page }) => {
      const newResearchPage = new NewResearchPage(page);
      const researchRunPage = new ResearchRunPage(page);

      await newResearchPage.goto(projectId);

      // Verify moderate is selected by default
      await expect(newResearchPage.moderateDepthRadio).toBeChecked();

      const instructions = `Moderate research test ${Date.now()}`;
      await newResearchPage.createResearch(instructions, 'MODERATE');

      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);
      const status = await researchRunPage.getStatus();
      expect(status).toMatch(/PENDING|RUNNING|COMPLETED/);
    });

    test('creates research with deep depth', async ({ page }) => {
      const newResearchPage = new NewResearchPage(page);
      const researchRunPage = new ResearchRunPage(page);

      await newResearchPage.goto(projectId);

      const instructions = `Deep research test ${Date.now()}`;
      await newResearchPage.createResearch(instructions, 'DEEP');

      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);
      const status = await researchRunPage.getStatus();
      expect(status).toMatch(/PENDING|RUNNING|COMPLETED/);
    });

    test('displays depth options with descriptions', async ({ page }) => {
      const newResearchPage = new NewResearchPage(page);

      await newResearchPage.goto(projectId);

      // Verify depth descriptions are shown
      await expect(page.getByText(/Quick.*1-2 minutes/i)).toBeVisible();
      await expect(page.getByText(/Moderate.*3-5 minutes/i)).toBeVisible();
      await expect(page.getByText(/Deep.*5-10 minutes/i)).toBeVisible();

      // Verify source counts
      await expect(page.getByText(/~5 sources/i)).toBeVisible();
      await expect(page.getByText(/~10 sources/i)).toBeVisible();
      await expect(page.getByText(/~20 sources/i)).toBeVisible();
    });
  });

  test.describe('Research Run Status', () => {
    test('displays research run details after creation', async ({ page }) => {
      const newResearchPage = new NewResearchPage(page);
      const researchRunPage = new ResearchRunPage(page);

      await newResearchPage.goto(projectId);

      const instructions = `Research run details test ${Date.now()}`;
      await newResearchPage.createResearch(instructions, 'QUICK');

      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

      // Verify basic elements
      await expect(researchRunPage.statusBadge).toBeVisible();
      await expect(researchRunPage.backToProjectLink).toBeVisible();

      // Verify URL structure
      const url = page.url();
      expect(url).toContain(`/projects/${projectId}/research/`);
      const runId = url.split('/research/')[1];
      expect(runId).toBeTruthy();
    });

    test('navigates back to project from research run', async ({ page }) => {
      const newResearchPage = new NewResearchPage(page);
      const researchRunPage = new ResearchRunPage(page);

      await newResearchPage.goto(projectId);
      await newResearchPage.createResearch(`Back nav test ${Date.now()}`, 'QUICK');

      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

      // Click back to project
      await researchRunPage.backToProjectLink.click();

      // Should be on project detail page
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
    });

    test('maintains state after page reload', async ({ page }) => {
      const newResearchPage = new NewResearchPage(page);
      const researchRunPage = new ResearchRunPage(page);

      await newResearchPage.goto(projectId);
      await newResearchPage.createResearch(`Reload test ${Date.now()}`, 'QUICK');

      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

      const initialStatus = await researchRunPage.getStatus();

      // Reload page
      await page.reload();

      // Verify still on research run page
      await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);
      await expect(researchRunPage.statusBadge).toBeVisible();

      const statusAfterReload = await researchRunPage.getStatus();
      expect(statusAfterReload).toBeTruthy();
    });
  });

  test.describe('Recommendations Display', () => {
    test('shows recommendation count in research run', async ({ page }) => {
      const newResearchPage = new NewResearchPage(page);
      const researchRunPage = new ResearchRunPage(page);

      await newResearchPage.goto(projectId);
      await newResearchPage.createResearch(`Recommendation count test ${Date.now()}`, 'QUICK');

      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/research\/[a-zA-Z0-9-]+$/);

      // The recommendations section should exist (even if empty)
      const recommendationsSection = page.getByText(/recommendations/i);
      await expect(recommendationsSection.first()).toBeVisible();
    });

    test.skip('displays recommendation cards when research completes @slow', async ({ page }) => {
      // This test requires Inngest to be running and research to complete
      // Skip for fast test runs, enable for integration testing
      const researchRunPage = new ResearchRunPage(page);

      // Would need a completed research run with recommendations
      // await researchRunPage.goto(projectId, 'some-completed-run-id');

      // Verify recommendation structure
      // await expect(researchRunPage.hasRecommendations()).resolves.toBe(true);
      // const buttons = await researchRunPage.getRecommendationButtons();
      // expect(await buttons.count()).toBeGreaterThan(0);
    });

    test.skip('approves individual recommendation @slow', async ({ page }) => {
      // This test requires completed research with pending recommendations
      const researchRunPage = new ResearchRunPage(page);

      // Would need to:
      // 1. Navigate to research run with pending recommendations
      // 2. Click approve button
      // 3. Verify status changes to APPROVED
    });

    test.skip('rejects individual recommendation @slow', async ({ page }) => {
      // This test requires completed research with pending recommendations
      const researchRunPage = new ResearchRunPage(page);

      // Would need to:
      // 1. Navigate to research run with pending recommendations
      // 2. Click reject button
      // 3. Verify status changes to REJECTED
    });

    test.skip('applies approved recommendations to corpus @slow', async ({ page }) => {
      // This is a critical workflow but requires:
      // 1. Completed research with recommendations
      // 2. Approved recommendations
      // 3. Apply action
      // 4. Verification that corpus updated
      // 5. Verification that snapshot created
    });
  });
});
