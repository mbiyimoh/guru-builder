// Quick script to check project status and position library
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Position counts by source and phase
  const positions = await prisma.positionLibrary.groupBy({
    by: ['sourceType', 'gamePhase'],
    _count: { id: true },
    orderBy: [{ sourceType: 'asc' }, { gamePhase: 'asc' }]
  });

  console.log('\n=== Position Library by Source & Phase ===');
  positions.forEach(function(p) {
    console.log(p.sourceType + ' | ' + p.gamePhase + ' | ' + p._count.id);
  });

  // Self-play batches
  const batches = await prisma.selfPlayBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log('\n=== Self-Play Batches ===');
  if (batches.length === 0) {
    console.log('No self-play batches found!');
  } else {
    batches.forEach(function(b) {
      console.log(b.status + ' | Games: ' + b.gamesCompleted + '/' + b.gamesRequested + ' | Positions: ' + b.positionsStored + ' | ' + b.createdAt.toISOString().slice(0,10));
    });
  }

  // Total counts
  const total = await prisma.positionLibrary.count();
  const selfPlayCount = await prisma.positionLibrary.count({ where: { sourceType: 'SELF_PLAY' } });
  const matchImportCount = await prisma.positionLibrary.count({ where: { sourceType: 'MATCH_IMPORT' } });

  console.log('\n=== Summary ===');
  console.log('Total positions: ' + total);
  console.log('Self-play positions: ' + selfPlayCount);
  console.log('Match import (Hardy): ' + matchImportCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
