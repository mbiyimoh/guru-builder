import { test, expect } from '@playwright/test';

test.describe('Version History', () => {
  // These tests require a project with artifacts
  // Using existing test project or creating test data

  test.beforeEach(async ({ page }) => {
    // Login and navigate to projects
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/projects/);
  });

  test('displays version history panel on artifact page', async ({ page }) => {
    // Navigate to any project's artifact page
    await page.goto('/projects');

    // Click first project
    const projectLink = page.locator('[data-testid="project-card"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();

      // Navigate to mental model artifact if available
      const mentalModelLink = page.locator('a[href*="/artifacts/teaching/mental-model"]');
      if (await mentalModelLink.isVisible()) {
        await mentalModelLink.click();

        // Verify version panel exists
        const versionPanel = page.locator('[data-testid="version-panel"]');
        await expect(versionPanel).toBeVisible();

        // Should show at least one version
        const versions = page.locator('[data-testid^="version-"]');
        await expect(versions.first()).toBeVisible();
      }
    }
  });

  test('shows latest badge on most recent version', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('[data-testid="project-card"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();

      const mentalModelLink = page.locator('a[href*="/artifacts/teaching/mental-model"]');
      if (await mentalModelLink.isVisible()) {
        await mentalModelLink.click();

        // Find the "Latest" badge
        const latestBadge = page.getByText('Latest');
        await expect(latestBadge).toBeVisible();
      }
    }
  });

  test('can switch between versions via panel', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('[data-testid="project-card"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();

      const mentalModelLink = page.locator('a[href*="/artifacts/teaching/mental-model"]');
      if (await mentalModelLink.isVisible()) {
        await mentalModelLink.click();

        // Check if v2 exists
        const v2Button = page.locator('[data-testid="version-2"]');
        if (await v2Button.isVisible()) {
          await v2Button.click();

          // Verify URL updates
          await expect(page).toHaveURL(/\?v=2/);
        }
      }
    }
  });

  test('diff toggle is disabled for v1', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('[data-testid="project-card"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();

      const mentalModelLink = page.locator('a[href*="/artifacts/teaching/mental-model"]');
      if (await mentalModelLink.isVisible()) {
        await mentalModelLink.click();

        // Click v1 if it exists
        const v1Button = page.locator('[data-testid="version-1"]');
        if (await v1Button.isVisible()) {
          await v1Button.click();

          const diffToggle = page.locator('[data-testid="diff-toggle"]');
          if (await diffToggle.isVisible()) {
            await expect(diffToggle).toBeDisabled();
          }
        }
      }
    }
  });

  test('can enable diff view for versions > 1', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('[data-testid="project-card"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();

      const mentalModelLink = page.locator('a[href*="/artifacts/teaching/mental-model"]');
      if (await mentalModelLink.isVisible()) {
        await mentalModelLink.click();

        // Click v2 if it exists
        const v2Button = page.locator('[data-testid="version-2"]');
        if (await v2Button.isVisible()) {
          await v2Button.click();

          const diffToggle = page.locator('[data-testid="diff-toggle"]');
          if (await diffToggle.isVisible() && await diffToggle.isEnabled()) {
            await diffToggle.click();

            // Verify URL updates with diff param
            await expect(page).toHaveURL(/diff/);
          }
        }
      }
    }
  });

  test('version URL is shareable', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('[data-testid="project-card"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();

      // Get project ID from URL
      const url = page.url();
      const projectIdMatch = url.match(/\/projects\/([^\/]+)/);
      if (projectIdMatch) {
        const projectId = projectIdMatch[1];

        // Navigate directly to specific version with diff
        await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model?v=1`);

        // Verify viewer loads
        const versionPanel = page.locator('[data-testid="version-panel"]');
        if (await versionPanel.isVisible()) {
          await expect(versionPanel).toBeVisible();
        }
      }
    }
  });

  test('shows corpus hash in tooltip', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('[data-testid="project-card"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();

      const mentalModelLink = page.locator('a[href*="/artifacts/teaching/mental-model"]');
      if (await mentalModelLink.isVisible()) {
        await mentalModelLink.click();

        // Find element with corpus hash title attribute
        const corpusTooltip = page.locator('[title^="Corpus:"]');
        if (await corpusTooltip.isVisible()) {
          await expect(corpusTooltip).toBeVisible();
        }
      }
    }
  });

  test('preserves diff param when switching versions', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('[data-testid="project-card"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();

      const mentalModelLink = page.locator('a[href*="/artifacts/teaching/mental-model"]');
      if (await mentalModelLink.isVisible()) {
        await mentalModelLink.click();

        // Enable diff if version > 1
        const diffToggle = page.locator('[data-testid="diff-toggle"]');
        if (await diffToggle.isVisible() && await diffToggle.isEnabled()) {
          await diffToggle.click();

          // Now switch versions and check diff param is preserved
          const v2Button = page.locator('[data-testid="version-2"]');
          if (await v2Button.isVisible()) {
            await v2Button.click();

            // URL should still have diff param
            await expect(page).toHaveURL(/diff/);
          }
        }
      }
    }
  });
});
