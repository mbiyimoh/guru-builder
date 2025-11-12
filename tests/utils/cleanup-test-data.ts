import { PrismaClient } from '@prisma/client';

/**
 * Shared utility to clean up test projects from the database
 * Used by both manual cleanup script and Playwright global teardown
 */
export async function cleanupTestProjects(options?: {
  verbose?: boolean;
  prismaClient?: PrismaClient;
}): Promise<number> {
  const { verbose = true, prismaClient } = options || {};
  const prisma = prismaClient || new PrismaClient();
  const shouldDisconnect = !prismaClient; // Only disconnect if we created the client

  try {
    if (verbose) {
      console.log('\n🧹 Starting test cleanup...');
    }

    // Find all test projects
    const testProjects = await prisma.project.findMany({
      where: {
        OR: [
          { name: { contains: 'Test', mode: 'insensitive' } },
          { name: { contains: 'test', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (testProjects.length === 0) {
      if (verbose) {
        console.log('✅ No test projects to clean up.');
      }
      return 0;
    }

    if (verbose) {
      console.log(`🗑️  Found ${testProjects.length} test projects to clean up...`);

      // Show details in verbose mode
      testProjects.forEach((project, index) => {
        console.log(`   ${index + 1}. ${project.name} (${project.id})`);
      });
    }

    // Delete all test projects (cascade will handle related data)
    const result = await prisma.project.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Test', mode: 'insensitive' } },
          { name: { contains: 'test', mode: 'insensitive' } },
        ],
      },
    });

    if (verbose) {
      console.log(`✅ Cleaned up ${result.count} test projects successfully!`);
      console.log('   All related data (context layers, knowledge files, research runs, etc.) have been removed.\n');
    }

    return result.count;
  } catch (error) {
    if (verbose) {
      console.error('❌ Error during test cleanup:', error);
    }
    throw error;
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }
}
