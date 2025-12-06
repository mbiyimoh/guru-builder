/**
 * Type definitions for the Guru Builder system
 */

// Research depth levels
export type ResearchDepth = "quick" | "moderate" | "deep";

// Research source interface
export interface ResearchSource {
  url: string;
  title: string;
}

// Research metadata
export interface ResearchMetadata {
  maxSources?: number;
  maxIterations?: number;
  reportType?: string;
  mode?: string;
  depth?: ResearchDepth;
  status?: string;
}

// Research findings from Python script
export interface ResearchFindings {
  query: string;
  depth: ResearchDepth;
  summary: string;
  fullReport: string;
  sources: ResearchSource[];
  sourcesAnalyzed: number;
  metadata: ResearchMetadata;
  noRecommendationsReason?: string;
}

// Error response from Python script
export interface ResearchError {
  error: string;
  message?: string;
  type?: string;
  usage?: string;
  example?: string;
  solution?: string;
  valid_depths?: string[];
}

// Research orchestrator options
export interface ResearchOptions {
  instructions: string;
  depth?: ResearchDepth;
  timeout?: number; // milliseconds
  onProgress?: (stage: string) => Promise<void>; // Progress callback for UI updates
}

// Research orchestrator result
export interface ResearchResult {
  success: boolean;
  data?: ResearchFindings;
  error?: ResearchError;
  executionTime?: number; // milliseconds
}
