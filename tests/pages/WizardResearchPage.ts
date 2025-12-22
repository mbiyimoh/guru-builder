import { Page, Locator } from '@playwright/test';

/**
 * Page Object for the Wizard Research Page (/projects/new/research)
 */
export class WizardResearchPage {
  readonly page: Page;

  // Page header
  readonly pageHeading: Locator;
  readonly pageDescription: Locator;
  readonly backToProfileLink: Locator;

  // Guru profile context
  readonly guruProfileContext: Locator;

  // Research suggestions
  readonly suggestedTopicsHeading: Locator;
  readonly criticalGapsSection: Locator;
  readonly suggestedGapsSection: Locator;
  readonly hideSuggestionsButton: Locator;
  readonly showSuggestionsButton: Locator;

  // Interface toggle
  readonly chatAssistantButton: Locator;
  readonly directFormButton: Locator;

  // Chat interface elements
  readonly chatSection: Locator;
  readonly researchPlanPanel: Locator;

  // Active research run
  readonly activeResearchCard: Locator;
  readonly researchStatusBadge: Locator;

  // Completed runs
  readonly completedRunsHeading: Locator;
  readonly completedRunCards: Locator;

  // Navigation
  readonly backButton: Locator;
  readonly continueToReadinessButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page header
    this.pageHeading = page.getByRole('heading', { name: 'Research Knowledge' });
    this.pageDescription = page.getByText(/Run research to discover/);
    this.backToProfileLink = page.getByRole('button', { name: /Back to Profile/i });

    // Guru profile context
    this.guruProfileContext = page.locator('.bg-blue-50');

    // Research suggestions
    this.suggestedTopicsHeading = page.getByRole('heading', { name: 'Suggested Research Topics' });
    this.criticalGapsSection = page.getByText('Critical Knowledge Gaps');
    this.suggestedGapsSection = page.getByText('Recommended Research Areas');
    this.hideSuggestionsButton = page.getByRole('button', { name: 'Hide Suggestions' });
    this.showSuggestionsButton = page.getByRole('button', { name: /Show Research Suggestions/i });

    // Interface toggle
    this.chatAssistantButton = page.getByRole('button', { name: 'Chat Assistant' });
    this.directFormButton = page.getByRole('button', { name: 'Direct Form' });

    // Chat interface elements
    this.chatSection = page.locator('[data-testid="research-chat"]');
    this.researchPlanPanel = page.locator('[data-testid="research-plan"]');

    // Active research run
    this.activeResearchCard = page.locator('text=Research in Progress');
    this.researchStatusBadge = page.locator('text=Status:');

    // Completed runs
    this.completedRunsHeading = page.getByRole('heading', { name: 'Completed Research Sessions' });
    this.completedRunCards = page.locator('.completed-run-card');

    // Navigation
    this.backButton = page.getByRole('button', { name: /Back to Profile/i }).last();
    this.continueToReadinessButton = page.getByRole('button', { name: /Continue to Readiness/i });
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/new/research?projectId=${projectId}`);
  }

  async gotoWithoutProjectId() {
    await this.page.goto('/projects/new/research');
  }

  async selectChatAssistant() {
    await this.chatAssistantButton.click();
  }

  async selectDirectForm() {
    await this.directFormButton.click();
  }

  async clickResearchSuggestion(suggestionText: string) {
    const button = this.page.getByRole('button', { name: 'Research This' }).filter({
      has: this.page.locator(`text=${suggestionText}`),
    });
    await button.click();
  }

  async continueToReadiness() {
    await this.continueToReadinessButton.click();
  }

  async isChatInterfaceActive(): Promise<boolean> {
    const chatButton = this.chatAssistantButton;
    const classes = await chatButton.getAttribute('class');
    return classes?.includes('bg-primary') || false;
  }

  async hasGuruProfileContext(): Promise<boolean> {
    return this.guruProfileContext.isVisible();
  }

  async hasSuggestions(): Promise<boolean> {
    return this.suggestedTopicsHeading.isVisible();
  }
}
