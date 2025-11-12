import { cleanupTestProjects } from './utils/cleanup-test-data';

/**
 * Global teardown for Playwright tests
 * Automatically cleans up test projects after test runs complete
 */
async function globalTeardown() {
  try {
    await cleanupTestProjects({ verbose: true });
  } catch (error) {
    console.error('❌ Error during test cleanup:', error);
    // Don't fail the teardown - tests already completed
  }
}

export default globalTeardown;
