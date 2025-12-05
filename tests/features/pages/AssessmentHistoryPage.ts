import { Page, Locator } from '@playwright/test';

export class AssessmentHistoryPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly projectName: Locator;
  readonly newAssessmentLink: Locator;
  readonly backToProjectLink: Locator;

  // Overall Performance section
  readonly overallPerformanceHeading: Locator;
  readonly totalSessionsCount: Locator;
  readonly totalProblemsCount: Locator;
  readonly matchAccuracyValue: Locator;
  readonly averageRatingValue: Locator;
  readonly overallScoreValue: Locator;

  // Session History section
  readonly sessionHistoryHeading: Locator;
  readonly emptySessionsMessage: Locator;
  readonly startAssessmentButton: Locator;
  readonly sessionList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { name: 'Assessment History', level: 1 });
    this.projectName = page.locator('header').getByText(/^(?!Assessment History)/);
    this.newAssessmentLink = page.getByRole('link', { name: 'New Assessment' });
    this.backToProjectLink = page.getByRole('link', { name: 'Back to Project' });

    // Overall Performance section
    this.overallPerformanceHeading = page.getByRole('heading', { name: 'Overall Performance' });
    this.totalSessionsCount = page.locator('text=Total Sessions').locator('..').getByRole('paragraph').filter({ hasText: /^\d+$/ });
    this.totalProblemsCount = page.locator('text=Total Problems').locator('..').getByRole('paragraph').filter({ hasText: /^\d+$/ });
    this.matchAccuracyValue = page.locator('text=Match Accuracy').locator('..').getByRole('paragraph').filter({ hasText: /\d+%/ });
    this.averageRatingValue = page.locator('text=Avg Rating').locator('..').getByRole('paragraph').filter({ hasText: /\d+\/5|N\/A/ });
    this.overallScoreValue = page.locator('text=Overall Score').locator('..').getByRole('paragraph').filter({ hasText: /\d+%/ });

    // Session History section
    this.sessionHistoryHeading = page.getByRole('heading', { name: 'Session History' });
    this.emptySessionsMessage = page.getByText('No assessment sessions yet');
    this.startAssessmentButton = page.getByRole('link', { name: 'Start Assessment' });
    this.sessionList = page.locator('.divide-y');
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/assessment/history`);
  }

  async getTotalSessions(): Promise<number> {
    const text = await this.page.locator('text=Total Sessions').locator('..').locator('p.text-2xl').textContent();
    return parseInt(text || '0', 10);
  }

  async getTotalProblems(): Promise<number> {
    const text = await this.page.locator('text=Total Problems').locator('..').locator('p.text-2xl').textContent();
    return parseInt(text || '0', 10);
  }

  async getMatchAccuracy(): Promise<number> {
    const text = await this.page.locator('text=Match Accuracy').locator('..').locator('p.text-2xl').textContent();
    const match = text?.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async getAverageRating(): Promise<number | null> {
    const text = await this.page.locator('text=Avg Rating').locator('..').locator('p.text-2xl').textContent();
    if (text?.includes('N/A')) return null;
    const match = text?.match(/(\d+)\/5/);
    return match ? parseInt(match[1], 10) : null;
  }

  async getOverallScore(): Promise<number> {
    const text = await this.page.locator('text=Overall Score').locator('..').locator('p.text-2xl').textContent();
    const match = text?.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async getLetterGrade(): Promise<string> {
    const text = await this.page.locator('text=Overall Score').locator('..').locator('p.text-2xl').textContent();
    const match = text?.match(/\(([A-F][+-]?)\)/);
    return match ? match[1] : '';
  }

  async hasSessions(): Promise<boolean> {
    const isEmpty = await this.emptySessionsMessage.isVisible().catch(() => false);
    return !isEmpty;
  }

  async getSessionCount(): Promise<number> {
    if (!(await this.hasSessions())) return 0;
    const sessions = this.sessionList.locator('> div');
    return sessions.count();
  }

  async getSessionDetails(index: number = 0): Promise<{
    date: string;
    problemCount: number;
    matchStats: string;
    rating: string;
    score: string;
  }> {
    const sessions = this.sessionList.locator('> div');
    const session = sessions.nth(index);

    const dateText = await session.locator('p.text-sm.font-medium').first().textContent();
    const problemBadge = await session.locator('span.text-xs.bg-gray-100').textContent();
    const statsText = await session.locator('.text-sm.text-gray-500').textContent();

    // Parse the stats
    const matchMatch = statsText?.match(/Match:\s*(\d+\/\d+\s*\(\d+%\))/);
    const ratingMatch = statsText?.match(/Rating:\s*([\d.]+\/5|N\/A)/);
    const scoreMatch = statsText?.match(/Score:\s*(\d+%\s*\([A-F][+-]?\))/);

    return {
      date: dateText || '',
      problemCount: parseInt(problemBadge?.match(/(\d+)/)?.[1] || '0', 10),
      matchStats: matchMatch ? matchMatch[1] : '',
      rating: ratingMatch ? ratingMatch[1] : '',
      score: scoreMatch ? scoreMatch[1] : '',
    };
  }

  async getDiceRollResults(sessionIndex: number = 0): Promise<string[]> {
    const sessions = this.sessionList.locator('> div');
    const session = sessions.nth(sessionIndex);

    const diceResults = session.locator('.text-xs.px-2.py-1.rounded.border');
    const count = await diceResults.count();

    const results: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await diceResults.nth(i).textContent();
      results.push(text || '');
    }

    return results;
  }

  async navigateToNewAssessment() {
    await this.newAssessmentLink.click();
  }

  async navigateBackToProject() {
    await this.backToProjectLink.click();
  }

  async clickStartAssessment() {
    await this.startAssessmentButton.click();
  }

  async getScoreColor(scorePercentage: number): Promise<string> {
    // Based on getScoreColor function in scoreCalculation
    if (scorePercentage >= 80) return 'text-green-600';
    if (scorePercentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }
}
