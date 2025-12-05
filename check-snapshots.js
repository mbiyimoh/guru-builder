const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSnapshots() {
  const snapshots = await prisma.corpusSnapshot.findMany();
  console.log(`Found ${snapshots.length} snapshots`);
  await prisma.$disconnect();
}

checkSnapshots();
