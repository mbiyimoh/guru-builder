/**
 * Ground Truth Module - Prompt Builder
 *
 * Builds prompts with verification instructions for ground truth-enabled
 * artifact generation. Adds tool descriptions and verification workflow
 * guidance to existing prompts.
 */

import { GROUND_TRUTH_TOOLS } from './tools'
import type { GroundTruthConfig } from './types'

/**
 * Build drill generation prompt with ground truth verification instructions.
 *
 * Enhances the base prompt with:
 * - Tool descriptions and usage guidelines
 * - Verification workflow instructions
 * - Best practices for using engine recommendations
 *
 * @param basePrompt - Original system or user prompt
 * @param config - Ground truth configuration (for context)
 * @returns Enhanced prompt with verification instructions
 *
 * @example
 * const enhanced = buildDrillPromptWithVerification(
 *   "Generate backgammon drills...",
 *   config
 * )
 * // Enhanced prompt includes tool descriptions and verification workflow
 */
export function buildDrillPromptWithVerification(
  basePrompt: string,
  config: GroundTruthConfig
): string {
  const verificationInstructions = `
## Ground Truth Verification

You have access to a backgammon engine for verifying positions and moves.

### Available Tools

${GROUND_TRUTH_TOOLS.map(t => `**${t.function.name}**
${t.function.description}

Parameters:
${Object.entries(t.function.parameters.properties || {}).map(([key, value]: [string, any]) =>
  `- \`${key}\` (${value.type}): ${value.description}`
).join('\n')}
`).join('\n')}

### Verification Workflow

IMPORTANT: Before recommending any specific move for a position:

1. **Query First**: Use \`query_position\` or \`get_best_moves\` to get the engine's analysis
2. **Verify Alignment**: Ensure your recommendations match the engine's top choices
3. **Use Engine Data**: Include the engine's equity values when explaining "why" a move is best
4. **Handle Discrepancies**: If there's a conflict between your analysis and the engine, prefer the engine's recommendation

### Best Practices

- For each drill problem involving a specific position and dice roll:
  - Query the engine BEFORE writing the drill
  - Use the engine's best move as the correct answer
  - Incorporate equity values into feedback explanations
  - Verify that distractors (wrong answers) are actually suboptimal

- For multiple-choice drills:
  - Use \`get_best_moves\` with \`count: 4\` to get top options
  - Use the #1 move as the correct answer
  - Use other top moves as plausible distractors
  - Include equity differences in feedback

- For position evaluation questions:
  - Query the position to get precise equity values
  - Use these values to calibrate difficulty (small vs. large equity differences)

Engine URL: ${config.engineUrl}
Engine: ${config.engineName} (${config.domain})
`

  return `${verificationInstructions}\n\n${basePrompt}`
}

/**
 * Build system prompt enhancement for ground truth verification.
 *
 * Adds high-level verification philosophy to system prompts without
 * getting into specific tool details (which belong in user prompts).
 *
 * @param baseSystemPrompt - Original system prompt
 * @returns Enhanced system prompt
 */
export function buildVerifiedSystemPrompt(baseSystemPrompt: string): string {
  const enhancement = `
## Factual Accuracy Priority

When generating teaching content about specific positions, moves, or evaluations:
- Prioritize factual accuracy over creativity
- Verify claims against the ground truth engine before including them
- Use precise equity values from the engine rather than approximations
- Ground all move recommendations in engine analysis

Balance pedagogical clarity with technical precision. Use the engine as your
authoritative source for all factual claims about positions and moves.
`

  return `${baseSystemPrompt}\n\n${enhancement}`
}

/**
 * Build curriculum generation prompt with ground truth verification instructions.
 *
 * Similar to drill prompts but tailored for curriculum generation workflow.
 * Emphasizes conceptual sequencing while maintaining factual accuracy.
 *
 * @param basePrompt - Original curriculum generation prompt
 * @param config - Ground truth configuration
 * @returns Enhanced prompt with verification instructions
 */
