# Fix: Recommendation Generation for Empty Projects

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-11-11

## Overview

The recommendation generation system currently produces 0 recommendations for empty projects (0 context layers, 0 knowledge files) when it should logically suggest foundational content. This spec defines three targeted fixes to resolve this issue.

## Problem Statement

When a new project with no existing corpus is researched (e.g., "Create a chess learning system"), the recommendation generator returns 0 recommendations instead of suggesting initial context layers and knowledge files. This happens because:

1. **Empty corpus ambiguity**: The GPT-4o prompt presents empty arrays without signaling that empty = needs foundation
2. **Hidden feedback**: The `noRecommendationsReason` field is captured but never displayed to users
3. **No quality filtering**: Low-confidence recommendations aren't filtered, potentially cluttering the UI

## Goals

- Make recommendation generation work correctly for empty projects
- Provide clear feedback when 0 recommendations are generated
- Filter low-confidence recommendations to maintain quality

## Non-Goals

- Complete architectural overhaul (command layer pattern, validation classes)
- MCP server integration for live monitoring
- Batch processing or retry mechanisms
- Performance optimizations beyond filtering
- Enhanced UI features (sorting, filtering, bulk operations)
- Alternative recommendation algorithms
- Corpus similarity metrics or explicit comparison logic

## Technical Approach

Three targeted fixes in existing files:

1. **Empty corpus detection** (`lib/corpusRecommendationGenerator.ts` ~line 75)
   - Add explicit empty corpus handling to the GPT-4o prompt
   - Signal when a project needs foundational content

2. **UI feedback** (`app/projects/[id]/research/[runId]/page.tsx` ~line 120)
   - Display `noRecommendationsReason` when present
   - Show after research findings, before recommendations section

3. **Quality filtering** (`lib/inngest-functions.ts` ~line 155)
   - Filter recommendations with confidence < 0.4
   - Log filtering metrics for debugging

## Implementation Details

### Fix 1: Update GPT-4o Prompt for Empty Corpus

**File:** `lib/corpusRecommendationGenerator.ts`
**Location:** Before the main prompt construction (~line 70)

Add empty corpus detection:

```typescript
// Detect empty corpus
const isEmptyCorpus = currentLayers.length === 0 && currentKnowledgeFiles.length === 0;
const corpusStatusGuidance = isEmptyCorpus
  ? `

CORPUS STATUS: EMPTY PROJECT
This is a new project with NO existing context layers or knowledge files.
Your task is to suggest foundational content to establish a strong starting point.
Be liberal with ADD recommendations - the user can reject what they don't need.
Focus on essential building blocks that any project in this domain would benefit from.
`
  : `

CORPUS STATUS: EXISTING CONTENT
This project has ${currentLayers.length} context layers and ${currentKnowledgeFiles.length} knowledge files.
Review the existing corpus and suggest improvements, additions, or removals based on the research findings.
`;

const prompt = `You are an AI assistant helping to improve a knowledge corpus based on research findings.
${corpusStatusGuidance}
RESEARCH INSTRUCTIONS:
${instructions}

RESEARCH FINDINGS:
${JSON.stringify(researchFindings, null, 2)}

CURRENT CONTEXT LAYERS (${currentLayers.length}):
${currentLayers.length > 0 ? currentLayers.map((l, i) => `${i + 1}. ${l.title} (${l.id})`).join("\n") : "(none)"}

CURRENT KNOWLEDGE FILES (${currentKnowledgeFiles.length}):
${currentKnowledgeFiles.length > 0 ? currentKnowledgeFiles.map((f, i) => `${i + 1}. ${f.title} (${f.id})`).join("\n") : "(none)"}

...`;
```

### Fix 2: Display noRecommendationsReason in UI

**File:** `app/projects/[id]/research/[runId]/page.tsx`
**Location:** After research findings, before recommendations section (~line 143)

Add display of `noRecommendationsReason`:

```tsx
{/* No Recommendations Reason */}
{run.recommendations.length === 0 && run.status === 'COMPLETED' && (() => {
  const researchData = parseResearchData(run.researchData);
  if (researchData?.noRecommendationsReason) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex items-start">
          <svg className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              No Recommendations Generated
            </h3>
            <p className="text-blue-800 text-sm">
              {researchData.noRecommendationsReason}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
})()}
```

