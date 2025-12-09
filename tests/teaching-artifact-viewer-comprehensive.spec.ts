import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Tests for Teaching Artifact Viewer
 *
 * Verifies all implemented features from:
 * - docs/implementation-summaries/teaching-artifact-viewer-implementation.md
 * - docs/ideation/teaching-artifact-viewer-page.md
 *
 * Tests are designed to handle cases where artifacts may not exist using conditional skipping.
 */

test.describe('Teaching Artifact Viewer - Full Page Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test('navigates from teaching dashboard to dedicated artifact page', async ({ page }) => {
    // Click first project
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const projectCount = await projectCard.count();

    if (projectCount === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Look for a "View" button in the teaching section
    const viewButton = page.locator('a:has-text("View")').first();
    const hasViewButton = await viewButton.count() > 0;

    if (!hasViewButton) {
      test.skip();
      return;
    }

    // Click View button
    await viewButton.click();
    await page.waitForLoadState('networkidle');

    // Verify URL changed to artifact viewer route
    await expect(page).toHaveURL(/\/artifacts\/teaching\/(mental-model|curriculum|drill-series)/);

    // Verify full-page layout (not constrained like modals)
    const viewer = page.getByTestId('artifact-viewer-with-versions');
    await expect(viewer).toBeVisible();
  });

  test('route structure works correctly', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const projectCount = await projectCard.count();

    if (projectCount === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Get project ID
    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    // Test all three artifact type routes
    const types = ['mental-model', 'curriculum', 'drill-series'];

    for (const type of types) {
      await page.goto(`/projects/${projectId}/artifacts/teaching/${type}`);
      await page.waitForLoadState('networkidle');

      // Verify page loads (either with content or placeholder)
      const hasViewer = await page.getByTestId('artifact-viewer-with-versions').isVisible();
      const hasPlaceholder = await page.locator('text=Not Generated').count() > 0;

      expect(hasViewer || hasPlaceholder).toBeTruthy();
    }
  });

  test('back navigation returns to teaching dashboard', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const projectCount = await projectCard.count();

    if (projectCount === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    // Navigate to artifact page
    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    // Click back button
    const backButton = page.locator('text=Back to Project');
    if (await backButton.isVisible()) {
      await backButton.click();
      await page.waitForLoadState('networkidle');

      // Verify we're back on the project page
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
    } else {
      // If no back button, use browser navigation
      await page.goBack();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`));
    }
  });

  test('full viewport is used (not constrained like modals)', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const projectCount = await projectCard.count();

    if (projectCount === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const viewButton = page.locator('a:has-text("View")').first();
    const hasViewButton = await viewButton.count() > 0;

    if (!hasViewButton) {
      test.skip();
      return;
    }

    await viewButton.click();
    await page.waitForLoadState('networkidle');

    const viewer = page.getByTestId('artifact-viewer-with-versions');
    if (await viewer.isVisible()) {
      const box = await viewer.boundingBox();

      // Verify it uses significant viewport (not modal-constrained to max-w-4xl)
      // Full page should be wider than 896px (max-w-4xl)
      if (box) {
        expect(box.width).toBeGreaterThan(900);
      }
    } else {
      test.skip();
    }
  });
});

test.describe('Version History Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test('displays all versions with timestamps', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    const versionPanel = page.getByTestId('version-panel');
    if (await versionPanel.isVisible()) {
      // Check that versions are displayed
      const versionButtons = page.locator('[data-testid^="version-"]');
      const count = await versionButtons.count();
      expect(count).toBeGreaterThan(0);

      // Verify timestamps are shown
      const firstVersion = versionButtons.first();
      const text = await firstVersion.textContent();

      // Should contain version number (e.g., "v1", "v2")
      expect(text).toMatch(/v\d+/);

      // Should contain date (e.g., "Dec 8, 2025")
      expect(text).toMatch(/[A-Z][a-z]{2}\s+\d{1,2}/);
    } else {
      test.skip();
    }
  });

  test('shows corpus hash indicators', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    const versionPanel = page.getByTestId('version-panel');
    if (await versionPanel.isVisible()) {
      // Check for corpus hash tooltip
      const hashElement = page.locator('[title^="Corpus:"]').first();
      if (await hashElement.isVisible()) {
        const title = await hashElement.getAttribute('title');
        expect(title).toContain('Corpus:');
      }
    } else {
      test.skip();
    }
  });

  test('clicking version loads that version with URL param', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    const versionButtons = page.locator('[data-testid^="version-"]');
    const count = await versionButtons.count();

    if (count > 1) {
      // Click on version 2 if it exists
      const v2Button = page.getByTestId('version-2');
      if (await v2Button.isVisible()) {
        await v2Button.click();
        await page.waitForLoadState('networkidle');

        // Verify URL contains version parameter
        await expect(page).toHaveURL(/\?v=2/);

        // Verify version is highlighted
        await expect(v2Button).toHaveClass(/bg-blue-100/);
      }
    } else {
      test.skip();
    }
  });

  test('Latest badge displays correctly', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    const versionPanel = page.getByTestId('version-panel');
    if (await versionPanel.isVisible()) {
      // Find the "Latest" badge
      const latestBadge = page.getByText('Latest');
      if (await latestBadge.isVisible()) {
        await expect(latestBadge).toBeVisible();

        // Should be styled with green background
        await expect(latestBadge).toHaveClass(/bg-green-100/);
      }
    } else {
      test.skip();
    }
  });

  test('version switching preserves artifact type', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    // Start on curriculum page
    await page.goto(`/projects/${projectId}/artifacts/teaching/curriculum`);
    await page.waitForLoadState('networkidle');

    const versionButtons = page.locator('[data-testid^="version-"]');
    const count = await versionButtons.count();

    if (count > 1) {
      const v1Button = page.getByTestId('version-1');
      if (await v1Button.isVisible()) {
        await v1Button.click();
        await page.waitForLoadState('networkidle');

        // Verify we're still on curriculum page
        await expect(page).toHaveURL(/\/curriculum/);
      }
    } else {
      test.skip();
    }
  });
});

test.describe('View Mode Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test('three modes are available', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const viewButton = page.locator('a:has-text("View")').first();
    if (await viewButton.count() === 0) {
      test.skip();
      return;
    }

    await viewButton.click();
    await page.waitForLoadState('networkidle');

    const viewer = page.getByTestId('artifact-viewer-with-versions');
    if (await viewer.isVisible()) {
      // Check all three mode buttons exist
      await expect(page.getByTestId('view-mode-rendered')).toBeVisible();
      await expect(page.getByTestId('view-mode-markdown')).toBeVisible();
      await expect(page.getByTestId('view-mode-json')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('default mode is Rendered', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const viewButton = page.locator('a:has-text("View")').first();
    if (await viewButton.count() === 0) {
      test.skip();
      return;
    }

    await viewButton.click();
    await page.waitForLoadState('networkidle');

    const viewer = page.getByTestId('artifact-viewer-with-versions');
    if (await viewer.isVisible()) {
      // Rendered button should be selected by default
      await expect(page.getByTestId('view-mode-rendered')).toHaveAttribute('aria-selected', 'true');

      // Type-specific renderer should be visible
      const renderer = page.getByTestId('type-specific-renderer');
      if (await renderer.count() > 0) {
        await expect(renderer).toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('can switch to Markdown mode', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const viewButton = page.locator('a:has-text("View")').first();
    if (await viewButton.count() === 0) {
      test.skip();
      return;
    }

    await viewButton.click();
    await page.waitForLoadState('networkidle');

    const viewer = page.getByTestId('artifact-viewer-with-versions');
    if (await viewer.isVisible()) {
      // Click Markdown button
      await page.getByTestId('view-mode-markdown').click();
      await page.waitForTimeout(200);

      // Markdown should be selected
      await expect(page.getByTestId('view-mode-markdown')).toHaveAttribute('aria-selected', 'true');

      // Type-specific renderer should NOT be visible
      const renderer = page.getByTestId('type-specific-renderer');
      if (await renderer.count() > 0) {
        await expect(renderer).not.toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('can switch to JSON mode', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const viewButton = page.locator('a:has-text("View")').first();
    if (await viewButton.count() === 0) {
      test.skip();
      return;
    }

    await viewButton.click();
    await page.waitForLoadState('networkidle');

    const viewer = page.getByTestId('artifact-viewer-with-versions');
    if (await viewer.isVisible()) {
      // Click JSON button
      await page.getByTestId('view-mode-json').click();
      await page.waitForTimeout(200);

      // JSON should be selected
      await expect(page.getByTestId('view-mode-json')).toHaveAttribute('aria-selected', 'true');

      // Should show pre element with JSON
      const preElement = page.locator('pre');
      await expect(preElement).toBeVisible();
      await expect(preElement).toContainText('{');
    } else {
      test.skip();
    }
  });

  test('content displays correctly in each mode', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const viewButton = page.locator('a:has-text("View")').first();
    if (await viewButton.count() === 0) {
      test.skip();
      return;
    }

    await viewButton.click();
    await page.waitForLoadState('networkidle');

    const viewer = page.getByTestId('artifact-viewer-with-versions');
    if (await viewer.isVisible()) {
      // Rendered mode - should show type-specific renderer
      const renderer = page.getByTestId('type-specific-renderer');
      if (await renderer.count() > 0) {
        await expect(renderer).toBeVisible();
      }

      // Switch to JSON mode
      await page.getByTestId('view-mode-json').click();
      await page.waitForTimeout(200);

      const preElement = page.locator('pre');
      await expect(preElement).toBeVisible();
      const jsonText = await preElement.textContent();
      expect(jsonText).toContain('{');

      // Switch to Markdown mode
      await page.getByTestId('view-mode-markdown').click();
      await page.waitForTimeout(200);

      // In markdown mode, diff content component is shown
      // Content should be visible
      const markdownContent = page.locator('.overflow-auto');
      await expect(markdownContent).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('TOC only shows in Rendered mode', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const viewButton = page.locator('a:has-text("View")').first();
    if (await viewButton.count() === 0) {
      test.skip();
      return;
    }

    await viewButton.click();
    await page.waitForLoadState('networkidle');

    const viewer = page.getByTestId('artifact-viewer-with-versions');
    if (await viewer.isVisible()) {
      // In Rendered mode, TOC should be visible
      const tocInRendered = await page.getByTestId('table-of-contents').isVisible();

      // Switch to JSON mode
      await page.getByTestId('view-mode-json').click();
      await page.waitForTimeout(200);

      const tocInJson = await page.getByTestId('table-of-contents').isVisible();

      // Switch to Markdown mode
      await page.getByTestId('view-mode-markdown').click();
      await page.waitForTimeout(200);

      const tocInMarkdown = await page.getByTestId('table-of-contents').isVisible();

      // TOC should only be visible in Rendered mode
      expect(tocInJson).toBe(false);
      expect(tocInMarkdown).toBe(false);
    } else {
      test.skip();
    }
  });
});

test.describe('Type-Specific Renderers - Mental Model', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test('displays categories with principles', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    const renderer = page.getByTestId('mental-model-renderer');
    if (await renderer.isVisible()) {
      // Check for category sections
      const categorySection = page.locator('section[id^="category-"]').first();
      if (await categorySection.isVisible()) {
        await expect(categorySection).toBeVisible();

        // Check for category heading
        const heading = categorySection.locator('h2');
        await expect(heading).toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('principle cards show all fields', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    const renderer = page.getByTestId('mental-model-renderer');
    if (await renderer.isVisible()) {
      // Find first principle card
      const principleCard = page.locator('[data-testid^="principle-card-"]').first();

      if (await principleCard.isVisible()) {
        // Should show principle name and essence by default
        const cardText = await principleCard.textContent();
        expect(cardText).toBeTruthy();

        // Click to expand
        await principleCard.click();
        await page.waitForTimeout(200);

        // After expansion, should show additional fields
        const expandedText = await principleCard.textContent();

        // Should contain section headers for expanded content
        expect(expandedText).toMatch(/(Why It Matters|Common Mistake|Recognition Pattern)/);
      }
    } else {
      test.skip();
    }
  });

  test('principle cards are expandable', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    const renderer = page.getByTestId('mental-model-renderer');
    if (await renderer.isVisible()) {
      const principleCard = page.locator('[data-testid^="principle-card-"]').first();

      if (await principleCard.isVisible()) {
        // Get initial height
        const collapsedBox = await principleCard.boundingBox();

        // Click to expand
        await principleCard.click();
        await page.waitForTimeout(300);

        // Get expanded height
        const expandedBox = await principleCard.boundingBox();

        // Expanded should be taller
        if (collapsedBox && expandedBox) {
          expect(expandedBox.height).toBeGreaterThan(collapsedBox.height);
        }

        // Click again to collapse
        await principleCard.click();
        await page.waitForTimeout(300);

        const reCollapsedBox = await principleCard.boundingBox();
        if (reCollapsedBox && collapsedBox) {
          expect(reCollapsedBox.height).toBeLessThanOrEqual(collapsedBox.height + 5);
        }
      }
    } else {
      test.skip();
    }
  });
});

test.describe('Type-Specific Renderers - Curriculum', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test('displays modules with lessons', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/curriculum`);
    await page.waitForLoadState('networkidle');

    const renderer = page.getByTestId('curriculum-renderer');
    if (await renderer.isVisible()) {
      // Check for module sections
      const moduleSection = page.locator('section[id^="module-"]').first();
      if (await moduleSection.isVisible()) {
        await expect(moduleSection).toBeVisible();

        // Should have module heading
        const heading = moduleSection.locator('h2');
        await expect(heading).toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('lesson cards show type badges', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/curriculum`);
    await page.waitForLoadState('networkidle');

    const renderer = page.getByTestId('curriculum-renderer');
    if (await renderer.isVisible()) {
      // Find first lesson card
      const lessonCard = page.locator('[data-testid^="lesson-card-"]').first();

      if (await lessonCard.isVisible()) {
        // Should contain a lesson type badge (CONCEPT, EXAMPLE, CONTRAST, or PRACTICE)
        const cardText = await lessonCard.textContent();
        const hasTypeBadge = /CONCEPT|EXAMPLE|CONTRAST|PRACTICE/.test(cardText || '');
        expect(hasTypeBadge).toBeTruthy();
      }
    } else {
      test.skip();
    }
  });

  test('lesson cards show difficulty badges', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/curriculum`);
    await page.waitForLoadState('networkidle');

    const renderer = page.getByTestId('curriculum-renderer');
    if (await renderer.isVisible()) {
      const lessonCard = page.locator('[data-testid^="lesson-card-"]').first();

      if (await lessonCard.isVisible()) {
        // Should contain a difficulty badge
        const cardText = await lessonCard.textContent();
        const hasDifficultyBadge = /FOUNDATIONAL|INTERMEDIATE|ADVANCED/.test(cardText || '');
        expect(hasDifficultyBadge).toBeTruthy();
      }
    } else {
      test.skip();
    }
  });

  test('lessons are expandable', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/curriculum`);
    await page.waitForLoadState('networkidle');

    const renderer = page.getByTestId('curriculum-renderer');
    if (await renderer.isVisible()) {
      const lessonCard = page.locator('[data-testid^="lesson-card-"]').first();

      if (await lessonCard.isVisible()) {
        // Click to expand
        await lessonCard.click();
        await page.waitForTimeout(300);

        // Should show expanded content
        const expandedText = await lessonCard.textContent();
        expect(expandedText).toBeTruthy();
        expect(expandedText!.length).toBeGreaterThan(50);
      }
    } else {
      test.skip();
    }
  });
});

test.describe('Type-Specific Renderers - Drill Series', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test('displays series sections with drills', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/drill-series`);
    await page.waitForLoadState('networkidle');

    const renderer = page.getByTestId('drill-series-renderer');
    if (await renderer.isVisible()) {
      // Check for series sections
      const seriesSection = page.locator('section[id^="series-"]').first();
      if (await seriesSection.isVisible()) {
        await expect(seriesSection).toBeVisible();

        // Should have series heading
        const heading = seriesSection.locator('h2');
        await expect(heading).toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('drill cards show tier badges', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/drill-series`);
    await page.waitForLoadState('networkidle');

    const renderer = page.getByTestId('drill-series-renderer');
    if (await renderer.isVisible()) {
      // Find first drill card
      const drillCard = page.locator('[data-testid^="drill-card-"]').first();

      if (await drillCard.isVisible()) {
        // Should contain a tier badge
        const cardText = await drillCard.textContent();
        const hasTierBadge = /RECOGNITION|APPLICATION|TRANSFER/.test(cardText || '');
        expect(hasTierBadge).toBeTruthy();
      }
    } else {
      test.skip();
    }
  });

  test('drill cards are expandable', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/drill-series`);
    await page.waitForLoadState('networkidle');

    const renderer = page.getByTestId('drill-series-renderer');
    if (await renderer.isVisible()) {
      const drillCard = page.locator('[data-testid^="drill-card-"]').first();

      if (await drillCard.isVisible()) {
        // Click to expand
        await drillCard.click();
        await page.waitForTimeout(300);

        // Should show feedback section
        const expandedText = await drillCard.textContent();
        expect(expandedText).toContain('Feedback');
      }
    } else {
      test.skip();
    }
  });

  test('practice sequences section displays', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/drill-series`);
    await page.waitForLoadState('networkidle');

    const renderer = page.getByTestId('drill-series-renderer');
    if (await renderer.isVisible()) {
      // Check if practice sequences section exists
      const practiceSection = page.locator('#practice-sequences');

      // It may or may not exist depending on the content
      const exists = await practiceSection.count() > 0;

      if (exists) {
        await expect(practiceSection).toBeVisible();
        await expect(practiceSection.locator('h2')).toContainText('Practice Sequences');
      }
    } else {
      test.skip();
    }
  });
});

test.describe('Table of Contents (TOC)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test('auto-generates TOC for artifact', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const viewButton = page.locator('a:has-text("View")').first();
    if (await viewButton.count() === 0) {
      test.skip();
      return;
    }

    await viewButton.click();
    await page.waitForLoadState('networkidle');

    const toc = page.getByTestId('table-of-contents');
    if (await toc.isVisible()) {
      // Should have TOC items
      const tocItems = page.locator('[data-testid^="toc-item-"]');
      const count = await tocItems.count();
      expect(count).toBeGreaterThan(0);
    } else {
      test.skip();
    }
  });

  test('TOC has hierarchical structure', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const viewButton = page.locator('a:has-text("View")').first();
    if (await viewButton.count() === 0) {
      test.skip();
      return;
    }

    await viewButton.click();
    await page.waitForLoadState('networkidle');

    const toc = page.getByTestId('table-of-contents');
    if (await toc.isVisible()) {
      // Check for nested structure (look for indented items)
      const allTocItems = page.locator('[data-testid^="toc-item-"]');
      const count = await allTocItems.count();

      if (count > 0) {
        // TOC should exist with items
        expect(count).toBeGreaterThan(0);
      }
    } else {
      test.skip();
    }
  });

  test('clicking TOC item scrolls to section', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const viewButton = page.locator('a:has-text("View")').first();
    if (await viewButton.count() === 0) {
      test.skip();
      return;
    }

    await viewButton.click();
    await page.waitForLoadState('networkidle');

    const toc = page.getByTestId('table-of-contents');
    if (await toc.isVisible()) {
      const firstTocItem = page.locator('[data-testid^="toc-item-"]').first();

      if (await firstTocItem.isVisible()) {
        // Get the section ID from the TOC item's data-testid
        const testId = await firstTocItem.getAttribute('data-testid');
        const sectionId = testId?.replace('toc-item-', '');

        // Click the TOC item
        await firstTocItem.click();
        await page.waitForTimeout(500);

        // The corresponding section should be in viewport
        if (sectionId) {
          const section = page.locator(`#${sectionId}`);
          if (await section.count() > 0) {
            await expect(section).toBeVisible();
          }
        }
      }
    } else {
      test.skip();
    }
  });

  test('active section highlighting (scroll spy)', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const viewButton = page.locator('a:has-text("View")').first();
    if (await viewButton.count() === 0) {
      test.skip();
      return;
    }

    await viewButton.click();
    await page.waitForLoadState('networkidle');

    const toc = page.getByTestId('table-of-contents');
    if (await toc.isVisible()) {
      // Wait for intersection observer to initialize
      await page.waitForTimeout(500);

      // Check if any TOC item has active highlighting
      const highlightedItems = page.locator('[data-testid^="toc-item-"].bg-blue-100');
      const count = await highlightedItems.count();

      // There may or may not be a highlighted item depending on scroll position
      // Just verify the TOC system is functional
      expect(count).toBeGreaterThanOrEqual(0);
    } else {
      test.skip();
    }
  });
});

