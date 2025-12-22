import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Update Backgammon AssessmentDefinitions to enable content validation
  const updated = await prisma.assessmentDefinition.updateMany({
    where: {
      OR: [
        { name: { contains: 'backgammon', mode: 'insensitive' } },
        { domain: { contains: 'backgammon', mode: 'insensitive' } }
      ]
    },
    data: {
      canValidateContent: true
    }
  })

  console.log(`Updated ${updated.count} assessment definitions to enable content validation`)

  // Show updated definitions
  const defs = await prisma.assessmentDefinition.findMany({
    where: {
      canValidateContent: true
    }
  })

  console.log('\nAssessments with content validation enabled:')
  defs.forEach(d => console.log(`  - ${d.name} (domain: ${d.domain})`))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
