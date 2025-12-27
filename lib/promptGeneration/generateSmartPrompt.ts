import OpenAI from 'openai';

// Lazy initialization - only create client when needed (not at import time)
// This prevents build failures when OPENAI_API_KEY isn't available during Docker build
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

export interface ProfilePromptContext {
  fieldKey: string;
  fieldLabel: string;
  currentValue: string | string[] | null;
  lightAreas: string[];
  domainExpertise: string;
  audienceLevel: string;
}

export interface ResearchPromptContext {
  gapName: string;
  dimensionDescription: string;
  isCritical: boolean;
  existingCorpusSummary: string;
}

export async function generateProfilePrompt(context: ProfilePromptContext): Promise<string> {
  const { fieldLabel, currentValue, domainExpertise, audienceLevel } = context;

  const currentValueStr = Array.isArray(currentValue)
    ? currentValue.join(', ')
    : currentValue || 'not specified';

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `Generate a concise, helpful prompt (2-3 sentences) for a user to improve their AI teaching assistant profile. The prompt should:
- Reference what was already inferred (if any)
- Ask specific questions to get better information
- Be conversational and encouraging
Do NOT include any preamble - just output the prompt text.`
        },
        {
          role: 'user',
          content: `Field to improve: "${fieldLabel}"
Current value: "${currentValueStr}"
Domain: ${domainExpertise}
Audience: ${audienceLevel}
This field was inferred with lower confidence.

Generate a prompt to help the user provide better details.`
        }
      ]
    });

    return response.choices[0]?.message?.content?.trim() || getFallbackProfilePrompt(fieldLabel, currentValueStr);
  } catch (error) {
    console.error('Failed to generate smart profile prompt:', error);
    return getFallbackProfilePrompt(fieldLabel, currentValueStr);
  }
}

function getFallbackProfilePrompt(fieldLabel: string, currentValue: string): string {
  if (currentValue && currentValue !== 'not specified') {
    return `I'd like to expand on ${fieldLabel.toLowerCase()}. You mentioned "${currentValue}" - could you tell me more about this?`;
  }
  return `I want to provide more details about ${fieldLabel.toLowerCase()}. `;
}

export async function generateResearchPrompt(context: ResearchPromptContext): Promise<string> {
  const { gapName, dimensionDescription, isCritical, existingCorpusSummary } = context;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `Generate a focused research instruction (2-3 sentences) for building an AI teaching assistant's knowledge base. The instruction should:
- Reference the specific knowledge gap
- Suggest what kind of information to look for
- Be actionable and specific
Do NOT include any preamble - just output the research instruction.`
        },
        {
          role: 'user',
          content: `Knowledge gap: "${gapName}"
Description: ${dimensionDescription}
Priority: ${isCritical ? 'Critical - blocks readiness' : 'Suggested improvement'}
Current corpus: ${existingCorpusSummary || 'Empty - no content yet'}

Generate a research instruction to address this gap.`
        }
      ]
    });

    return response.choices[0]?.message?.content?.trim() || getFallbackResearchPrompt(gapName);
  } catch (error) {
    console.error('Failed to generate smart research prompt:', error);
    return getFallbackResearchPrompt(gapName);
  }
}

function getFallbackResearchPrompt(gapName: string): string {
  return `I want to research ${gapName.toLowerCase()} to improve my teaching assistant's knowledge.`;
}
