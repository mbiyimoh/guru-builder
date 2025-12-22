/**
 * Script to populate the Position Library with opening positions.
 * Run with: npx tsx scripts/populate-positions.ts
 */

// Use relative imports for tsx compatibility
import { PrismaClient } from '@prisma/client'
import { populateOpeningPositions } from '../lib/positionLibrary/openings'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Position Library Population Script ===\n')

  // Get the GNUBG engine configuration
  const engine = await prisma.groundTruthEngine.findFirst({
    where: {
      domain: 'backgammon',
      isActive: true
    }
  })

  if (!engine) {
    console.error('ERROR: No active backgammon engine found in database')
    process.exit(1)
  }

  console.log(`Found engine: ${engine.name}`)
  console.log(`Engine URL: ${engine.engineUrl}\n`)

  // Check current count
  const currentCount = await prisma.positionLibrary.count()
  console.log(`Current position library count: ${currentCount}\n`)

  // Build engine config
  const engineConfig = {
    enabled: true,
    engineId: engine.id,
    engineUrl: engine.engineUrl,
    engineName: engine.name,
    domain: engine.domain,
    configId: ''
  }

  console.log('Starting population...\n')

  // Populate opening positions
  const result = await populateOpeningPositions(engineConfig)

  console.log('\n=== Results ===')
  console.log(`Populated: ${result.populated} positions`)

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`)
    result.errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`))
  }

  // Verify final count
  const finalCount = await prisma.positionLibrary.count()
  console.log(`\nFinal position library count: ${finalCount}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
