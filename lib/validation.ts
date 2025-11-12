/**
 * Zod Validation Schemas
 *
 * Defines runtime validation schemas for structured data
 */

import { z } from "zod";

// Recommendation source schema
export const recommendationSourceSchema = z.object({
  title: z.string().describe("Source title or description"),
  url: z.string().url().describe("Source URL"),
  relevance: z
    .string()
    .describe("Brief explanation of why this source is relevant"),
});

// Learning resource schema
export const learningResourceSchema = z.object({
  type: z
    .enum(["book", "article", "video", "course", "tool", "practice"])
    .describe("Type of learning resource"),
  title: z.string().describe("Resource title"),
  url: z.string().url().optional().describe("Resource URL if available"),
  description: z.string().describe("Brief description of the resource"),
  difficulty: z
    .enum(["beginner", "intermediate", "advanced"])
    .describe("Difficulty level"),
  estimatedTime: z
    .string()
    .optional()
    .describe("Estimated time to complete (e.g., '2 hours', '3 weeks')"),
});

// Practice drill schema
export const practiceDrillSchema = z.object({
  title: z.string().describe("Drill title"),
  description: z.string().describe("Detailed description of the drill"),
  difficulty: z
    .enum(["beginner", "intermediate", "advanced"])
    .describe("Difficulty level"),
  duration: z
    .string()
    .describe("Recommended practice duration (e.g., '15 minutes', '30 minutes')"),
  frequency: z
    .string()
    .describe("Recommended practice frequency (e.g., 'daily', '3x per week')"),
  keyFocus: z.string().describe("What skill this drill focuses on"),
});

// Learning milestone schema
export const learningMilestoneSchema = z.object({
  phase: z.string().describe("Learning phase (e.g., 'Week 1-2', 'Beginner')"),
  goal: z.string().describe("What to achieve in this phase"),
  skills: z
    .array(z.string())
    .describe("Specific skills to develop in this phase"),
  successCriteria: z
    .string()
    .describe("How to know you've completed this phase"),
});

// Main recommendation schema
export const recommendationSchema = z.object({
  topic: z.string().describe("The subject being taught"),
  overview: z
    .string()
    .describe("High-level overview of the learning journey"),
  estimatedTimeToMastery: z
    .string()
    .describe("Estimated time to reach competency (e.g., '3-6 months')"),
  sources: z
    .array(recommendationSourceSchema)
    .describe("Research sources used to generate recommendations"),
  learningPath: z
    .array(learningMilestoneSchema)
    .describe("Structured learning path with phases and milestones"),
  recommendedResources: z
    .array(learningResourceSchema)
    .describe("Curated list of learning resources"),
  practiceDrills: z
    .array(practiceDrillSchema)
    .describe("Specific drills to build skills"),
  commonPitfalls: z
    .array(z.string())
    .describe("Common mistakes beginners make"),
  expertTips: z
    .array(z.string())
    .describe("Pro tips from experienced practitioners"),
  nextSteps: z
    .string()
    .describe("What to do after completing the initial learning path"),
});

// Export types derived from schemas
export type RecommendationSource = z.infer<typeof recommendationSourceSchema>;
export type LearningResource = z.infer<typeof learningResourceSchema>;
export type PracticeDrill = z.infer<typeof practiceDrillSchema>;
export type LearningMilestone = z.infer<typeof learningMilestoneSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;

// ==================== Research Findings Validation ====================

import type { ResearchFindings } from './types';

// Schema for research source
const researchSourceSchema = z.object({
  url: z.string(),
  title: z.string(),
});

// Schema for research metadata
const researchMetadataSchema = z.object({
  maxSources: z.number().optional(),
  maxIterations: z.number().optional(),
  reportType: z.string().optional(),
  mode: z.string().optional(),
  depth: z.enum(['quick', 'moderate', 'deep']).optional(),
  status: z.string().optional(),
  warning: z.string().optional(),
});

