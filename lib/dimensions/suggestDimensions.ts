/**
 * Dimension Suggestion Logic
 *
 * Core logic for using AI to suggest pedagogical dimension tags for corpus content.
 * This is extracted from the API route to allow direct server-side calls without HTTP.
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { prisma } from '@/lib/db';

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

// Schema for dimension suggestions
const dimensionSuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      dimension: z.string(), // dimension key (e.g., 'foundations')
      confidence: z.number().min(0).max(1),
    })
  ),
});

const SYSTEM_PROMPT = `You are an expert at categorizing teaching content into pedagogical dimensions.

Dimensions:
- foundations: Core concepts, terminology, fundamental principles
- progression: Learning paths, prerequisites, skill building order
- mistakes: Common errors, misconceptions, pitfalls
- examples: Concrete examples, case studies, practical applications
- nuance: Exceptions, edge cases, contextual variations
- practice: Exercises, drills, application opportunities

For each piece of content, suggest relevant dimensions with confidence scores (0-1).
Only include dimensions where confidence > 0.3.
A single piece of content can match multiple dimensions.`;

export interface SuggestDimensionsParams {
  content: string;
  title: string;
  type: 'layer' | 'file';
}

export interface DimensionSuggestion {
  dimension: string;
  confidence: number;
}

export interface SuggestDimensionsResult {
  suggestions: DimensionSuggestion[];
}

/**
 * Suggest pedagogical dimensions for content using AI.
 * This is the core logic - can be called directly without HTTP.
 *
 * @param params - Content details to analyze
 * @returns Array of dimension suggestions with confidence scores
 * @throws Error if no dimensions are configured or OpenAI call fails
 */
export async function suggestDimensions(
  params: SuggestDimensionsParams
): Promise<SuggestDimensionsResult> {
  const { content, title, type } = params;

  // Fetch available dimensions to provide in context
  const dimensions = await prisma.pedagogicalDimension.findMany({
    orderBy: { priority: 'asc' },
    select: { key: true, name: true, description: true },
  });

  if (dimensions.length === 0) {
    throw new Error('No pedagogical dimensions configured');
  }

  // Truncate content to save tokens (first 2000 chars)
  const truncatedContent = content.slice(0, 2000);

  // Build enhanced system prompt with actual dimensions from database
  const enhancedSystemPrompt = `${SYSTEM_PROMPT}

Available dimensions in this system:
${dimensions.map((d) => `- ${d.key}: ${d.description}`).join('\n')}

Only suggest dimensions from the list above.`;

  // Create user prompt
  const userPrompt = `Title: ${title}
Type: ${type}
Content:
${truncatedContent}

Analyze this content and suggest which pedagogical dimensions it belongs to. Return your suggestions with confidence scores.`;

  // Call GPT-4o-mini for efficiency
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: enhancedSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: zodResponseFormat(dimensionSuggestionSchema, 'dimension_suggestions'),
    temperature: 0.3, // Lower temperature for more consistent categorization
  });

  const result = dimensionSuggestionSchema.parse(
    JSON.parse(completion.choices[0].message.content || '{}')
  );

  // Filter suggestions by confidence threshold
  const filteredSuggestions = result.suggestions.filter((s) => s.confidence > 0.3);

  // Validate that all suggested dimensions exist
  const validDimensionKeys = new Set(dimensions.map((d) => d.key));
  const validatedSuggestions = filteredSuggestions.filter((s) =>
    validDimensionKeys.has(s.dimension)
  );

  return {
    suggestions: validatedSuggestions,
  };
}
