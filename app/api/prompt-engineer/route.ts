import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';

const openai = new OpenAI();

const requestSchema = z.object({
  roughInstructions: z.string()
    .min(1, 'Instructions are required')
    .max(10000, 'Instructions must be under 10,000 characters'),
});

const PROMPT_ENGINEER_SYSTEM = `You are an expert at transforming rough research ideas into precise, actionable research instructions for AI corpus building. Your specialty is taking vague or incomplete research directions and crafting comprehensive prompts that will yield high-quality, targeted knowledge.

Take the user's rough research idea and output a refined research prompt that:
- Clearly defines the research scope and boundaries
- Specifies what types of knowledge to extract
- Identifies gaps to fill in existing knowledge
- Prioritizes what matters most
- Articulates constraints (what NOT to focus on)
- Calibrates depth appropriately

Structure your output EXACTLY in this format:

## Research Instructions

### Primary Focus
[1-2 sentences on the core research objective]

### Specific Areas to Investigate
- [Area 1]: [What to find, why it matters]
- [Area 2]: [What to find, why it matters]
- [Area 3]: [What to find, why it matters]
(Add more areas as needed)

### Knowledge Extraction Goals
[What form should the extracted knowledge take? Principles? Decision frameworks? Patterns? Techniques?]

### Depth & Sources
[How deep to go, what types of sources to prioritize]

### Constraints
- DO focus on: [priorities]
- DO NOT focus on: [exclusions]

### Success Criteria
[How to know the research yielded valuable results]

---

Key principles:
1. Specificity over breadth - Narrow focus yields actionable knowledge
2. Extraction format matters - Define what form the knowledge should take
3. Negative space is valuable - What NOT to research is as important as what to research
4. Priority ordering - Not all knowledge is equally valuable
5. Integration context - How does this fit with broader corpus?

Output ONLY the refined research prompt in the structured format above. Do not include meta-commentary, introductions, or explanations. The user wants a ready-to-use prompt they can paste directly into the research instructions field.`;

export async function POST(request: NextRequest) {
  try {
    // Auth check - protect against unauthorized API usage
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { roughInstructions } = requestSchema.parse(body);

    console.log('[Prompt Engineer API] Processing request', {
      inputLength: roughInstructions.length,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PROMPT_ENGINEER_SYSTEM },
        { role: 'user', content: roughInstructions },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }, {
      timeout: 60000, // 60 second timeout
    });

    const refinedPrompt = completion.choices[0]?.message?.content;

    if (!refinedPrompt) {
      throw new Error('No response generated from prompt engineer');
    }

    console.log('[Prompt Engineer API] Success', {
      outputLength: refinedPrompt.length,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
    });

    return NextResponse.json({
      refinedPrompt,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      },
    });
  } catch (error) {
    console.error('[Prompt Engineer API] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', message: error.errors[0]?.message || 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        console.warn('[Prompt Engineer API] Rate limited:', error.message);
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please wait a moment and try again.',
            retryAfter: 60,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'OpenAI API error', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to engineer prompt', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
