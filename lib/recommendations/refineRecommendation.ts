/**
 * Recommendation Refinement Logic
 *
 * Core logic for using AI to refine recommendation content based on user guidance.
 * Uses GPT-4o with structured output to update title, description, fullContent, and reasoning.
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { Recommendation } from '@prisma/client';

/**
 * Custom error class for refinement-specific errors
 */
export class RefinementError extends Error {
  constructor(
    public readonly code: 'OPENAI_ERROR' | 'TIMEOUT' | 'RATE_LIMIT' | 'INVALID_RESPONSE',
    message: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'RefinementError';
  }
}

// Lazy-loaded OpenAI client (avoids build-time initialization errors)
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// Schema for refined recommendation output
const RefinedRecommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  fullContent: z.string(),
  reasoning: z.string(),
});

export type RefinedRecommendation = z.infer<typeof RefinedRecommendationSchema>;

/**
 * Refine a recommendation based on user guidance.
 *
 * @param recommendation - The original recommendation to refine
 * @param refinementPrompt - User's natural language guidance for how to adjust the recommendation
 * @returns The refined recommendation fields (title, description, fullContent, reasoning)
 */
export async function refineRecommendation(
  recommendation: Recommendation,
  refinementPrompt: string
): Promise<RefinedRecommendation> {
  const openai = getOpenAI();

  const systemPrompt = `You are helping a user refine an AI-generated recommendation for their knowledge corpus. The user will provide guidance on how to adjust the recommendation.

Current recommendation:
- Title: ${recommendation.title}
- Description: ${recommendation.description}
- Full Content: ${recommendation.fullContent}
- Reasoning: ${recommendation.reasoning}

Target: ${recommendation.targetType} (${recommendation.action} action)

IMPORTANT CONSTRAINTS:
- Maintain the same action type (${recommendation.action})
- Maintain the same target type (${recommendation.targetType})
- Preserve the general intent of the recommendation
- Apply the user's guidance to adjust the content

Return updated versions of:
1. title - Updated title reflecting changes (if applicable)
2. description - Brief summary of what the refined recommendation does
3. fullContent - The complete, production-ready content incorporating user feedback
4. reasoning - Updated explanation of why this recommendation matters`;

  const userPrompt = `User's refinement request:
"${refinementPrompt}"

Please refine the recommendation according to this guidance.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: zodResponseFormat(RefinedRecommendationSchema, 'refined_recommendation'),
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new RefinementError(
        'INVALID_RESPONSE',
        'No response from OpenAI',
        true
      );
    }

    return JSON.parse(content) as RefinedRecommendation;
  } catch (error) {
    // Re-throw RefinementErrors as-is
    if (error instanceof RefinementError) {
      throw error;
    }

    // Handle OpenAI-specific errors
    if (error instanceof Error) {
      // Rate limit errors (429)
      if ('status' in error && (error as { status: number }).status === 429) {
        throw new RefinementError(
          'RATE_LIMIT',
          'OpenAI rate limit reached. Please try again in a moment.',
          true
        );
      }

      // Timeout errors
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        throw new RefinementError(
          'TIMEOUT',
          'Request timed out. Please try again.',
          true
        );
      }

      // Generic OpenAI error
      throw new RefinementError(
        'OPENAI_ERROR',
        `AI service error: ${error.message}`,
        false
      );
    }

    throw error;
  }
}
