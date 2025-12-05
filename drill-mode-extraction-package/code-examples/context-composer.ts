// @ts-nocheck
// ⚠️ COPY-PASTE EXAMPLE - This file is meant to be copied to your project
// It will not compile in isolation. See INTEGRATION_GUIDE.md for setup instructions.

// lib/contextComposer.ts
// Core context composition system - assembles multi-layer context + drill-specific prompts

import { prisma } from './db'
import { DrillContext, ContextWithMetadata, ContextLayerMetadata } from './types'

const DEFAULT_CONTEXT = `
You are a backgammon coach. Provide strategic advice based on general backgammon principles.
When no custom context is provided, use general backgammon knowledge.
`.trim()

/**
 * Compose system prompt from active context layers
 * Used by: Chat API for both open and drill modes
 */
export async function composeContextFromLayers(
  projectId: string,
  layerIds?: string[]
): Promise<string> {
  try {
    const layers = await prisma.contextLayer.findMany({
      where: {
        projectId,
        isActive: true,
        ...(layerIds && layerIds.length > 0 ? { id: { in: layerIds } } : {}),
      },
      orderBy: { priority: 'asc' },  // Lower priority = first in prompt
    })

    if (layers.length === 0) {
      console.warn('[composeContextFromLayers] No active layers, using default context')
      return DEFAULT_CONTEXT
    }

    let prompt = '# CONTEXT LAYERS\n\n'
    prompt += 'The following layers inform your coaching style and knowledge:\n\n'

    layers.forEach((layer, idx) => {
      prompt += `## Layer ${idx + 1}: ${layer.name}\n\n`
      prompt += `${layer.content}\n\n`
      prompt += '---\n\n'
    })

    prompt += '\nAnswer the user\'s question based on the context layers above. '
    prompt += 'Reference specific principles from the layers when relevant.\n'

    return prompt
  } catch (error) {
    console.error('[composeContextFromLayers] Error:', error)
    return DEFAULT_CONTEXT  // Graceful degradation
  }
}

/**
 * Compose context with metadata for audit trails
 * Returns both prompt and layer metadata for transparency
 */
export async function composeContextWithMetadata(
  projectId: string,
  layerIds?: string[]
): Promise<ContextWithMetadata> {
  try {
    const layers = await prisma.contextLayer.findMany({
      where: {
        projectId,
        isActive: true,
        ...(layerIds && layerIds.length > 0 ? { id: { in: layerIds } } : {}),
      },
      orderBy: { priority: 'asc' },
    })

    if (layers.length === 0) {
      return {
        prompt: DEFAULT_CONTEXT,
        layers: [],
      }
    }

    let prompt = '# CONTEXT LAYERS\n\n'
    prompt += 'The following layers inform your coaching style and knowledge:\n\n'

    const layerMetadata: ContextLayerMetadata[] = []

    layers.forEach((layer, idx) => {
      prompt += `## Layer ${idx + 1}: ${layer.name}\n\n`
      prompt += `${layer.content}\n\n`
      prompt += '---\n\n'

      layerMetadata.push({
        id: layer.id,
        name: layer.name,
        priority: layer.priority,
        contentLength: layer.content.length,
      })
    })

    prompt += '\nAnswer the user\'s question based on the context layers above. '
    prompt += 'Reference specific principles from the layers when relevant.\n'

    return {
      prompt,
      layers: layerMetadata,
    }
  } catch (error) {
    console.error('[composeContextWithMetadata] Error:', error)
    return {
      prompt: DEFAULT_CONTEXT,
      layers: [],
    }
  }
}

/**
 * Compose drill-specific system prompt
 * Appends drill context to base layers for focused practice
 */
export function composeDrillSystemPrompt(drillContext: DrillContext): string {
  const { drill, hintsUsedCount } = drillContext
  const boardSummary = drill.boardSetup.summary

  return `
---

# DRILL MODE ACTIVE

You are helping the user practice this specific backgammon position:

**Position**: ${boardSummary}
**To Play**: ${drill.toPlay.charAt(0).toUpperCase() + drill.toPlay.slice(1)}
**Roll**: ${drill.roll.join('-')}
**Question**: ${drill.question}

**Core Principle**: ${drill.principle}

**Available Moves**:
${drill.options
  .map(
    (opt, idx) =>
      `${idx + 1}. ${opt.move} ${opt.isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}
   ${opt.explanation}`
  )
  .join('\n\n')}

**Progressive Hints Available** (${hintsUsedCount}/${drill.hintsAvailable.length} used):
${drill.hintsAvailable
  .map((hint, idx) => {
    const hintNum = idx + 1
    if (idx < hintsUsedCount) {
      return `${hintNum}. [ALREADY PROVIDED] ${hint}`
    } else if (idx === hintsUsedCount) {
      return `${hintNum}. [NEXT HINT] ${hint}`
    } else {
      return `${hintNum}. [NOT YET PROVIDED]`
    }
  })
  .join('\n')}

---

## Your Role in Drill Mode

**When user selects a move** (e.g., "I choose option A" or "I choose option 2"):
- Tell them if it's correct or incorrect
- Provide the explanation for their choice
- Reference the core principle
- Encourage them or guide them to think more

**When user asks "hint" or "I'm stuck"**:
- If JSON hints remain: Provide the NEXT hint from the list above
  - Add label: "(Hint from training material)"
- If all JSON hints exhausted: Generate a helpful Socratic hint based on the principle
  - Add label: "(AI-generated hint)"
- Don't reveal the answer directly

**When user asks for explanation or "show answer"**:
- Explain why the correct move is best
- Reference the principle
- Compare with other options if relevant

**When user wants open discussion**:
- Discuss related strategy, alternative scenarios, or concepts
- Stay grounded in this position but can broaden if they ask

**Important**:
- Be concise and focused (mobile-friendly)
- Use short paragraphs
- Always reference the principle when explaining
- Adapt tone to be encouraging and educational
`.trim()
}
