# Feature: Recommendation Description and Full Content Fields

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-11-12

## Overview

Separate the recommendation data model into `description` (what's changing and why) and `fullContent` (the complete, LLM-optimized text to insert into the corpus). This fixes a critical misalignment where change descriptions are currently being inserted into the corpus as if they were the actual content.

## Problem Statement

Currently, the `Recommendation.content` field contains a brief description of proposed changes ("Add a context layer about X strategy"), but `applyRecommendations.ts` uses this field directly as the actual corpus content. This means change descriptions—not actual content—get inserted into context layers and knowledge files.

**User Impact:** Users cannot preview the exact content that will be added to their corpus before approving recommendations, and the content being generated may not be optimized for LLM consumption following the "guru" philosophy.

**Core Issue:** Schema field naming doesn't match its usage, and there's no field for the full, production-ready content.

## Goals

1. Rename `Recommendation.content` → `description` to match its actual usage
2. Add new `Recommendation.fullContent` field for complete, ready-to-apply content
3. **Update GPT-4o prompt to generate exceptional, LLM-optimized full content** that follows guru principles
4. Update `applyRecommendations.ts` to use `fullContent` instead of `description`
5. Update UI to show both description (summary) and expandable full content preview

## Non-Goals

- In-browser content editing (users can reject/approve, but not edit inline)
- Diff visualization library integration (will use simple before/after display for EDIT operations)
- Content regeneration on-demand (content generated once during recommendation creation)
- Multi-stage approval workflows
- Content versioning beyond what snapshots already provide
- Advanced content validation or quality scoring
- Integration with external content management systems

## Technical Approach

### High-Level Flow

1. **Schema Migration**: Rename `content` → `description`, add `fullContent` field
2. **Prompt Engineering** (CRITICAL): Craft thoughtful prompt that generates guru-quality content
3. **Generator Update**: Update `corpusRecommendationGenerator.ts` schema and types
4. **Application Update**: Modify `applyRecommendations.ts` to use `fullContent`
5. **UI Enhancement**: Show description + expandable full content preview

### Key Files to Modify

- `prisma/schema.prisma` - Database schema
- `lib/corpusRecommendationGenerator.ts` - Recommendation generation with enhanced prompt
- `lib/applyRecommendations.ts` - Application logic
- `lib/inngest-functions.ts` - Type references
- `app/projects/[id]/research/[runId]/RecommendationsView.tsx` - UI display

### External Libraries

None required for core functionality.

### Integration Points

- **Database**: Prisma migration to rename/add fields
- **OpenAI API**: Enhanced prompt in structured outputs request
- **Existing Recommendations**: Data migration for any existing recommendations (likely none in production)

## Implementation Details

### 1. Database Schema Changes

**File:** `prisma/schema.prisma`

```prisma
model Recommendation {
  id               String               @id @default(cuid())
  researchRunId    String

  // Recommendation type and target
  action           RecommendationAction
  targetType       TargetType
  targetId         String?

  // Recommendation content
  title            String
  description      String               @db.Text  // RENAMED: Brief summary of what's changing
  fullContent      String               @db.Text  // NEW: Complete, production-ready content
  reasoning        String               @db.Text

  // Metadata...
  confidence       Float
  impactLevel      ImpactLevel
  priority         Int
  status           RecommendationStatus @default(PENDING)

  // Timestamps and relations...
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_full_content_to_recommendations
```

### 2. Enhanced Prompt Engineering (CRITICAL)

**File:** `lib/corpusRecommendationGenerator.ts`

This is the most important part of the implementation. The prompt must guide GPT-4o to generate content that:
- Follows the "guru" philosophy (instructional vs informational)
- Is optimized for LLM context window consumption
- Distinguishes between context layers (protocols/directives) and knowledge files (reference content)
- Is concise yet comprehensive
- Uses clear, actionable language

**Key Prompt Sections:**

```typescript
const GURU_CONTENT_GUIDELINES = `
## Content Generation Guidelines

You are generating content for an AI "guru" system—a knowledge corpus optimized for LLM consumption.

### Understanding Content Types

**CONTEXT LAYERS** (Instructional/Behavioral):
- Define HOW the AI should think, behave, and respond
- Contain protocols, decision frameworks, and reasoning patterns
- Use directive language: "You are...", "When X, do Y", "Always consider..."
- Include example outputs and tone guidance
- Reference other layers and knowledge files when appropriate
- Length: 200-600 words typically

**Example Context Layer Pattern:**
"You are a [domain] expert who [role]. Your primary responsibility is to [core task].

When [situation], you should [directive] because [reasoning].

Protocol:
1. [Step one]
2. [Step two]
3. [Step three]

Tone: [Description of desired tone and approach]

Example: [Concrete example of desired output]"

**KNOWLEDGE FILES** (Reference/Informational):
- Contain detailed INFORMATION that gets loaded conditionally
- Provide comprehensive reference materials, examples, exercises
- Use informational language: "This is...", "The key concepts are...", "Examples include..."
- Structured with clear sections, examples, and practical details
- Length: 500-2000 words typically

**Example Knowledge File Pattern:**
"# [Topic] Guide

## Overview
[Brief introduction to the topic]

## Key Concepts
1. **[Concept]**: [Explanation]
2. **[Concept]**: [Explanation]

## Examples
- [Example with context]
- [Example with context]

## Practical Applications
[How to apply these concepts]

## Common Patterns
[Recognizable patterns to look for]"

### Critical Requirements for fullContent

1. **Purpose-Driven**: Content must serve the guru's instructional goals
2. **LLM-Optimized**: Written to be effective when loaded into context windows
3. **Actionable**: Protocols and directives, not passive descriptions
4. **Concise**: Information-dense without unnecessary verbosity
5. **Well-Structured**: Clear hierarchy, sections, and formatting
6. **Markdown Formatted**: Proper headings, lists, code blocks, emphasis
7. **Cross-Referenced**: Mention related layers/files when appropriate

### What to AVOID

❌ Generic summaries without actionable guidance
❌ Overly academic or theoretical content without practical application
❌ Redundant content that duplicates existing layers/files
❌ Vague directives without clear examples
❌ Content that treats the AI as a passive database vs. active reasoner
`;

const prompt = `You are an expert knowledge engineer creating content for an AI "guru" system.

${GURU_CONTENT_GUIDELINES}

${corpusStatusGuidance}

RESEARCH INSTRUCTIONS:
${instructions}

RESEARCH FINDINGS:
${JSON.stringify(researchFindings, null, 2)}

CURRENT CONTEXT LAYERS (${currentLayers.length}):
${currentLayers.length > 0 ? currentLayers.map((l, i) => `${i + 1}. ${l.title} (${l.id})`).join("\n") : "(none)"}

CURRENT KNOWLEDGE FILES (${currentKnowledgeFiles.length}):
${currentKnowledgeFiles.length > 0 ? currentKnowledgeFiles.map((f, i) => `${i + 1}. ${f.title} (${f.id})`).join("\n") : "(none)"}

## Your Task

Generate recommendations for improving this guru's corpus based on the research findings.

For each recommendation:

1. **action**: ADD, EDIT, or DELETE
2. **targetType**: LAYER (for protocols/directives) or KNOWLEDGE_FILE (for reference content)
3. **targetId**: The ID if editing/deleting, null if adding
4. **title**: Clear, concise title (5-10 words)
5. **description**: 1-3 sentence summary of WHAT is changing and WHY it matters
6. **fullContent**: The COMPLETE, PRODUCTION-READY content to insert into the corpus
   - For LAYERS: Follow the Context Layer pattern above
   - For KNOWLEDGE_FILES: Follow the Knowledge File pattern above
   - Must be exceptional quality, ready to use immediately
   - Optimized for LLM consumption
   - 200-2000 words depending on type and complexity
7. **reasoning**: Detailed justification connecting research findings to this recommendation
8. **confidence**: 0.0 to 1.0
9. **impactLevel**: LOW, MEDIUM, or HIGH

## Quality Standards for fullContent

- **Context Layers**: Must be directive and behavioral, not just informative
- **Knowledge Files**: Must be comprehensive and well-structured reference material
- **Both**: Must follow guru philosophy of teaching the AI HOW to think, not just WHAT to know
- **Markdown**: Proper formatting with headings, lists, emphasis, code blocks
- **Concise**: Information-dense, no fluff
- **Actionable**: Practical and immediately useful when loaded into LLM context

Focus on high-quality, transformative recommendations that elevate the guru's capabilities.`;
```

### 3. Zod Schema Update

```typescript
const corpusRecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      action: z.enum(["ADD", "EDIT", "DELETE"]),
      targetType: z.enum(["LAYER", "KNOWLEDGE_FILE"]),
      targetId: z.string().nullable(),
      title: z.string(),
      description: z.string(),      // What's changing (brief)
      fullContent: z.string(),       // Complete content to apply
      reasoning: z.string(),
      confidence: z.number().min(0).max(1),
      impactLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
    })
  ),
  noRecommendationsReason: z.string().nullable().optional(),
});

