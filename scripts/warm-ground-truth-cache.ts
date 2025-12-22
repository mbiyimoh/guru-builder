#!/usr/bin/env npx ts-node

/**
 * Ground Truth Cache Warming Script
 *
 * Pre-populates the ground truth cache with common backgammon positions
 * to improve response times during content generation and verification.
 *
 * Usage:
 *   npx ts-node scripts/warm-ground-truth-cache.ts [engineUrl]
 *
 * Arguments:
 *   engineUrl - The GNU Backgammon engine MCP server URL (default: http://localhost:3001)
 *
 * Example:
 *   npx ts-node scripts/warm-ground-truth-cache.ts http://localhost:3001
 *
 * Note: Requires DATABASE_URL environment variable to be set.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Standard opening positions (same as in positionDetector.ts)
const STANDARD_OPENINGS: Record<string, string> = {
  '3-1': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:31:0:0:0:0:10',
  '4-2': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:42:0:0:0:0:10',
  '5-3': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:53:0:0:0:0:10',
  '6-1': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:61:0:0:0:0:10',
  '5-1': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:51:0:0:0:0:10',
  '6-5': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:65:0:0:0:0:10',
  '4-1': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:41:0:0:0:0:10',
  '3-2': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:32:0:0:0:0:10',
  '2-1': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:21:0:0:0:0:10',
  '6-4': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:64:0:0:0:0:10',
  '6-3': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:63:0:0:0:0:10',
  '6-2': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:62:0:0:0:0:10',
  '5-4': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:54:0:0:0:0:10',
  '5-2': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:52:0:0:0:0:10',
  '4-3': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:43:0:0:0:0:10',
}

// Cache TTL for opening positions (7 days in ms)
const OPENING_CACHE_TTL = 7 * 24 * 60 * 60 * 1000

interface EngineResponse {
  success: boolean
  data?: {
    bestMoves?: Array<{
      move: string
      equity: number
      winChance: number
    }>
  }
  error?: string
}

/**
 * Query the engine for best moves
 */
async function queryEngine(engineUrl: string, xgid: string, dice: string): Promise<EngineResponse> {
  try {
    const response = await fetch(`${engineUrl}/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'analyze_position',
        args: {
          position: xgid,
          dice,
          topMoves: 5
        }
      }),
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`Engine returned ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Build cache key for opening position
 */
function buildCacheKey(xgid: string): string {
  return `gt:analyze_position:${xgid}`
}

/**
 * Store response in cache
 */
async function cacheResponse(key: string, response: EngineResponse): Promise<void> {
  const expiresAt = new Date(Date.now() + OPENING_CACHE_TTL)

  await prisma.groundTruthCache.upsert({
    where: { cacheKey: key },
    create: {
      cacheKey: key,
      response: JSON.parse(JSON.stringify(response)),
      expiresAt
    },
    update: {
      response: JSON.parse(JSON.stringify(response)),
      expiresAt
    }
  })
}

/**
 * Check engine health
 */
async function checkEngineHealth(engineUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${engineUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Main cache warming function
 */
async function warmCache(engineUrl: string): Promise<void> {
  console.log(`\n🔥 Ground Truth Cache Warming Script`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Engine URL: ${engineUrl}`)
  console.log(`Positions to cache: ${Object.keys(STANDARD_OPENINGS).length}`)
  console.log(`Cache TTL: 7 days\n`)

  // Check engine health first
  console.log(`Checking engine health...`)
  const isHealthy = await checkEngineHealth(engineUrl)

  if (!isHealthy) {
    console.error(`\n❌ Engine is not responding at ${engineUrl}`)
    console.error(`   Please ensure the GNU Backgammon MCP server is running.`)
    process.exit(1)
  }

  console.log(`✓ Engine is healthy\n`)
  console.log(`Warming cache for opening positions:\n`)

  let successCount = 0
  let errorCount = 0
  let skippedCount = 0

  for (const [dice, xgid] of Object.entries(STANDARD_OPENINGS)) {
    const cacheKey = buildCacheKey(xgid)

    // Check if already cached
    const existing = await prisma.groundTruthCache.findUnique({
      where: { cacheKey }
    })

    if (existing && existing.expiresAt > new Date()) {
      console.log(`  ⏩ ${dice}: Already cached (expires ${existing.expiresAt.toLocaleDateString()})`)
      skippedCount++
      continue
    }

    // Query engine
    process.stdout.write(`  🔄 ${dice}: Querying engine...`)
    const response = await queryEngine(engineUrl, xgid, dice)

    if (response.success && response.data?.bestMoves) {
      await cacheResponse(cacheKey, response)
      console.log(` ✓ Cached ${response.data.bestMoves.length} moves`)
      successCount++
    } else {
      console.log(` ❌ ${response.error || 'Failed'}`)
      errorCount++
    }

    // Small delay between requests to avoid overwhelming the engine
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📊 Cache Warming Complete`)
  console.log(`   ✓ Cached: ${successCount}`)
  console.log(`   ⏩ Skipped: ${skippedCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
}

/**
 * Get cache statistics
 */
async function getCacheStats(): Promise<void> {
  const total = await prisma.groundTruthCache.count()
  const expired = await prisma.groundTruthCache.count({
    where: { expiresAt: { lt: new Date() } }
  })
  const valid = total - expired

  console.log(`\n📊 Cache Statistics`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`   Total entries: ${total}`)
  console.log(`   Valid entries: ${valid}`)
  console.log(`   Expired entries: ${expired}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
}

/**
 * Clean expired cache entries
 */
async function cleanExpiredCache(): Promise<void> {
  console.log(`\n🧹 Cleaning expired cache entries...`)

  const result = await prisma.groundTruthCache.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  })

  console.log(`   Deleted ${result.count} expired entries\n`)
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0] || 'warm'
  const engineUrl = args[1] || process.env.GROUND_TRUTH_ENGINE_URL || 'http://localhost:3001'

  try {
    switch (command) {
      case 'warm':
        await warmCache(engineUrl)
        break
      case 'stats':
        await getCacheStats()
        break
      case 'clean':
        await cleanExpiredCache()
        break
      case 'help':
        console.log(`
Ground Truth Cache Warming Script

Usage:
  npx ts-node scripts/warm-ground-truth-cache.ts [command] [engineUrl]

Commands:
  warm   - Warm the cache with opening positions (default)
  stats  - Show cache statistics
  clean  - Remove expired cache entries
  help   - Show this help message

Arguments:
  engineUrl - The GNU Backgammon engine MCP server URL
              Default: http://localhost:3001
              Or set GROUND_TRUTH_ENGINE_URL environment variable

Examples:
  npx ts-node scripts/warm-ground-truth-cache.ts warm http://localhost:3001
  npx ts-node scripts/warm-ground-truth-cache.ts stats
  npx ts-node scripts/warm-ground-truth-cache.ts clean
        `)
        break
      default:
        console.error(`Unknown command: ${command}`)
        console.log(`Use 'help' for usage information`)
        process.exit(1)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
