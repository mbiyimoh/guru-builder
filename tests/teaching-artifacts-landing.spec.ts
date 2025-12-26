import { test, expect } from '@playwright/test';
import { ProjectsListPage } from './pages/ProjectsListPage';

/**
 * Teaching Artifacts Landing Page E2E Tests
 *
 * Tests the split-view artifact landing page at /projects/[id]/artifacts/teaching
 * which shows:
 * - Left sidebar with artifact type list
 * - Right panel with artifact details and generation controls
 * - Empty state guidance wizard
 * - Mobile drawer for small screens
 * - Readiness warning banner when score < 60
 */

test.describe('Teaching Artifacts Landing Page', () => {
  let projectId: string;
  const testProjectName = `Test Artifacts Landing ${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    // Create a fresh test project for each test
    const projectsPage = new ProjectsListPage(page);
    await projectsPage.goto();
    await projectsPage.createProject(testProjectName, 'Test project for artifacts landing');

    // Wait for navigation to project page and extract project ID
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
    const url = page.url();
    const match = url.match(/\/projects\/([a-zA-Z0-9-]+)$/);
    if (match) {
      projectId = match[1];
    }
  });

  test('renders page with header and breadcrumbs', async ({ page }) => {
    // Navigate to teaching artifacts landing page
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Verify header with breadcrumbs is visible
    const header = page.locator('[data-testid="artifacts-header"]');
    await expect(header).toBeVisible();

    // Verify breadcrumb structure
    await expect(page.getByText('Projects')).toBeVisible();
    await expect(page.getByText(testProjectName)).toBeVisible();
    await expect(page.getByText('Teaching Artifacts')).toBeVisible();

    // Verify main heading
    await expect(page.getByRole('heading', { name: 'Teaching Artifacts', level: 1 })).toBeVisible();
  });

  test('sidebar shows all three artifact types', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Verify sidebar is visible
    const sidebar = page.locator('[data-testid="artifact-list-sidebar"]');
    await expect(sidebar).toBeVisible();

    // Verify all three artifact types are listed
    const mentalModelItem = page.locator('[data-testid="artifact-item-mental-model"]');
    const curriculumItem = page.locator('[data-testid="artifact-item-curriculum"]');
    const drillSeriesItem = page.locator('[data-testid="artifact-item-drill-series"]');

    await expect(mentalModelItem).toBeVisible();
    await expect(curriculumItem).toBeVisible();
    await expect(drillSeriesItem).toBeVisible();

    // Verify artifact type labels
    await expect(mentalModelItem).toContainText('Mental Model');
    await expect(curriculumItem).toContainText('Curriculum');
    await expect(drillSeriesItem).toContainText('Drill Series');

    // Verify descriptions
    await expect(mentalModelItem).toContainText('Core concepts and principles');
    await expect(curriculumItem).toContainText('Structured learning path');
    await expect(drillSeriesItem).toContainText('Practice exercises');
  });

  test('sidebar shows artifact count', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    const sidebar = page.locator('[data-testid="artifact-list-sidebar"]');

    // For new project, should show 0 artifacts
    await expect(sidebar).toContainText('0 artifacts generated');
  });

  test('selecting artifact updates detail panel', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Initially, no artifact should be selected (shows empty state guidance)
    const emptyStateGuidance = page.locator('[data-testid="empty-state-guidance"]');
    await expect(emptyStateGuidance).toBeVisible();

    // Click on Mental Model item
    const mentalModelItem = page.locator('[data-testid="artifact-item-mental-model"]');
    await mentalModelItem.click();

    // Empty state should disappear
    await expect(emptyStateGuidance).not.toBeVisible();

    // Detail panel should show Mental Model details
    await expect(page.getByRole('heading', { name: 'Mental Model', level: 2 })).toBeVisible();

    // Should show "Generate Mental Model" button since artifact doesn't exist yet
    await expect(page.getByRole('button', { name: /Generate Mental Model/i })).toBeVisible();

    // Click on Curriculum item
    const curriculumItem = page.locator('[data-testid="artifact-item-curriculum"]');
    await curriculumItem.click();

    // Detail panel should update to show Curriculum
    await expect(page.getByRole('heading', { name: 'Curriculum', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate Curriculum/i })).toBeVisible();
  });

  test('shows empty state guidance when no artifacts exist', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Empty state guidance should be visible by default
    const emptyStateGuidance = page.locator('[data-testid="empty-state-guidance"]');
    await expect(emptyStateGuidance).toBeVisible();

    // Verify wizard guidance content
    await expect(page.getByRole('heading', { name: 'Create Your Teaching Artifacts' })).toBeVisible();
    await expect(page.getByText(/Generate AI-powered learning materials/i)).toBeVisible();

    // Verify all three wizard steps are shown
    await expect(page.getByText('Mental Model')).toBeVisible();
    await expect(page.getByText('Start with the foundational concepts')).toBeVisible();
    await expect(page.getByText('Curriculum')).toBeVisible();
    await expect(page.getByText('Create a structured learning path')).toBeVisible();
    await expect(page.getByText('Drill Series')).toBeVisible();
    await expect(page.getByText('Design practice exercises')).toBeVisible();

    // First step should be enabled, others disabled
    const generateButtons = page.getByRole('button', { name: /Generate/i });
    const firstButton = generateButtons.nth(0);
    const secondButton = generateButtons.nth(1);
    const thirdButton = generateButtons.nth(2);

    await expect(firstButton).toBeEnabled();
    await expect(secondButton).toBeDisabled();
    await expect(thirdButton).toBeDisabled();
  });

  test('empty state guidance shows requires dependencies', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Verify curriculum step shows requirement
    await expect(page.getByText('(requires Mental Model)')).toBeVisible();

    // Verify drill series step shows requirement
    await expect(page.getByText('(requires Curriculum)')).toBeVisible();
  });

  test('selecting artifact removes empty state', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Empty state should be visible initially
    const emptyStateGuidance = page.locator('[data-testid="empty-state-guidance"]');
    await expect(emptyStateGuidance).toBeVisible();

    // Click artifact in sidebar
    const mentalModelItem = page.locator('[data-testid="artifact-item-mental-model"]');
    await mentalModelItem.click();

    // Empty state should be replaced with detail panel
    await expect(emptyStateGuidance).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mental Model', level: 2 })).toBeVisible();
  });

  test('artifact items show "Not Generated" badge initially', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // All artifacts should show "Not Generated" badge
    const mentalModelItem = page.locator('[data-testid="artifact-item-mental-model"]');
    const curriculumItem = page.locator('[data-testid="artifact-item-curriculum"]');
    const drillSeriesItem = page.locator('[data-testid="artifact-item-drill-series"]');

    await expect(mentalModelItem.getByText('Not Generated')).toBeVisible();
    await expect(curriculumItem.getByText('Not Generated')).toBeVisible();
    await expect(drillSeriesItem.getByText('Not Generated')).toBeVisible();
  });

  test('detail panel shows generation controls', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Select Mental Model
    await page.locator('[data-testid="artifact-item-mental-model"]').click();

    // Verify generation controls are present
    await expect(page.getByRole('button', { name: /Generate Mental Model/i })).toBeVisible();

    // Verify generation notes textarea
    const notesTextarea = page.getByPlaceholder('Optional notes to guide generation...');
    await expect(notesTextarea).toBeVisible();

    // Notes should be editable
    await notesTextarea.fill('Test generation notes');
    await expect(notesTextarea).toHaveValue('Test generation notes');
  });

  test('detail panel shows advanced mode toggle', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Select an artifact
    await page.locator('[data-testid="artifact-item-mental-model"]').click();

    // Verify advanced mode toggle exists
    await expect(page.getByText('Advanced')).toBeVisible();

    // Find and toggle the switch
    const advancedSwitch = page.locator('button[role="switch"]');
    await expect(advancedSwitch).toBeVisible();

    // Check initial state (should be off)
    await expect(advancedSwitch).toHaveAttribute('aria-checked', 'false');

    // Toggle advanced mode
    await advancedSwitch.click();
    await expect(advancedSwitch).toHaveAttribute('aria-checked', 'true');
  });

  test('advanced mode shows prompt editor button', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Select an artifact
    await page.locator('[data-testid="artifact-item-mental-model"]').click();

    // Prompt editor button should not be visible initially
    const promptEditorButton = page.getByRole('button', { name: /Edit Prompts/i });
    await expect(promptEditorButton).not.toBeVisible();

    // Enable advanced mode
    const advancedSwitch = page.locator('button[role="switch"]');
    await advancedSwitch.click();

    // Now prompt editor button should be visible
    await expect(promptEditorButton).toBeVisible();
  });

  test('advanced mode shows drill configuration for drill-series', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Select drill series
    await page.locator('[data-testid="artifact-item-drill-series"]').click();

    // Enable advanced mode
    const advancedSwitch = page.locator('button[role="switch"]');
    await advancedSwitch.click();

    // Drill Configuration panel should appear
    await expect(page.getByRole('heading', { name: 'Drill Configuration' })).toBeVisible();

    // Note: The DrillConfigurationPanel component tests should cover detailed drill config testing
  });

  test('mobile menu button visible on small screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Mobile menu button should be visible
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    await expect(mobileMenuButton).toBeVisible();

    // Desktop sidebar should be hidden
    const desktopSidebar = page.locator('[data-testid="artifact-list-sidebar"]').first();
    await expect(desktopSidebar).not.toBeVisible();
  });

  test('mobile menu button hidden on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Mobile menu button should not be visible
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    await expect(mobileMenuButton).not.toBeVisible();

    // Desktop sidebar should be visible
    const desktopSidebar = page.locator('[data-testid="artifact-list-sidebar"]').first();
    await expect(desktopSidebar).toBeVisible();
  });

  test('mobile drawer opens when button clicked', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Mobile drawer should not be visible initially
    const mobileDrawer = page.locator('[data-testid="mobile-drawer"]');
    await expect(mobileDrawer).not.toBeVisible();

    // Click mobile menu button
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    await mobileMenuButton.click();

    // Mobile drawer should now be visible
    await expect(mobileDrawer).toBeVisible();

    // Sidebar content should be visible in drawer
    await expect(mobileDrawer.getByText('Mental Model')).toBeVisible();
    await expect(mobileDrawer.getByText('Curriculum')).toBeVisible();
    await expect(mobileDrawer.getByText('Drill Series')).toBeVisible();
  });

  test('mobile drawer closes after selecting artifact', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Open mobile drawer
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    await mobileMenuButton.click();

    const mobileDrawer = page.locator('[data-testid="mobile-drawer"]');
    await expect(mobileDrawer).toBeVisible();

    // Click an artifact in the drawer
    const mentalModelItem = mobileDrawer.locator('[data-testid="artifact-item-mental-model"]');
    await mentalModelItem.click();

    // Drawer should close
    await expect(mobileDrawer).not.toBeVisible();

    // Detail panel should show selected artifact
    await expect(page.getByRole('heading', { name: 'Mental Model', level: 2 })).toBeVisible();
  });

  test('breadcrumb links are functional', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Click "Projects" breadcrumb
    await page.getByRole('link', { name: 'Projects' }).click();
    await page.waitForURL(/\/projects$/);
    await expect(page).toHaveURL(/\/projects$/);

    // Navigate back to artifacts page
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Click project name breadcrumb
    await page.getByRole('link', { name: testProjectName }).click();
    await page.waitForURL(new RegExp(`/projects/${projectId}$`));
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
  });

  test('selected artifact persists visual state in sidebar', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    const mentalModelItem = page.locator('[data-testid="artifact-item-mental-model"]');
    const curriculumItem = page.locator('[data-testid="artifact-item-curriculum"]');

    // Initially no selection styling
    await expect(mentalModelItem).not.toHaveClass(/bg-blue-100/);

    // Click Mental Model
    await mentalModelItem.click();

    // Mental Model should have selected styling
    await expect(mentalModelItem).toHaveClass(/bg-blue-100/);
    await expect(curriculumItem).not.toHaveClass(/bg-blue-100/);

    // Click Curriculum
    await curriculumItem.click();

    // Curriculum should now be selected
    await expect(curriculumItem).toHaveClass(/bg-blue-100/);
    await expect(mentalModelItem).not.toHaveClass(/bg-blue-100/);
  });

  test('detail panel shows artifact status card', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Select an artifact
    await page.locator('[data-testid="artifact-item-mental-model"]').click();

    // Status card should be visible
    await expect(page.getByRole('heading', { name: 'Status' })).toBeVisible();

    // For new artifact, should show generation prompt
    await expect(page.getByText(/hasn't been generated yet/i)).toBeVisible();
  });

  test('detail panel shows artifact icon', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Select Mental Model (has Brain icon)
    await page.locator('[data-testid="artifact-item-mental-model"]').click();
    await expect(page.getByRole('heading', { name: 'Mental Model', level: 2 })).toBeVisible();

    // Select Curriculum (has BookOpen icon)
    await page.locator('[data-testid="artifact-item-curriculum"]').click();
    await expect(page.getByRole('heading', { name: 'Curriculum', level: 2 })).toBeVisible();

    // Select Drill Series (has Target icon)
    await page.locator('[data-testid="artifact-item-drill-series"]').click();
    await expect(page.getByRole('heading', { name: 'Drill Series', level: 2 })).toBeVisible();
  });

  test('page layout uses full height', async ({ page }) => {
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Root container should use flex column layout with full height
    const root = page.locator('div.flex.flex-col.h-screen').first();
    await expect(root).toBeVisible();

    // Header should be flex-shrink-0
    const header = page.locator('[data-testid="artifacts-header"]');
    await expect(header).toHaveClass(/flex-shrink-0/);
  });
});

test.describe('Teaching Artifacts Landing - Readiness Warning', () => {
  test.skip('shows readiness warning when score is low', async ({ page }) => {
    // Note: This test requires a project with low readiness score (<60%)
    // Implementation depends on readiness score calculation being available
    // Marked as skip - implement when we can control readiness score in tests

    const projectsPage = new ProjectsListPage(page);
    await projectsPage.goto();

    // Create project with minimal corpus (low readiness)
    const projectName = `Test Low Readiness ${Date.now()}`;
    await projectsPage.createProject(projectName, 'Minimal corpus project');

    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
    const url = page.url();
    const match = url.match(/\/projects\/([a-zA-Z0-9-]+)$/);
    if (!match) return;
    const projectId = match[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    // Should show readiness warning
    const readinessWarning = page.locator('[data-testid="readiness-warning"]');
    await expect(readinessWarning).toBeVisible();

    // Warning should show score and link to readiness page
    await expect(readinessWarning).toContainText(/Low Readiness Score/i);
    await expect(readinessWarning.getByRole('link', { name: /View Readiness Details/i })).toBeVisible();
  });

  test.skip('readiness warning link navigates to readiness page', async ({ page }) => {
    // Marked as skip - depends on low readiness score setup

    // Assuming we have a project with low readiness
    const projectId = 'test-project-id';
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    const readinessWarning = page.locator('[data-testid="readiness-warning"]');
    if (await readinessWarning.isVisible()) {
      const link = readinessWarning.getByRole('link', { name: /View Readiness Details/i });
      await link.click();

      await page.waitForURL(new RegExp(`/projects/${projectId}/readiness`));
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/readiness`));
    }
  });

  test.skip('no readiness warning when score is sufficient', async ({ page }) => {
    // Marked as skip - depends on high readiness score setup

    // Assuming we have a project with good readiness (>=60%)
    const projectId = 'test-project-id';
    await page.goto(`/projects/${projectId}/artifacts/teaching`);

    const readinessWarning = page.locator('[data-testid="readiness-warning"]');
    await expect(readinessWarning).not.toBeVisible();
  });
});
