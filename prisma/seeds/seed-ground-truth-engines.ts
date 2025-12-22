import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Ground Truth Engines...\n')

  // Upsert GNU Backgammon engine
  const gnuBackgammon = await prisma.groundTruthEngine.upsert({
    where: { id: 'gnubg-engine' },
    update: {
      name: 'GNU Backgammon',
      domain: 'backgammon',
      engineUrl: 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com',
      description: 'World-class backgammon analysis engine. Verifies checker plays, cube decisions, and provides equity calculations for any position.',
      iconUrl: '/icons/backgammon.svg',
      isActive: true,
    },
    create: {
      id: 'gnubg-engine',
      name: 'GNU Backgammon',
      domain: 'backgammon',
      engineUrl: 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com',
      description: 'World-class backgammon analysis engine. Verifies checker plays, cube decisions, and provides equity calculations for any position.',
      iconUrl: '/icons/backgammon.svg',
      isActive: true,
    },
  })

  console.log(`  Created/Updated: ${gnuBackgammon.name}`)
  console.log(`    - Domain: ${gnuBackgammon.domain}`)
  console.log(`    - URL: ${gnuBackgammon.engineUrl}`)
  console.log(`    - Active: ${gnuBackgammon.isActive}`)

  // Show all engines
  const allEngines = await prisma.groundTruthEngine.findMany({
    where: { isActive: true },
  })

  console.log(`\nTotal active Ground Truth Engines: ${allEngines.length}`)
  allEngines.forEach(e => console.log(`  - ${e.name} (${e.domain})`))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
