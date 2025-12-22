import { test, expect } from '@playwright/test';
import { loginAsTestUser, loginAsAdminUser, hasAdminCredentials, hasTestCredentials, hasOpenAIKey } from './utils/test-auth';
import { WizardProfilePage } from './pages/WizardProfilePage';
import path from 'path';

/**
 * Tier 3: Integration Tests (AI-Dependent)
 *
 * Goal: Test flows that require AI/backend integration.
 * Priority: LOWER (conditional - skip if no API key)
 * Dependencies: Tier 1 + Tier 2 passing, OPENAI_API_KEY set
 *
 * These tests call actual AI endpoints and may take 30-60s each.
 */

/**
 * Existing backgammon-guru-2 project for T3.3 research flow test.
 * Note: This is a hardcoded project ID for an existing project in the database.
 * For a more robust solution, consider creating test projects dynamically
 * in a beforeAll hook (see corpus-management.spec.ts for the pattern).
 */
const BACKGAMMON_GURU_PROJECT_ID = 'cmi1r0uwy00006hypk1xuyncu';

test.describe('Wizard Integration Tests (Tier 3)', () => {
  test.describe('Profile Synthesis', () => {
    test.skip(!hasTestCredentials, 'Requires TEST_USER_EMAIL and TEST_USER_PASSWORD');
    test.skip(!hasOpenAIKey, 'Requires OPENAI_API_KEY for AI synthesis');

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page);
    });

    test('T3.1: profile-chat-synthesis - Chat mode synthesis generates profile preview', async ({ page }) => {
      test.setTimeout(90000); // 90 seconds for AI call

      const profilePage = new WizardProfilePage(page);
      await profilePage.goto();

      // Verify we're on chat mode (default)
      await expect(profilePage.chatTab).toHaveAttribute('aria-selected', 'true');

      // The chat shows an initial AI message - wait for it
      const initialMessage = page.getByText(/what subject or domain/i);
      await expect(initialMessage).toBeVisible({ timeout: 10000 });

      // Send first message using Page Object methods
      await profilePage.sendChatMessage(
        'I want to create a backgammon teaching assistant that helps intermediate players ' +
        'improve their checker play decisions. The target audience is people who know the rules ' +
        'but want to get better at positional judgment.'
      );

      // Wait for AI simulated response
      await profilePage.waitForAIResponse();

      // Wait for AI follow-up response content
      await expect(page.getByText(/teaching style/i)).toBeVisible({ timeout: 5000 });

      // Send second message
      await profilePage.sendChatMessage(
        'My teaching style is analytical but accessible. I focus on explaining the "why" behind moves ' +
        'rather than just memorizing positions. I use clear examples and build concepts progressively.'
      );

      // Wait for AI response again
      await profilePage.waitForAIResponse();

      // Click generate and wait for synthesis (requires MIN_EXCHANGES = 2)
      await profilePage.clickGenerateProfile();

      // Wait for profile preview to appear (this calls the actual synthesis API)
      // The preview page shows project name input and profile details
      const projectNameInput = page.getByLabel(/project name/i).or(page.getByPlaceholder(/project name/i));
      await expect(projectNameInput).toBeVisible({ timeout: 60000 });

      // Verify profile preview content is shown (use heading to avoid strict mode violation)
      const previewContent = page.getByRole('heading', { name: /domain.*expertise/i });
      await expect(previewContent).toBeVisible();
    });

    test('T3.2: profile-document-synthesis - Document upload and synthesis works', async ({ page }) => {
      test.setTimeout(90000); // 90 seconds for AI call

      const profilePage = new WizardProfilePage(page);
      await profilePage.goto();

      // Switch to document mode
      await profilePage.selectDocumentMode();
      await expect(profilePage.documentTab).toHaveAttribute('aria-selected', 'true');

      // Upload a test fixture file
      const fixtureFile = path.join(process.cwd(), 'tests/fixtures/backgammon-opening-principles.txt');

      // Get the hidden file input and upload
      const fileInput = profilePage.documentUploadInput;
      await fileInput.setInputFiles(fixtureFile);

      // Wait for document parsing success message
      const successMessage = page.getByText(/document parsed successfully/i);
      await expect(successMessage).toBeVisible({ timeout: 30000 });

      // Verify content preview is shown
      const contentPreview = page.getByText(/content preview/i);
      await expect(contentPreview).toBeVisible();

      // Click the generate profile button
      const generateButton = page.getByRole('button', { name: /generate profile from document/i });
      await expect(generateButton).toBeVisible();
      await generateButton.click();

      // Wait for profile preview (AI synthesis happens here)
      const projectNameInput = page.getByLabel(/project name/i).or(page.getByPlaceholder(/project name/i));
      await expect(projectNameInput).toBeVisible({ timeout: 60000 });

      // Verify profile content is shown (use heading to avoid strict mode violation)
      const profileSection = page.getByRole('heading', { name: /domain.*expertise/i });
      await expect(profileSection).toBeVisible();
    });
  });

  test.describe('Research Flow', () => {
    test.skip(!hasAdminCredentials, 'Requires ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD');
    test.skip(!hasOpenAIKey, 'Requires OPENAI_API_KEY for AI research');

    test.beforeEach(async ({ page }) => {
      await loginAsAdminUser(page);
    });

    test('T3.3: research-chat-interaction - Research page loads and chat interface works', async ({ page }) => {
      test.setTimeout(60000); // 60 seconds

      // Navigate to research page with existing project
      await page.goto(`/projects/new/research?projectId=${BACKGAMMON_GURU_PROJECT_ID}`);

      // Wait for page to load (shows project info and chat interface)
      const researchHeading = page.getByRole('heading', { name: /research knowledge/i });
      await expect(researchHeading).toBeVisible({ timeout: 15000 });

      // Verify guru profile context is shown
      const profileContext = page.getByText(/guru profile context/i);
      await expect(profileContext).toBeVisible();

      // Verify chat interface is shown (default)
      const chatAssistantButton = page.getByRole('button', { name: /chat assistant/i });
      await expect(chatAssistantButton).toBeVisible();

      // The chat interface should be loaded (dynamically imported)
      // Look for the chat container or input
      const chatContainer = page.locator('[class*="grid"]').filter({ hasText: /plan/i }).first();
      await expect(chatContainer).toBeVisible({ timeout: 10000 });

      // Verify suggestions panel is shown (if gaps exist)
      const suggestionsHeading = page.getByText(/suggested research topics/i);
      // This may or may not be visible depending on readiness gaps
      const hasSuggestions = await suggestionsHeading.isVisible().catch(() => false);

      if (hasSuggestions) {
        // Click a suggestion to test interaction
        const researchButton = page.getByRole('button', { name: /research this/i }).first();
        if (await researchButton.isVisible()) {
          await researchButton.click();
          // Should scroll to chat section and potentially pre-fill input
          await page.waitForTimeout(1000);
        }
      }

      // Verify the continue button to readiness is present
      const continueButton = page.getByRole('button', { name: /continue to readiness/i });
      await expect(continueButton).toBeVisible();
    });
  });
});
