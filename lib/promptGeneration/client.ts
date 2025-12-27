/**
 * Client-side wrapper for prompt generation
 * Calls the server-side API route instead of using OpenAI directly
 */

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
  try {
    const response = await fetch('/api/prompts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'profile', context }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate prompt');
    }

    const data = await response.json();
    return data.prompt;
  } catch (error) {
    console.error('Failed to generate profile prompt:', error);
    // Fallback to generic prompt
    const currentValueStr = Array.isArray(context.currentValue)
      ? context.currentValue.join(', ')
      : context.currentValue || 'not specified';

    if (currentValueStr && currentValueStr !== 'not specified') {
      return `I'd like to expand on ${context.fieldLabel.toLowerCase()}. You mentioned "${currentValueStr}" - could you tell me more about this?`;
    }
    return `I want to provide more details about ${context.fieldLabel.toLowerCase()}. `;
  }
}

export async function generateResearchPrompt(context: ResearchPromptContext): Promise<string> {
  try {
    const response = await fetch('/api/prompts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'research', context }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate prompt');
    }

    const data = await response.json();
    return data.prompt;
  } catch (error) {
    console.error('Failed to generate research prompt:', error);
    // Fallback to generic prompt
    return `I want to research ${context.gapName.toLowerCase()} to improve my teaching assistant's knowledge.`;
  }
}
