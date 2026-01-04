# Recommendation Refinement via Prompt - Ideation

## Problem Statement

Users currently have binary choices for AI-generated recommendations: Approve or Reject. When a recommendation is 80% good but needs tweaks, users must either:
1. Accept it as-is and manually edit the corpus later
2. Reject it entirely and lose the work

**Pain point:** No middle ground for "this is close, but I want to adjust X."

## Proposed Solution

Add inline prompt-based refinement for each recommendation. Users can provide natural language guidance to tweak the recommendation before approving.

---

## User Experience Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RECOMMENDATION CARD (PENDING)                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐ ┌─────────────────┐ ┌────────┐ ┌────────────┐                  │
│  │  EDIT   │ │ KNOWLEDGE_FILE  │ │ MEDIUM │ │ 85% conf   │                  │
│  └─────────┘ └─────────────────┘ └────────┘ └────────────┘                  │
│                                                                              │
│  **Update Opening Principles Guide**                                         │
│  Adds comprehensive coverage of pip count evaluation and race               │
│  considerations for the opening phase.                                       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [▼ View proposed changes]                                           │    │
│  │                                                                       │    │
│  │  --- Current Content ---                                              │    │
│  │  The opening phase focuses on...                                      │    │
│  │                                                                       │    │
│  │  +++ Proposed Content +++                                             │    │
│  │  The opening phase focuses on establishing...                         │    │
│  │  [expanded diff view]                                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 💡 Reasoning: This update addresses gaps in the current opening      │    │
│  │ documentation by adding pip count strategy...                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✏️  Refine this recommendation                                       │    │
│  │ ┌───────────────────────────────────────────────────────────────┐   │    │
│  │ │ Make it more concise. Focus on the 3 most important opening   │   │    │
│  │ │ principles and remove the section about advanced racing...    │   │    │
│  │ └───────────────────────────────────────────────────────────────┘   │    │
│  │                                               [Refine] [Cancel]      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐                                         │
│  │ ✓ Approve    │  │ ✗ Reject     │                                         │
│  └──────────────┘  └──────────────┘                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## State Transitions

```
                    ┌─────────────────┐
                    │    PENDING      │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │  APPROVED   │   │  REJECTED   │   │  REFINING   │ (UI-only state)
    └─────────────┘   └─────────────┘   └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   PENDING   │ (with updated content)
                                        └─────────────┘
```

---

## UI Component Design

### Refinement Input (Collapsed State)

```
┌─────────────────────────────────────────────────────────────────┐
│ ✏️  Refine this recommendation                              [▼] │
└─────────────────────────────────────────────────────────────────┘
```

### Refinement Input (Expanded State)

```
┌─────────────────────────────────────────────────────────────────┐
│ ✏️  Refine this recommendation                              [▲] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Describe how you'd like to adjust this recommendation:         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Make it shorter and focus only on pip count strategy.     │ │
│  │ Remove the racing section - that's covered elsewhere.     │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Examples:                                                      │
│  • "Make it more concise"                                       │
│  • "Add more examples for beginners"                            │
│  • "Change the tone to be more conversational"                  │
│  • "Focus on X and remove Y"                                    │
│                                                                 │
│                                    ┌──────────┐  ┌──────────┐  │
│                                    │  Cancel  │  │  Refine  │  │
│                                    └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Refining State (Loading)

```
┌─────────────────────────────────────────────────────────────────┐
│ ✏️  Refining recommendation...                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              ⟳ Applying your changes...                         │
│                                                                 │
│  Your request: "Make it shorter and focus only on pip count     │
│  strategy. Remove the racing section."                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### After Refinement (Success)

```
┌─────────────────────────────────────────────────────────────────┐
│ ✅ Recommendation refined                                   [▼] │
│ Last refined: just now                                          │
└─────────────────────────────────────────────────────────────────┘

(Card now shows updated content - user can review and approve/reject/refine again)
```

---

## Technical Architecture

### New API Endpoint

```
POST /api/recommendations/[id]/refine
```

**Request:**
```typescript
{
  refinementPrompt: string;  // User's natural language guidance
}
```

**Response:**
```typescript
{
  success: true,
  recommendation: {
    id: string,
    title: string,           // May be updated
    description: string,     // May be updated
    fullContent: string,     // Updated
    reasoning: string,       // Updated to reflect refinement
    // ... other fields unchanged
  },
  refinementApplied: string  // Echo back what was requested
}
```

### Backend Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │ ──► │  API Route  │ ──► │  Refine Fn  │ ──► │   GPT-4o    │
│  (React)    │     │  (Next.js)  │     │  (Library)  │     │  (OpenAI)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       │  POST /refine     │                   │                   │
       │  {prompt}         │                   │                   │
       │ ─────────────────►│                   │                   │
       │                   │  Validate &       │                   │
       │                   │  Auth check       │                   │
       │                   │ ─────────────────►│                   │
       │                   │                   │  Build prompt     │
       │                   │                   │  with context     │
       │                   │                   │ ─────────────────►│
       │                   │                   │                   │
       │                   │                   │ ◄─────────────────│
       │                   │                   │  Refined content  │
       │                   │ ◄─────────────────│                   │
       │                   │  Update DB        │                   │
       │ ◄─────────────────│                   │                   │
       │  Updated rec      │                   │                   │
