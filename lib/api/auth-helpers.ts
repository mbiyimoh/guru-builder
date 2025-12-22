import { NextResponse } from 'next/server';

/**
 * Standardized auth error handler for API routes
 * Maps auth exceptions to appropriate HTTP responses
 */
export function handleAuthError(error: unknown): NextResponse | null {
  const message = error instanceof Error ? error.message : 'Error';

  if (message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (message === 'Forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (message === 'Project not found') {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return null; // Not an auth error
}

/**
 * Wrapper for requireProjectOwnership with automatic error handling
 * Returns NextResponse if auth fails, undefined if successful
 */
export async function withProjectAuth(
  projectId: string
): Promise<NextResponse | undefined> {
  const { requireProjectOwnership } = await import('@/lib/auth');

  try {
    await requireProjectOwnership(projectId);
    return undefined; // Success
  } catch (error) {
    const authError = handleAuthError(error);
    if (authError) return authError;
    throw error; // Re-throw if not an auth error
  }
}
