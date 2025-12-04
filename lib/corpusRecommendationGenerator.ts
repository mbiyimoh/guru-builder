/**
 * Corpus Recommendation Generator
 *
 * Generates recommendations for improving the knowledge corpus based on research findings
 */

import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { RESEARCH_MODEL } from './assessment/constants';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Schema for corpus recommendations
const corpusRecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      action: z.enum(["ADD", "EDIT", "DELETE"]),
      targetType: z.enum(["LAYER", "KNOWLEDGE_FILE"]),
      targetId: z.string().nullable(),
      title: z.string(),
      description: z.string(),
      fullContent: z.string(),
      reasoning: z.string(),
      confidence: z.number().min(0).max(1),
      impactLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
    })
  ),
  noRecommendationsReason: z.string().nullable().optional(),
});

export interface CorpusItem {
  id: string;
  title: string;
  content: string;
}

export interface GenerateCorpusRecommendationsOptions {
  researchFindings: Record<string, unknown>;
  currentLayers: CorpusItem[];
  currentKnowledgeFiles: CorpusItem[];
  instructions: string;
}

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

export type CorpusRecommendationsResult = {
  recommendations: CorpusRecommendation[];
  noRecommendationsReason?: string | null;
};

/**
 * Generate corpus improvement recommendations from research findings
 */
export async function generateCorpusRecommendations(
  options: GenerateCorpusRecommendationsOptions
): Promise<CorpusRecommendationsResult> {
  const { researchFindings, currentLayers, currentKnowledgeFiles, instructions } = options;

  try {
    // Detect empty corpus and provide appropriate guidance
    const isEmptyCorpus = currentLayers.length === 0 && currentKnowledgeFiles.length === 0;

    // Add telemetry logging
    if (isEmptyCorpus) {
      console.log(`[Corpus Recommendations] Empty corpus detected - will generate foundational recommendations`);
    } else {
      console.log(`[Corpus Recommendations] Existing corpus: ${currentLayers.length} layers, ${currentKnowledgeFiles.length} files`);
    }

    const corpusStatusGuidance = isEmptyCorpus
      ? `

CORPUS STATUS: EMPTY PROJECT
This is a new project with NO existing context layers or knowledge files.
Your task is to suggest foundational content to establish a strong starting point.

GUIDANCE FOR EMPTY PROJECTS:
1. Context Layers: Suggest 2-4 essential layers that define the domain
   - Examples: "Domain Overview", "Key Concepts", "Terminology", "Best Practices"
2. Knowledge Files: Suggest 3-6 foundational documents based on research findings
   - Examples: Getting started guides, reference materials, tutorials, FAQs
3. Be liberal with ADD recommendations - the user can reject what they don't need
4. Focus on essential building blocks that any project in this domain would benefit from
5. Use HIGH impact level for foundational content

IMPORTANT: Empty project means you SHOULD generate recommendations. Generate at least 4-6 foundational items.
`
      : `

CORPUS STATUS: EXISTING CONTENT
This project has ${currentLayers.length} context layers and ${currentKnowledgeFiles.length} knowledge files.
Review the existing corpus and suggest improvements, additions, or removals based on the research findings.
Be selective - only suggest changes that add clear value based on the research.
`;

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

Focus on high-quality, transformative recommendations that elevate the guru's capabilities.

IMPORTANT: If you determine that NO recommendations should be made (empty array), you MUST provide a clear explanation in the 'noRecommendationsReason' field explaining why the research findings do not warrant any changes to the existing corpus. Be specific about what was analyzed and why it doesn't require corpus updates.`;

    // Log the full prompt for debugging
    console.log(`[Corpus Recommendations] === PROMPT START ===`);
    console.log(prompt);
    console.log(`[Corpus Recommendations] === PROMPT END ===`);
    console.log(`[Corpus Recommendations] Prompt length: ${prompt.length} characters`);

    const completion = await openai.chat.completions.create({
      model: RESEARCH_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert knowledge engineer who improves AI knowledge bases with research-backed recommendations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema" as const,
        json_schema: {
          name: "corpus_recommendations",
          schema: zodResponseFormat(corpusRecommendationSchema, "corpus_recommendations").json_schema.schema,
          strict: true,
        },
      },
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      console.error("[Corpus Recommendations] No content in response");
      return { recommendations: [] };
    }

    // Log raw response for debugging
    console.log(`[Corpus Recommendations] === RAW GPT-4o RESPONSE START ===`);
    console.log(content);
    console.log(`[Corpus Recommendations] === RAW GPT-4o RESPONSE END ===`);
    console.log(`[Corpus Recommendations] Response length: ${content.length} characters`);

    const parsed = corpusRecommendationSchema.parse(JSON.parse(content));

    // Log parsed result
    console.log(`[Corpus Recommendations] Parsed ${parsed.recommendations.length} recommendations`);
    if (parsed.recommendations.length > 0) {
      console.log(`[Corpus Recommendations] Sample recommendations:`,
        parsed.recommendations.slice(0, 3).map(r => ({
          action: r.action,
          type: r.targetType,
          title: r.title,
          confidence: r.confidence
        }))
      );
    }
    if (parsed.noRecommendationsReason) {
      console.log(`[Corpus Recommendations] No recommendations reason: ${parsed.noRecommendationsReason}`);
    }

    return {
      recommendations: parsed.recommendations,
      noRecommendationsReason: parsed.noRecommendationsReason,
    };
  } catch (error) {
    console.error("[Corpus Recommendations] Error generating:", error);
    return { recommendations: [] };
  }
}
