import { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly getStartedButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Guru Builder', level: 1 });
    this.getStartedButton = page.getByRole('link', { name: /Get Started with Projects/i });
  }

  async goto() {
    await this.page.goto('/');
  }

  async clickGetStarted() {
    await this.getStartedButton.click();
  }

  async isVisible() {
    return await this.heading.isVisible();
  }
}
