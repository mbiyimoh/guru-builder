/**
 * In-memory storage for audit trails
 *
 * ⚠️ PRODUCTION WARNING ⚠️
 * This is a DEVELOPMENT-ONLY implementation using in-memory storage.
 *
 * LIMITATIONS:
 * - Data lost on server restart/redeployment
 * - Not suitable for serverless environments (Vercel, AWS Lambda)
 * - No sharing across multiple server instances
 * - Memory leaks from setTimeout-based cleanup
 * - Cannot query historical audit data
 *
 * MIGRATION REQUIRED FOR PRODUCTION:
 * See docs/audit-trail-database-migration.md for complete migration plan.
 * Estimated effort: 11 hours (core) or 15 hours (with analytics)
 *
 * Note: Using globalThis to persist across Next.js hot reloads in development.
 */

export interface AuditTrail {
  messageId: string
  timestamp: Date
  model: string
  reasoning?: string[]  // Claude's extended thinking traces
  contextLayers: number
  tokens: {
    prompt: number
    completion: number
    total: number
  }
  cost: {
    prompt: number
    completion: number
    total: number
  }
}

declare global {
  // eslint-disable-next-line no-var
  var auditStore: Map<string, AuditTrail> | undefined
}

const auditStore = globalThis.auditStore ?? new Map<string, AuditTrail>()

if (process.env.NODE_ENV !== 'production') {
  globalThis.auditStore = auditStore
}

// Retention period: 7 days
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Store an audit trail for a message
 */
export function storeAuditTrail(auditTrail: AuditTrail): void {
  auditStore.set(auditTrail.messageId, auditTrail)

  console.log(`[auditStore] Stored audit trail for messageId: ${auditTrail.messageId}`)
  console.log(`[auditStore] Current store size: ${auditStore.size}`)

  // Schedule cleanup after retention period
  setTimeout(() => {
    auditStore.delete(auditTrail.messageId)
    console.log(`[auditStore] Cleaned up audit trail for messageId: ${auditTrail.messageId}`)
  }, RETENTION_MS)
}

/**
 * Retrieve an audit trail by message ID
 */
export function getAuditTrail(messageId: string): AuditTrail | undefined {
  const trail = auditStore.get(messageId)
  console.log(`[auditStore] Retrieving audit trail for messageId: ${messageId}`)
  console.log(`[auditStore] Found: ${trail ? 'YES' : 'NO'}, Store size: ${auditStore.size}`)

  if (!trail) {
    // Debug: log all available messageIds
    const availableIds = Array.from(auditStore.keys())
    console.log(`[auditStore] Available messageIds: ${availableIds.join(', ') || 'NONE'}`)
  }

  return trail
}

/**
 * Update an existing audit trail (for adding reasoning/usage after initial storage)
 */
export function updateAuditTrail(messageId: string, updates: Partial<AuditTrail>): void {
  const existing = auditStore.get(messageId)

  if (!existing) {
    console.warn(`[auditStore] Cannot update - audit trail not found for messageId: ${messageId}`)
    return
  }

  const updated = { ...existing, ...updates }
  auditStore.set(messageId, updated)

  console.log(`[auditStore] Updated audit trail for messageId: ${messageId}`)
}

/**
 * Get all stored audit trails (for debugging)
 */
export function getAllAuditTrails(): AuditTrail[] {
  return Array.from(auditStore.values())
}

/**
 * Clear all audit trails (for testing)
 */
export function clearAuditStore(): void {
  auditStore.clear()
}

/**
 * Get audit store size (for monitoring)
 */
export function getAuditStoreSize(): number {
  return auditStore.size
}
