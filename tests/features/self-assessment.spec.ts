import { test, expect } from '@playwright/test';
import { ProjectsListPage } from '../pages/ProjectsListPage';
import { ProjectDetailPage } from '../pages/ProjectDetailPage';
import { AssessmentPage } from './pages/AssessmentPage';
import { AssessmentHistoryPage } from './pages/AssessmentHistoryPage';

test.describe('Self-Assessment Feature', () => {
  let projectId: string;
  const projectName = `Test Assessment Project ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    // Create a test project for all assessment tests
    const context = await browser.newContext();
    const page = await context.newPage();
    const projectsPage = new ProjectsListPage(page);

    await projectsPage.goto();
    await projectsPage.createProject(projectName, 'Test project for self-assessment E2E tests');

    // Extract project ID from URL
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
    const url = page.url();
    const match = url.match(/\/projects\/([a-zA-Z0-9-]+)$/);
    if (match) {
      projectId = match[1];
    }

    await context.close();
  });

  test.describe('Assessment Configuration', () => {
    test('should display self-assessment toggle on project page', async ({ page }) => {
      const projectDetailPage = new ProjectDetailPage(page);
      await projectDetailPage.goto(projectId);

      // Check that the toggle is visible
      const assessmentToggle = page.getByText('Self-Assessment');
      await expect(assessmentToggle).toBeVisible();

      const toggleCheckbox = page.getByRole('checkbox');
      await expect(toggleCheckbox).toBeVisible();
    });

    test('should enable self-assessment from project page', async ({ page }) => {
      const projectDetailPage = new ProjectDetailPage(page);
      await projectDetailPage.goto(projectId);

      // Find and click the assessment toggle
      const toggleCheckbox = page.getByRole('checkbox');
      const isChecked = await toggleCheckbox.isChecked();

      if (!isChecked) {
        await toggleCheckbox.click();
        // Wait for the state to update
        await page.waitForResponse((response) =>
          response.url().includes('/assessment/config') && response.status() === 200
        );
      }

      // Verify the checkbox is now checked
      await expect(toggleCheckbox).toBeChecked();

      // Verify Start Assessment button appears
      const startButton = page.getByRole('link', { name: 'Start Assessment' });
      await expect(startButton).toBeVisible();
    });

    test('should navigate to assessment page after enabling', async ({ page }) => {
      const projectDetailPage = new ProjectDetailPage(page);
      await projectDetailPage.goto(projectId);

      // Ensure assessment is enabled
      const toggleCheckbox = page.getByRole('checkbox');
      if (!(await toggleCheckbox.isChecked())) {
        await toggleCheckbox.click();
        await page.waitForResponse((response) =>
          response.url().includes('/assessment/config') && response.status() === 200
        );
      }

      // Click Start Assessment
      const startButton = page.getByRole('link', { name: 'Start Assessment' });
      await startButton.click();

      // Verify navigation to assessment page
      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/assessment$/);
      const assessmentPage = new AssessmentPage(page);
      await expect(assessmentPage.pageTitle).toBeVisible();
    });
  });

  test.describe('Assessment Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Ensure assessment is enabled before each test
      const projectDetailPage = new ProjectDetailPage(page);
      await projectDetailPage.goto(projectId);

      const toggleCheckbox = page.getByRole('checkbox');
      if (!(await toggleCheckbox.isChecked())) {
        await toggleCheckbox.click();
        await page.waitForResponse((response) =>
          response.url().includes('/assessment/config') && response.status() === 200
        );
      }
    });

    test('should display assessment page with correct layout', async ({ page }) => {
      const assessmentPage = new AssessmentPage(page);
      await assessmentPage.goto(projectId);

      // Verify main sections are visible
      await expect(assessmentPage.pageTitle).toBeVisible();
      await expect(assessmentPage.contextLayersCount).toBeVisible();
      await expect(assessmentPage.viewHistoryLink).toBeVisible();
      await expect(assessmentPage.backToProjectLink).toBeVisible();

      // Verify dice roll input section
      await expect(assessmentPage.diceRollInput).toBeVisible();
      await expect(assessmentPage.setProblemButton).toBeVisible();
    });

    test('should validate dice roll input format', async ({ page }) => {
      const assessmentPage = new AssessmentPage(page);
      await assessmentPage.goto(projectId);

      // Test invalid format
      await assessmentPage.setDiceRoll('invalid');
      const errorMessage = await assessmentPage.getErrorMessage();
      expect(errorMessage).toContain('Invalid dice format');

      // Test another invalid format
      await assessmentPage.diceRollInput.clear();
      await assessmentPage.setDiceRoll('7-1');
      const errorMessage2 = await assessmentPage.getErrorMessage();
      expect(errorMessage2).toContain('Invalid dice format');
    });

    test('should set a valid dice roll problem', async ({ page }) => {
      const assessmentPage = new AssessmentPage(page);
      await assessmentPage.goto(projectId);

      // Set a valid dice roll
      await assessmentPage.setDiceRoll('3-1');

      // Verify problem is set - the split screen should appear
      await expect(assessmentPage.guruAnalysisHeading).toBeVisible();
      await expect(assessmentPage.groundTruthHeading).toBeVisible();

      // Verify ASCII board is displayed
      const boardVisible = await assessmentPage.isAsciiBoardVisible();
      expect(boardVisible).toBe(true);
    });

    test('should ask guru for recommendation', async ({ page }) => {
      const assessmentPage = new AssessmentPage(page);
      await assessmentPage.goto(projectId);

      // Set dice roll first
      await assessmentPage.setDiceRoll('4-2');

      // Click Ask Guru
      await assessmentPage.askGuru();

      // Verify user message appears in chat
      const userMessage = await assessmentPage.getUserMessage();
      expect(userMessage).toContain('What is the best move');

      // Wait for guru response (this may take time due to streaming)
      await assessmentPage.waitForGuruResponse(60000);

      // Verify guru responded
      const responseText = await assessmentPage.getGuruResponseText();
      expect(responseText.length).toBeGreaterThan(0);
    });

    test('should verify guru response includes Context Audit Details', async ({ page }) => {
      test.setTimeout(90000); // Extended timeout for streaming response

      const assessmentPage = new AssessmentPage(page);
      await assessmentPage.goto(projectId);

      // Set dice roll and ask guru
      await assessmentPage.setDiceRoll('5-3');
      await assessmentPage.askGuru();
      await assessmentPage.waitForGuruResponse(60000);

      // Check for Context Audit Details section
      const hasAuditDetails = await assessmentPage.hasContextAuditDetails();
      expect(hasAuditDetails).toBe(true);
    });

    test('should fetch ground truth from GNU Backgammon engine', async ({ page }) => {
      test.setTimeout(60000); // Extended timeout for external API

      const assessmentPage = new AssessmentPage(page);
      await assessmentPage.goto(projectId);

      // Set dice roll first
      await assessmentPage.setDiceRoll('6-1');

      // Check answer (fetch ground truth)
      await assessmentPage.checkAnswer();

      // Wait for ground truth to load
      await assessmentPage.waitForGroundTruth(30000);

      // Verify best moves are displayed
      await expect(assessmentPage.bestMovesSection).toBeVisible();

      // Verify we have some moves listed
      const movesCount = await assessmentPage.getBestMovesCount();
      expect(movesCount).toBeGreaterThan(0);
      expect(movesCount).toBeLessThanOrEqual(5); // Max 5 moves shown
    });

    test('should rate guru response with stars', async ({ page }) => {
      test.setTimeout(120000); // Extended timeout for full workflow

      const assessmentPage = new AssessmentPage(page);
      await assessmentPage.goto(projectId);

      // Complete full workflow: set problem, ask guru, check answer
      await assessmentPage.setDiceRoll('2-1');
      await assessmentPage.askGuru();
      await assessmentPage.waitForGuruResponse(60000);
      await assessmentPage.checkAnswer();
      await assessmentPage.waitForGroundTruth(30000);

      // Verify rating section appears
      const isRatingVisible = await assessmentPage.isRatingSectionVisible();
      expect(isRatingVisible).toBe(true);

      // Rate the response
      await assessmentPage.rateResponse(4);

      // Verify rating was saved
      await expect(assessmentPage.ratingConfirmation).toBeVisible();
      await expect(assessmentPage.ratingConfirmation).toContainText('Rated 4/5');
    });

    test('should navigate to history page from assessment', async ({ page }) => {
      const assessmentPage = new AssessmentPage(page);
      await assessmentPage.goto(projectId);

      await assessmentPage.navigateToHistory();

      // Verify navigation
      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/assessment\/history$/);
      const historyPage = new AssessmentHistoryPage(page);
      await expect(historyPage.pageTitle).toBeVisible();
    });
  });

  test.describe('Assessment History', () => {
    test('should display assessment history page with overall stats', async ({ page }) => {
      const historyPage = new AssessmentHistoryPage(page);
      await historyPage.goto(projectId);

      // Verify main sections
      await expect(historyPage.pageTitle).toBeVisible();
      await expect(historyPage.overallPerformanceHeading).toBeVisible();
      await expect(historyPage.sessionHistoryHeading).toBeVisible();

      // Verify navigation links
      await expect(historyPage.newAssessmentLink).toBeVisible();
      await expect(historyPage.backToProjectLink).toBeVisible();
    });

    test('should display correct overall performance metrics', async ({ page }) => {
      const historyPage = new AssessmentHistoryPage(page);
      await historyPage.goto(projectId);

      // Get stats
      const totalSessions = await historyPage.getTotalSessions();
      const totalProblems = await historyPage.getTotalProblems();
      const matchAccuracy = await historyPage.getMatchAccuracy();
      const overallScore = await historyPage.getOverallScore();

      // Validate stats are reasonable
      expect(totalSessions).toBeGreaterThanOrEqual(0);
      expect(totalProblems).toBeGreaterThanOrEqual(0);
      expect(matchAccuracy).toBeGreaterThanOrEqual(0);
      expect(matchAccuracy).toBeLessThanOrEqual(100);
      expect(overallScore).toBeGreaterThanOrEqual(0);
      expect(overallScore).toBeLessThanOrEqual(100);
    });

    test('should display empty state when no sessions exist', async ({ page }) => {
      // Create a new project without any assessment sessions
      const projectsPage = new ProjectsListPage(page);
      await projectsPage.goto();

      const emptyProjectName = `Test Empty Assessment ${Date.now()}`;
      await projectsPage.createProject(emptyProjectName);

      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
      const url = page.url();
      const match = url.match(/\/projects\/([a-zA-Z0-9-]+)$/);
      const emptyProjectId = match ? match[1] : '';

      // Enable assessment
      const toggleCheckbox = page.getByRole('checkbox');
      await toggleCheckbox.click();
      await page.waitForResponse((response) =>
        response.url().includes('/assessment/config') && response.status() === 200
      );

      // Navigate to history
      const historyPage = new AssessmentHistoryPage(page);
      await historyPage.goto(emptyProjectId);

      // Verify empty state
      await expect(historyPage.emptySessionsMessage).toBeVisible();
      await expect(historyPage.startAssessmentButton).toBeVisible();
    });

    test('should navigate back to project from history', async ({ page }) => {
      const historyPage = new AssessmentHistoryPage(page);
      await historyPage.goto(projectId);

      await historyPage.navigateBackToProject();

      // Verify navigation
      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
      const projectDetailPage = new ProjectDetailPage(page);
      await expect(projectDetailPage.projectHeading).toBeVisible();
    });

    test('should navigate to new assessment from history', async ({ page }) => {
      const historyPage = new AssessmentHistoryPage(page);
      await historyPage.goto(projectId);

      await historyPage.navigateToNewAssessment();

      // Verify navigation
      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\/assessment$/);
      const assessmentPage = new AssessmentPage(page);
      await expect(assessmentPage.pageTitle).toBeVisible();
    });

    test('should display letter grade with overall score', async ({ page }) => {
      const historyPage = new AssessmentHistoryPage(page);
      await historyPage.goto(projectId);

      const letterGrade = await historyPage.getLetterGrade();

      // Letter grade should be one of: A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F
      const validGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
      expect(validGrades).toContain(letterGrade);
    });
  });

  test.describe('Full Assessment Workflow', () => {
    test('should complete full assessment cycle and verify in history', async ({ page }) => {
      test.setTimeout(180000); // 3 minutes for full workflow

      const assessmentPage = new AssessmentPage(page);
      const historyPage = new AssessmentHistoryPage(page);

      // Get initial history stats
      await historyPage.goto(projectId);
      const initialProblems = await historyPage.getTotalProblems();

      // Go to assessment page
      await assessmentPage.goto(projectId);

      // Complete assessment: set problem, ask guru, check answer, rate
      await assessmentPage.setDiceRoll('3-2');
      await assessmentPage.askGuru();
      await assessmentPage.waitForGuruResponse(60000);
      await assessmentPage.checkAnswer();
      await assessmentPage.waitForGroundTruth(30000);
      await assessmentPage.rateResponse(3);

      // Navigate to history
      await assessmentPage.navigateToHistory();
      await page.waitForURL(/\/assessment\/history$/);

      // Verify the new problem was recorded
      const newProblems = await historyPage.getTotalProblems();
      expect(newProblems).toBeGreaterThan(initialProblems);

      // Verify sessions increased or stayed same (might be same session)
      const hasSessions = await historyPage.hasSessions();
      expect(hasSessions).toBe(true);
    });

    test('should handle multiple dice rolls in same session', async ({ page }) => {
      test.setTimeout(240000); // 4 minutes for multiple rolls

      const assessmentPage = new AssessmentPage(page);
      await assessmentPage.goto(projectId);

      const diceRolls = ['6-5', '4-3', '2-2'];

      for (const roll of diceRolls) {
        // Set new problem
        await assessmentPage.setDiceRoll(roll);

        // Ask guru
        await assessmentPage.askGuru();
        await assessmentPage.waitForGuruResponse(60000);

        // Check answer
        await assessmentPage.checkAnswer();
        await assessmentPage.waitForGroundTruth(30000);

        // Rate
        await assessmentPage.rateResponse(Math.floor(Math.random() * 5) + 1);
      }

      // Verify all assessments completed
      const historyPage = new AssessmentHistoryPage(page);
      await assessmentPage.navigateToHistory();
      await page.waitForURL(/\/assessment\/history$/);

      const hasSessions = await historyPage.hasSessions();
      expect(hasSessions).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid dice roll gracefully', async ({ page }) => {
      const assessmentPage = new AssessmentPage(page);
      await assessmentPage.goto(projectId);

      // Test various invalid formats
      const invalidRolls = ['0-1', '1-7', 'a-b', '12', ''];

      for (const roll of invalidRolls) {
        await assessmentPage.diceRollInput.clear();
        await assessmentPage.setDiceRoll(roll);

        if (roll === '') {
          // Empty string should show format error or nothing happens
          const splitScreen = page.locator('.grid.grid-cols-1.lg\\:grid-cols-2');
          const isVisible = await splitScreen.isVisible().catch(() => false);
          // Should not show the split screen without valid dice
        } else {
          const error = await assessmentPage.getErrorMessage();
          expect(error).toContain('Invalid dice format');
        }
      }
    });

    test('should prevent asking guru before setting problem', async ({ page }) => {
      const assessmentPage = new AssessmentPage(page);
      await assessmentPage.goto(projectId);

      // Ask Guru button should not be visible without a problem set
      const askGuruVisible = await assessmentPage.askGuruButton.isVisible().catch(() => false);
      expect(askGuruVisible).toBe(false);
    });

    test('should prevent checking answer before asking guru', async ({ page }) => {
      const assessmentPage = new AssessmentPage(page);
      await assessmentPage.goto(projectId);

      // Set problem but don't ask guru
      await assessmentPage.setDiceRoll('5-1');

      // Check answer button should be visible but result will create a session
      await expect(assessmentPage.checkAnswerButton).toBeVisible();

      // Ground truth can be fetched independently
      await assessmentPage.checkAnswer();
      await assessmentPage.waitForGroundTruth(30000);

      // But rating section should NOT appear (no guru response to rate)
      const isRatingVisible = await assessmentPage.isRatingSectionVisible();
      expect(isRatingVisible).toBe(false);
    });

    test('should redirect if assessment not configured', async ({ page }) => {
      // Create project without enabling assessment
      const projectsPage = new ProjectsListPage(page);
      await projectsPage.goto();

      const unconfiguredProjectName = `Test Unconfigured ${Date.now()}`;
      await projectsPage.createProject(unconfiguredProjectName);

      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
      const url = page.url();
      const match = url.match(/\/projects\/([a-zA-Z0-9-]+)$/);
      const unconfiguredProjectId = match ? match[1] : '';

      // Try to access assessment page directly
      await page.goto(`/projects/${unconfiguredProjectId}/assessment`);

      // Should redirect back to project page with error
      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+\?error=assessment-not-configured$/);
    });
  });
});
