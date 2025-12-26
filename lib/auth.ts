import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { cache } from 'react'
import type { User } from '@prisma/client'

/**
 * Check if email is on the whitelist
 */
export function isEmailWhitelisted(email: string): boolean {
  const whitelist = process.env.ALLOWED_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || []
  return whitelist.includes(email.toLowerCase())
}

/**
 * Sync a Supabase user to the Prisma database.
 * Handles the case where email exists with a different ID (e.g., after Supabase project migration).
 */
export async function syncUserToPrisma(supabaseUser: {
  id: string
  email: string
  user_metadata?: { name?: string }
}): Promise<User> {
  // First try by Supabase ID
  let dbUser = await prisma.user.findUnique({
    where: { id: supabaseUser.id }
  })

  if (dbUser) {
    // Update existing user's email if changed
    if (dbUser.email !== supabaseUser.email) {
      dbUser = await prisma.user.update({
        where: { id: supabaseUser.id },
        data: { email: supabaseUser.email },
      })
    }
    return dbUser
  }

  // Check if user exists by email (may have different ID from old Supabase project)
  const existingByEmail = await prisma.user.findUnique({
    where: { email: supabaseUser.email }
  })

  if (existingByEmail) {
    // Update existing user with new Supabase ID
    return prisma.user.update({
      where: { email: supabaseUser.email },
      data: {
        id: supabaseUser.id,
        name: supabaseUser.user_metadata?.name ?? existingByEmail.name,
      }
    })
  }

  // Create new user
  return prisma.user.create({
    data: {
      id: supabaseUser.id,
      email: supabaseUser.email,
      name: supabaseUser.user_metadata?.name,
    }
  })
}

/**
 * Get current authenticated user (cached per request)
 * Returns null if not authenticated
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    console.warn('[Auth] Supabase auth error:', error.message)
    return null
  }

  if (!user) {
    console.warn('[Auth] No user in session')
    return null
  }

  if (!user.email) {
    console.warn('[Auth] User has no email:', user.id)
    return null
  }

  return syncUserToPrisma({
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata as { name?: string } | undefined,
  })
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
 * Check if current user is an admin (non-throwing)
 * Returns authorization status and user object for flexible API handling
 */
export async function checkAdminAuth(): Promise<{ authorized: boolean; user: User | null }> {
  const user = await getCurrentUser()
  if (!user) {
    return { authorized: false, user: null }
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
  if (!adminEmail) {
    console.warn('[Auth] ADMIN_EMAIL not configured')
    return { authorized: false, user }
  }

  const isAdmin = user.email.toLowerCase() === adminEmail
  return { authorized: isAdmin, user }
}

/**
 * Require admin user - throws if not authenticated or not admin
 * Consistent with requireUser() and requireProjectOwnership() patterns
 */
export async function requireAdmin(): Promise<User> {
  const { authorized, user } = await checkAdminAuth()
  if (!user) {
    throw new Error('Unauthorized')
  }
  if (!authorized) {
    throw new Error('Forbidden')
  }
  return user
}

/**
 * Check if current user is the project owner or an admin (non-throwing)
 * Returns authorization status and user object for flexible API handling
 */
export async function checkProjectOwnerOrAdmin(
  projectId: string
): Promise<{ authorized: boolean; user: User | null }> {
  const user = await getCurrentUser()
  if (!user) {
    return { authorized: false, user: null }
  }

  // Check if admin
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
  if (adminEmail && user.email.toLowerCase() === adminEmail) {
    return { authorized: true, user }
  }

  // Check if project owner
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })

  if (project?.userId === user.id) {
    return { authorized: true, user }
  }

  return { authorized: false, user }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