### Fix 3: Add Confidence Threshold Filtering

**File:** `lib/inngest-functions.ts`
**Location:** After recommendation generation, before saving (~line 165)

Add confidence filtering:

```typescript
// Generate recommendations
const recommendationsResult = await step.run("generate-recommendations", async () => {
  console.log(`[Recommendation Job ${researchId}] Generating recommendations...`);

  const result = await generateCorpusRecommendations({
    researchFindings: researchRun.researchData as Record<string, unknown>,
    currentLayers: researchRun.project.contextLayers,
    currentKnowledgeFiles: researchRun.project.knowledgeFiles,
    instructions: researchRun.instructions,
  });

  // Filter by confidence threshold
  const MIN_CONFIDENCE = 0.4;
  const filteredRecommendations = result.recommendations.filter(
    rec => rec.confidence >= MIN_CONFIDENCE
  );

  console.log(
    `[Recommendation Job ${researchId}] Generated ${result.recommendations.length} recommendations, ` +
    `filtered to ${filteredRecommendations.length} (min confidence: ${MIN_CONFIDENCE})`
  );

  if (result.noRecommendationsReason) {
    console.log(`[Recommendation Job ${researchId}] No recommendations reason: ${result.noRecommendationsReason}`);
  }

  return {
    ...result,
    recommendations: filteredRecommendations,
  };
});
```

## Testing Approach

### Manual Testing Scenarios

1. **Empty Project Test**
   - Create new project with 0 context layers and 0 knowledge files
   - Start research with instructions (e.g., "Create a chess learning system")
   - Verify: Multiple foundational recommendations generated (not 0)
   - Verify: Recommendations include basic context layers and knowledge files

2. **Existing Project Test**
   - Use project with existing corpus
   - Start research
   - Verify: Recommendations still work as before
   - Verify: Low-confidence (<0.4) recommendations are filtered out

3. **No Recommendations Case**
   - If 0 recommendations generated (rare), verify `noRecommendationsReason` displays in UI
   - Verify: Clear explanation shown to user

### Validation Checks

- TypeScript compilation: `npx tsc --noEmit`
- Server restart: Verify both Next.js and Inngest servers start cleanly
- Console logs: Check Inngest logs for filtering metrics
- UI rendering: Verify no React errors or warnings

## Open Questions

None - implementation is straightforward.

## Future Improvements and Enhancements

These are valuable ideas that go beyond the current scope:

### Enhanced Empty Corpus Detection
- Detect "nearly empty" projects (1-2 items) and provide similar guidance
- Domain-specific foundational templates (e.g., chess, cooking, programming)
- Confidence boost for foundational recommendations in empty projects

### Advanced Quality Filtering
- Dynamic confidence thresholds based on recommendation count
- Filter by impact level (e.g., only show HIGH/MEDIUM impact)
- Configurable filtering preferences per project

### UI Enhancements
- Sort recommendations by confidence or impact
- Filter toggles for action type (ADD/EDIT/DELETE)
- Bulk approval/rejection of recommendations
- Preview changes before applying

### Monitoring and Observability
- MCP server integration for live recommendation pipeline monitoring
- Command pattern for testable, traceable recommendation steps
- Validation layer with detailed error messages
- Metrics dashboard for recommendation acceptance rates

### Corpus Analysis
- Explicit similarity scoring between recommendations and existing content
- Detect duplicate or conflicting recommendations
- Suggest recommendation consolidation
- Coverage analysis (what topics are missing)

### Performance Optimizations
- Batch processing for large recommendation sets
- Retry logic for transient OpenAI API failures
- Caching for repeated research patterns
- Background regeneration when corpus changes significantly

## References

- **Original issue**: Empty project (0 layers, 0 files) generates 0 recommendations
- **Developer Guide**: `/developer-guides/04-recommendation-system-guide.md`
- **Research Workflow**: `/developer-guides/02-research-workflow-guide.md`
- **GPT-4o Structured Outputs**: Using model `gpt-4o-2024-08-06` with strict schema validation
- **Related files**:
  - `lib/corpusRecommendationGenerator.ts` (recommendation extraction)
  - `lib/inngest-functions.ts` (background job orchestration)
  - `app/projects/[id]/research/[runId]/page.tsx` (UI display)
