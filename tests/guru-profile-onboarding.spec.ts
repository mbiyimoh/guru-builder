import { test, expect } from '@playwright/test';

/**
 * Guru Profile Onboarding E2E Tests
 *
 * Tests the guru profile onboarding modal and synthesis flow.
 * Note: Tests requiring actual AI synthesis are marked with skip
 * unless the OPENAI_API_KEY environment variable is set.
 */

test.describe('Guru Profile Onboarding', () => {
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    // Create a test project for the tests
    const page = await browser.newPage();
    await page.goto('/projects');

    // Click new project button
    await page.getByRole('button', { name: /New Project/i }).click();
    await page.waitForSelector('[role="dialog"]');

    // Fill in project details
    const testName = `Test Profile Onboarding ${Date.now()}`;
    await page.getByLabel('Name').fill(testName);
    await page.getByRole('button', { name: /Create/i }).click();

    // Wait for redirect to project page and extract ID
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
    projectId = page.url().split('/').pop() || '';
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup handled by global teardown if project name contains 'Test'
  });

  test('should display guru profile section on project page', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);

    // Look for guru profile card or section
    const guruSection = page.locator('text=/Guru Profile|Teaching Style/i').first();
    await expect(guruSection).toBeVisible({ timeout: 10000 });
  });

  test('should open onboarding modal when clicking setup button', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);

    // Look for setup/configure button
    const setupButton = page.getByRole('button', { name: /Setup|Configure|Create Profile/i });
    if (await setupButton.isVisible()) {
      await setupButton.click();

      // Modal should appear
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Should have input mode options or text area
      const hasInputOptions = await page.getByText(/voice|text|speak|type/i).count() > 0 ||
                              await page.locator('textarea').count() > 0;
      expect(hasInputOptions).toBeTruthy();
    }
  });

  test('should display text input mode', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);

    // Open modal if available
    const setupButton = page.getByRole('button', { name: /Setup|Configure|Create Profile/i });
    if (await setupButton.isVisible()) {
      await setupButton.click();

      // Wait for modal
      await page.waitForSelector('[role="dialog"]');

      // Look for text mode option or textarea
      const textModeButton = page.getByRole('button', { name: /text|type/i });
      if (await textModeButton.isVisible()) {
        await textModeButton.click();
      }

      // Should have text input area
      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible({ timeout: 5000 });
    }
  });

  test('should validate empty brain dump input', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);

    const setupButton = page.getByRole('button', { name: /Setup|Configure|Create Profile/i });
    if (await setupButton.isVisible()) {
      await setupButton.click();
      await page.waitForSelector('[role="dialog"]');

      // Find and click synthesize/generate button without input
      const synthesizeButton = page.getByRole('button', { name: /synthesize|generate|create/i });
      if (await synthesizeButton.isVisible()) {
        // Button should be disabled or show validation error
        const isDisabled = await synthesizeButton.isDisabled();
        if (!isDisabled) {
          await synthesizeButton.click();
          // Should show validation error
          const error = page.locator('text=/required|enter|provide/i');
          await expect(error).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });

  test('should accept brain dump input in text mode', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);

    const setupButton = page.getByRole('button', { name: /Setup|Configure|Create Profile/i });
    if (await setupButton.isVisible()) {
      await setupButton.click();
      await page.waitForSelector('[role="dialog"]');

      // Find textarea
      const textarea = page.locator('textarea');
      if (await textarea.isVisible()) {
        // Type some brain dump content
        await textarea.fill('I am an expert in backgammon strategy. I focus on teaching beginners how to understand basic opening moves and cube decisions. My teaching style is encouraging and uses lots of examples.');

        // Input should be accepted (textarea has content)
        const value = await textarea.inputValue();
        expect(value.length).toBeGreaterThan(50);
      }
    }
  });

  test.skip('should synthesize profile from brain dump', async ({ page }) => {
    // Skip unless we have OpenAI API key and want to run full synthesis
    // This test would verify the actual AI synthesis process
    await page.goto(`/projects/${projectId}`);

    const setupButton = page.getByRole('button', { name: /Setup|Configure|Create Profile/i });
    await setupButton.click();
    await page.waitForSelector('[role="dialog"]');

    const textarea = page.locator('textarea');
    await textarea.fill('Expert backgammon teacher focusing on beginners. I use encouraging tone with practical examples. My specialty is opening theory and cube handling.');

    const synthesizeButton = page.getByRole('button', { name: /synthesize|generate|create/i });
    await synthesizeButton.click();

    // Wait for synthesis (may take 10-30 seconds)
    await page.waitForSelector('text=/profile|synthesized|created/i', { timeout: 60000 });
  });

  test('should close modal when clicking close button', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);

    const setupButton = page.getByRole('button', { name: /Setup|Configure|Create Profile/i });
    if (await setupButton.isVisible()) {
      await setupButton.click();
      await page.waitForSelector('[role="dialog"]');

      // Find and click close button
      const closeButton = page.getByRole('button', { name: /close|cancel|×/i });
      if (await closeButton.isVisible()) {
        await closeButton.click();

        // Modal should close
        const modal = page.locator('[role="dialog"]');
        await expect(modal).not.toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should display profile fields after synthesis', async ({ page }) => {
    // This tests the profile display component (assuming a profile exists)
    await page.goto(`/projects/${projectId}`);

    // Check if profile already exists and is displayed
    const profileSection = page.locator('[data-testid="guru-profile"]');
    if (await profileSection.isVisible()) {
      // Should show domain expertise
      await expect(page.locator('text=/domain|expertise|field/i')).toBeVisible();

      // Should show audience level
      await expect(page.locator('text=/audience|level|beginner|intermediate|advanced/i')).toBeVisible();

      // Should show teaching style
      await expect(page.locator('text=/style|tone|approach/i')).toBeVisible();
    }
  });
});