export type CorpusRecommendation = {
  action: "ADD" | "EDIT" | "DELETE";
  targetType: "LAYER" | "KNOWLEDGE_FILE";
  targetId: string | null;
  title: string;
  description: string;
  fullContent: string;
  reasoning: string;
  confidence: number;
  impactLevel: "LOW" | "MEDIUM" | "HIGH";
};
```

### 4. Application Logic Update

**File:** `lib/applyRecommendations.ts`

```typescript
async function applySingleRecommendationWithTx(
  tx: Prisma.TransactionClient,
  recommendation: {
    id: string;
    action: string;
    targetType: string;
    targetId: string | null;
    title: string;
    fullContent: string;  // CHANGED from "content"
    researchRun: {
      projectId: string;
    };
  },
  snapshotId: string
) {
  const { action, targetType, targetId, title, fullContent, researchRun } = recommendation;
  const projectId = researchRun.projectId;

  if (targetType === "LAYER") {
    if (action === "ADD") {
      const layer = await tx.contextLayer.create({
        data: {
          projectId,
          title,
          content: fullContent,  // Use fullContent for actual corpus
          priority: 999,
          isActive: true,
        },
      });
      // ... logging
    } else if (action === "EDIT" && targetId) {
      const updated = await tx.contextLayer.update({
        where: { id: targetId },
        data: {
          title,
          content: fullContent,  // Use fullContent for actual corpus
        },
      });
      // ... logging
    }
    // ... DELETE case
  }
  // Similar for KNOWLEDGE_FILE...
}
```

### 5. UI Enhancement

**File:** `app/projects/[id]/research/[runId]/RecommendationsView.tsx`

```tsx
<div className="flex-1">
  {/* Title and metadata badges */}
  <div className="flex items-center gap-2 mb-2">
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${actionColors[rec.action]}`}>
      {rec.action}
    </span>
    <span className="text-sm text-gray-500">{rec.targetType}</span>
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${impactColors[rec.impactLevel]}`}>
      {rec.impactLevel}
    </span>
    <span className="text-sm text-gray-500">
      Confidence: {(rec.confidence * 100).toFixed(0)}%
    </span>
  </div>

  <h3 className="text-lg font-medium text-gray-900 mb-2">{rec.title}</h3>

  {/* Description - always visible */}
  <p className="text-gray-700 mb-3">{rec.description}</p>

  {/* Full Content Preview - expandable */}
  <details className="mb-3">
    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium text-sm">
      View Full {rec.action === 'EDIT' ? 'Proposed Changes' : 'Content'}
      ({Math.ceil(rec.fullContent.length / 1000)}k characters)
    </summary>
    <div className="mt-3 p-4 bg-gray-50 rounded-md border border-gray-200 max-h-96 overflow-y-auto">
      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
        {rec.fullContent}
      </pre>
    </div>
  </details>

  {/* Reasoning */}
  <div className="bg-gray-50 p-3 rounded-md">
    <p className="text-sm text-gray-600">
      <span className="font-medium">Reasoning:</span> {rec.reasoning}
    </p>
  </div>
