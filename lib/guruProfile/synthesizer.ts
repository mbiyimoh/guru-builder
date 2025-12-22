/**
 * Guru Profile Synthesizer Service
 *
 * Transforms natural language brain dumps into structured guru profile data
 * using GPT-4o with JSON mode and comprehensive error handling.
 *
 * Features:
 * - 60-second timeout with AbortController
 * - Lazy-loaded OpenAI client (build-safe)
 * - Light areas detection for fields with low confidence
 * - Comprehensive error handling with retryable classification
 *
 * @module lib/guruProfile/synthesizer
 */

import type {
  GuruProfileData,
  SynthesisResult,
  SynthesisErrorCode,
} from './types'
import { guruProfileDataSchema } from './types'

// Lazy-load OpenAI client to avoid build-time errors
let openaiClient: import('openai').default | null = null

function getOpenAIClient(): import('openai').default {
  if (!openaiClient) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = require('openai').default
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient!
}

/**
 * Custom error class for synthesis failures
 *
 * Provides structured error information with retry guidance.
 */
export class SynthesisError extends Error {
  constructor(
    public readonly code: SynthesisErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'SynthesisError'
    Object.setPrototypeOf(this, SynthesisError.prototype)
  }
}

/**
 * Internal schema for GPT-4o structured output
 *
 * Includes metadata about inference quality alongside the profile data.
 */
interface SynthesisGPTOutput {
  profile: GuruProfileData
  lightAreas: string[]
  confidence: number
  reasoning: string // Internal field for debugging, not exposed
}

/**
 * Build the system prompt for GPT-4o synthesis
 *
 * Explains the guru profile concept and all 15 fields with detailed descriptions.
 */
function buildSystemPrompt(): string {
  return `You are an AI assistant that helps synthesize structured guru profile data from natural language brain dumps.

# Guru Profile Concept

A "guru" is an AI teaching assistant with a specific domain, audience, and teaching style. Your job is to extract and structure the following 15 fields from the user's raw input:

## 1. Domain & Expertise

- **domainExpertise** (string, required): The primary teaching domain or field of expertise (e.g., "Backgammon Strategy", "Spanish Grammar for Beginners", "Python Programming").

- **specificTopics** (string[], required): Key topics, subjects, or areas covered by this guru. At least one topic is required. Examples: ["opening moves", "priming strategies", "endgame play"] or ["present tense conjugation", "common phrases", "pronunciation"].

- **yearsOfExperience** (number | null, optional): Years of experience in the domain. Leave null if not explicitly mentioned or unclear.

## 2. Audience

- **audienceLevel** (enum, required): Primary skill level of the target audience. Must be one of: "beginner", "intermediate", "advanced", "mixed".

- **audienceDescription** (string, required): Detailed description of who this guru teaches. Include characteristics like background, goals, challenges, or context (e.g., "Casual players who want to move beyond beginner mistakes", "Spanish learners preparing for travel").

## 3. Teaching Style

- **pedagogicalApproach** (string, required): Core teaching methodology or educational philosophy. How does the guru structure learning? (e.g., "Principle-based teaching that emphasizes 'why' over 'what'", "Immersive practice with immediate feedback").

- **tone** (enum, required): Overall communication tone. Must be one of: "formal", "conversational", "encouraging", "direct", "socratic".

- **communicationStyle** (string, required): How the guru communicates concepts and interacts with learners. Be specific about language, pacing, and interaction patterns (e.g., "Uses analogies and real-world examples, asks probing questions to guide discovery").

## 4. Content Preferences

- **emphasizedConcepts** (string[], optional): Key concepts or principles to emphasize in teaching. Can be empty if not specified.

- **avoidedTopics** (string[], optional): Topics to avoid, minimize, or handle with care. Can be empty if not specified.

- **examplePreferences** (string, required): Preferences for how examples should be used. Should this guru use concrete vs abstract examples? Domain-specific or cross-domain? Simple or complex? (e.g., "Concrete game positions from real matches, annotated with decision-making rationale").

## 5. Unique Characteristics

- **uniquePerspective** (string, required): What makes this guru's approach distinctive or valuable? What sets it apart from generic teaching? (e.g., "Focuses on pattern recognition over memorization, emphasizes probabilistic thinking").

- **commonMisconceptions** (string[], optional): Common misconceptions or pitfalls learners face that the guru should address. Can be empty if not specified.

- **successMetrics** (string, required): How the guru measures learning success or student progress. What outcomes matter? (e.g., "Ability to explain reasoning behind moves, not just making correct moves").

## 6. Meta

- **additionalContext** (string | null, optional): Any additional context, constraints, or information not captured elsewhere. Leave null if nothing extra to add.

# Your Task

1. **Extract** all 15 fields from the user's brain dump
2. **Infer** missing fields thoughtfully based on context and domain knowledge
3. **Identify light areas**: Mark fields where you had to infer heavily without explicit information (these become your "lightAreas" array)
4. **Assess confidence**: Provide an overall confidence score (0-1) for the synthesis quality
5. **Provide reasoning**: Explain your synthesis decisions (internal use only)

# Output Format

Return a JSON object with this structure:

{
  "profile": {
    "domainExpertise": "...",
    "specificTopics": ["...", "..."],
    "yearsOfExperience": 10 or null,
    "audienceLevel": "beginner" | "intermediate" | "advanced" | "mixed",
    "audienceDescription": "...",
    "pedagogicalApproach": "...",
    "tone": "formal" | "conversational" | "encouraging" | "direct" | "socratic",
    "communicationStyle": "...",
    "emphasizedConcepts": ["...", "..."],
    "avoidedTopics": ["...", "..."],
    "examplePreferences": "...",
    "uniquePerspective": "...",
    "commonMisconceptions": ["...", "..."],
    "successMetrics": "...",
    "additionalContext": "..." or null
  },
  "lightAreas": ["field1", "field2"],  // Fields with lower confidence or heavy inference
  "confidence": 0.85,  // Overall confidence (0-1)
  "reasoning": "Explanation of synthesis decisions..."
}

# Guidelines

- **Be thoughtful**: Use domain expertise to fill gaps intelligently
- **Be honest**: Mark fields as light areas if you're inferring without explicit input
- **Be complete**: All required fields must have meaningful values
- **Be specific**: Avoid generic descriptions - tailor to the specific domain and context
- **Use enums correctly**: audienceLevel and tone must use exact enum values
- **Handle arrays**: Empty arrays are valid for optional array fields`
}

