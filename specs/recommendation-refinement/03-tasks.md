# Task Breakdown: Recommendation Refinement via Prompt

Generated: 2025-01-04
Source: specs/recommendation-refinement/02-specification.md
Last Decompose: 2025-01-04

## Overview

Add inline prompt-based refinement for recommendations. Users can provide natural language guidance to tweak a recommendation before approving it. This involves creating an API endpoint, core refinement logic, and a UI component.

## Phase 1: Backend Implementation

### Task 1.1: Create Core Refinement Function
**Description**: Implement the `refineRecommendation` function that calls GPT-4o to refine recommendation content
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (foundation task)

**Technical Requirements**:
- Lazy-loaded OpenAI client pattern (avoids build-time initialization errors)
- Zod schema for structured output
- GPT-4o model with temperature 0.7
- Preserve action type and target type
- Return refined title, description, fullContent, and reasoning

**File**: `lib/recommendations/refineRecommendation.ts`

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Function exports correctly from module
- [ ] Lazy OpenAI initialization works (no build-time errors)
- [ ] Returns properly typed RefinedRecommendation object
- [ ] Preserves action and targetType in prompt context

---

### Task 1.2: Create API Route for Refinement
**Description**: Implement POST endpoint at `/api/recommendations/[id]/refine`
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Technical Requirements**:
- Use `getCurrentUser` from `@/lib/auth` for authentication
- Use `prisma` from `@/lib/db` for database access
- RouteContext type pattern matching existing routes
- Validate prompt: 1-2000 characters
- Check recommendation exists and is PENDING
- Verify user owns project via research run

**File**: `app/api/recommendations/[id]/refine/route.ts`

**Implementation**:
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

**Error Responses**:
- `400` - Invalid prompt (empty or >2000 chars)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (doesn't own project)
- `404` - Recommendation not found
- `409` - Recommendation not in PENDING status
- `500` - OpenAI API error or internal error

**Acceptance Criteria**:
- [ ] Returns 401 when not authenticated
- [ ] Returns 400 when prompt is empty or too long
- [ ] Returns 404 when recommendation doesn't exist
- [ ] Returns 403 when user doesn't own the project
- [ ] Returns 409 when recommendation is not PENDING
- [ ] Returns 200 with updated recommendation on success
- [ ] Database is updated with refined content

---

## Phase 2: Frontend Implementation

### Task 2.1: Create RefinementInput Component
**Description**: Build the collapsible refinement input UI component
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: None

**Technical Requirements**:
- Collapsible panel with expand/collapse toggle
- Auto-resizing textarea (80px min, 160px max)
- Character counter with color coding (amber at 500+, red at 2000+)
- Example prompt chips that populate textarea on click
- Loading state with spinner and prompt preview
- Error display inline with input preservation
- Purple theme for refinement branding

**File**: `components/recommendations/RefinementInput.tsx`

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Collapsed state shows toggle with sparkle icon
- [ ] Expanded state shows textarea, examples, and buttons
- [ ] Textarea auto-resizes up to 160px
- [ ] Character counter shows current/max
- [ ] Amber warning at 500+ chars
- [ ] Red warning and disabled button at 2000+ chars
- [ ] Example chips populate textarea on click
- [ ] Loading state shows spinner and prompt preview
- [ ] Error displays inline, preserves input
- [ ] Cancel clears input and collapses
- [ ] Success calls onRefinementComplete and collapses

---

### Task 2.2: Integrate RefinementInput into RecommendationsView
**Description**: Add the RefinementInput component to each pending recommendation card
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: None

**Technical Requirements**:
- Import RefinementInput component
- Add to each recommendation card after reasoning box, before approve/reject buttons
- Only show for PENDING status recommendations
- Disable during other processing (loading state)
- Update local state on successful refinement

**File**: `app/projects/[id]/research/[runId]/RecommendationsView.tsx`

**Changes**:
```tsx
// Add import at top
import { RefinementInput } from '@/components/recommendations/RefinementInput';

// Add state for local recommendations (if not already present)
const [localRecommendations, setLocalRecommendations] = useState(recommendations);

// Inside recommendation card mapping, after reasoning box:
{rec.status === 'PENDING' && (
  <RefinementInput
    recommendationId={rec.id}
    disabled={loadingId === rec.id}
    onRefinementComplete={(updated) => {
      setLocalRecommendations(prev =>
        prev.map(r => r.id === updated.id ? { ...r, ...updated } : r)
      );
    }}
  />
)}
```

**Acceptance Criteria**:
- [ ] RefinementInput appears on PENDING recommendations only
- [ ] Hidden on APPROVED and REJECTED recommendations
- [ ] Disabled when recommendation is being processed
- [ ] Successful refinement updates card content immediately
- [ ] Card reflects new title, description, fullContent, reasoning

---

## Phase 3: Testing & Verification

### Task 3.1: Manual End-to-End Testing
**Description**: Verify the complete refinement flow works correctly
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.2
**Can run parallel with**: None

**Test Scenarios**:
1. **Happy path**: Expand refinement input, type prompt, click Refine, verify card updates
2. **Character limits**: Test at 500 chars (warning), 2000 chars (disabled)
3. **Example chips**: Click example, verify it populates textarea
4. **Cancel flow**: Type text, click cancel, verify input cleared and collapsed
5. **Error handling**: Test with network error, verify error displays and input preserved
6. **Status check**: Approve a recommendation, verify refinement input disappears
7. **Concurrent actions**: Try to refine while approve is processing

**Acceptance Criteria**:
- [ ] All test scenarios pass
- [ ] No console errors during testing
- [ ] UI is responsive and accessible
- [ ] Mobile layout works correctly

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 2 | Backend: Core function + API route |
| 2 | 2 | Frontend: Component + Integration |
| 3 | 1 | Testing: E2E verification |

**Total Tasks**: 5
**Critical Path**: 1.1 → 1.2 → 2.1 → 2.2 → 3.1
**Parallel Opportunities**: None (sequential dependency chain)
