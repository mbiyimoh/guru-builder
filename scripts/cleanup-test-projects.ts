import { cleanupTestProjects } from '../tests/utils/cleanup-test-data';

/**
 * Standalone script to clean up test projects
 * Run with: npm run test:cleanup
 */
async function main() {
  console.log('🔍 Finding test projects...\n');

  try {
    const count = await cleanupTestProjects({ verbose: true });

    if (count === 0) {
      console.log('Database is clean!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Failed to clean up test projects:', error);
    process.exit(1);
  }
}

main();
