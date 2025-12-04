import { storeAuditTrail, updateAuditTrail } from './auditStore'
import { MODEL_PRICING, ModelName } from './constants'

interface ModelUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

interface CostBreakdown {
  prompt: number
  completion: number
  total: number
}

/**
 * Calculate costs for a model based on token usage
 */
function calculateCosts(
  usage: ModelUsage | undefined,
  modelName: ModelName
): CostBreakdown {
  if (!usage) {
    console.warn('[calculateCosts] Usage data unavailable, returning zero costs')
    return {
      prompt: 0,
      completion: 0,
      total: 0,
    }
  }

  const pricing = MODEL_PRICING[modelName]
  const promptCost = ((usage.inputTokens || 0) / 1_000_000) * pricing.input
  const completionCost = ((usage.outputTokens || 0) / 1_000_000) * pricing.output

  return {
    prompt: promptCost,
    completion: completionCost,
    total: promptCost + completionCost,
  }
}

/**
 * Generate a unique message ID for tracking
 */
export function generateMessageId(): string {
  return crypto.randomUUID()
}

/**
 * Create and store a placeholder audit trail immediately (before reasoning/usage available)
 * This prevents race conditions where the user clicks "View Audit" before data is ready
 */
export function createPlaceholderAuditTrail(params: {
  messageId: string
  model: ModelName
  contextLayers: number
}) {
  const { messageId, model, contextLayers } = params

  const placeholderAuditTrail = {
    messageId,
    timestamp: new Date(),
    model,
    reasoning: undefined,
    contextLayers,
    tokens: {
      prompt: 0,
      completion: 0,
      total: 0,
    },
    cost: {
      prompt: 0,
      completion: 0,
      total: 0,
    },
  }

  console.log(`[createPlaceholderAuditTrail] Storing placeholder for messageId: ${messageId}`)
  storeAuditTrail(placeholderAuditTrail)
}

/**
 * Update an existing audit trail with reasoning and usage data
 */
export function updateAuditTrailWithData(params: {
  messageId: string
  model: ModelName
  usage: ModelUsage
  reasoning?: string
}) {
  const { messageId, model, usage, reasoning } = params

  const costs = calculateCosts(usage, model)
  const reasoningArray = reasoning ? [reasoning] : undefined

  const updates = {
    reasoning: reasoningArray,
    tokens: {
      prompt: usage.inputTokens || 0,
      completion: usage.outputTokens || 0,
      total: usage.totalTokens || 0,
    },
    cost: {
      prompt: costs.prompt,
      completion: costs.completion,
      total: costs.total,
    },
  }

  console.log(`[updateAuditTrailWithData] Updating messageId: ${messageId}`)
  console.log(`[updateAuditTrailWithData] Has reasoning: ${reasoningArray ? 'Yes (' + reasoningArray.length + ' entries)' : 'No'}`)
  console.log(`[updateAuditTrailWithData] Tokens: ${updates.tokens.total}, Cost: $${updates.cost.total.toFixed(4)}`)

  updateAuditTrail(messageId, updates)
}
