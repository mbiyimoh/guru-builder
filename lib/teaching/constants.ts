import type { GuruArtifactType, ArtifactStatus } from '@prisma/client';

export type ArtifactType = GuruArtifactType;
export type ArtifactTypeSlug = 'mental-model' | 'curriculum' | 'drill-series';

// Artifact type configuration - single source of truth
export const ARTIFACT_TYPE_CONFIG: Record<GuruArtifactType, {
  slug: ArtifactTypeSlug;
  label: string;
  icon: string;
  endpoint: string;
  apiKey: 'mentalModel' | 'curriculum' | 'drillSeries';
}> = {
  MENTAL_MODEL: {
    slug: 'mental-model',
    label: 'Mental Model',
    icon: '🧠',
    endpoint: 'mental-model',
    apiKey: 'mentalModel',
  },
  CURRICULUM: {
    slug: 'curriculum',
    label: 'Curriculum',
    icon: '📚',
    endpoint: 'curriculum',
    apiKey: 'curriculum',
  },
  DRILL_SERIES: {
    slug: 'drill-series',
    label: 'Drill Series',
    icon: '🎯',
    endpoint: 'drill-series',
    apiKey: 'drillSeries',
  },
} as const;

// Helper functions
export function getArtifactConfig(type: GuruArtifactType) {
  return ARTIFACT_TYPE_CONFIG[type];
}

export function getArtifactSlug(type: GuruArtifactType): ArtifactTypeSlug {
  return ARTIFACT_TYPE_CONFIG[type].slug;
}

export function getArtifactTypeFromSlug(slug: ArtifactTypeSlug): GuruArtifactType {
  const entry = Object.entries(ARTIFACT_TYPE_CONFIG).find(([, config]) => config.slug === slug);
  if (!entry) throw new Error(`Unknown artifact slug: ${slug}`);
  return entry[0] as GuruArtifactType;
}

export function getApiKeyFromSlug(slug: ArtifactTypeSlug): 'mentalModel' | 'curriculum' | 'drillSeries' {
  const type = getArtifactTypeFromSlug(slug);
  return ARTIFACT_TYPE_CONFIG[type].apiKey;
}

export interface TeachingPhase {
  key: string;
  label: string;
  icon: string;
  estimatedTime: string;  // Simple estimate like "~30s"
}

// Phase key constants - single source of truth for Inngest jobs and UI
export const MENTAL_MODEL_PHASE_KEYS = {
  COMPOSING_CORPUS: 'COMPOSING_CORPUS',
  ANALYZING_STRUCTURE: 'ANALYZING_STRUCTURE',
  EXTRACTING_PRINCIPLES: 'EXTRACTING_PRINCIPLES',
  BUILDING_FRAMEWORK: 'BUILDING_FRAMEWORK',
  SAVING_ARTIFACT: 'SAVING_ARTIFACT',
} as const;

export const CURRICULUM_PHASE_KEYS = {
  LOADING_PREREQUISITES: 'LOADING_PREREQUISITES',
  ANALYZING_MENTAL_MODEL: 'ANALYZING_MENTAL_MODEL',
  DESIGNING_PATH: 'DESIGNING_PATH',
  STRUCTURING_MODULES: 'STRUCTURING_MODULES',
  VERIFYING_CONTENT: 'VERIFYING_CONTENT',
  SAVING_ARTIFACT: 'SAVING_ARTIFACT',
} as const;

export const DRILL_SERIES_PHASE_KEYS = {
  LOADING_PREREQUISITES: 'LOADING_PREREQUISITES',
  ANALYZING_CURRICULUM: 'ANALYZING_CURRICULUM',
  DESIGNING_EXERCISES: 'DESIGNING_EXERCISES',
  GENERATING_CONTENT: 'GENERATING_CONTENT',
  VALIDATING_OUTPUT: 'VALIDATING_OUTPUT',
  VERIFYING_CONTENT: 'VERIFYING_CONTENT',
  SAVING_ARTIFACT: 'SAVING_ARTIFACT',
} as const;

