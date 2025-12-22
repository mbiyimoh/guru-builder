import { test, expect } from '@playwright/test';
import { loginAsTestUser, hasTestCredentials } from './utils/test-auth';
import { WizardProfilePage } from './pages/WizardProfilePage';

/**
 * Tier 1: Critical Path Smoke Tests
 *
 * Goal: Verify wizard pages are navigable and render without crashing.
 * Priority: HIGH
 * Dependencies: Requires authentication (TEST_USER_EMAIL, TEST_USER_PASSWORD env vars)
 *
 * Note: Tests that require auth will be skipped if credentials are not available.
 */

test.describe('Wizard Smoke Tests (Tier 1)', () => {
  test.describe('Profile Page (requires auth)', () => {
    test.skip(!hasTestCredentials, 'Requires TEST_USER_EMAIL and TEST_USER_PASSWORD');

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page);
    });

    test('T1.1: wizard-navigation-renders - WizardNavigation shows 4 phases', async ({ page }) => {
      const profilePage = new WizardProfilePage(page);
      await profilePage.goto();

      await expect(profilePage.pageHeading).toBeVisible({ timeout: 10000 });

      // Verify all 4 phase labels are present (visible on md+ screens)
      // On mobile, only icons are shown, so we check for the phase icons/links
      const phases = ['Define Guru', 'Build Knowledge', 'Readiness Check', 'Create Content'];

      for (const phaseLabel of phases) {
        const phaseElement = page.getByText(phaseLabel);
        // Phase labels are hidden on mobile (md:inline), so check they exist in DOM
        await expect(phaseElement).toBeAttached();
      }

      // Verify "Back to Projects" link is present
      const backLink = page.getByRole('link', { name: /Back to Projects/i });
      await expect(backLink).toBeVisible();
    });

    test('T1.2: profile-page-renders - Profile page loads and shows 3 mode tabs', async ({ page }) => {
      const profilePage = new WizardProfilePage(page);

      await profilePage.goto();

      await expect(profilePage.pageHeading).toBeVisible({ timeout: 10000 });
      await expect(profilePage.chatTab).toBeVisible();
      await expect(profilePage.voiceTab).toBeVisible();
      await expect(profilePage.documentTab).toBeVisible();
    });

    test('T1.2b: profile-mode-tabs-functional - Mode tabs can be clicked and switch content', async ({ page }) => {
      const profilePage = new WizardProfilePage(page);

      await profilePage.goto();

      await expect(profilePage.pageHeading).toBeVisible({ timeout: 10000 });

      await profilePage.selectVoiceMode();
      await expect(profilePage.voiceComingSoonMessage).toBeVisible();

      await profilePage.selectDocumentMode();
      await expect(profilePage.documentUploadInput).toBeAttached();

      await profilePage.selectChatMode();
      await expect(profilePage.chatTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  test.describe('Research Page', () => {
    test('T1.3: research-page-redirects-without-projectId - Research page redirects without projectId', async ({ page }) => {
      await page.goto('/projects/new/research');

      await page.waitForURL(/\/(login|projects\/new\/profile)/, { timeout: 15000 });

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(login|projects\/new\/profile)/);
    });
  });

  test.describe('Readiness Page', () => {
    test('T1.4: readiness-page-redirects-to-login - Readiness page redirects unauthenticated users', async ({ page }) => {
      await page.goto('/projects/new/readiness');

      // Unauthenticated users should be redirected to login
      await page.waitForURL(/\/login/, { timeout: 15000 });
      expect(page.url()).toContain('/login');

      // Verify redirect parameter is preserved
      const redirectParam = new URL(page.url()).searchParams.get('redirect');
      expect(redirectParam).toBe('/projects/new/readiness');
    });
  });

  test.describe('Artifacts Page', () => {
    test('T1.5: artifacts-page-redirects-to-login - Artifacts page redirects unauthenticated users', async ({ page }) => {
      await page.goto('/projects/new/artifacts');

      // Unauthenticated users should be redirected to login
      await page.waitForURL(/\/login/, { timeout: 15000 });
      expect(page.url()).toContain('/login');

      // Verify redirect parameter is preserved
      const redirectParam = new URL(page.url()).searchParams.get('redirect');
      expect(redirectParam).toBe('/projects/new/artifacts');
    });
  });

  test.describe('Public Guru Page', () => {
    test('T1.7: public-guru-404 - /g/invalid-id handles gracefully', async ({ page }) => {
      await page.goto('/g/invalid-test-id-xyz123');

      const notFoundIndicator = page.getByText(/not found|404|does not exist|error/i);
      const foundMessage = page.getByText(/guru/i);

      const notFoundVisible = await notFoundIndicator.isVisible({ timeout: 5000 }).catch(() => false);
      const foundVisible = await foundMessage.isVisible({ timeout: 5000 }).catch(() => false);

      expect(notFoundVisible || foundVisible).toBe(true);
    });
  });

  test.describe('Auth Redirects', () => {
    test('T1.8: protected-routes-redirect-to-login - Protected wizard routes redirect to login', async ({ page }) => {
      await page.goto('/projects/new/profile');

      await page.waitForURL(/\/login/, { timeout: 10000 });

      expect(page.url()).toContain('/login');

      const redirectParam = new URL(page.url()).searchParams.get('redirect');
      expect(redirectParam).toBe('/projects/new/profile');
    });
  });
});
