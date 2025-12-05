/**
 * Model Pricing Configuration
 *
 * Used for cost calculation in audit trails.
 * Merge this with your existing constants.ts file.
 *
 * Sources:
 * - Anthropic: https://www.anthropic.com/pricing
 * - OpenAI: https://openai.com/api/pricing/
 *
 * Last verified: 2025-01-08
 *
 * NOTE: Update these prices regularly. Providers may change pricing.
 */

export const MODEL_PRICING = {
  'claude-3-7-sonnet-20250219': {
    input: 3.00,   // $3 per 1M input tokens
    output: 15.00, // $15 per 1M output tokens
  },
  'claude-sonnet-4-20250514': {
    input: 3.00,
    output: 15.00,
  },
  'claude-opus-4-20250514': {
    input: 15.00,
    output: 75.00,
  },
  'gpt-4o-mini': {
    input: 0.15,   // $0.15 per 1M input tokens
    output: 0.60,  // $0.60 per 1M output tokens
  },
  'gpt-4o': {
    input: 2.50,
    output: 10.00,
  },
} as const

export type ModelName = keyof typeof MODEL_PRICING

/**
 * Extended Thinking Configuration (optional)
 *
 * Budget tokens for Claude's reasoning process.
 * Only relevant if you're using extended thinking.
 */
export const THINKING_BUDGET = {
  DRILL: 5000,  // Tokens allocated for Claude to "think"
  CHAT: 3000,
} as const
