import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const PEDAGOGICAL_DIMENSIONS = [
  {
    key: 'foundations',
    name: 'Foundations',
    icon: 'BookOpen',
    description: 'Core concepts, terminology, and fundamental principles that every learner must understand first.',
    question: 'What are the essential building blocks someone needs to know before anything else?',
    priority: 1,
    isCritical: true,
  },
  {
    key: 'progression',
    name: 'Progression',
    icon: 'TrendingUp',
    description: 'How skills build on each other, learning paths, and prerequisite relationships.',
    question: 'What is the ideal order for learning these concepts? What should come before what?',
    priority: 2,
    isCritical: true,
  },
  {
    key: 'mistakes',
    name: 'Common Mistakes',
    icon: 'AlertTriangle',
    description: 'Typical errors, misconceptions, and pitfalls that learners encounter.',
    question: 'What mistakes do beginners (and even intermediates) commonly make? What misconceptions need correcting?',
    priority: 3,
    isCritical: true,
  },
  {
    key: 'examples',
    name: 'Examples',
    icon: 'FileText',
    description: 'Concrete examples, case studies, and practical applications.',
    question: 'What are the best examples that illustrate key concepts? What real-world applications help understanding?',
    priority: 4,
    isCritical: false,
  },
  {
    key: 'nuance',
    name: 'Nuance & Edge Cases',
    icon: 'Lightbulb',
    description: 'Exceptions to rules, contextual variations, and advanced considerations.',
    question: 'What are the exceptions to the rules? When do standard approaches not apply?',
    priority: 5,
    isCritical: false,
  },
  {
    key: 'practice',
    name: 'Practice & Application',
    icon: 'Dumbbell',
    description: 'Exercises, drills, and opportunities to apply learned concepts.',
    question: 'What exercises or practice scenarios help reinforce learning? How should students test their understanding?',
    priority: 6,
    isCritical: false,
  },
];

async function main() {
  console.log('Seeding pedagogical dimensions...');

  for (const dimension of PEDAGOGICAL_DIMENSIONS) {
    const result = await prisma.pedagogicalDimension.upsert({
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

    console.log(`✓ ${result.name} (${result.key})`);
  }

  console.log('\nSeeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding pedagogical dimensions:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
