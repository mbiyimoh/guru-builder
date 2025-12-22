import { prisma } from '@/lib/db';
import type { ReadinessScore, DimensionCoverage } from '@/lib/wizard/types';
import type { GuruProfileData } from '@/lib/guruProfile/types';

// Required profile fields for completeness calculation
const PROFILE_REQUIRED_FIELDS: (keyof GuruProfileData)[] = [
  'domainExpertise',
  'specificTopics',
  'audienceLevel',
  'audienceDescription',
  'pedagogicalApproach',
  'tone',
  'communicationStyle',
  'uniquePerspective',
  'successMetrics',
];

// Weights for dimension scoring (must sum to 100)
const DIMENSION_WEIGHTS: Record<string, number> = {
  foundations: 25,
  progression: 20,
  mistakes: 20,
  examples: 15,
  nuance: 10,
  practice: 10,
};

export async function calculateReadinessScore(projectId: string): Promise<{
  score: ReadinessScore;
  dimensions: DimensionCoverage[];
}> {
  // 1. Fetch project with profile, layers, files, and dimension tags
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      currentProfile: true,
      contextLayers: {
        include: { dimensionTags: true },
      },
      knowledgeFiles: {
        include: { dimensionTags: true },
      },
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // 2. Calculate profile completeness (0-100)
  // Check each required field is non-empty (arrays need length > 0)
  const profileData = project.currentProfile?.profileData as GuruProfileData | null;
  let profileScore = 0;
  if (profileData) {
    const filledFields = PROFILE_REQUIRED_FIELDS.filter(field => {
      const value = profileData[field];
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== '';
    });
    profileScore = Math.round((filledFields.length / PROFILE_REQUIRED_FIELDS.length) * 100);
  }

  // 3. Get all pedagogical dimensions
  const allDimensions = await prisma.pedagogicalDimension.findMany({
    orderBy: { priority: 'asc' },
  });

  // 4. Calculate per-dimension coverage
  const dimensionCoverage: DimensionCoverage[] = [];
  const criticalGaps: string[] = [];
  const suggestedGaps: string[] = [];
  let weightedKnowledgeScore = 0;

  for (const dim of allDimensions) {
    // Find all tags for this dimension across layers and files
    const layerTags = project.contextLayers.flatMap(l =>
      l.dimensionTags.filter(t => t.dimensionId === dim.id)
    );
    const fileTags = project.knowledgeFiles.flatMap(f =>
      f.dimensionTags.filter(t => t.dimensionId === dim.id)
    );

    const allTags = [...layerTags, ...fileTags];
    const itemCount = allTags.length;
    const confirmedCount = allTags.filter(t => t.confirmedByUser).length;

    // Coverage calculation:
    // - 1+ confirmed items = 50 + (confirmedCount * 10), max 100
    // - Only unconfirmed items = 40 (raised from 25 for better reflection of content value)
    // - No items = 0
    let coveragePercent = 0;
    if (confirmedCount > 0) {
      coveragePercent = Math.min(100, 50 + (confirmedCount * 10));
    } else if (itemCount > 0) {
      coveragePercent = 40;
    }

    dimensionCoverage.push({
      dimensionKey: dim.key,
      dimensionName: dim.name,
      itemCount,
      confirmedCount,
      isCritical: dim.isCritical,
      coveragePercent,
    });

    // Track gaps (coverage < 50%)
    if (coveragePercent < 50) {
      if (dim.isCritical) {
        criticalGaps.push(dim.key);
      } else {
        suggestedGaps.push(dim.key);
      }
    }

    // Add to weighted knowledge score
    const weight = DIMENSION_WEIGHTS[dim.key] || 10;
    weightedKnowledgeScore += (coveragePercent / 100) * weight;
  }

  // 5. Calculate overall knowledge score (0-100)
  const totalWeight = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
  const knowledgeScore = Math.round((weightedKnowledgeScore / totalWeight) * 100);

  // 6. Calculate overall score: 40% profile + 60% knowledge
  const overallScore = Math.round((profileScore * 0.4) + (knowledgeScore * 0.6));

  return {
    score: {
      overall: overallScore,
      profile: profileScore,
      knowledge: knowledgeScore,
      criticalGaps,
      suggestedGaps,
      dimensionScores: Object.fromEntries(
        dimensionCoverage.map(d => [d.dimensionKey, d.coveragePercent])
      ),
    },
    dimensions: dimensionCoverage,
  };
}
