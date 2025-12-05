// @ts-nocheck
// ⚠️ COPY-PASTE EXAMPLE - This file is meant to be copied to your project
// It will not compile in isolation. See INTEGRATION_GUIDE.md for setup instructions.

// lib/auditUtils.ts
// Audit trail creation and management - tracks reasoning, tokens, costs

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
 * Pricing from constants.ts (per 1M tokens)
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
    console.warn(`[calculateCosts] Unknown model pricing: ${modelName}`)
    return {
      prompt: 0,
      completion: 0,
      total: 0,
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
 * Create and store a complete audit trail from AI generation result
 * Use when you have all data immediately (non-streaming responses)
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
 * Used to correlate messages with audit trails
 */
export function generateMessageId(): string {
  return crypto.randomUUID()
}

/**
 * Create and store a placeholder audit trail IMMEDIATELY (before reasoning/usage available)
 * CRITICAL PATTERN: Prevents race conditions where user clicks "View Audit" before data is ready
 *
 * Workflow:
 * 1. Create placeholder (this function) - BEFORE streaming starts
 * 2. Start streaming - Returns to user immediately
 * 3. Update with data (updateAuditTrailWithData) - ASYNCHRONOUSLY when ready
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
 * Called ASYNCHRONOUSLY after streaming completes and data is available
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
