/**
 * Guru Profile Synthesis API Endpoint
 *
 * POST /api/projects/synthesize-guru-profile
 *
 * Transforms natural language brain dumps into structured guru profiles.
 * Supports iterative refinement via additionalContext parameter.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { synthesizeGuruProfile, SynthesisError } from '@/lib/guruProfile/synthesizer'
import { SynthesisErrorCode } from '@/lib/guruProfile/types'

/**
 * Request validation schema
 */
const requestSchema = z.object({
  rawInput: z.string().min(10, 'Please provide at least 10 characters of description'),
  additionalContext: z.string().optional(),
})

/**
 * POST /api/projects/synthesize-guru-profile
 *
 * Synthesize a guru profile from natural language input.
 *
 * @param request - NextRequest with JSON body { rawInput, additionalContext? }
 * @returns JSON response with synthesized profile or error
 */
export async function POST(request: NextRequest) {
  // Rate limiting consideration (log for now, implement later)
  const startTime = Date.now()

  try {
    // Authentication check
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            retryable: false,
          },
        },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message || 'Invalid request',
            retryable: false,
          },
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      )
    }

    // Call synthesizer
    const result = await synthesizeGuruProfile(
      parsed.data.rawInput,
      parsed.data.additionalContext
    )

    // Log success metrics
    const duration = Date.now() - startTime
    console.log(`[Synthesis API] Success for user ${user.id} in ${duration}ms`)

    return NextResponse.json(
      {
        success: true,
        profile: result,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error) {
    const duration = Date.now() - startTime

    // Handle SynthesisError with structured response
    if (error instanceof SynthesisError) {
      const status = error.code === SynthesisErrorCode.RATE_LIMITED ? 429 : 500

      console.error(
        `[Synthesis API] SynthesisError: ${error.code} - ${error.message} (${duration}ms)`,
        error.cause
      )

      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
          },
        },
        {
          status,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            ...(status === 429 ? { 'Retry-After': '60' } : {}),
          },
        }
      )
    }

    // Generic error fallback
    console.error('[Synthesis API] Unexpected error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during synthesis',
          retryable: true,
        },
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
