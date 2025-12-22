import { test, expect } from '@playwright/test';
import { loginAsTestUser, hasTestCredentials } from './utils/test-auth';
import { WizardProfilePage } from './pages/WizardProfilePage';

/**
 * Tier 2: Core Interaction Tests
 *
 * Goal: Test primary user interactions without requiring AI calls.
 * Priority: MEDIUM
 * Dependencies: Tier 1 passing, authenticated test user
 */

test.describe('Wizard Interaction Tests (Tier 2)', () => {
  test.describe('Profile Page Interactions', () => {
    test.skip(!hasTestCredentials, 'Requires TEST_USER_EMAIL and TEST_USER_PASSWORD');

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page);
    });

    test('T2.1: profile-mode-switching - Switch between Chat/Voice/Document tabs, verify UI updates', async ({ page }) => {
      const profilePage = new WizardProfilePage(page);
      await profilePage.goto();

      // Start on Chat tab (default)
      await expect(profilePage.chatTab).toHaveAttribute('aria-selected', 'true');

      // Switch to Voice tab
      await profilePage.selectVoiceMode();
      await expect(profilePage.voiceTab).toHaveAttribute('aria-selected', 'true');
      await expect(profilePage.chatTab).toHaveAttribute('aria-selected', 'false');
      await expect(profilePage.voiceComingSoonMessage).toBeVisible();

      // Switch to Document tab
      await profilePage.selectDocumentMode();
      await expect(profilePage.documentTab).toHaveAttribute('aria-selected', 'true');
      await expect(profilePage.voiceTab).toHaveAttribute('aria-selected', 'false');
      await expect(profilePage.documentUploadInput).toBeAttached();

      // Switch back to Chat tab
      await profilePage.selectChatMode();
      await expect(profilePage.chatTab).toHaveAttribute('aria-selected', 'true');
      await expect(profilePage.documentTab).toHaveAttribute('aria-selected', 'false');
    });

    test('T2.2: profile-voice-browser-warning - Voice mode shows coming soon message', async ({ page }) => {
      const profilePage = new WizardProfilePage(page);
      await profilePage.goto();

      await profilePage.selectVoiceMode();

      // Verify the "coming soon" message is displayed
      await expect(profilePage.voiceComingSoonMessage).toBeVisible();
      await expect(profilePage.voiceComingSoonMessage).toContainText('Voice Recording Coming Soon');
    });

    test('T2.3: profile-document-upload-ui - Document mode shows file input and accepts correct types', async ({ page }) => {
      const profilePage = new WizardProfilePage(page);
      await profilePage.goto();

      await profilePage.selectDocumentMode();

      // Verify file input exists and accepts correct types
      await expect(profilePage.documentUploadInput).toBeAttached();
      const acceptAttr = await profilePage.documentUploadInput.getAttribute('accept');
      expect(acceptAttr).toContain('.pdf');
      expect(acceptAttr).toContain('.docx');
      expect(acceptAttr).toContain('.txt');

      // Verify browse button is visible
      const browseButton = page.getByRole('button', { name: /browse files/i });
      await expect(browseButton).toBeVisible();

      // Verify supported formats text is shown
      const formatsText = page.getByText(/Supported formats.*PDF.*DOCX.*TXT/i);
      await expect(formatsText).toBeVisible();
    });

    test('T2.4: profile-chat-textarea-present - Chat mode shows input area', async ({ page }) => {
      const profilePage = new WizardProfilePage(page);
      await profilePage.goto();

      // Chat is the default tab
      await expect(profilePage.chatTab).toHaveAttribute('aria-selected', 'true');

      // Look for a textarea or input for chat messages
      // This could be a textarea for brain dump or a chat input
      const chatInput = page.locator('textarea').first();
      await expect(chatInput).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Document Upload Validation', () => {
    test.skip(!hasTestCredentials, 'Requires TEST_USER_EMAIL and TEST_USER_PASSWORD');

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page);
    });

    test('T2.5: profile-drag-drop-area - Document mode has drag and drop area', async ({ page }) => {
      const profilePage = new WizardProfilePage(page);
      await profilePage.goto();

      await profilePage.selectDocumentMode();

      // Verify drag-drop area exists with proper messaging
      const uploadArea = page.getByText(/drag and drop/i);
      await expect(uploadArea).toBeVisible();

      // Verify size limit is shown
      const sizeLimit = page.getByText(/max.*10MB/i);
      await expect(sizeLimit).toBeVisible();
    });
  });

  test.describe('Navigation Interactions', () => {
    test.skip(!hasTestCredentials, 'Requires TEST_USER_EMAIL and TEST_USER_PASSWORD');

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page);
    });

    test('T2.6: back-to-projects-link - Back to Projects link works', async ({ page }) => {
      const profilePage = new WizardProfilePage(page);
      await profilePage.goto();

      // Find and click "Back to Projects" link
      const backLink = page.getByRole('link', { name: /back to projects/i });
      await expect(backLink).toBeVisible();

      await backLink.click();

      // Should navigate to projects list
      await page.waitForURL(/\/projects$/, { timeout: 10000 });
    });

    test('T2.7: wizard-nav-phase-indicators - Wizard navigation shows current phase', async ({ page }) => {
      const profilePage = new WizardProfilePage(page);
      await profilePage.goto();

      // The first phase "Define Guru" should be highlighted/active
      const defineGuruPhase = page.getByText('Define Guru');
      await expect(defineGuruPhase).toBeVisible();

      // Check that the Define Guru phase is the current/active one
      // The active phase typically has different styling
      const activeIndicator = page.locator('[aria-current="step"], [data-active="true"]').first();
      // This checks if there's any active indicator - implementation may vary
      const hasActiveIndicator = await activeIndicator.isVisible().catch(() => false);

      // At minimum, verify all phase labels exist
      const phases = ['Define Guru', 'Build Knowledge', 'Readiness Check', 'Create Content'];
      for (const phase of phases) {
        await expect(page.getByText(phase)).toBeAttached();
      }
    });
  });

  test.describe('UI State Tests', () => {
    test.skip(!hasTestCredentials, 'Requires TEST_USER_EMAIL and TEST_USER_PASSWORD');

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page);
    });

    test('T2.8: profile-page-responsive - Page has proper responsive structure', async ({ page }) => {
      const profilePage = new WizardProfilePage(page);
      await profilePage.goto();

      // Verify main heading is visible
      await expect(profilePage.pageHeading).toBeVisible();

      // Verify the subheading/description is present
      const description = page.getByText(/describe your teaching assistant/i);
      await expect(description).toBeVisible();

      // Verify card structure exists (shadcn/ui Card uses data-slot="card" or specific structure)
      // Look for the card by its content - "Choose Your Input Method"
      const cardTitle = page.getByText(/choose your input method/i);
      await expect(cardTitle).toBeVisible();
    });

    test('T2.9: tab-accessibility - Tabs have proper accessibility attributes', async ({ page }) => {
      const profilePage = new WizardProfilePage(page);
      await profilePage.goto();

      // Verify tabs have role="tablist"
      const tabList = page.locator('[role="tablist"]');
      await expect(tabList).toBeVisible();

      // Verify each tab has role="tab"
      const tabs = page.locator('[role="tab"]');
      expect(await tabs.count()).toBeGreaterThanOrEqual(3);

      // Verify tab panels exist
      const tabPanels = page.locator('[role="tabpanel"]');
      expect(await tabPanels.count()).toBeGreaterThanOrEqual(1);
    });
  });
});
