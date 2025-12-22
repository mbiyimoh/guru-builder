/**
 * Ground Truth Module - Cache Operations
 *
 * Manages caching of ground truth engine responses using the
 * GroundTruthCache Prisma model.
 *
 * Cache reduces redundant API calls and improves performance for
 * frequently verified positions/moves.
 */

import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

/**
 * Cache TTL strategy based on operation type.
 *
 * Opening positions are stable and cacheable for longer periods.
 * Specific position analysis has medium TTL.
 * Move verifications have shorter TTL.
 */
export const CACHE_TTL = {
  /** Opening positions (common, stable) - 7 days */
  OPENING: 7 * 24 * 60 * 60 * 1000,
  /** Specific positions - 24 hours */
  POSITION: 24 * 60 * 60 * 1000,
  /** Move verifications - 1 hour */
  VERIFICATION: 60 * 60 * 1000,
} as const

/**
 * Check cache for an existing ground truth response.
 *
 * Looks up a cached response by key and verifies it hasn't expired.
 * Automatically deletes expired entries on lookup.
 *
 * @param key - Cache key (use buildCacheKey to generate)
 * @returns Cached response or null if not found/expired
 */
export async function checkCache(key: string): Promise<unknown | null> {
  const cached = await prisma.groundTruthCache.findUnique({
    where: { cacheKey: key }
  })

  if (!cached) return null

  // Check expiration
  if (cached.expiresAt < new Date()) {
    // Expired - delete and return null
    await prisma.groundTruthCache.delete({
      where: { cacheKey: key }
    }).catch(() => {
      // Ignore errors if already deleted by cleanup job
    })
    return null
  }

  return cached.response
}

/**
 * Store a ground truth response in cache.
 *
 * Saves response with expiration timestamp for future lookups.
 * Uses upsert to handle duplicate keys gracefully.
 *
 * @param key - Cache key (use buildCacheKey to generate)
 * @param response - Engine response to cache
 * @param ttlMs - Time-to-live in milliseconds
 */
export async function cacheResponse(
  key: string,
  response: unknown,
  ttlMs: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs)

  // Ensure response is JSON-serializable
  // Parse and stringify to validate/normalize the structure
  const jsonResponse = JSON.parse(JSON.stringify(response)) as Prisma.InputJsonValue

  await prisma.groundTruthCache.upsert({
    where: { cacheKey: key },
    create: {
      cacheKey: key,
      response: jsonResponse,
      expiresAt
    },
    update: {
      response: jsonResponse,
      expiresAt
    }
  })
}

/**
 * Cleanup expired cache entries.
 *
 * Intended for periodic background job execution.
 * Deletes all entries where expiresAt is in the past.
 *
 * @returns Number of entries deleted
 */
export async function cleanupExpiredCache(): Promise<number> {
  const result = await prisma.groundTruthCache.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  })
  return result.count
}

/**
 * Build a standardized cache key for ground truth operations.
 *
 * Creates deterministic keys for position analysis, move evaluation, etc.
 *
 * @param operation - Operation type (e.g., 'analyze_position', 'evaluate_move')
 * @param params - Operation parameters (position ID, move notation, etc.)
 * @returns Cache key string
 *
 * @example
 * buildCacheKey('analyze_position', 'XGID=abcd123')
 * // => 'gt:analyze_position:XGID=abcd123'
 */
export function buildCacheKey(operation: string, ...params: string[]): string {
  return `gt:${operation}:${params.join(':')}`
}
