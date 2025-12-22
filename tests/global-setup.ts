import { PrismaClient, Prisma } from '@prisma/client';
import { PEDAGOGICAL_DIMENSIONS } from '../prisma/seeds/pedagogical-dimensions';

/**
 * Global setup for Playwright tests
 * Seeds necessary reference data before tests run
 */
async function globalSetup() {
  const prisma = new PrismaClient();

  try {
    console.log('\n📦 Running global test setup...');

    // Seed PedagogicalDimensions (required for readiness scoring)
    console.log('🎯 Seeding PedagogicalDimensions...');

    for (const dimension of PEDAGOGICAL_DIMENSIONS) {
      try {
        await prisma.pedagogicalDimension.upsert({
          where: { key: dimension.key },
          update: {
            name: dimension.name,
            icon: dimension.icon,
            description: dimension.description,
            question: dimension.question,
            priority: dimension.priority,
            isCritical: dimension.isCritical,
          },
          create: dimension,
        });
      } catch (error) {
        // Ignore unique constraint violations from parallel runs (P2002)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }
        throw error;
      }
    }

    // Verify seeding was successful
    const seedCount = await prisma.pedagogicalDimension.count();
    if (seedCount < PEDAGOGICAL_DIMENSIONS.length) {
      throw new Error(`Expected ${PEDAGOGICAL_DIMENSIONS.length} dimensions, found ${seedCount}`);
    }

    console.log(`   ✓ ${seedCount} dimensions seeded`);
    console.log('✅ Global setup complete!\n');
  } catch (error) {
    console.error('❌ Error during global setup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export default globalSetup;
