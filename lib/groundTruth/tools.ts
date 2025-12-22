/**
 * Ground Truth Module - OpenAI Tool Definitions
 *
 * Defines the OpenAI function calling tools that the AI can use to
 * query the ground truth engine during artifact generation.
 *
 * These tools enable the AI to verify factual claims about backgammon
 * positions, moves, and evaluations against an authoritative engine.
 */

/**
 * OpenAI tool schemas for ground truth verification.
 *
 * Each tool represents a query capability against the backgammon engine:
 * - query_position: Get the best moves for a given position and dice roll
 * - verify_move: Verify if a specific move is correct for a position
 * - get_best_moves: Get the top N best moves with equity values
 */
export const GROUND_TRUTH_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'query_position',
      description: 'Query the backgammon engine to get the best moves for a given position and dice roll. Use this when you need to know what the correct move is for a specific position.',
      parameters: {
        type: 'object',
        properties: {
          position: {
            type: 'string',
            description: 'The position ID or description (e.g., "opening", "4-point game", or GNUBG position ID). Can be a standard position name or a unique identifier.',
          },
          dice: {
            type: 'string',
            description: 'The dice roll in format "X-Y" where X and Y are numbers 1-6 (e.g., "3-1", "6-6", "5-2")',
          },
        },
        required: ['position', 'dice'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'verify_move',
      description: 'Verify if a proposed move is the best or an acceptable move for a given position. Use this to validate move recommendations before including them in teaching content.',
      parameters: {
        type: 'object',
        properties: {
          position: {
            type: 'string',
            description: 'The position ID or description (e.g., "opening", "4-point game", or GNUBG position ID)',
          },
          dice: {
            type: 'string',
            description: 'The dice roll in format "X-Y" where X and Y are numbers 1-6 (e.g., "3-1", "6-6")',
          },
          move: {
            type: 'string',
            description: 'The move to verify in backgammon notation (e.g., "8/5 6/5", "24/21 13/10", "bar/22"). Use point numbers from the player\'s perspective.',
          },
        },
        required: ['position', 'dice', 'move'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_best_moves',
      description: 'Get the top N best moves for a position with their equity values. Use this when you need to compare multiple candidate moves or show alternative plays.',
      parameters: {
        type: 'object',
        properties: {
          position: {
            type: 'string',
            description: 'The position ID or description (e.g., "opening", "4-point game", or GNUBG position ID)',
          },
          dice: {
            type: 'string',
            description: 'The dice roll in format "X-Y" where X and Y are numbers 1-6 (e.g., "3-1", "6-6")',
          },
          count: {
            type: 'number',
            description: 'Number of top moves to return. Default is 3, maximum is 10. Higher values may increase response time.',
            minimum: 1,
            maximum: 10,
          },
        },
        required: ['position', 'dice'],
        additionalProperties: false,
      },
    },
  },
] as const

/**
 * Extract tool name type from the tool definitions.
 * This ensures type safety when dispatching tool calls.
 */
export type GroundTruthToolName = typeof GROUND_TRUTH_TOOLS[number]['function']['name']

/**
 * Arguments for the query_position tool.
 */
export interface QueryPositionArgs {
  /** Position ID or description */
  position: string
  /** Dice roll in format "X-Y" (e.g., "3-1") */
  dice: string
}

/**
 * Arguments for the verify_move tool.
 */
export interface VerifyMoveArgs {
  /** Position ID or description */
  position: string
  /** Dice roll in format "X-Y" (e.g., "3-1") */
  dice: string
  /** Move to verify in backgammon notation (e.g., "8/5 6/5") */
  move: string
}

/**
 * Arguments for the get_best_moves tool.
 */
export interface GetBestMovesArgs {
  /** Position ID or description */
  position: string
  /** Dice roll in format "X-Y" (e.g., "3-1") */
  dice: string
  /** Number of top moves to return (default: 3, max: 10) */
  count?: number
}

/**
 * Union type of all possible tool argument types.
 * Use this with type narrowing based on tool name.
 */
export type GroundTruthToolArgs = QueryPositionArgs | VerifyMoveArgs | GetBestMovesArgs

/**
 * Type guard to check if arguments match QueryPositionArgs.
 */
export function isQueryPositionArgs(args: GroundTruthToolArgs): args is QueryPositionArgs {
  return 'position' in args && 'dice' in args && !('move' in args) && !('count' in args)
}

/**
 * Type guard to check if arguments match VerifyMoveArgs.
 */
export function isVerifyMoveArgs(args: GroundTruthToolArgs): args is VerifyMoveArgs {
  return 'position' in args && 'dice' in args && 'move' in args
}

/**
 * Type guard to check if arguments match GetBestMovesArgs.
 */
export function isGetBestMovesArgs(args: GroundTruthToolArgs): args is GetBestMovesArgs {
  return 'position' in args && 'dice' in args && !('move' in args)
}

/**
 * Validate that dice roll is in correct format.
 * @param dice - Dice roll string to validate
 * @returns true if format is valid (e.g., "3-1", "6-6")
 */
export function isValidDiceFormat(dice: string): boolean {
  const dicePattern = /^[1-6]-[1-6]$/
  return dicePattern.test(dice)
}

/**
 * Validate tool arguments based on tool name.
 * @param toolName - Name of the tool
 * @param args - Arguments to validate
 * @returns Validation result with error message if invalid
 */
export function validateToolArgs(
  toolName: GroundTruthToolName,
  args: unknown
): { valid: true } | { valid: false; error: string } {
  // Type check
  if (typeof args !== 'object' || args === null) {
    return { valid: false, error: 'Arguments must be an object' }
  }

  const typedArgs = args as Record<string, unknown>

  // Common validations for all tools
  if (typeof typedArgs.position !== 'string' || typedArgs.position.trim() === '') {
    return { valid: false, error: 'position must be a non-empty string' }
  }

  if (typeof typedArgs.dice !== 'string' || !isValidDiceFormat(typedArgs.dice)) {
    return { valid: false, error: 'dice must be in format "X-Y" where X and Y are 1-6' }
  }

  // Tool-specific validations
  switch (toolName) {
    case 'query_position':
      // No additional validations needed
      break

    case 'verify_move':
      if (typeof typedArgs.move !== 'string' || typedArgs.move.trim() === '') {
        return { valid: false, error: 'move must be a non-empty string' }
      }
      break

    case 'get_best_moves':
      if (typedArgs.count !== undefined) {
        if (typeof typedArgs.count !== 'number') {
          return { valid: false, error: 'count must be a number' }
        }
        if (typedArgs.count < 1 || typedArgs.count > 10) {
          return { valid: false, error: 'count must be between 1 and 10' }
        }
        if (!Number.isInteger(typedArgs.count)) {
          return { valid: false, error: 'count must be an integer' }
        }
      }
      break

    default:
      return { valid: false, error: `Unknown tool name: ${toolName}` }
  }

  return { valid: true }
}
