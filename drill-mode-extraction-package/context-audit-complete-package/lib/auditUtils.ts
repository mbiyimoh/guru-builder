import { storeAuditTrail, updateAuditTrail } from './auditStore'
import { ContextLayerMetadata, KnowledgeFileMetadata } from './types'
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
  if (!pricing) {
    console.warn(
      `[calculateCosts] Unknown model pricing: ${modelName}, using Claude 3.7 Sonnet defaults`
    )
    const fallbackPricing = MODEL_PRICING['claude-3-7-sonnet-20250219']
    const promptCost = ((usage.inputTokens || 0) / 1_000_000) * fallbackPricing.input
    const completionCost =
      ((usage.outputTokens || 0) / 1_000_000) * fallbackPricing.output

    return {
      prompt: promptCost,
      completion: completionCost,
      total: promptCost + completionCost,
    }
  }

  const promptCost = ((usage.inputTokens || 0) / 1_000_000) * pricing.input
  const completionCost = ((usage.outputTokens || 0) / 1_000_000) * pricing.output

  return {
    prompt: promptCost,
    completion: completionCost,
    total: promptCost + completionCost,
  }
}

/**
 * Create and store an audit trail from AI generation result
 */
export function createAuditTrail(params: {
  messageId: string
  model: ModelName
  usage: ModelUsage
  reasoning?: string
  contextLayers?: ContextLayerMetadata[]
  knowledgeFiles?: KnowledgeFileMetadata[]
}) {
  const { messageId, model, usage, reasoning, contextLayers = [], knowledgeFiles = [] } = params

  const costs = calculateCosts(usage, model)

  // Convert reasoning string to array format for storage
  const reasoningArray = reasoning ? [reasoning] : undefined

  const auditTrail = {
    messageId,
    timestamp: new Date(),
    model,
    reasoning: reasoningArray,
    contextLayers,
    knowledgeFiles,
    tokens: {
      prompt: usage.inputTokens || 0,
      completion: usage.outputTokens || 0,
      reasoning: undefined, // Claude's reasoning tokens are included in outputTokens
      total: usage.totalTokens || 0,
    },
    cost: {
      prompt: costs.prompt,
      completion: costs.completion,
      reasoning: undefined, // Reasoning cost is included in completion cost
      total: costs.total,
    },
  }

  console.log(`[createAuditTrail] Storing audit trail for messageId: ${messageId}`)
  console.log(`[createAuditTrail] Has reasoning: ${reasoningArray ? 'Yes (' + reasoningArray.length + ' entries)' : 'No'}`)
  console.log(`[createAuditTrail] Tokens: ${auditTrail.tokens.total}, Cost: $${auditTrail.cost.total.toFixed(4)}`)

  storeAuditTrail(auditTrail)
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
  contextLayers?: ContextLayerMetadata[]
  knowledgeFiles?: KnowledgeFileMetadata[]
}) {
  const { messageId, model, contextLayers = [], knowledgeFiles = [] } = params

  const placeholderAuditTrail = {
    messageId,
    timestamp: new Date(),
    model,
    reasoning: undefined,
    contextLayers,
    knowledgeFiles,
    tokens: {
      prompt: 0,
      completion: 0,
      reasoning: undefined,
      total: 0,
    },
    cost: {
      prompt: 0,
      completion: 0,
      reasoning: undefined,
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
      reasoning: undefined,
      total: usage.totalTokens || 0,
    },
    cost: {
      prompt: costs.prompt,
      completion: costs.completion,
      reasoning: undefined,
      total: costs.total,
    },
  }

  console.log(`[updateAuditTrailWithData] Updating messageId: ${messageId}`)
  console.log(`[updateAuditTrailWithData] Has reasoning: ${reasoningArray ? 'Yes (' + reasoningArray.length + ' entries)' : 'No'}`)
  console.log(`[updateAuditTrailWithData] Tokens: ${updates.tokens.total}, Cost: $${updates.cost.total.toFixed(4)}`)

  updateAuditTrail(messageId, updates)
}