export const MENTAL_MODEL_PHASES: TeachingPhase[] = [
  { key: MENTAL_MODEL_PHASE_KEYS.COMPOSING_CORPUS, label: 'Composing', icon: '1', estimatedTime: '~5s' },
  { key: MENTAL_MODEL_PHASE_KEYS.ANALYZING_STRUCTURE, label: 'Analyzing', icon: '2', estimatedTime: '~20s' },
  { key: MENTAL_MODEL_PHASE_KEYS.EXTRACTING_PRINCIPLES, label: 'Extracting', icon: '3', estimatedTime: '~30s' },
  { key: MENTAL_MODEL_PHASE_KEYS.BUILDING_FRAMEWORK, label: 'Building', icon: '4', estimatedTime: '~20s' },
  { key: MENTAL_MODEL_PHASE_KEYS.SAVING_ARTIFACT, label: 'Saving', icon: '5', estimatedTime: '~5s' },
];

export const CURRICULUM_PHASES: TeachingPhase[] = [
  { key: CURRICULUM_PHASE_KEYS.LOADING_PREREQUISITES, label: 'Loading', icon: '1', estimatedTime: '~5s' },
  { key: CURRICULUM_PHASE_KEYS.ANALYZING_MENTAL_MODEL, label: 'Analyzing', icon: '2', estimatedTime: '~15s' },
  { key: CURRICULUM_PHASE_KEYS.DESIGNING_PATH, label: 'Designing', icon: '3', estimatedTime: '~30s' },
  { key: CURRICULUM_PHASE_KEYS.STRUCTURING_MODULES, label: 'Structuring', icon: '4', estimatedTime: '~25s' },
  { key: CURRICULUM_PHASE_KEYS.VERIFYING_CONTENT, label: 'Verifying', icon: '5', estimatedTime: '~20s' },
  { key: CURRICULUM_PHASE_KEYS.SAVING_ARTIFACT, label: 'Saving', icon: '6', estimatedTime: '~5s' },
];

export const DRILL_SERIES_PHASES: TeachingPhase[] = [
  { key: DRILL_SERIES_PHASE_KEYS.LOADING_PREREQUISITES, label: 'Loading', icon: '1', estimatedTime: '~5s' },
  { key: DRILL_SERIES_PHASE_KEYS.ANALYZING_CURRICULUM, label: 'Analyzing', icon: '2', estimatedTime: '~15s' },
  { key: DRILL_SERIES_PHASE_KEYS.DESIGNING_EXERCISES, label: 'Designing', icon: '3', estimatedTime: '~40s' },
  { key: DRILL_SERIES_PHASE_KEYS.GENERATING_CONTENT, label: 'Generating', icon: '4', estimatedTime: '~30s' },
  { key: DRILL_SERIES_PHASE_KEYS.VALIDATING_OUTPUT, label: 'Validating', icon: '5', estimatedTime: '~10s' },
  { key: DRILL_SERIES_PHASE_KEYS.VERIFYING_CONTENT, label: 'Verifying', icon: '6', estimatedTime: '~20s' },
  { key: DRILL_SERIES_PHASE_KEYS.SAVING_ARTIFACT, label: 'Saving', icon: '7', estimatedTime: '~5s' },
];

export function getPhasesForArtifactType(type: ArtifactType): TeachingPhase[] {
  switch (type) {
    case 'MENTAL_MODEL': return MENTAL_MODEL_PHASES;
    case 'CURRICULUM': return CURRICULUM_PHASES;
    case 'DRILL_SERIES': return DRILL_SERIES_PHASES;
  }
}

/**
 * Get the initial progressStage for a given artifact type.
 * This is set when the artifact is created in GENERATING status,
 * providing immediate UI feedback before the Inngest job starts.
 */
export function getInitialProgressStage(type: ArtifactType): string {
  switch (type) {
    case 'MENTAL_MODEL':
      return MENTAL_MODEL_PHASE_KEYS.COMPOSING_CORPUS;
    case 'CURRICULUM':
      return CURRICULUM_PHASE_KEYS.LOADING_PREREQUISITES;
    case 'DRILL_SERIES':
      return DRILL_SERIES_PHASE_KEYS.LOADING_PREREQUISITES;
  }
}

// Position Library Thresholds
// Used by AccuracyToolsPanel (UI warnings) and drill-series API (generation blocks)
export const POSITION_LIBRARY_THRESHOLDS = {
  /** Minimum non-opening positions required for drill generation (hard block) */
  MINIMUM_POSITIONS: 21,
  /** Show warning below this threshold (but allow generation) */
  WARNING_THRESHOLD: 100,
} as const;
