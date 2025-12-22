/**
 * Ground Truth Module - Type Definitions
 *
 * Core types for integrating ground truth verification into artifact generation.
 * Ground truth validates factual claims (moves, positions, evaluations) against
 * an authoritative backgammon engine API.
 */

/**
 * Ground truth configuration resolved from database.
 *
 * This configuration is loaded from the ProjectGroundTruthConfig model
 * and determines whether ground truth verification is enabled and how
 * to connect to the engine.
 */
export interface GroundTruthConfig {
  /** Whether ground truth verification is enabled for this project */
  enabled: boolean
  /** Base URL of the ground truth engine API */
  engineUrl: string
  /** ID of the GroundTruthEngine */
  engineId: string
  /** Display name of the engine */
  engineName: string
  /** Domain the engine covers (e.g., "backgammon") */
  domain: string
  /** ID of the ProjectGroundTruthConfig linking project to engine */
  configId: string
}

/**
 * Result of a single tool call to the ground truth engine.
 *
 * Tracks execution metadata including caching and timing for
 * performance monitoring.
 */
export interface ToolCallResult {
  /** Name of the tool that was called */
  toolName: string
  /** Arguments passed to the tool */
  arguments: Record<string, unknown>
  /** Response from the engine or cache */
  result: unknown
  /** Whether this response came from cache */
  cached: boolean
  /** Time spent executing (milliseconds, 0 if cached) */
  executionTime: number
}

/**
 * Location metadata for where a claim appears in content.
 *
 * Supports both drill series and curriculum artifacts with
 * appropriate optional fields for each type.
 */
export interface ClaimLocation {
  /** Index in drill series (if applicable) */
  drillIndex?: number
  /** Index of module in curriculum (if applicable) */
  moduleIndex?: number
  /** Index of lesson within module (if applicable) */
  lessonIndex?: number
  /** Section name in artifact */
  sectionName?: string
  /** Lesson type for curriculum (CONCEPT, EXAMPLE, etc.) */
  lessonType?: string
  /** Line number in source */
  lineNumber?: number
}

/**
 * A factual claim extracted from generated content that needs verification.
 *
 * Claims are identified during artifact generation and verified against
 * the ground truth engine to ensure accuracy.
 */
export interface VerificationClaim {
  /** Unique identifier for this claim */
  id: string
  /** Type of claim being verified */
  type: 'move_recommendation' | 'position_evaluation' | 'equity_value' | 'match_score'
  /** The claim content/statement */
  content: string
  /** Location within the artifact where this claim appears */
  location: ClaimLocation
  /** Extracted move notation (e.g., "24/20 13/9") */
  extractedMove?: string
  /** Extracted position ID or notation */
  extractedPosition?: string
}

/**
 * Result of verifying a single claim against the ground truth engine.
 */
export interface ClaimVerificationResult {
  /** The claim that was verified */
  claim: VerificationClaim
  /** Whether the claim was verified as accurate */
  verified: boolean
  /** Raw response from the engine */
  engineResponse?: unknown
  /** Description of any discrepancy found */
  discrepancy?: string
  /** Whether this verification used cached data */
  cached: boolean
}

/**
 * Overall verification result for an entire artifact.
 *
 * Aggregates all claim verifications and provides summary statistics.
 */
export interface VerificationResult {
  /** Overall status of verification */
  status: 'VERIFIED' | 'NEEDS_REVIEW' | 'UNVERIFIED' | 'FAILED'
  /** Results for each individual claim */
  claims: ClaimVerificationResult[]
  /** All tool calls made during verification */
  toolCalls: ToolCallResult[]
  /** Summary statistics */
  summary: {
    /** Total number of claims verified */
    totalClaims: number
    /** Number of claims that passed verification */
    verifiedClaims: number
    /** Number of claims that failed verification */
    failedClaims: number
    /** Number of responses served from cache */
    cachedResponses: number
  }
}

/**
 * Operational limits for ground truth operations.
 *
 * These limits prevent runaway generation loops and ensure
 * reasonable resource usage.
 */
export const GROUND_TRUTH_LIMITS = {
  /** Maximum tool calls allowed in a single generation */
  MAX_TOOL_CALLS: 100,
  /** Maximum agentic loop iterations */
  MAX_ITERATIONS: 50,
  /** Maximum attempts to regenerate failed content */
  MAX_REGENERATION_ATTEMPTS: 5,
  /** Timeout for individual engine queries (milliseconds) */
  ENGINE_QUERY_TIMEOUT: 10000,  // 10 seconds
  /** Timeout for entire generation process (milliseconds) */
  GENERATION_TIMEOUT: 300000,   // 5 minutes
} as const