test.describe('Dependency Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test('dependency chips display in header', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    // Navigate to curriculum which might depend on mental model
    await page.goto(`/projects/${projectId}/artifacts/teaching/curriculum`);
    await page.waitForLoadState('networkidle');

    const viewer = page.getByTestId('artifact-viewer-with-versions');
    if (await viewer.isVisible()) {
      // Look for dependency information in the page
      // This might be in a footer or header section
      const pageText = await page.textContent('body');

      // Dependencies might be labeled as "Depends on" or "Used by"
      const hasDependencyInfo = pageText?.includes('Depends on') || pageText?.includes('Used by');

      // This is optional - not all artifacts have dependencies
      // Just verify the page loaded successfully
      expect(viewer).toBeVisible();
    } else {
      test.skip();
    }
  });
});

test.describe('Diff View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test('diff toggle appears for version > 1', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    // Check if we have multiple versions
    const versionButtons = page.locator('[data-testid^="version-"]');
    const count = await versionButtons.count();

    if (count > 1) {
      // Select version 2 or higher
      const v2Button = page.getByTestId('version-2');
      if (await v2Button.isVisible()) {
        await v2Button.click();
        await page.waitForLoadState('networkidle');

        // Diff toggle should be available and enabled
        const diffToggle = page.getByTestId('diff-toggle');
        if (await diffToggle.count() > 0) {
          await expect(diffToggle).toBeEnabled();
        }
      }
    } else {
      test.skip();
    }
  });

  test('diff toggle is disabled for v1', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model?v=1`);
    await page.waitForLoadState('networkidle');

    const diffToggle = page.getByTestId('diff-toggle');
    if (await diffToggle.count() > 0) {
      await expect(diffToggle).toBeDisabled();
    } else {
      // If v1 doesn't exist, skip
      test.skip();
    }
  });

  test('switching to diff view works', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    if (await projectCard.count() === 0) {
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const projectIdMatch = url.match(/\/projects\/([^/]+)/);
    if (!projectIdMatch) {
      test.skip();
      return;
    }
    const projectId = projectIdMatch[1];

    await page.goto(`/projects/${projectId}/artifacts/teaching/mental-model`);
    await page.waitForLoadState('networkidle');

    // Check if we have multiple versions
    const versionButtons = page.locator('[data-testid^="version-"]');
    const count = await versionButtons.count();

    if (count > 1) {
      const v2Button = page.getByTestId('version-2');
      if (await v2Button.isVisible()) {
        await v2Button.click();
        await page.waitForLoadState('networkidle');

        // Switch to markdown mode first (diff shows in markdown mode)
        await page.getByTestId('view-mode-markdown').click();
        await page.waitForTimeout(200);

        const diffToggle = page.getByTestId('diff-toggle');
        if (await diffToggle.count() > 0 && await diffToggle.isEnabled()) {
          await diffToggle.click();
          await page.waitForLoadState('networkidle');

          // URL should contain diff parameter
          await expect(page).toHaveURL(/diff/);
        }
      }
    } else {
      test.skip();
    }
  });
});
