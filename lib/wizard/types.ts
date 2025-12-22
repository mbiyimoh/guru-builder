import type { GuruProfileData } from '@/lib/guruProfile/types';

export type WizardPhase = 'profile' | 'research' | 'readiness' | 'artifacts';

export interface WizardState {
  currentPhase: WizardPhase;
  projectId: string | null;
  profile: GuruProfileData | null;
  researchRuns: string[];  // IDs of research runs
  readinessScore: ReadinessScore | null;
  artifacts: ArtifactSummary[];
}

export interface ArtifactSummary {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
}

export interface ReadinessScore {
  overall: number;           // 0-100
  profile: number;           // 0-100 (profile completeness)
  knowledge: number;         // 0-100 (dimension coverage)
  criticalGaps: string[];    // Dimension keys missing critical content
  suggestedGaps: string[];   // Dimension keys that could be improved
  dimensionScores: Record<string, number>;  // Per-dimension scores
}

export interface DimensionCoverage {
  dimensionKey: string;
  dimensionName: string;
  itemCount: number;
  confirmedCount: number;
  isCritical: boolean;
  coveragePercent: number;
}
