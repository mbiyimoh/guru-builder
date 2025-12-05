import { AuditTrail } from './types'

/**
 * In-memory storage for audit trails
 *
 * ⚠️ WARNING: This is a temporary solution suitable only for development.
 *
 * LIMITATIONS:
 * - Data lost on server restart/redeployment
 * - Doesn't work reliably in serverless environments (Vercel, AWS Lambda)
 * - No sharing across multiple server instances
 * - Memory usage grows until cleanup runs
 *
 * PRODUCTION TODO: Replace with database storage (Prisma) before deploying.
 * See: https://www.prisma.io/docs/concepts/components/prisma-client
 *
 * Key: messageId, Value: AuditTrail
 *
 * Note: Using globalThis to persist across Next.js hot reloads in development.
 * Without this, the Map would be cleared on every code change.
 */
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
