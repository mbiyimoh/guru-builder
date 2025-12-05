const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProjects() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            contextLayers: true,
            knowledgeFiles: true,
            researchRuns: true,
          },
        },
      },
    });

    console.log('\n=== ALL PROJECTS IN DATABASE ===\n');

    if (projects.length === 0) {
      console.log('❌ NO PROJECTS FOUND IN DATABASE');
    } else {
      console.log(`Found ${projects.length} project(s):\n`);

      projects.forEach((project, index) => {
        console.log(`${index + 1}. ${project.name}`);
        console.log(`   ID: ${project.id}`);
        console.log(`   Created: ${project.createdAt.toISOString()}`);
        console.log(`   Layers: ${project._count.contextLayers}`);
        console.log(`   Files: ${project._count.knowledgeFiles}`);
        console.log(`   Research Runs: ${project._count.researchRuns}`);
        if (project.description) {
          console.log(`   Description: ${project.description.substring(0, 100)}...`);
        }
        console.log('');
      });
    }

    // Check specifically for the user's projects
    console.log('=== CHECKING FOR USER\'S SPECIFIC PROJECTS ===\n');

    const backgammon = await prisma.project.findMany({
      where: {
        name: {
          contains: 'backgammon',
          mode: 'insensitive',
        },
      },
    });

    const chess = await prisma.project.findMany({
      where: {
        name: {
          contains: 'chess',
          mode: 'insensitive',
        },
      },
    });

    console.log(`Backgammon projects: ${backgammon.length}`);
    if (backgammon.length > 0) {
      backgammon.forEach(p => console.log(`  - ${p.name} (${p.id})`));
    }

    console.log(`Chess projects: ${chess.length}`);
    if (chess.length > 0) {
      chess.forEach(p => console.log(`  - ${p.name} (${p.id})`));
    }

  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProjects();
