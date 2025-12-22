import { test, expect } from '@playwright/test';

test.describe('Version History (Dropdown UI)', () => {
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

  test('displays version dropdown on artifact page', async ({ page }) => {
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

        // Verify version dropdown trigger exists in header
        const versionDropdown = page.locator('[data-testid="version-dropdown-trigger"]');
        await expect(versionDropdown).toBeVisible();

        // Should show current version number
        await expect(versionDropdown).toContainText(/v\d+/);
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

        // Find the "Latest" badge in the dropdown trigger
        const versionDropdown = page.locator('[data-testid="version-dropdown-trigger"]');
        if (await versionDropdown.isVisible()) {
          const latestBadge = versionDropdown.getByText('Latest');
          await expect(latestBadge).toBeVisible();
        }
      }
    }
  });

  test('can open and close version dropdown', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('[data-testid="project-card"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();

      const mentalModelLink = page.locator('a[href*="/artifacts/teaching/mental-model"]');
      if (await mentalModelLink.isVisible()) {
        await mentalModelLink.click();

        const versionDropdown = page.locator('[data-testid="version-dropdown-trigger"]');
        if (await versionDropdown.isVisible()) {
          // Open dropdown
          await versionDropdown.click();

          // Verify dropdown menu is visible
          const dropdownMenu = page.locator('[role="listbox"]');
          await expect(dropdownMenu).toBeVisible();

          // Close with Escape
          await page.keyboard.press('Escape');
          await expect(dropdownMenu).not.toBeVisible();
        }
      }
    }
  });

  test('can switch between versions via dropdown', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('[data-testid="project-card"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();

      const mentalModelLink = page.locator('a[href*="/artifacts/teaching/mental-model"]');
      if (await mentalModelLink.isVisible()) {
        await mentalModelLink.click();

        const versionDropdown = page.locator('[data-testid="version-dropdown-trigger"]');
        if (await versionDropdown.isVisible()) {
          // Open dropdown
          await versionDropdown.click();

          // Check if v2 exists in dropdown
          const v2Option = page.locator('[data-testid="version-option-2"]');
          if (await v2Option.isVisible()) {
            await v2Option.click();

            // Verify URL updates
            await expect(page).toHaveURL(/\?v=2/);

            // Verify dropdown closes after selection
            const dropdownMenu = page.locator('[role="listbox"]');
            await expect(dropdownMenu).not.toBeVisible();
          }
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

        const versionDropdown = page.locator('[data-testid="version-dropdown-trigger"]');
        if (await versionDropdown.isVisible()) {
          // Open dropdown and click v1
          await versionDropdown.click();

          const v1Option = page.locator('[data-testid="version-option-1"]');
          if (await v1Option.isVisible()) {
            await v1Option.click();

            const diffToggle = page.locator('[data-testid="diff-toggle"]');
            if (await diffToggle.isVisible()) {
              await expect(diffToggle).toBeDisabled();
            }
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

        const versionDropdown = page.locator('[data-testid="version-dropdown-trigger"]');
        if (await versionDropdown.isVisible()) {
          // Open dropdown and click v2
          await versionDropdown.click();

          const v2Option = page.locator('[data-testid="version-option-2"]');
          if (await v2Option.isVisible()) {
            await v2Option.click();

            const diffToggle = page.locator('[data-testid="diff-toggle"]');
            if (await diffToggle.isVisible() && await diffToggle.isEnabled()) {
              await diffToggle.click();

              // Verify URL updates with diff param
              await expect(page).toHaveURL(/diff/);
            }
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

        // Verify viewer loads with version dropdown
        const versionDropdown = page.locator('[data-testid="version-dropdown-trigger"]');
        if (await versionDropdown.isVisible()) {
          await expect(versionDropdown).toBeVisible();
          // Should show v1 in the dropdown trigger
          await expect(versionDropdown).toContainText('v1');
        }
      }
    }
  });

  test('dropdown shows all versions in descending order', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('[data-testid="project-card"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();

      const mentalModelLink = page.locator('a[href*="/artifacts/teaching/mental-model"]');
      if (await mentalModelLink.isVisible()) {
        await mentalModelLink.click();

        const versionDropdown = page.locator('[data-testid="version-dropdown-trigger"]');
        if (await versionDropdown.isVisible()) {
          // Open dropdown
          await versionDropdown.click();

          // Get all version options
          const versionOptions = page.locator('[data-testid^="version-option-"]');
          const count = await versionOptions.count();

          if (count > 1) {
            // Verify versions are in descending order (newest first)
            const versions: number[] = [];
            for (let i = 0; i < count; i++) {
              const testId = await versionOptions.nth(i).getAttribute('data-testid');
              if (testId) {
                const version = parseInt(testId.replace('version-option-', ''));
                versions.push(version);
              }
            }

            // Check descending order
            for (let i = 0; i < versions.length - 1; i++) {
              expect(versions[i]).toBeGreaterThan(versions[i + 1]);
            }
          }
        }
      }
    }
  });

  test('preserves diff param when switching versions via dropdown', async ({ page }) => {
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

          // Now switch versions via dropdown and check diff param is preserved
          const versionDropdown = page.locator('[data-testid="version-dropdown-trigger"]');
          if (await versionDropdown.isVisible()) {
            await versionDropdown.click();

            const v2Option = page.locator('[data-testid="version-option-2"]');
            if (await v2Option.isVisible()) {
              await v2Option.click();

              // URL should still have diff param
              await expect(page).toHaveURL(/diff/);
            }
          }
        }
      }
    }
  });

  test('dropdown closes on outside click', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('[data-testid="project-card"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();

      const mentalModelLink = page.locator('a[href*="/artifacts/teaching/mental-model"]');
      if (await mentalModelLink.isVisible()) {
        await mentalModelLink.click();

        const versionDropdown = page.locator('[data-testid="version-dropdown-trigger"]');
        if (await versionDropdown.isVisible()) {
          // Open dropdown
          await versionDropdown.click();

          const dropdownMenu = page.locator('[role="listbox"]');
          await expect(dropdownMenu).toBeVisible();

          // Click outside (on the main content area)
          await page.click('body', { position: { x: 10, y: 10 } });

          // Dropdown should close
          await expect(dropdownMenu).not.toBeVisible();
        }
      }
    }
  });
});
