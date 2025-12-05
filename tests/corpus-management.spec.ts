import { test, expect } from '@playwright/test';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';

/**
 * Corpus Management Tests
 *
 * Tests CRUD operations for Context Layers and Knowledge Files.
 * These tests fill critical coverage gaps in the test suite.
 */
test.describe('Corpus Management', () => {
  let projectId: string;
  const projectName = `Test Corpus Management ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    // Create a shared test project for corpus management tests
    const context = await browser.newContext();
    const page = await context.newPage();
    const projectsPage = new ProjectsListPage(page);

    await projectsPage.goto();
    await projectsPage.createProject(projectName, 'Corpus management test project');

    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
    const url = page.url();
    const match = url.match(/\/projects\/([a-zA-Z0-9-]+)$/);
    if (match) {
      projectId = match[1];
    }

    await context.close();
  });

  test.describe('Context Layer CRUD', () => {
    test('creates new context layer', async ({ page }) => {
      await page.goto(`/projects/${projectId}`);

      // Wait for context layers section to load
      await expect(page.getByText('Context Layers')).toBeVisible();

      // Click Add Context Layer button
      const addButton = page.getByRole('button', { name: /add context layer/i });
      await expect(addButton).toBeVisible();
      await addButton.click();

      // Fill in modal form
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      await modal.getByLabel(/title/i).fill('Test Context Layer');
      await modal.getByLabel(/content/i).fill('This is the content for the test context layer. It provides foundational knowledge.');
      await modal.getByLabel(/priority/i).fill('1');

      // Save
      await modal.getByRole('button', { name: /save|create/i }).click();

      // Verify layer appears in list
      await expect(page.getByText('Test Context Layer')).toBeVisible();
      await expect(page.getByText('Priority 1')).toBeVisible();
    });

    test('updates context layer content', async ({ page }) => {
      await page.goto(`/projects/${projectId}`);

      // Wait for layers to load
      await expect(page.getByText('Test Context Layer')).toBeVisible();

      // Click edit button
      const layerSection = page.locator('text=Test Context Layer').locator('..');
      await layerSection.getByRole('button', { name: /edit/i }).click();

      // Verify modal opens with existing data
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Update content
      const contentInput = modal.getByLabel(/content/i);
      await contentInput.clear();
      await contentInput.fill('Updated content for the context layer with new information.');

      // Save changes
      await modal.getByRole('button', { name: /save|update/i }).click();

      // Verify modal closes
      await expect(modal).not.toBeVisible();

      // Verify content preview updates (shows first 200 chars)
      await expect(page.getByText('Updated content for the context layer')).toBeVisible();
    });

    test('toggles context layer active status', async ({ page }) => {
      await page.goto(`/projects/${projectId}`);

      // Wait for layer to load
      await expect(page.getByText('Test Context Layer')).toBeVisible();

      // Find the checkbox in the layer row
      const layerRow = page.locator('text=Test Context Layer').locator('..').locator('..');
      const activeCheckbox = layerRow.getByRole('checkbox');

      // Should be active by default
      await expect(activeCheckbox).toBeChecked();

      // Toggle off
      await activeCheckbox.uncheck();

      // Wait for API call to complete
      await page.waitForResponse((response) =>
        response.url().includes('/api/context-layers/') && response.request().method() === 'PATCH'
      );

      // Verify status badge updates
      await expect(layerRow.getByText('Inactive')).toBeVisible();

      // Toggle back on
      await activeCheckbox.check();

      await page.waitForResponse((response) =>
        response.url().includes('/api/context-layers/') && response.request().method() === 'PATCH'
      );

      await expect(layerRow.getByText('Active')).toBeVisible();
    });

    test('deletes context layer with confirmation', async ({ page }) => {
      await page.goto(`/projects/${projectId}`);

      // First create a layer to delete
      const addButton = page.getByRole('button', { name: /add context layer/i });
      await addButton.click();

      const modal = page.locator('[role="dialog"]');
      await modal.getByLabel(/title/i).fill('Layer To Delete');
      await modal.getByLabel(/content/i).fill('This layer will be deleted.');
      await modal.getByLabel(/priority/i).fill('99');
      await modal.getByRole('button', { name: /save|create/i }).click();

      // Verify layer exists
      await expect(page.getByText('Layer To Delete')).toBeVisible();

      // Set up dialog handler for confirm dialog
      page.once('dialog', (dialog) => dialog.accept());

      // Click delete
      const layerRow = page.locator('text=Layer To Delete').locator('..').locator('..');
      await layerRow.getByRole('button', { name: /delete/i }).click();

      // Verify layer is removed
      await expect(page.getByText('Layer To Delete')).not.toBeVisible();
    });
  });

  test.describe('Knowledge File CRUD', () => {
    test('creates new knowledge file', async ({ page }) => {
      await page.goto(`/projects/${projectId}`);

      // Scroll to knowledge files section
      await page.getByText('Knowledge Files').scrollIntoViewIfNeeded();
      await expect(page.getByText('Knowledge Files')).toBeVisible();

      // Click Add Knowledge File button
      const addButton = page.getByRole('button', { name: /add knowledge file/i });
      await expect(addButton).toBeVisible();
      await addButton.click();

      // Fill in modal form
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      await modal.getByLabel(/title/i).fill('Test Knowledge File');
      await modal.getByLabel(/content/i).fill('Detailed knowledge content for the test file.');

      // Optional fields
      const descriptionInput = modal.getByLabel(/description/i);
      if (await descriptionInput.isVisible()) {
        await descriptionInput.fill('A test knowledge file');
      }

      const categoryInput = modal.getByLabel(/category/i);
      if (await categoryInput.isVisible()) {
        await categoryInput.fill('Testing');
      }

      // Save
      await modal.getByRole('button', { name: /save|create/i }).click();

      // Verify file appears in list
      await expect(page.getByText('Test Knowledge File')).toBeVisible();
    });

    test('updates knowledge file metadata', async ({ page }) => {
      await page.goto(`/projects/${projectId}`);

      // Wait for knowledge files to load
      await page.getByText('Knowledge Files').scrollIntoViewIfNeeded();
      await expect(page.getByText('Test Knowledge File')).toBeVisible();

      // Click edit button
      const fileSection = page.locator('text=Test Knowledge File').locator('..');
      await fileSection.getByRole('button', { name: /edit/i }).click();

      // Verify modal opens
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Update title
      const titleInput = modal.getByLabel(/title/i);
      await titleInput.clear();
      await titleInput.fill('Updated Knowledge File');

      // Update content
      const contentInput = modal.getByLabel(/content/i);
      await contentInput.clear();
      await contentInput.fill('Updated content with more detailed information.');

      // Save changes
      await modal.getByRole('button', { name: /save|update/i }).click();

      // Verify modal closes
      await expect(modal).not.toBeVisible();

      // Verify updates
      await expect(page.getByText('Updated Knowledge File')).toBeVisible();
    });

    test('deletes knowledge file with confirmation', async ({ page }) => {
      await page.goto(`/projects/${projectId}`);

      // First create a file to delete
      await page.getByText('Knowledge Files').scrollIntoViewIfNeeded();
      const addButton = page.getByRole('button', { name: /add knowledge file/i });
      await addButton.click();

      const modal = page.locator('[role="dialog"]');
      await modal.getByLabel(/title/i).fill('File To Delete');
      await modal.getByLabel(/content/i).fill('This file will be deleted.');
      await modal.getByRole('button', { name: /save|create/i }).click();

      // Verify file exists
      await expect(page.getByText('File To Delete')).toBeVisible();

      // Set up dialog handler for confirm dialog
      page.once('dialog', (dialog) => dialog.accept());

      // Click delete
      const fileRow = page.locator('text=File To Delete').locator('..').locator('..');
      await fileRow.getByRole('button', { name: /delete/i }).click();

      // Verify file is removed
      await expect(page.getByText('File To Delete')).not.toBeVisible();
    });

    test('displays corpus statistics correctly', async ({ page }) => {
      await page.goto(`/projects/${projectId}`);

      // Wait for page to load completely
      await expect(page.getByText('Context Layers')).toBeVisible();

      // Verify stats cards show non-zero counts (from previous tests)
      const contextLayersCount = await page.locator('text=Context Layers').locator('..').locator('p.text-2xl').textContent();
      const knowledgeFilesCount = await page.locator('text=Knowledge Files').locator('..').locator('p.text-2xl').first().textContent();

      // Should have at least 1 layer and 1 file from previous tests
      expect(parseInt(contextLayersCount || '0')).toBeGreaterThanOrEqual(1);
      expect(parseInt(knowledgeFilesCount || '0')).toBeGreaterThanOrEqual(1);
    });
  });
});
