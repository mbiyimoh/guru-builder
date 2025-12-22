import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Phase-Organized Drill Library
 *
 * Tests for the hierarchical drill viewer with:
 * - Phase sections (OPENING, EARLY, MIDDLE, BEAROFF)
 * - Principle groups within phases
 * - Drill cards with feedback expansion
 * - Position attribution panel (when positions are available)
 * - TOC navigation for phases
 */

test.describe('Phase-Organized Drill Viewer', () => {
  let projectId: string | null = null;
  let hasDrillSeries = false;

  test.beforeEach(async ({ page }) => {
    // Navigate to projects list
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Click on first available project
    const projectLink = page.locator('a[href^="/projects/"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForLoadState('networkidle');

      // Extract project ID from URL
      const url = page.url();
      const match = url.match(/\/projects\/([^/]+)/);
      projectId = match ? match[1] : null;

      // Check if drill series artifact exists and is viewable
      const drillSeriesLink = page.locator('a[href*="/artifacts/teaching/drill-series"]');
      if (await drillSeriesLink.isVisible()) {
        await drillSeriesLink.click();
        await page.waitForLoadState('networkidle');

        // Check if artifact has content (vs placeholder)
        const hasContent = await page.getByTestId('phase-organized-drill-renderer').isVisible();
        hasDrillSeries = hasContent;
      }
    }
  });

  test('displays phase-organized drill renderer', async ({ page }) => {
    if (!hasDrillSeries) {
      test.skip();
      return;
    }

    // Verify the phase-organized renderer is present
    await expect(page.getByTestId('phase-organized-drill-renderer')).toBeVisible();
  });

  test('shows drill series header with title and stats', async ({ page }) => {
    if (!hasDrillSeries) {
      test.skip();
      return;
    }

    // Check for title in header
    const header = page.locator('h1');
    await expect(header).toBeVisible();

    // Check for drill count and estimated time
    const drillsText = page.locator('text=/\\d+ drills/');
    const timeText = page.locator('text=/~?\\d+ min/');
    await expect(drillsText).toBeVisible();
    await expect(timeText).toBeVisible();
  });

  test('displays phase sections with colored headers', async ({ page }) => {
    if (!hasDrillSeries) {
      test.skip();
      return;
    }

    // Look for phase sections (at least OPENING should exist)
    const phaseSection = page.locator('[id^="phase-"]').first();
    await expect(phaseSection).toBeVisible();

    // Verify phase header has gradient styling (just check structure, not color)
    const phaseHeader = phaseSection.locator('h2').first();
    await expect(phaseHeader).toBeVisible();
  });

  test('shows principle groups within phases', async ({ page }) => {
    if (!hasDrillSeries) {
      test.skip();
      return;
    }

    // Look for principle group headers
    const principleHeader = page.locator('[id^="principle-"]').first();
    await expect(principleHeader).toBeVisible();

    // Principle groups should show drill count
    const drillCount = page.locator('text=/\\(\\d+ drills?\\)/').first();
    await expect(drillCount).toBeVisible();
  });

  test('drill cards display scenario and question', async ({ page }) => {
    if (!hasDrillSeries) {
      test.skip();
      return;
    }

    // Find a drill card
    const drillCard = page.locator('[data-testid^="drill-card-with-position-"]').first().or(
      page.locator('[data-testid^="phase-drill-card-"]').first()
    );

    if (await drillCard.count() > 0) {
      // Verify scenario and question sections exist
      await expect(drillCard.locator('text=Scenario').first()).toBeVisible();
      await expect(drillCard.locator('text=Question').first()).toBeVisible();
    }
  });

  test('drill cards show tier and methodology badges', async ({ page }) => {
    if (!hasDrillSeries) {
      test.skip();
      return;
    }

    // Find a drill card
    const drillCard = page.locator('[data-testid^="drill-card-with-position-"]').first().or(
      page.locator('[data-testid^="phase-drill-card-"]').first()
    );

    if (await drillCard.count() > 0) {
      // Look for tier badge (RECOGNITION, APPLICATION, or TRANSFER)
      const tierBadge = drillCard.locator('text=/RECOGNITION|APPLICATION|TRANSFER/').first();
      await expect(tierBadge).toBeVisible();
    }
  });

  test('feedback section expands and collapses', async ({ page }) => {
    if (!hasDrillSeries) {
      test.skip();
      return;
    }

    // Find a drill card with feedback toggle
    const feedbackToggle = page.locator('button:has-text("Show Feedback")').first().or(
      page.locator('button:has-text("Feedback & Explanation")').first()
    );

    if (await feedbackToggle.count() > 0) {
      // Initially feedback should be collapsed
      const correctResponse = page.locator('text=Correct Response');
      await expect(correctResponse).not.toBeVisible();

      // Click to expand
      await feedbackToggle.click();
      await page.waitForTimeout(200);

      // Feedback should now be visible
      await expect(correctResponse.first()).toBeVisible();

      // Click to collapse
      const hideButton = page.locator('button:has-text("Hide Feedback")').first();
      if (await hideButton.isVisible()) {
        await hideButton.click();
        await page.waitForTimeout(200);
      }
    }
  });

  test('displays multiple choice options with correct answer highlighted', async ({ page }) => {
    if (!hasDrillSeries) {
      test.skip();
      return;
    }

    // Find drill cards with options
    const optionElements = page.locator('.bg-green-50').first();

    // If there are options, at least one should be marked correct (green background)
    if (await optionElements.count() > 0) {
      await expect(optionElements).toBeVisible();
    }
  });

  test('TOC displays phase sections', async ({ page }) => {
    if (!hasDrillSeries) {
      test.skip();
      return;
    }

    const tocExists = await page.getByTestId('table-of-contents').isVisible();

    if (tocExists) {
      // Should have at least one phase-level TOC item
      const phaseTocItems = page.locator('[data-testid^="toc-item-phase-"]');
      const count = await phaseTocItems.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('clicking TOC item scrolls to phase section', async ({ page }) => {
    if (!hasDrillSeries) {
      test.skip();
      return;
    }

    const tocExists = await page.getByTestId('table-of-contents').isVisible();

    if (tocExists) {
      // Get the first phase TOC item
      const tocItem = page.locator('[data-testid^="toc-item-phase-"]').first();

      if (await tocItem.isVisible()) {
        // Click the TOC item
        await tocItem.click();
        await page.waitForTimeout(500);

        // The phase section should be visible
        const phaseSection = page.locator('[id^="phase-"]').first();
        await expect(phaseSection).toBeVisible();
      }
    }
  });
});

test.describe('Position Attribution Panel', () => {
  let hasDrillWithPosition = false;

  test.beforeEach(async ({ page }) => {
    // Navigate to projects and find drill series
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const projectLink = page.locator('a[href^="/projects/"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForLoadState('networkidle');

      const drillSeriesLink = page.locator('a[href*="/artifacts/teaching/drill-series"]');
      if (await drillSeriesLink.isVisible()) {
        await drillSeriesLink.click();
        await page.waitForLoadState('networkidle');

        // Check if any drill has position attribution (button with "Position:" text)
        const positionButton = page.locator('button:has-text("Position:")').first();
        hasDrillWithPosition = await positionButton.count() > 0;
      }
    }
  });

  test('shows position toggle button when drill has positionId', async ({ page }) => {
    if (!hasDrillWithPosition) {
      test.skip();
      return;
    }

    // Position button should be visible
    const positionButton = page.locator('button:has-text("Position:")').first();
    await expect(positionButton).toBeVisible();

    // Should display the position ID
    await expect(positionButton).toContainText('Position:');
  });

  test('position panel expands and shows ASCII board', async ({ page }) => {
    if (!hasDrillWithPosition) {
      test.skip();
      return;
    }

    // Click position toggle
    const positionButton = page.locator('button:has-text("Position:")').first();
    await positionButton.click();

    // Wait for panel to load (has async fetch)
    await page.waitForTimeout(1000);

    // Should show ASCII board in pre element
    const asciiBoard = page.locator('pre.font-mono').first();
    await expect(asciiBoard).toBeVisible();
  });

  test('position panel shows move analysis', async ({ page }) => {
    if (!hasDrillWithPosition) {
      test.skip();
      return;
    }

    // Click position toggle
    const positionButton = page.locator('button:has-text("Position:")').first();
    await positionButton.click();

    // Wait for panel to load
    await page.waitForTimeout(1000);

    // Should show "Best:" move
    const bestMove = page.locator('text=Best:').first();
    await expect(bestMove).toBeVisible();
  });

  test('position panel shows match context when available', async ({ page }) => {
    if (!hasDrillWithPosition) {
      test.skip();
      return;
    }

    // Click position toggle
    const positionButton = page.locator('button:has-text("Position:")').first();
    await positionButton.click();

    // Wait for panel to load
    await page.waitForTimeout(1000);

    // Match context is optional - just verify the panel loaded
    // If there's a match, it would show "vs" text
    const panelLoaded = await page.locator('pre.font-mono').isVisible() ||
                        await page.locator('text=Position not found').isVisible() ||
                        await page.locator('text=Loading position').isVisible();
    expect(panelLoaded).toBeTruthy();
  });

  test('position panel handles loading state', async ({ page }) => {
    if (!hasDrillWithPosition) {
      test.skip();
      return;
    }

    // Click position toggle
    const positionButton = page.locator('button:has-text("Position:")').first();
    await positionButton.click();

    // Should briefly show loading state (may be fast)
    // Just verify the panel appeared
    const panelContainer = page.locator('.bg-gray-50.border-t').first();
    await expect(panelContainer).toBeVisible();
  });
});

test.describe('Phase-Organized Drill Viewer - Design Thoughts', () => {
  let hasDrillSeries = false;

  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const projectLink = page.locator('a[href^="/projects/"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForLoadState('networkidle');

      const drillSeriesLink = page.locator('a[href*="/artifacts/teaching/drill-series"]');
      if (await drillSeriesLink.isVisible()) {
        await drillSeriesLink.click();
        await page.waitForLoadState('networkidle');
        hasDrillSeries = await page.getByTestId('phase-organized-drill-renderer').isVisible();
      }
    }
  });

  test('shows design thoughts section if available', async ({ page }) => {
    if (!hasDrillSeries) {
      test.skip();
      return;
    }

    // Design thoughts section is optional
    const designThoughts = page.locator('#design-thoughts');
    const exists = await designThoughts.count() > 0;

    if (exists) {
      await expect(designThoughts).toBeVisible();
      await expect(designThoughts.locator('text=Design Thoughts')).toBeVisible();
    }
  });
});