```

### GPT-4o Prompt Structure

```typescript
const systemPrompt = `You are helping a user refine an AI-generated recommendation
for their knowledge corpus. The user will provide guidance on how to adjust the
recommendation.

Current recommendation:
- Title: ${recommendation.title}
- Description: ${recommendation.description}
- Full Content: ${recommendation.fullContent}
- Reasoning: ${recommendation.reasoning}

Target: ${recommendation.targetType} (${recommendation.action} action)

Maintain the same:
- Action type (${recommendation.action})
- Target type (${recommendation.targetType})
- General intent of the recommendation

Apply the user's guidance to produce refined versions of:
1. title - Updated title reflecting changes (if applicable)
2. description - Brief summary of what the refined recommendation does
3. fullContent - The complete, production-ready content
4. reasoning - Updated explanation of why this recommendation matters

Return as JSON with these 4 fields.`;

const userPrompt = `
User's refinement request:
"${refinementPrompt}"

Please refine the recommendation according to this guidance.
`;
```

---

## File Changes Required

### New Files

| File | Purpose |
|------|---------|
| `app/api/recommendations/[id]/refine/route.ts` | API endpoint |
| `lib/recommendations/refineRecommendation.ts` | Core refinement logic |
| `components/recommendations/RefinementInput.tsx` | UI component |

### Modified Files

| File | Changes |
|------|---------|
| `app/projects/[id]/research/[runId]/RecommendationsView.tsx` | Add RefinementInput to each card |

---

## Component Hierarchy

```
RecommendationsView
├── Stats section (approved/rejected/pending counts)
├── Apply All Approved button
└── Recommendation Cards (map)
    ├── Status badges
    ├── Title & description
    ├── Content preview / DiffViewer
    ├── Reasoning box
    ├── **RefinementInput** ← NEW
    │   ├── Collapsed toggle
    │   ├── Textarea
    │   ├── Example prompts
    │   └── Refine/Cancel buttons
    └── Approve/Reject buttons
```

---

## State Management

### Per-Recommendation State

```typescript
// In RecommendationsView
const [refiningId, setRefiningId] = useState<string | null>(null);
const [refinementText, setRefinementText] = useState<Record<string, string>>({});
const [expandedRefinement, setExpandedRefinement] = useState<Set<string>>(new Set());
```

### Optimistic Updates

After successful refinement:
1. Update local recommendation state immediately
2. Show "Refined just now" indicator
3. Collapse refinement input
4. User sees updated content and can approve/reject/refine again

---

## Edge Cases & Constraints

### Constraints

1. **Only PENDING recommendations** can be refined
2. **Minimum 10 characters** for refinement prompt
3. **60-second timeout** for GPT-4o call
4. **One refinement at a time** per recommendation (prevent double-clicks)

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Empty prompt | Disable Refine button |
| Network error | Show alert, keep input text |
| GPT-4o timeout | Show timeout error, allow retry |
| Concurrent approve while refining | Check status before saving |
| Very long content | Truncate context if needed |

---

## Success Metrics

1. **Adoption:** % of approved recommendations that were refined first
2. **Iterations:** Average refinements per recommendation before approval
3. **Time savings:** Compare time-to-apply vs. manual corpus editing

---

## Future Enhancements (Out of Scope for V1)

1. **Voice input** - Like profile refinement
2. **Refinement history** - See previous versions
3. **Undo refinement** - Revert to original AI recommendation
4. **Bulk refinement** - Apply same tweak to multiple recommendations
5. **Suggested refinements** - AI-generated improvement suggestions

---

## Open Questions

1. **Should refinement reset confidence score?**
   - Option A: Keep original (user validated the direction)
   - Option B: Reduce slightly (content changed)
   - Option C: Let GPT-4o reassess
   >> option A. confidence score is only there to help the user decide if the rec is worth implementing or not, so if they are interacting with it, the confidence score has already done its job

2. **Track refinement count?**
   - Could add `refinementCount` field to schema
   - Useful for analytics but not essential for V1
   >> no

3. **Character limit on refinement prompt?**
   - Suggest 500 chars max to keep prompts focused
   - Or unlimited and let user be verbose?
   >> let the user go up to 2k but recommend 500 or less to them

---

## Recommendation

Implement V1 with:
- Simple text input (no voice for now)
- Keep original confidence score
- No refinement history tracking
- 500 char soft limit with warning
- Inline collapsible UI (not modal)

This gives users the core value proposition quickly while leaving room for enhancements.
