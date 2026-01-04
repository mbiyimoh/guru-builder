# Recommendation Refinement via Prompt - Specification

## Overview

Add inline prompt-based refinement for recommendations. Users can provide natural language guidance to tweak a recommendation before approving it.

---

## Decisions from Ideation

| Question | Decision |
|----------|----------|
| Reset confidence score? | **No** - Keep original. If user is interacting, confidence already did its job. |
| Track refinement count? | **No** - Not needed for V1 |
| Character limit? | **2000 max, 500 recommended** - Show guidance in UI |

---

## Data Model

No schema changes required. Refinement updates existing recommendation fields in-place:
- `title` - May be updated
- `description` - May be updated
- `fullContent` - Updated with refined content
- `reasoning` - Updated to reflect refinement

Unchanged fields: `id`, `action`, `targetType`, `targetId`, `confidence`, `priority`, `status`

---

## API Specification

### POST `/api/recommendations/[id]/refine`

**Request:**
```typescript
{
  refinementPrompt: string;  // 1-2000 chars
}
```

**Validation:**
- `refinementPrompt` must be 1-2000 characters
- Recommendation must exist
- Recommendation must have status `PENDING`
- User must own the project containing this recommendation

**Response (200):**
```typescript
{
  success: true,
  recommendation: {
    id: string,
    title: string,
    description: string,
    fullContent: string,
    reasoning: string,
    action: 'CREATE' | 'EDIT' | 'DELETE',
    targetType: 'CONTEXT_LAYER' | 'KNOWLEDGE_FILE',
    targetId: string | null,
    confidence: number,
    priority: 'HIGH' | 'MEDIUM' | 'LOW',
    status: 'PENDING'
  }
}
```

**Error Responses:**
- `400` - Invalid prompt (empty or >2000 chars)
- `404` - Recommendation not found
- `409` - Recommendation not in PENDING status
- `500` - OpenAI API error or internal error

---

## Implementation

### File: `app/api/recommendations/[id]/refine/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { refineRecommendation } from '@/lib/recommendations/refineRecommendation';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { refinementPrompt } = body;

    // Validate prompt
    if (!refinementPrompt || typeof refinementPrompt !== 'string') {
      return NextResponse.json(
        { error: 'Refinement prompt is required' },
        { status: 400 }
      );
    }

    if (refinementPrompt.length > 2000) {
      return NextResponse.json(
        { error: 'Refinement prompt must be 2000 characters or less' },
        { status: 400 }
      );
    }

    // Fetch recommendation with ownership check
    const recommendation = await prisma.recommendation.findFirst({
      where: { id },
      include: {
        researchRun: {
          include: {
            project: true
          }
        }
      }
    });

    if (!recommendation) {
      return NextResponse.json(
        { error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (recommendation.researchRun.project.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check status
    if (recommendation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending recommendations can be refined' },
        { status: 409 }
      );
    }

    const refined = await refineRecommendation(recommendation, refinementPrompt);

    // Update recommendation in database
    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        title: refined.title,
        description: refined.description,
        fullContent: refined.fullContent,
        reasoning: refined.reasoning,
      }
    });

    return NextResponse.json({
      success: true,
      recommendation: updated
    });
  } catch (error) {
    console.error('Error refining recommendation:', error);
    return NextResponse.json(
      { error: 'Failed to refine recommendation' },
      { status: 500 }
    );
  }
}
```

### File: `lib/recommendations/refineRecommendation.ts`

```typescript
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { Recommendation } from '@prisma/client';

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

const RefinedRecommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  fullContent: z.string(),
  reasoning: z.string(),
});

