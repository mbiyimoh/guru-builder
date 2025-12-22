/**
 * Match Import API
 *
 * POST - Upload a match archive file for import
 * GET - List all match archives
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { storeArchiveFile } from '@/lib/matchImport/fileStorage'

export const dynamic = 'force-dynamic'

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024

/**
 * POST /api/match-import
 *
 * Upload a match archive file and start the import process.
 *
 * Request: multipart/form-data
 * - file: .txt or .mat file
 * - engineId: Ground truth engine ID
 * - sourceCollection: Optional source collection name
 *
 * Response:
 * - importId: Archive ID for tracking
 * - status: Current import status
 * - filename: Original filename
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const engineId = formData.get('engineId') as string | null
    const sourceCollection = formData.get('sourceCollection') as string | null

    // Validate required fields
    if (!file || !engineId) {
      return NextResponse.json(
        { error: 'File and engineId are required' },
        { status: 400 }
      )
    }

    // Validate file type
    const filename = file.name.toLowerCase()
    if (!filename.endsWith('.txt') && !filename.endsWith('.mat')) {
      return NextResponse.json(
        { error: 'Only .txt and .mat files are supported' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 }
      )
    }

    // Validate engine exists
    const engine = await prisma.groundTruthEngine.findUnique({
      where: { id: engineId }
    })

    if (!engine) {
      return NextResponse.json(
        { error: 'Invalid engine ID' },
        { status: 400 }
      )
    }

    // Read file content
    const content = await file.text()

    // Basic validation - check if it looks like a JellyFish format
    if (!content.includes('point match') && !content.includes('Game ')) {
      return NextResponse.json(
        { error: 'File does not appear to be a valid JellyFish match format' },
        { status: 400 }
      )
    }

    // Create archive record
    const archive = await prisma.matchArchive.create({
      data: {
        filename: file.name,
        sourceCollection: sourceCollection || null,
        importStatus: 'PENDING'
      }
    })

    // Store file content
    await storeArchiveFile(archive.id, content)

    // Trigger Inngest job
    await inngest.send({
      name: 'match-archive/import.started',
      data: {
        archiveId: archive.id,
        engineId
      }
    })

    return NextResponse.json({
      importId: archive.id,
      status: 'PENDING',
      filename: file.name
    }, {
      headers: {
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('[Match Import API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to start import' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/match-import
 *
 * List all match archives with their import status.
 *
 * Response:
 * - archives: Array of archive records with status
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const archives = await prisma.matchArchive.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        filename: true,
        sourceCollection: true,
        totalMatches: true,
        totalGames: true,
        totalPositions: true,
        positionsVerified: true,
        importStatus: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true
      }
    })

    return NextResponse.json({ archives })
  } catch (error) {
    console.error('[Match Import API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch archives' },
      { status: 500 }
    )
  }
}
