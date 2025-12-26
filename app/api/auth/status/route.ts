/**
 * Auth Status API
 *
 * GET /api/auth/status - Check current authentication state
 *
 * This endpoint is used by the debug terminal to check auth state
 * before making API calls, helping diagnose 401 errors.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Get raw Supabase session state
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser();

    // Also try to get the synced Prisma user
    let prismaUser = null;
    try {
      prismaUser = await getCurrentUser();
    } catch {
      // getCurrentUser may throw if auth fails
    }

    return NextResponse.json({
      authenticated: !!prismaUser,
      timestamp: new Date().toISOString(),
      supabase: {
        hasSession: !!session,
        sessionError: sessionError?.message || null,
        hasUser: !!supabaseUser,
        userError: userError?.message || null,
        userId: supabaseUser?.id || null,
        email: supabaseUser?.email || null,
      },
      prisma: {
        synced: !!prismaUser,
        userId: prismaUser?.id || null,
        email: prismaUser?.email || null,
      },
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      supabase: null,
      prisma: null,
    }, { status: 500 });
  }
}
