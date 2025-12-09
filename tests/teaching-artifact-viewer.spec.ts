import { test, expect } from '@playwright/test';

test.describe('Teaching Artifact Viewer', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to projects list first
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test('can navigate to artifact viewer from teaching dashboard', async ({ page }) => {
    // Find a project with a Mental Model
    const projectCard = page.locator('[data-testid="project-card"]').first();

    // If no projects exist, skip test
    const projectCount = await projectCard.count();
    if (projectCount === 0) {
      test.skip();
      return;
    }

    // Click on the first project
    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Look for a completed Mental Model with View button
    const viewButton = page.locator('text=Mental Model').locator('..').locator('..').locator('a:has-text("View")');
    const hasViewButton = await viewButton.count() > 0;

    if (!hasViewButton) {
      // No completed artifact, skip test
      test.skip();
      return;
    }

    // Click View button
    await viewButton.click();
    await page.waitForLoadState('networkidle');

    // Verify URL changed to artifact viewer
    await expect(page).toHaveURL(/\/artifacts\/teaching\/mental-model/);

    // Verify content displays
    await expect(page.locator('h1')).toContainText('Mental Model');

    // Verify side panel navigation is visible
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('text=Teaching Artifacts')).toBeVisible();
  });

  test('side panel shows all artifact types', async ({ page }) => {
    // Navigate to a project first
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const projectCount = await projectCard.count();
    if (projectCount === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Get project ID from URL
    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    // Navigate directly to artifact viewer
    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    // Verify all three artifact types are shown in nav
    await expect(page.locator('nav').locator('text=Mental Model')).toBeVisible();
    await expect(page.locator('nav').locator('text=Curriculum')).toBeVisible();
    await expect(page.locator('nav').locator('text=Drill Series')).toBeVisible();
  });

  test('can switch between artifact types via side panel', async ({ page }) => {
    // Navigate to a project first
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const projectCount = await projectCard.count();
    if (projectCount === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Get project ID from URL
    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    // Navigate to mental model page
    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    // Click Curriculum in side panel
    await page.locator('nav').locator('text=Curriculum').click();
    await page.waitForLoadState('networkidle');

    // Verify URL changes
    await expect(page).toHaveURL(/\/artifacts\/teaching\/curriculum/);
  });

  test('back button returns to project page', async ({ page }) => {
    // Navigate to a project first
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const projectCount = await projectCard.count();
    if (projectCount === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Get project ID from URL
    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    // Navigate to artifact viewer
    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    // Click back button
    await page.locator('text=Back to Project').click();
    await page.waitForLoadState('networkidle');

    // Verify returns to project page
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));

    // Verify teaching section is visible
    await expect(page.locator('text=Guru Teaching Pipeline')).toBeVisible();
  });

  test('shows placeholder for non-existent artifacts', async ({ page }) => {
    // Navigate to a project first
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const projectCount = await projectCard.count();
    if (projectCount === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Get project ID from URL
    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    // Navigate to drill-series page (least likely to exist)
    await page.goto(`/projects/${projectId}/artifacts/teaching/drill-series`);
    await page.waitForLoadState('networkidle');

    // Either content or placeholder should be visible
    const hasContent = await page.locator('h1:has-text("Drill Series")').count() > 0;
    const hasPlaceholder = await page.locator('text=Not Generated').count() > 0;

    expect(hasContent || hasPlaceholder).toBeTruthy();
  });

  test('URL is deep-linkable', async ({ page }) => {
    // Navigate to a project first to get a valid project ID
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const projectCount = await projectCard.count();
    if (projectCount === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Get project ID from URL
    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    // Navigate directly to curriculum page (deep link)
    await page.goto(`/projects/${projectId}/artifacts/teaching/curriculum`);
    await page.waitForLoadState('networkidle');

    // Should load correctly without going through dashboard
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('nav').locator('text=Teaching Artifacts')).toBeVisible();
  });
});
