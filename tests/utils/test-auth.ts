import { Page } from '@playwright/test';

/**
 * Test Authentication Utilities
 *
 * Provides login functionality for E2E tests.
 * Requires TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables.
 *
 * For admin access (existing projects), use ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD.
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL || '';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || '';
const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD || '';

/**
 * Logs in as the test user using credentials from environment variables.
 * Waits for redirect to /projects after successful login.
 *
 * @throws Error if credentials are not configured or login fails
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables are required. ' +
      'See .env.example for configuration.'
    );
  }

  await page.goto('/login');

  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  try {
    await page.waitForURL(/\/projects/, { timeout: 15000 });
  } catch {
    // Check for error in URL (Supabase redirects with error param)
    const currentUrl = page.url();
    if (currentUrl.includes('error=')) {
      const errorParam = new URL(currentUrl).searchParams.get('error');
      throw new Error(
        `Login failed: ${errorParam}\n` +
        `Email: ${TEST_EMAIL}\n` +
        `Ensure the user exists in Supabase and email is confirmed.`
      );
    }

    // Check if still on login page
    if (currentUrl.includes('/login')) {
      throw new Error(
        `Login failed - still on login page after 15 seconds.\n` +
        `Email: ${TEST_EMAIL}\n` +
        `Verify credentials are correct and user is in ALLOWED_EMAILS.`
      );
    }

    throw new Error(
      `Login failed - unexpected redirect.\n` +
      `Current URL: ${currentUrl}\n` +
      `Expected: /projects`
    );
  }
}

/**
 * Logs in as the admin user (for accessing existing projects like backgammon-guru-2).
 * Requires ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD environment variables.
 *
 * @throws Error if credentials are not configured or login fails
 */
export async function loginAsAdminUser(page: Page): Promise<void> {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD environment variables are required. ' +
      'See .env.example for configuration.'
    );
  }

  await page.goto('/login');

  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  try {
    await page.waitForURL(/\/projects/, { timeout: 15000 });
  } catch {
    const currentUrl = page.url();
    if (currentUrl.includes('error=')) {
      const errorParam = new URL(currentUrl).searchParams.get('error');
      throw new Error(
        `Admin login failed: ${errorParam}\n` +
        `Email: ${ADMIN_EMAIL}\n` +
        `Ensure the admin user exists in Supabase.`
      );
    }

    if (currentUrl.includes('/login')) {
      throw new Error(
        `Admin login failed - still on login page after 15 seconds.\n` +
        `Email: ${ADMIN_EMAIL}\n` +
        `Verify credentials are correct.`
      );
    }

    throw new Error(
      `Admin login failed - unexpected redirect.\n` +
      `Current URL: ${currentUrl}\n` +
      `Expected: /projects`
    );
  }
}

/** Check if admin credentials are configured */
export const hasAdminCredentials = !!(ADMIN_EMAIL && ADMIN_PASSWORD);

/** Check if test user credentials are configured */
export const hasTestCredentials = !!(TEST_EMAIL && TEST_PASSWORD);

/** Check if OpenAI API key is configured (required for AI-dependent tests) */
export const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