// Schema for complete research findings
export const researchFindingsSchema = z.object({
  query: z.string(),
  depth: z.enum(['quick', 'moderate', 'deep']),
  summary: z.string(),
  fullReport: z.string(),
  sources: z.array(researchSourceSchema),
  sourcesAnalyzed: z.number(),
  metadata: researchMetadataSchema,
  noRecommendationsReason: z.string().optional(),
});

/**
 * Parse and validate research data from database Json field
 *
 * Provides runtime type safety for research data retrieved from Prisma Json fields,
 * which are typed as JsonValue and require validation before use.
 *
 * @param data - Unknown data from Prisma Json field (researchData column)
 * @returns Validated ResearchFindings or null if invalid
 *
 * @example
 * const researchData = parseResearchData(run.researchData);
 * if (!researchData) {
 *   return <ErrorMessage />;
 * }
 * return <ResearchView data={researchData} />;
 */
export function parseResearchData(data: unknown): ResearchFindings | null {
  try {
    return researchFindingsSchema.parse(data);
  } catch (error) {
    console.error('[ResearchData Validation] Invalid data structure:', error);
    if (error instanceof z.ZodError) {
      console.error('[ResearchData Validation] Zod errors:', error.errors);
    }
    return null;
  }
}

// ==================== Snapshot Data Validation ====================

// Schema for context layer in snapshot
const snapshotLayerSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  priority: z.number(),
  isActive: z.boolean(),
  projectId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Schema for knowledge file in snapshot
const snapshotFileSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  content: z.string(),
  category: z.string().nullable(),
  isActive: z.boolean(),
  projectId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Schema for complete snapshot data
export const snapshotLayersDataSchema = z.array(snapshotLayerSchema);
export const snapshotFilesDataSchema = z.array(snapshotFileSchema);

// Export types
export type SnapshotLayer = z.infer<typeof snapshotLayerSchema>;
export type SnapshotFile = z.infer<typeof snapshotFileSchema>;

/**
 * Parse and validate snapshot layers data from database Json field
 *
 * @param data - Unknown data from Prisma Json field (layersData column)
 * @returns Validated array of snapshot layers or null if invalid
 */
export function parseSnapshotLayersData(data: unknown): SnapshotLayer[] | null {
  try {
    return snapshotLayersDataSchema.parse(data);
  } catch (error) {
    console.error('[SnapshotLayersData Validation] Invalid data structure:', error);
    if (error instanceof z.ZodError) {
      console.error('[SnapshotLayersData Validation] Zod errors:', error.errors);
    }
    return null;
  }
}

/**
 * Parse and validate snapshot files data from database Json field
 *
 * @param data - Unknown data from Prisma Json field (filesData column)
 * @returns Validated array of snapshot files or null if invalid
 */
export function parseSnapshotFilesData(data: unknown): SnapshotFile[] | null {
  try {
    return snapshotFilesDataSchema.parse(data);
  } catch (error) {
    console.error('[SnapshotFilesData Validation] Invalid data structure:', error);
    if (error instanceof z.ZodError) {
      console.error('[SnapshotFilesData Validation] Zod errors:', error.errors);
    }
    return null;
  }
}

// ==================== Change Log Value Validation ====================

// Schema for change log values (previousValue/newValue in ApplyChangesLog)
const changeLogValueSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  content: z.string(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  priority: z.number().optional(),
  isActive: z.boolean().optional(),
  projectId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough(); // Allow additional fields

export type ChangeLogValue = z.infer<typeof changeLogValueSchema>;

/**
 * Parse and validate change log value (previousValue/newValue)
 *
 * @param data - Unknown data from Prisma Json field
 * @returns Validated change log value or null if invalid
 */
export function parseChangeLogValue(data: unknown): ChangeLogValue | null {
  if (!data) return null;
  try {
    return changeLogValueSchema.parse(data);
  } catch (error) {
    console.error('[ChangeLogValue Validation] Invalid data:', error);
    if (error instanceof z.ZodError) {
      console.error('[ChangeLogValue Validation] Zod errors:', error.errors);
    }
    return null;
  }
}
