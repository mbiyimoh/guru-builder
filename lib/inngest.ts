/**
 * Inngest Client Configuration
 *
 * Inngest is used for serverless background job orchestration,
 * particularly for long-running research tasks (5-10 minutes)
 */

import { Inngest, EventSchemas } from "inngest";
import type { DrillGenerationConfig } from "@/lib/guruFunctions/types";

// Define event schemas for type safety
type Events = {
  "research/requested": {
    data: {
      researchId: string;
      instructions: string;
      depth: "quick" | "moderate" | "deep";
      userId?: string;
    };
  };
  "research/completed": {
    data: {
      researchId: string;
      success: boolean;
      executionTime: number;
    };
  };
  "recommendation/requested": {
    data: {
      recommendationId: string;
      researchFindings: string;
      userId?: string;
    };
  };
  "test/simple": {
    data: {
      message: string;
    };
  };
  // Guru Teaching Function Events
  "guru/generate-mental-model": {
    data: {
      projectId: string;
      artifactId: string;
      userNotes?: string;
    };
  };
  "guru/generate-curriculum": {
    data: {
      projectId: string;
      artifactId: string;
      mentalModelArtifactId: string;
      userNotes?: string;
    };
  };
  "guru/generate-drill-series": {
    data: {
      projectId: string;
      artifactId: string;
      mentalModelArtifactId: string;
      curriculumArtifactId: string;
      userNotes?: string;
      drillConfig?: DrillGenerationConfig;
    };
  };
  "guru/regenerate-artifact": {
    data: {
      artifactId: string;
      projectId: string;
      artifactType: "MENTAL_MODEL" | "CURRICULUM" | "DRILL_SERIES";
      scope: "all" | "failed"; // 'all' = full regeneration, 'failed' = only failed claims (future)
      previousFailures?: unknown; // Previous verification failures for context
    };
  };
  // Match Archive Import Events
  "match-archive/import.started": {
    data: {
      archiveId: string;
      engineId: string;
    };
  };
  "match-archive/verify-batch": {
    data: {
      archiveId: string;
      positionIds: string[];
      batchNumber: number;
      totalBatches: number;
      engineId: string;
    };
  };
  "match-archive/scrape.started": {
    data: {
      collection: "Hardy";
      engineId: string;
    };
  };
  // Self-Play Position Generation Events
  "position-library/self-play.started": {
    data: {
      batchId: string;
      engineId: string;
      gamesCount: number;
      skipOpening: boolean;
    };
  };
};

// Create Inngest client with type-safe events
export const inngest = new Inngest({
  id: "guru-builder",
  schemas: new EventSchemas().fromRecord<Events>(),
});
