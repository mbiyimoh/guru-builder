// lib/assessment/contextComposer.ts

import { prisma } from '@/lib/db'
import { OPENING_POSITION, BackgammonBoard } from './types'
import { renderOpeningBoard } from './asciiBoard'

export interface AssessmentContextResult {
  systemPrompt: string
  layerCount: number
}

export function composeBoardStatePrompt(
  dice: [number, number],
  board: BackgammonBoard = OPENING_POSITION,
  positionName: string = 'Standard Opening Position'
): string {
  const asciiBoard = renderOpeningBoard(dice)

  return `
---

# CURRENT POSITION - ASSESSMENT MODE

## Board State (Structured Data)
\`\`\`json
{
  "position": "${positionName}",
  "player_to_move": "Black",
  "dice_roll": [${dice[0]}, ${dice[1]}],
  "checkers": {
    "black": ${JSON.stringify(board.x)},
    "white": ${JSON.stringify(board.o)}
  }
}
\`\`\`

## Visual Representation
\`\`\`
${asciiBoard}
\`\`\`

## Your Task
Analyze the position above and recommend the best move(s) for Black with dice roll ${dice[0]}-${dice[1]}.

**Requirements:**
1. Specify exact checker movements (e.g., "8/5, 6/5" or "13/10, 24/21")
2. Explain the strategic reasoning based on your knowledge base
3. Reference specific principles that justify your choice
4. Consider alternative moves and why they're inferior

IMPORTANT: You CAN see the complete board state above. Use this information in your analysis.
`.trim()
}

export async function composeAssessmentContext(
  projectId: string,
  diceRoll: string
): Promise<AssessmentContextResult> {
  const layers = await prisma.contextLayer.findMany({
    where: { projectId, isActive: true },
    orderBy: { priority: 'asc' },
    select: { title: true, content: true },
  })

  if (layers.length === 0) {
    throw new Error('No active context layers found. Cannot assess guru without knowledge.')
  }

  let systemPrompt = `# BACKGAMMON GURU KNOWLEDGE BASE\n\n`

  layers.forEach((layer) => {
    systemPrompt += `## ${layer.title}\n\n`
    systemPrompt += `${layer.content}\n\n---\n\n`
  })

  // CRITICAL FIX: Inject actual board state instead of generic text
  const dice = diceRoll.split('-').map(Number) as [number, number]
  systemPrompt += '\n\n' + composeBoardStatePrompt(dice)

  return {
    systemPrompt,
    layerCount: layers.length,
  }
}
