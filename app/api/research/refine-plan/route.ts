/**
 * Research Plan Refinement API
 *
 * POST /api/research/refine-plan - Chat with AI to refine research plans
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { guruProfileDataSchema } from '@/lib/guruProfile/types';

// Lazy-load OpenAI to avoid build-time errors
let OpenAI: typeof import('openai').default | null = null;
async function getOpenAI() {
  if (!OpenAI) {
    const module = await import('openai');
    OpenAI = module.default;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Request validation schema
const requestSchema = z.object({
  projectId: z.string(),
  message: z.string().min(1),
  currentPlan: z.object({
    title: z.string(),
    objective: z.string(),
    queries: z.array(z.string()),
    focusAreas: z.array(z.string()),
    expectedOutcomes: z.array(z.string()),
    depth: z.enum(['QUICK', 'MODERATE', 'DEEP']),
  }).nullable(),
  guruProfile: guruProfileDataSchema.partial().optional(),
});

// System prompt for the research planning assistant
const SYSTEM_PROMPT = `You are a research planning assistant helping users create effective research plans for building AI teaching assistants (gurus).

Your role is to:
1. Understand what knowledge the user wants their guru to have
2. Suggest specific, actionable research queries
3. Identify focus areas that will yield the best learning content
4. Recommend appropriate research depth based on scope

When creating or refining a plan, consider:
- The user's guru profile and teaching domain
- What pedagogical dimensions need coverage (Foundations, Progression, Mistakes, Examples, Nuance, Practice)
- Specificity of queries for better results
- Realistic scope for the chosen depth level

DEPTH GUIDELINES:
- QUICK: 2-3 minutes, 1-2 queries, narrow focus (good for quick validation or specific gaps)
- MODERATE: 5-7 minutes, 3-5 queries, balanced coverage (recommended for most research)
- DEEP: 10-15 minutes, 5-8 queries, comprehensive exploration (for building foundational knowledge)

Always respond with:
1. A conversational message explaining your suggestions
2. A complete research plan

IMPORTANT: Always include a complete research plan in your response. Create an initial plan based on the user's first message. Only return null for updatedPlan if the user explicitly says they don't want a plan or want to cancel planning.

Output format (JSON):
{
  "reply": "Your conversational response...",
  "updatedPlan": {
    "title": "Research plan title",
    "objective": "What this research aims to discover",
    "queries": ["query1", "query2", ...],
    "focusAreas": ["area1", "area2", ...],
    "expectedOutcomes": ["outcome1", "outcome2", ...],
    "depth": "QUICK" | "MODERATE" | "DEEP"
  }
}`;

/**
 * POST /api/research/refine-plan
 * Chat with AI to refine research plans
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    let user;
    try {
      user = await requireUser();
    } catch (error) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const result = requestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.format(),
        },
        { status: 400 }
      );
    }

    const { projectId, message, currentPlan, guruProfile } = result.data;

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build context for GPT
    let contextPrompt = `Project: ${project.name}\n\n`;

    if (guruProfile) {
      contextPrompt += `Guru Profile:\n`;
      contextPrompt += `- Domain: ${guruProfile.domainExpertise}\n`;
      contextPrompt += `- Audience: ${guruProfile.audienceDescription}\n`;
      contextPrompt += `- Teaching Style: ${guruProfile.pedagogicalApproach}\n\n`;
    }

    if (currentPlan) {
      contextPrompt += `Current Research Plan:\n`;
      contextPrompt += `Title: ${currentPlan.title}\n`;
      contextPrompt += `Objective: ${currentPlan.objective}\n`;
      contextPrompt += `Queries: ${currentPlan.queries.join(', ')}\n`;
      contextPrompt += `Focus Areas: ${currentPlan.focusAreas.join(', ')}\n`;
      contextPrompt += `Expected Outcomes: ${currentPlan.expectedOutcomes.join(', ')}\n`;
      contextPrompt += `Depth: ${currentPlan.depth}\n\n`;
    }

    contextPrompt += `User Message: ${message}`;

    // Call OpenAI
    const openai = await getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contextPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('[Research Plan Refinement] Failed to parse JSON:', responseContent);
      throw new Error('Invalid JSON response from AI');
    }

    // Validate response structure
    if (!parsedResponse.reply || typeof parsedResponse.reply !== 'string') {
      throw new Error('Invalid response format: missing reply');
    }

    // If updatedPlan is provided, validate it
    if (parsedResponse.updatedPlan !== null && parsedResponse.updatedPlan !== undefined) {
      const planSchema = z.object({
        title: z.string(),
        objective: z.string(),
        queries: z.array(z.string()),
        focusAreas: z.array(z.string()),
        expectedOutcomes: z.array(z.string()),
        depth: z.enum(['QUICK', 'MODERATE', 'DEEP']),
      });

      const planResult = planSchema.safeParse(parsedResponse.updatedPlan);
      if (!planResult.success) {
        console.error('[Research Plan Refinement] Invalid plan structure:', planResult.error);
        // Return reply but no plan if plan is malformed
        parsedResponse.updatedPlan = null;
      }
    }

    return NextResponse.json({
      reply: parsedResponse.reply,
      updatedPlan: parsedResponse.updatedPlan || null,
    });
  } catch (error) {
    console.error('[Research Plan Refinement] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to refine research plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
