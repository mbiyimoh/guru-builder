/**
 * Inngest Client Configuration
 *
 * Inngest is used for serverless background job orchestration,
 * particularly for long-running research tasks (5-10 minutes)
 */

import { Inngest, EventSchemas } from "inngest";

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
};

// Create Inngest client with type-safe events
export const inngest = new Inngest({
  id: "guru-builder",
  schemas: new EventSchemas().fromRecord<Events>(),
});
