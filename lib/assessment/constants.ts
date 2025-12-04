// lib/assessment/constants.ts

/**
 * Model Configuration
 *
 * Centralizes all AI model identifiers and pricing used across the application.
 * Using constants prevents typos and enables type-safe model references.
 */

/**
 * Claude 3.7 Sonnet - Used for assessment guru responses
 * Features: Extended thinking, high reasoning capability
 */
export const ASSESSMENT_MODEL = 'claude-3-7-sonnet-20250219' as const
export type AssessmentModel = typeof ASSESSMENT_MODEL

/**
 * GPT-4o - Used for research and recommendation generation
 * Features: Structured outputs, function calling
 */
export const RESEARCH_MODEL = 'gpt-4o-2024-08-06' as const
export type ResearchModel = typeof RESEARCH_MODEL

/**
 * Model pricing for cost calculation
 * Prices in USD per 1M tokens
 */
export const MODEL_PRICING = {
  [ASSESSMENT_MODEL]: {
    input: 3.0, // $3 per 1M input tokens
    output: 15.0, // $15 per 1M output tokens
  },
  [RESEARCH_MODEL]: {
    input: 2.5, // $2.50 per 1M input tokens
    output: 10.0, // $10 per 1M output tokens
  },
} as const

export type ModelName = keyof typeof MODEL_PRICING