</div>
```

## Testing Approach

### Key Scenarios

1. **Empty Project Test**
   - Create new project with 0 layers/files
   - Run research on a topic (e.g., "Create a chess coaching system")
   - Verify recommendations contain both `description` and `fullContent`
   - Verify `fullContent` follows guru patterns (directive for layers, informational for files)
   - Expand full content preview in UI
   - Approve recommendations and apply
   - Verify applied content in corpus matches `fullContent` field

2. **Existing Project Test**
   - Project with existing layers/files
   - Run research
   - Verify EDIT recommendations show description
   - Expand full content to see proposed new version
   - Apply and verify changes

3. **Content Quality Test**
   - Review generated `fullContent` for:
     - Proper markdown formatting
     - Appropriate length (not too brief, not bloated)
     - Matches content type (directive for layers, informational for files)
     - Clear structure and actionable content

### Manual Validation

- TypeScript compilation: `npx tsc --noEmit`
- Database migration applies cleanly
- UI renders expandable content correctly
- Applied content matches previewed content

## User Experience

### Before (Current)

1. User sees recommendation with brief description
2. User approves without seeing actual content
3. Brief description gets inserted into corpus (WRONG)

### After (Improved)

1. User sees recommendation with:
   - Title
   - Description (1-3 sentence summary)
   - Expandable "View Full Content" section
   - Reasoning
2. User can expand to preview exact content before approving
3. User approves/rejects based on full preview
4. Full content gets applied to corpus (CORRECT)

## Migration/Rollout

### Database Migration

```sql
-- Step 1: Rename content to description
ALTER TABLE "Recommendation" RENAME COLUMN "content" TO "description";