export function buildCurriculumPromptWithVerification(
  basePrompt: string,
  config: GroundTruthConfig
): string {
  const verificationInstructions = `
## Ground Truth Verification for Curriculum

You have access to a backgammon engine for verifying positions and moves when creating curriculum content.

### Available Tools

${GROUND_TRUTH_TOOLS.map(t => `**${t.function.name}**
${t.function.description}

Parameters:
${Object.entries(t.function.parameters.properties || {}).map(([key, value]: [string, any]) =>
  `- \`${key}\` (${value.type}): ${value.description}`
).join('\n')}
`).join('\n')}

### Verification Workflow for Curriculum

IMPORTANT: When including specific examples in curriculum modules:

1. **Verify Examples**: If you reference a specific position or move as an example, verify it with the engine first
2. **Use Accurate Data**: Include real equity values when discussing move quality or decision points
3. **Factual Grounding**: Ensure all technical claims (e.g., "this is the best move") are engine-verified
4. **Pedagogical Balance**: Focus on concepts and sequencing, but ground specific examples in facts

### Best Practices

- For concept introduction modules:
  - Use verified positions as canonical examples
  - Query the engine to confirm examples match the concept being taught
  - Include equity context when it enhances learning

- For skill progression:
  - Verify that example positions match the intended difficulty level
  - Use engine analysis to confirm complexity claims
  - Ensure prerequisites are ordered by actual strategic importance

- For milestone definitions:
  - Ground skill level descriptions in verifiable position evaluations
  - Use engine-verified positions as assessment checkpoints

Engine URL: ${config.engineUrl}
Engine: ${config.engineName} (${config.domain})
`

  return `${verificationInstructions}\n\n${basePrompt}`
}

/**
 * Format tool call results for inclusion in conversation history.
 *
 * Converts engine responses into human-readable format that the LLM
 * can easily interpret and use in its generation.
 *
 * @param toolName - Name of the tool that was called
 * @param result - Raw result from the engine
 * @returns Formatted string for LLM consumption
 *
 * @example
 * const formatted = formatToolResultForPrompt('query_position', {
 *   bestMove: '8/5 6/5',
 *   equity: 0.125
 * })
 * // Returns: "Best move: 8/5 6/5 (equity: +0.125)"
 */
export function formatToolResultForPrompt(
  toolName: string,
  result: unknown
): string {
  if (!result || typeof result !== 'object') {
    return `Tool ${toolName} returned: ${JSON.stringify(result)}`
  }

  const data = result as Record<string, unknown>

  switch (toolName) {
    case 'query_position':
      return formatQueryPositionResult(data)

    case 'verify_move':
      return formatVerifyMoveResult(data)

    case 'get_best_moves':
      return formatGetBestMovesResult(data)

    default:
      return `Tool ${toolName} returned: ${JSON.stringify(result, null, 2)}`
  }
}

/**
 * Format query_position tool result.
 */
function formatQueryPositionResult(data: Record<string, unknown>): string {
  const bestMove = data.bestMove || data.move || 'unknown'
  const equity = typeof data.equity === 'number' ? data.equity.toFixed(3) : 'N/A'
  const evaluation = data.evaluation || ''

  return `Best move: ${bestMove} (equity: ${equity > '0' ? '+' : ''}${equity})${evaluation ? ` - ${evaluation}` : ''}`
}

/**
 * Format verify_move tool result.
 */
function formatVerifyMoveResult(data: Record<string, unknown>): string {
  const isCorrect = data.isCorrect || data.verified || false
  const move = data.move || 'unknown'
  const ranking = data.ranking || data.rank

  if (isCorrect) {
    return `Move ${move} is CORRECT${ranking ? ` (ranked #${ranking})` : ''}`
  } else {
    const bestMove = data.bestMove || data.correctMove
    const equityDiff = typeof data.equityDifference === 'number'
      ? ` (equity difference: ${data.equityDifference.toFixed(3)})`
      : ''

    return `Move ${move} is INCORRECT${bestMove ? `. Best move is: ${bestMove}` : ''}${equityDiff}`
  }
}

/**
 * Format get_best_moves tool result.
 */
function formatGetBestMovesResult(data: Record<string, unknown>): string {
  const moves = data.moves || data.bestMoves || []

  if (!Array.isArray(moves) || moves.length === 0) {
    return 'No moves returned from engine'
  }

  const formattedMoves = moves.map((move: unknown, index: number) => {
    const moveData = move as Record<string, unknown>
    const notation = moveData.move || moveData.notation || 'unknown'
    const equity = typeof moveData.equity === 'number' ? moveData.equity.toFixed(3) : 'N/A'
    return `  ${index + 1}. ${notation} (equity: ${equity > '0' ? '+' : ''}${equity})`
  }).join('\n')

  return `Top ${moves.length} moves:\n${formattedMoves}`
}

/**
 * Extract tool usage summary from verification instructions.
 *
 * Useful for logging and debugging which tools were available
 * during a generation session.
 *
 * @returns Summary of available tools
 */
export function getToolSummary(): string {
  return GROUND_TRUTH_TOOLS.map(t =>
    `- ${t.function.name}: ${t.function.description}`
  ).join('\n')
}
