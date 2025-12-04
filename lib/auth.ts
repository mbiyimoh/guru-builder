import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { cache } from 'react'

/**
 * Check if email is on the whitelist
 */
export function isEmailWhitelisted(email: string): boolean {
  const whitelist = process.env.ALLOWED_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || []
  return whitelist.includes(email.toLowerCase())
}

/**
 * Get current authenticated user (cached per request)
 * Returns null if not authenticated
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  // Get or create Prisma user record
  let dbUser = await prisma.user.findUnique({
    where: { id: user.id }
  })

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.name,
      }
    })
  }

  return dbUser
})

/**
 * Require authenticated user - throws if not authenticated
 */
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

/**
 * Require ownership of a project - throws if not owner
 */
export async function requireProjectOwnership(projectId: string) {
  const user = await requireUser()
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true }
  })

  if (!project) {
    throw new Error('Project not found')
  }

  if (project.userId !== user.id) {
    throw new Error('Forbidden')
  }

  return user
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
