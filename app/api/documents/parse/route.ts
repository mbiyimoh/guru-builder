/**
 * Document Parse API Endpoint
 *
 * POST /api/documents/parse
 *
 * Parses uploaded documents (PDF, DOCX, TXT) and extracts text content.
 * Used for document-based guru profile synthesis.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import pdf from 'pdf-parse'
import mammoth from 'mammoth'

/**
 * Maximum file size: 10MB
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * Supported file types
 */
const SUPPORTED_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
} as const

/**
 * POST /api/documents/parse
 *
 * Parse an uploaded document and extract text content.
 *
 * @param request - NextRequest with multipart form data containing a file
 * @returns JSON response with extracted text and metadata
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'No file provided',
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      )
    }

    // Validate file type
    const fileType = SUPPORTED_TYPES[file.type as keyof typeof SUPPORTED_TYPES]
    if (!fileType) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type. Supported types: PDF, DOCX, TXT`,
        },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Extract text based on file type
    let text: string
    let pages: number | undefined

    try {
      switch (fileType) {
        case 'pdf': {
          const data = await pdf(buffer)
          text = data.text
          pages = data.numpages
          break
        }

        case 'docx': {
          const result = await mammoth.extractRawText({ buffer })
          text = result.value
          break
        }

        case 'txt': {
          text = buffer.toString('utf-8')
          break
        }

        default:
          throw new Error('Unsupported file type')
      }
    } catch (parseError) {
      console.error('[Document Parse API] Parse error:', parseError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse document. The file may be corrupted or password-protected.',
        },
        { status: 500 }
      )
    }

    // Validate extracted text
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No text content found in document',
        },
        { status: 400 }
      )
    }

    // Calculate metadata
    const words = text.trim().split(/\s+/).length
    const metadata: {
      pages?: number
      words: number
      fileName: string
      fileType: string
      fileSize: number
    } = {
      words,
      fileName: file.name,
      fileType,
      fileSize: file.size,
    }

    if (pages !== undefined) {
      metadata.pages = pages
    }

    console.log(
      `[Document Parse API] Successfully parsed ${fileType.toUpperCase()} for user ${user.id}: ${words} words${pages ? `, ${pages} pages` : ''}`
    )

    return NextResponse.json(
      {
        success: true,
        text: text.trim(),
        metadata,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error) {
    console.error('[Document Parse API] Unexpected error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while parsing the document',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  }
}
