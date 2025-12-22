import { test, expect } from '@playwright/test';
import { loginAsTestUser, hasTestCredentials } from './utils/test-auth';

/**
 * Dashboard Navigation & Wizard-to-Dashboard Migration Tests
 *
 * Tests for the new dashboard-anchored routes that replaced the wizard flow:
 * - /projects/[id]/research (was /projects/new/research?projectId=X)
 * - /projects/[id]/readiness (was /projects/new/readiness?projectId=X)
 * - /projects/[id]/profile (was /projects/new/profile?projectId=X for existing projects)
 *
 * Also tests legacy wizard routes redirect to new routes.
 */

test.describe('Dashboard Navigation Tests', () => {
  test.describe('Legacy Wizard Route Redirects', () => {
    test.skip(!hasTestCredentials, 'Requires TEST_USER_EMAIL and TEST_USER_PASSWORD');

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page);
    });

    test('Legacy research route with projectId redirects to new dashboard route', async ({ page }) => {
      // Get a real project ID first
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Find a project link
      const projectLink = page.locator('a[href*="/projects/"]').first();
      const href = await projectLink.getAttribute('href');
      const projectId = href?.match(/\/projects\/([^/]+)/)?.[1];

      if (!projectId) {
        test.skip(true, 'No existing projects found');
        return;
      }

      // Visit legacy route with projectId
      await page.goto(`/projects/new/research?projectId=${projectId}`);

      // Should redirect to new route
      await page.waitForURL(`/projects/${projectId}/research`, { timeout: 10000 });
      expect(page.url()).toContain(`/projects/${projectId}/research`);
    });

    test('Legacy readiness route with projectId redirects to new dashboard route', async ({ page }) => {
      // Get a real project ID first
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Find a project link
      const projectLink = page.locator('a[href*="/projects/"]').first();
      const href = await projectLink.getAttribute('href');
      const projectId = href?.match(/\/projects\/([^/]+)/)?.[1];

      if (!projectId) {
        test.skip(true, 'No existing projects found');
        return;
      }

      // Visit legacy route with projectId
      await page.goto(`/projects/new/readiness?projectId=${projectId}`);

      // Should redirect to new route
      await page.waitForURL(`/projects/${projectId}/readiness`, { timeout: 10000 });
      expect(page.url()).toContain(`/projects/${projectId}/readiness`);
    });

    test('Legacy artifacts route with projectId redirects to teaching artifacts', async ({ page }) => {
      // Get a real project ID first
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Find a project link
      const projectLink = page.locator('a[href*="/projects/"]').first();
      const href = await projectLink.getAttribute('href');
      const projectId = href?.match(/\/projects\/([^/]+)/)?.[1];

      if (!projectId) {
        test.skip(true, 'No existing projects found');
        return;
      }

      // Visit legacy route with projectId
      await page.goto(`/projects/new/artifacts?projectId=${projectId}`);

      // Should redirect to new teaching artifacts route
      await page.waitForURL(/\/projects\/[^/]+\/artifacts\/teaching/, { timeout: 10000 });
      expect(page.url()).toContain(`/projects/${projectId}/artifacts/teaching`);
    });

    test('Legacy routes without projectId redirect to projects list', async ({ page }) => {
      // Visit legacy readiness without projectId
      await page.goto('/projects/new/readiness');

      // Should redirect to projects list (or login)
      await page.waitForURL(/\/(projects|login)/, { timeout: 10000 });
    });
  });

  test.describe('New Dashboard Route Pages', () => {
    test.skip(!hasTestCredentials, 'Requires TEST_USER_EMAIL and TEST_USER_PASSWORD');

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page);
    });

    test('Research page renders with breadcrumb navigation', async ({ page }) => {
      // Get a real project ID first
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Find a project link
      const projectLink = page.locator('a[href*="/projects/"]').first();
      const href = await projectLink.getAttribute('href');
      const projectId = href?.match(/\/projects\/([^/]+)/)?.[1];

      if (!projectId) {
        test.skip(true, 'No existing projects found');
        return;
      }

      // Visit new research route
      await page.goto(`/projects/${projectId}/research`);
      await page.waitForLoadState('networkidle');

      // Check breadcrumb navigation exists
      const breadcrumbProjects = page.getByRole('link', { name: 'Projects' });
      await expect(breadcrumbProjects).toBeVisible({ timeout: 10000 });

      // Check page title
      const pageTitle = page.getByRole('heading', { name: /Research/i, level: 1 });
      await expect(pageTitle).toBeVisible();
    });

    test('Readiness page renders with breadcrumb navigation', async ({ page }) => {
      // Get a real project ID first
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Find a project link
      const projectLink = page.locator('a[href*="/projects/"]').first();
      const href = await projectLink.getAttribute('href');
      const projectId = href?.match(/\/projects\/([^/]+)/)?.[1];

      if (!projectId) {
        test.skip(true, 'No existing projects found');
        return;
      }

      // Visit new readiness route
      await page.goto(`/projects/${projectId}/readiness`);
      await page.waitForLoadState('networkidle');

      // Check breadcrumb navigation exists
      const breadcrumbProjects = page.getByRole('link', { name: 'Projects' });
      await expect(breadcrumbProjects).toBeVisible({ timeout: 10000 });

      // Check page title
      const pageTitle = page.getByRole('heading', { name: /Readiness/i, level: 1 });
      await expect(pageTitle).toBeVisible();
    });

    test('Profile page renders with breadcrumb navigation', async ({ page }) => {
      // Get a real project ID first
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Find a project link
      const projectLink = page.locator('a[href*="/projects/"]').first();
      const href = await projectLink.getAttribute('href');
      const projectId = href?.match(/\/projects\/([^/]+)/)?.[1];

      if (!projectId) {
        test.skip(true, 'No existing projects found');
        return;
      }

      // Visit new profile route
      await page.goto(`/projects/${projectId}/profile`);
      await page.waitForLoadState('networkidle');

      // Check breadcrumb navigation exists
      const breadcrumbProjects = page.getByRole('link', { name: 'Projects' });
      await expect(breadcrumbProjects).toBeVisible({ timeout: 10000 });

      // Check page title
      const pageTitle = page.getByRole('heading', { name: /Profile/i, level: 1 });
      await expect(pageTitle).toBeVisible();
    });
  });

  test.describe('Dashboard Navigation Links', () => {
    test.skip(!hasTestCredentials, 'Requires TEST_USER_EMAIL and TEST_USER_PASSWORD');

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page);
    });

    test('Dashboard links navigate to new routes (not old wizard routes)', async ({ page }) => {
      // Get a real project ID first
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Find a project link and click it
      const projectLink = page.locator('a[href*="/projects/"]').first();
      const href = await projectLink.getAttribute('href');
      const projectId = href?.match(/\/projects\/([^/]+)/)?.[1];

      if (!projectId) {
        test.skip(true, 'No existing projects found');
        return;
      }

      await projectLink.click();
      await page.waitForLoadState('networkidle');

      // Check for Research link that goes to new route
      const researchLink = page.locator(`a[href*="/projects/${projectId}/research"]`);
      if (await researchLink.count() > 0) {
        const researchHref = await researchLink.first().getAttribute('href');
        expect(researchHref).toContain(`/projects/${projectId}/research`);
        expect(researchHref).not.toContain('?projectId=');
      }

      // Check for Artifacts link that goes to new route
      const artifactsLink = page.locator(`a[href*="/projects/${projectId}/artifacts"]`);
      if (await artifactsLink.count() > 0) {
        const artifactsHref = await artifactsLink.first().getAttribute('href');
        expect(artifactsHref).toContain(`/projects/${projectId}/artifacts`);
        expect(artifactsHref).not.toContain('?projectId=');
      }
    });

    test('Breadcrumb navigation links work correctly', async ({ page }) => {
      // Get a real project ID first
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Find a project link
      const projectLink = page.locator('a[href*="/projects/"]').first();
      const href = await projectLink.getAttribute('href');
      const projectId = href?.match(/\/projects\/([^/]+)/)?.[1];

      if (!projectId) {
        test.skip(true, 'No existing projects found');
        return;
      }

      // Go to research page
      await page.goto(`/projects/${projectId}/research`);
      await page.waitForLoadState('networkidle');

      // Click on project name in breadcrumb (should go to dashboard)
      const projectBreadcrumb = page.locator(`nav a[href*="/projects/${projectId}"]`);
      if (await projectBreadcrumb.count() > 0) {
        await projectBreadcrumb.first().click();
        await page.waitForURL(`/projects/${projectId}`, { timeout: 10000 });
        expect(page.url()).toContain(`/projects/${projectId}`);
      }

      // Click on Projects breadcrumb (should go to projects list)
      await page.goto(`/projects/${projectId}/research`);
      await page.waitForLoadState('networkidle');

      const projectsBreadcrumb = page.getByRole('link', { name: 'Projects' });
      await projectsBreadcrumb.click();
      await page.waitForURL('/projects', { timeout: 10000 });
      expect(page.url()).toContain('/projects');
    });
  });
});