/**
 * Build the user prompt with raw input and optional additional context
 */
function buildUserPrompt(rawInput: string, additionalContext?: string): string {
  let prompt = `Please synthesize a complete guru profile from the following brain dump:\n\n${rawInput}`

  if (additionalContext?.trim()) {
    prompt += `\n\n# Additional Context\n\n${additionalContext.trim()}`
  }

  return prompt
}

/**
 * Synthesize a guru profile from natural language input
 *
 * @param rawInput - Natural language brain dump (voice transcription or typed text)
 * @param additionalContext - Optional additional context for refinement
 * @returns Structured profile with confidence metadata
 * @throws {SynthesisError} On timeout, API errors, or validation failures
 *
 * @example
 * const result = await synthesizeGuruProfile(
 *   "I want to teach backgammon to casual players...",
 *   "Focus on practical strategies, not theory"
 * )
 */
export async function synthesizeGuruProfile(
  rawInput: string,
  additionalContext?: string
): Promise<SynthesisResult> {
  // Validate input
  if (!rawInput?.trim()) {
    throw new SynthesisError(
      'SCHEMA_VALIDATION' as SynthesisErrorCode,
      'Raw input is required and cannot be empty',
      false
    )
  }

  // Setup timeout with AbortController
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

  try {
    const openai = getOpenAIClient()

    // Call GPT-4o with JSON mode
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(),
          },
          {
            role: 'user',
            content: buildUserPrompt(rawInput, additionalContext),
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for consistent extraction
      },
      {
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    // Extract response content
    const rawContent = completion.choices[0]?.message?.content
    if (!rawContent) {
      throw new SynthesisError(
        'API_ERROR' as SynthesisErrorCode,
        'No content in GPT-4o response',
        true // Retryable - might be transient
      )
    }

    // Parse JSON
    let parsed: SynthesisGPTOutput
    try {
      parsed = JSON.parse(rawContent) as SynthesisGPTOutput
    } catch (parseError) {
      throw new SynthesisError(
        'INVALID_JSON' as SynthesisErrorCode,
        `Failed to parse GPT-4o JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        true, // Retryable - might work on retry with different prompt
        parseError instanceof Error ? parseError : undefined
      )
    }

    // Validate against Zod schema
    let validatedProfile: GuruProfileData
    try {
      validatedProfile = guruProfileDataSchema.parse(parsed.profile)
    } catch (validationError) {
      throw new SynthesisError(
        'SCHEMA_VALIDATION' as SynthesisErrorCode,
        `Profile validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
        true, // Retryable - might work with refined prompt
        validationError instanceof Error ? validationError : undefined
      )
    }

    // Validate confidence score
    const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5))

    // Validate light areas (must be valid field names)
    const validFieldNames = new Set(Object.keys(validatedProfile))
    const lightAreas = (parsed.lightAreas ?? []).filter((field) =>
      validFieldNames.has(field)
    )

    // Return successful synthesis result
    return {
      profile: validatedProfile,
      lightAreas,
      confidence,
      rawInput,
      synthesisMode: 'TEXT', // Default to TEXT, caller can override if needed
    }
  } catch (error) {
    clearTimeout(timeoutId)

    // If already a SynthesisError, rethrow
    if (error instanceof SynthesisError) {
      throw error
    }

    // Handle AbortController timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SynthesisError(
        'TIMEOUT' as SynthesisErrorCode,
        'Synthesis timed out after 60 seconds. Please try again with a shorter input.',
        true // Retryable
      )
    }

    // Handle OpenAI API errors
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status?: number; message?: string }

      // Rate limit (429)
      if (apiError.status === 429) {
        throw new SynthesisError(
          'RATE_LIMITED' as SynthesisErrorCode,
          'OpenAI API rate limit reached. Please wait a moment and try again.',
          true // Retryable after delay
        )
      }

      // Other API errors
      throw new SynthesisError(
        'API_ERROR' as SynthesisErrorCode,
        `OpenAI API error: ${apiError.message ?? 'Unknown error'}`,
        true, // Most API errors are retryable
        error instanceof Error ? error : undefined
      )
    }

    // Handle network errors
    if (
      error instanceof Error &&
      (error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED'))
    ) {
      throw new SynthesisError(
        'NETWORK_ERROR' as SynthesisErrorCode,
        'Network error during synthesis. Please check your connection and try again.',
        true, // Retryable
        error
      )
    }

    // Generic error fallback
    throw new SynthesisError(
      'API_ERROR' as SynthesisErrorCode,
      `Synthesis failed: ${error instanceof Error ? error.message : String(error)}`,
      false, // Unknown errors are not retryable by default
      error instanceof Error ? error : undefined
    )
  }
}