-- Step 2: Add fullContent (temporarily nullable for migration)
ALTER TABLE "Recommendation" ADD COLUMN "fullContent" TEXT;

-- Step 3: For any existing recommendations, copy description to fullContent as placeholder
UPDATE "Recommendation" SET "fullContent" = "description" WHERE "fullContent" IS NULL;

-- Step 4: Make fullContent required
ALTER TABLE "Recommendation" ALTER COLUMN "fullContent" SET NOT NULL;
```

**Note:** In practice, there are likely no production recommendations yet, so this migration is straightforward.

### Rollout Plan

1. Apply schema migration
2. Deploy code changes
3. Test with new research run
4. Verify full content quality
5. Iterate on prompt if needed

## Open Questions

1. **Minimum content length?** Should we enforce minimum character counts for `fullContent` to ensure quality?
   - **Decision**: Start without enforced minimums, rely on prompt guidance and GPT-4o quality

2. **Content validation?** Should we validate markdown syntax or content structure?
   - **Decision**: No validation initially; GPT-4o with strict schema should be reliable

3. **Prompt iteration process?** How do we improve the prompt based on real-world results?
   - **Decision**: Monitor first 5-10 research runs, collect feedback, iterate prompt as needed

## Future Improvements and Enhancements

### Enhanced Preview Features
- Rich markdown rendering in preview (not just plaintext in `<pre>`)
- Side-by-side diff view for EDIT operations using a library like `react-diff-viewer`
- Syntax highlighting for code blocks in content
- Collapsible sections for long content

### Content Editing
- Inline content editing before approval
- "Regenerate content" button to get alternative versions
- AI-assisted content refinement ("make this more concise")
- Template-based content generation for common patterns

### Advanced Prompt Engineering
- Domain-specific prompt customization per project
- Learning from user approval/rejection patterns to improve prompts
- A/B testing different prompt variants
- Prompt versioning and rollback

### Content Quality Enhancements
- Automated content quality scoring (readability, structure, completeness)
- Content length recommendations based on content type
- Duplicate content detection across corpus
- Cross-reference validation (ensuring referenced files exist)

### UI/UX Improvements
- Bulk preview mode (expand all content at once)
- Content search/filter in recommendations list
- Export recommendations to markdown for review
- Print-friendly recommendation reports
- Mobile-optimized preview UI

### Performance Optimizations
- Lazy-load full content (don't fetch until user expands)
- Content compression for large recommendations
- Virtualized list rendering for many recommendations
- Incremental content generation for very long pieces

### Analytics and Monitoring
- Track average `fullContent` length by type
- Measure user approval rates by content length/quality
- Monitor GPT-4o token usage for content generation
- A/B test prompt variations with success metrics

### Advanced Content Types
- Support for diagrams/visualizations in content
- Code snippet execution examples
- Interactive content elements
- Multi-language content support

## References

- **Original Guru Philosophy**: `project-context/guru-builder-system.md`
- **Backgammon Examples**: `context-and-knowledge-layers-111025/`
- **Current Recommendation System**: `developer-guides/04-recommendation-system-guide.md`
- **Fix Empty Project Spec**: `specs/fix-empty-project-recommendations-lean.md`
- **OpenAI Structured Outputs**: https://platform.openai.com/docs/guides/structured-outputs
