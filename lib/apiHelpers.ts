/**
 * API Helper Utilities
 *
 * Common utilities for API route handlers to reduce code duplication
 */

import { NextResponse } from "next/server";

/**
 * Prisma error codes we commonly handle
 */
const PRISMA_ERROR_CODES = {
  P2025: "Record not found",
  P2002: "Unique constraint violation",
  P2003: "Foreign key constraint failed",
  P2004: "Constraint failed on the database",
} as const;

/**
 * Handle Prisma-specific errors
 */
export function handlePrismaError(error: unknown): {
  type: "not_found" | "conflict" | "constraint" | null;
  status: number;
  message: string;
} | null {
  if (error instanceof Error && "code" in error) {
    const code = (error as { code: string }).code;

    if (code === "P2025") {
      return {
        type: "not_found",
        status: 404,
        message: PRISMA_ERROR_CODES.P2025,
      };
    }

    if (code === "P2002") {
      return {
        type: "conflict",
        status: 409,
        message: PRISMA_ERROR_CODES.P2002,
      };
    }

    if (code === "P2003") {
      return {
        type: "constraint",
        status: 400,
        message: PRISMA_ERROR_CODES.P2003,
      };
    }

    if (code === "P2004") {
      return {
        type: "constraint",
        status: 400,
        message: PRISMA_ERROR_CODES.P2004,
      };
    }
  }

  return null;
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  action: string,
  error: unknown,
  defaultStatus: number = 500
): NextResponse {
  // Check for Prisma errors first
  const prismaError = handlePrismaError(error);
  if (prismaError) {
    return NextResponse.json(
      {
        error: `Failed to ${action}`,
        message: prismaError.message,
      },
      { status: prismaError.status }
    );
  }

  // Generic error response
  console.error(`[API Error] ${action}:`, error);
  return NextResponse.json(
    {
      error: `Failed to ${action}`,
      message: error instanceof Error ? error.message : "Unknown error",
    },
    { status: defaultStatus }
  );
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  const response: { data?: T; message?: string } = {};

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  return NextResponse.json(response, { status });
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(details: unknown): NextResponse {
  return NextResponse.json(
    {
      error: "Validation failed",
      details,
    },
    { status: 400 }
  );
}