type RefinedRecommendation = z.infer<typeof RefinedRecommendationSchema>;

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
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(content) as RefinedRecommendation;
}
```

### File: `components/recommendations/RefinementInput.tsx`

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RefinementInputProps {
  recommendationId: string;
  disabled?: boolean;
  onRefinementComplete: (updatedRecommendation: any) => void;
}

const EXAMPLE_PROMPTS = [
  'Make it more concise',
  'Add more examples for beginners',
  'Change the tone to be more conversational',
  'Focus on X and remove Y',
];

const MAX_CHARS = 2000;
const RECOMMENDED_CHARS = 500;

export function RefinementInput({
  recommendationId,
  disabled = false,
  onRefinementComplete,
}: RefinementInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const minHeight = 80;
    const maxHeight = 160;
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [prompt]);

  // Focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  const handleRefine = async () => {
    if (!prompt.trim() || isRefining || disabled) return;

    setIsRefining(true);
    setError(null);

    try {
      const response = await fetch(`/api/recommendations/${recommendationId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refinementPrompt: prompt.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refine recommendation');
      }

      const data = await response.json();
      onRefinementComplete(data.recommendation);
      setPrompt('');
      setIsExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRefining(false);
    }
  };

  const handleCancel = () => {
    setPrompt('');
    setError(null);
    setIsExpanded(false);
  };

  const charCount = prompt.length;
  const isOverRecommended = charCount > RECOMMENDED_CHARS;
  const isOverMax = charCount > MAX_CHARS;

  if (disabled) {
    return null;
  }

  return (
    <div className="border rounded-lg bg-gray-50 overflow-hidden">
      {/* Collapsed Header / Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full px-4 py-3 flex items-center justify-between text-left',
          'hover:bg-gray-100 transition-colors',
          isExpanded && 'border-b'
        )}
        disabled={isRefining}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium text-gray-700">
            {isRefining ? 'Refining recommendation...' : 'Refine this recommendation'}
          </span>
        </div>
        {isRefining ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        ) : isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && !isRefining && (
        <div className="px-4 py-4 space-y-4">
          {/* Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe how you&apos;d like to adjust this recommendation:
            </label>
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Make it more concise and focus on the key principles..."
              className={cn(
                'resize-none text-sm',
                isOverMax && 'border-red-500 focus:ring-red-500'
              )}
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">
                {isOverRecommended && !isOverMax && (
                  <span className="text-amber-600">Consider keeping under {RECOMMENDED_CHARS} chars for best results</span>
                )}
                {isOverMax && (
                  <span className="text-red-600">Exceeds maximum length</span>
                )}
              </p>
              <p className={cn(
                'text-xs',
                isOverMax ? 'text-red-600' : isOverRecommended ? 'text-amber-600' : 'text-gray-500'
              )}>
                {charCount}/{MAX_CHARS}
              </p>
            </div>
          </div>

          {/* Example Prompts */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Examples:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="text-xs px-2 py-1 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  &quot;{example}&quot;
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRefine}
              disabled={!prompt.trim() || isOverMax}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Refine
            </Button>
          </div>
        </div>
      )}

      {/* Refining State */}
      {isRefining && (
        <div className="px-4 py-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Applying your changes...</p>
          {prompt && (
            <p className="text-xs text-gray-500 mt-2 italic">
              &quot;{prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Integration with RecommendationsView

### File: `app/projects/[id]/research/[runId]/RecommendationsView.tsx`

Add the RefinementInput component to each recommendation card:

```tsx
// Import
import { RefinementInput } from '@/components/recommendations/RefinementInput';

// Inside recommendation card mapping, after the Reasoning box and before Approve/Reject buttons:
{rec.status === 'PENDING' && (
  <RefinementInput
    recommendationId={rec.id}
    disabled={processingId === rec.id}
    onRefinementComplete={(updated) => {
      // Update local state with refined recommendation
      setRecommendations(prev =>
        prev.map(r => r.id === updated.id ? { ...r, ...updated } : r)
      );
    }}
  />
)}
```

---

## UI States Summary

| State | Visual |
|-------|--------|
| Collapsed | Purple sparkle icon + "Refine this recommendation" + chevron down |
| Expanded | Textarea + examples + character counter + Cancel/Refine buttons |
| Refining | Spinner + "Applying your changes..." + quoted prompt preview |
| Success | Collapses, card shows updated content |
| Error | Red error message in expanded state, input preserved |

---

## Validation Rules

| Rule | Enforcement |
|------|-------------|
| Prompt required | Button disabled when empty |
| Max 2000 chars | Button disabled + red border when exceeded |
| Recommend 500 chars | Amber warning when exceeded |
| PENDING status only | Component hidden for non-pending |
| User owns project | API returns 401 |

---

## Tasks

1. [ ] Create `app/api/recommendations/[id]/refine/route.ts`
2. [ ] Create `lib/recommendations/refineRecommendation.ts`
3. [ ] Create `components/recommendations/RefinementInput.tsx`
4. [ ] Integrate RefinementInput into RecommendationsView
5. [ ] Test refinement flow end-to-end
6. [ ] Test error handling (network, timeout, validation)
7. [ ] Test concurrent operations (refine while processing another action)

---

## Acceptance Criteria

- [ ] User can expand refinement input on PENDING recommendations
- [ ] Character counter shows current/max with color coding
- [ ] Example prompts can be clicked to populate textarea
- [ ] Refine button disabled when empty or over max
- [ ] Loading state shows during API call
- [ ] Success updates card content without page refresh
- [ ] Error displays inline, preserves user input
- [ ] Refinement input hidden for APPROVED/REJECTED recommendations
- [ ] Works on mobile (responsive layout)

---

## Out of Scope (V1)

- Voice input for refinement
- Refinement history / undo
- Bulk refinement across multiple recommendations
- AI-suggested refinements
