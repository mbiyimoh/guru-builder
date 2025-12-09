import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { syncUserToPrisma } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Admin email from environment - used for orphan project assignment
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/projects'

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user && user.email) {
      // Sync user to Prisma database using shared helper
      await syncUserToPrisma({
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata as { name?: string } | undefined,
      })

      // Assign orphan projects to admin on first login
      if (ADMIN_EMAIL && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        const orphanProjects = await prisma.project.findMany({
          where: { userId: null },
          select: { id: true },
        })

        if (orphanProjects.length > 0) {
          await prisma.project.updateMany({
            where: { userId: null },
            data: { userId: user.id },
          })
          console.log(`[Auth] Assigned ${orphanProjects.length} orphan projects to admin ${user.email}`)
        }
      }

      const response = NextResponse.redirect(`${origin}${next}`)
      response.headers.set('Cache-Control', 'no-store, max-age=0')
      return response
    }
  }

  // Auth failed - redirect to login with error
  const errorResponse = NextResponse.redirect(`${origin}/login?error=auth_failed`)
  errorResponse.headers.set('Cache-Control', 'no-store, max-age=0')
  return errorResponse
}
