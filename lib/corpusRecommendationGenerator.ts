/**
 * Corpus Recommendation Generator
 *
 * Generates recommendations for improving the knowledge corpus based on research findings
 */

import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

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
      content: z.string(),
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
  content: string;
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

Based on the research findings, generate recommendations to improve the corpus. You can:
- ADD new context layers or knowledge files
- EDIT existing ones (provide targetId and new content)
- DELETE outdated ones (provide targetId)

For each recommendation:
1. Determine the action (ADD/EDIT/DELETE)
2. Specify if it's a LAYER or KNOWLEDGE_FILE
3. Provide the targetId if editing/deleting (use null for ADD)
4. Write a clear title and content
5. Explain your reasoning
6. Rate your confidence (0.0 to 1.0)
7. Assess impact level (LOW/MEDIUM/HIGH)

Focus on high-quality, actionable recommendations that directly address the research findings.

IMPORTANT: If you determine that NO recommendations should be made (empty array), you MUST provide a clear explanation in the 'noRecommendationsReason' field explaining why the research findings do not warrant any changes to the existing corpus. Be specific about what was analyzed and why it doesn't require corpus updates.`;

    // Log the full prompt for debugging
    console.log(`[Corpus Recommendations] === PROMPT START ===`);
    console.log(prompt);
    console.log(`[Corpus Recommendations] === PROMPT END ===`);
    console.log(`[Corpus Recommendations] Prompt length: ${prompt.length} characters`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
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
