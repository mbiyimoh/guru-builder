# Task Breakdown: Railway Deployment + Supabase Auth

**Generated:** 2025-12-03
**Source:** specs/feat-railway-supabase-auth-whitelist.md

---

## Overview

Deploy Guru Builder to Railway with Supabase email/password authentication and email whitelist access control. This involves:
1. Database schema changes (User model, ownership)
2. Supabase client integration
3. Auth pages and actions
4. Protected API routes
5. Protected pages
6. Railway deployment configuration

---

## Phase 1: Database & Dependencies

### Task 1.1: Add User Model and Update Project Schema

**Description:** Add User model to Prisma schema and add userId to Project for ownership tracking
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.2

**Technical Requirements:**
- User model with id (UUID from Supabase), email, name, timestamps
- userId field on Project model (nullable for migration)
- Cascade delete when user is deleted
- Index on userId for efficient filtering

**Implementation:**

Update `prisma/schema.prisma`:

```prisma
model User {
  id        String   @id // UUID from Supabase auth.users.id
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  projects Project[]

  @@index([email])
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // NEW: User ownership
  userId      String?  // Nullable for migration period
  user        User?    @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Existing relations unchanged
  contextLayers    ContextLayer[]
  knowledgeFiles   KnowledgeFile[]
  researchRuns     ResearchRun[]
  snapshots        CorpusSnapshot[]
  assessmentConfig SelfAssessmentConfig?

  @@index([createdAt])
  @@index([userId]) // NEW: Index for user filtering
}
```

**Migration Steps:**
1. Run `npm run db:backup` (MANDATORY)
2. Run `npm run migrate:safe -- add-user-model`
3. Run `npx prisma generate`

**Acceptance Criteria:**
- [ ] User model exists in schema with id, email, name, timestamps
- [ ] Project model has nullable userId field
- [ ] Cascade delete configured (onDelete: Cascade)
- [ ] Index on userId for Project
- [ ] Migration runs without data loss
- [ ] Prisma client regenerated successfully

---

### Task 1.2: Install Supabase Packages

**Description:** Install @supabase/supabase-js and @supabase/ssr packages
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.1

**Implementation:**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

**Update `.env.example`:**

```bash
# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# App URL (for auth redirects)
NEXT_PUBLIC_APP_URL="http://localhost:3002"

# Email whitelist (comma-separated)
ALLOWED_EMAILS="mbiyimoh@33strategies.ai"
```

**Acceptance Criteria:**
- [ ] @supabase/supabase-js installed
- [ ] @supabase/ssr installed
- [ ] .env.example updated with Supabase variables
- [ ] No TypeScript errors after installation

---

## Phase 2: Supabase Client Integration

### Task 2.1: Create Supabase Browser Client

**Description:** Create browser-side Supabase client for client components
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 2.2

**Implementation:**

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Acceptance Criteria:**
- [ ] lib/supabase/client.ts created
- [ ] Uses createBrowserClient from @supabase/ssr
- [ ] Reads from NEXT_PUBLIC_ env vars
- [ ] No TypeScript errors

---

### Task 2.2: Create Supabase Server Client

**Description:** Create server-side Supabase client with cookie handling for Server Components, Route Handlers, and Server Actions
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 2.1

**Implementation:**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - ignore
            // Middleware will handle session refresh
          }
        },
      },
    }
  )
}
```

**Key Implementation Notes:**
- MUST use getAll() and setAll() - never get(), set(), remove()
- The try/catch in setAll handles Server Component calls gracefully
- Async function because cookies() is async in Next.js 15

**Acceptance Criteria:**
- [ ] lib/supabase/server.ts created
- [ ] Uses createServerClient from @supabase/ssr
- [ ] Implements getAll() and setAll() cookie methods
- [ ] Handles Server Component cookie setting gracefully
- [ ] No TypeScript errors

---

### Task 2.3: Create Auth Helper Functions

**Description:** Create auth utility functions for getting current user, requiring auth, and checking whitelist
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.2, Task 1.1
**Can run parallel with:** Task 2.4

**Implementation:**

Create `lib/auth.ts`:

```typescript
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
```

**Key Implementation Notes:**
- getCurrentUser uses React cache() to prevent multiple DB calls per request
- Always use getUser() not getSession() for security
- Whitelist check is case-insensitive and trims whitespace

**Acceptance Criteria:**
- [ ] lib/auth.ts created with all functions
- [ ] isEmailWhitelisted handles case insensitivity and whitespace
- [ ] getCurrentUser is cached and syncs to Prisma
- [ ] requireUser throws on unauthenticated
- [ ] requireProjectOwnership validates ownership
- [ ] No TypeScript errors

---

### Task 2.4: Create Middleware for Session Refresh

**Description:** Create root middleware to refresh Supabase sessions and protect routes
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.2
**Can run parallel with:** Task 2.3

**Implementation:**

Create `middleware.ts` in project root:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/auth/callback']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: Refresh session - do not add code between createServerClient and getUser()
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublicRoute = PUBLIC_ROUTES.some(route =>
    path === route || path.startsWith('/auth/')
  )
  const isApiRoute = path.startsWith('/api/')

  // Redirect unauthenticated users on protected page routes
  if (!user && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && (path === '/login' || path === '/signup')) {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Key Implementation Notes:**
- Must call getUser() immediately after createServerClient
- Cookies must be set on both request and response
- API routes are NOT redirected - they return 401 from the route handler

**Acceptance Criteria:**
- [ ] middleware.ts created in project root
- [ ] Session refresh works correctly
- [ ] Unauthenticated users redirected to /login on protected routes
- [ ] Authenticated users redirected away from /login, /signup
- [ ] API routes pass through (not redirected)
- [ ] Static assets excluded from middleware

---

## Phase 3: Auth Pages & Actions

### Task 3.1: Create Login Page

**Description:** Create login page with email/password form
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.3
**Can run parallel with:** Task 3.2

**Implementation:**

Create `app/(auth)/login/page.tsx`:

```typescript
import { login } from './actions'
import Link from 'next/link'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string; error?: string }
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Guru Builder
          </h2>
        </div>

        {searchParams.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {searchParams.error === 'auth_failed'
              ? 'Authentication failed. Please try again.'
              : searchParams.error}
          </div>
        )}

        <form className="mt-8 space-y-6" action={login}>
          <input type="hidden" name="redirect" value={searchParams.redirect || '/projects'} />

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Sign in
            </button>
          </div>

          <div className="text-center text-sm">
            <span className="text-gray-600">Don't have an account? </span>
            <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
```

Create `app/(auth)/login/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirect') as string || '/projects'

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo)
}
```

**Acceptance Criteria:**
- [ ] Login page renders with email/password form
- [ ] Error messages display correctly
- [ ] Successful login redirects to /projects or specified redirect
- [ ] Failed login shows error message
- [ ] Link to signup page works

---

### Task 3.2: Create Signup Page with Whitelist Check

**Description:** Create signup page that checks email whitelist before allowing registration
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.3
**Can run parallel with:** Task 3.1

**Implementation:**

Create `app/(auth)/signup/page.tsx`:

```typescript
import { signup } from './actions'
import Link from 'next/link'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Signup is restricted to approved email addresses only.
          </p>
        </div>

        <form className="mt-8 space-y-6" action={signup}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password (min 6 characters)"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Sign up
            </button>
          </div>

          <div className="text-center text-sm">
            <span className="text-gray-600">Already have an account? </span>
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
```

Create `app/(auth)/signup/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isEmailWhitelisted } from '@/lib/auth'

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Check whitelist BEFORE calling Supabase
  if (!isEmailWhitelisted(email)) {
    redirect('/signup?error=' + encodeURIComponent('This email is not authorized to create an account. Contact an administrator for access.'))
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Since we're not doing email verification, user is immediately active
      data: {
        email_confirmed: true,
      },
    },
  })

  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/projects')
}
```

**Update signup page to handle errors:**

Add to the page component:
```typescript
export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  // ... existing code

  // Add error display after <p> tag:
  {searchParams.error && (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
      {searchParams.error}
    </div>
  )}
```

**Acceptance Criteria:**
- [ ] Signup page renders with email/password form
- [ ] Whitelist notice displayed to users
- [ ] Non-whitelisted emails get clear error message
- [ ] Whitelisted emails can create account
- [ ] Successful signup redirects to /projects
- [ ] Link to login page works

---

### Task 3.3: Create Auth Callback Route with Orphan Assignment

**Description:** Create auth callback handler that syncs users to Prisma and assigns orphan projects to admin
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.3, Task 1.1
**Can run parallel with:** None

**Implementation:**

Create `app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'mbiyimoh@33strategies.ai'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/projects'

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Sync user to Prisma database
      await prisma.user.upsert({
        where: { id: user.id },
        update: { email: user.email! },
        create: {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.name,
        },
      })

      // Assign orphan projects to admin on first login
      if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
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

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth failed - redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

**Acceptance Criteria:**
- [ ] Auth callback route created at app/auth/callback/route.ts
- [ ] User synced to Prisma on callback
- [ ] Admin email (mbiyimoh@33strategies.ai) gets orphan projects assigned
- [ ] Failed auth redirects to login with error
- [ ] Successful auth redirects to /projects or specified next

---

### Task 3.4: Update Layout with Auth Navigation

**Description:** Update root layout to show auth state in navigation
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.3
**Can run parallel with:** None

**Implementation:**

Update `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser, signOut } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Guru Builder",
  description: "Build AI teaching assistants through research and iteration",
};

async function handleSignOut() {
  'use server'
  await signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser()

  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full flex flex-col`}>
        <nav className="border-b bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center space-x-8">
                <Link href="/" className="flex items-center text-xl font-bold text-gray-900">
                  Guru Builder
                </Link>
                {user && (
                  <Link
                    href="/projects"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Projects
                  </Link>
                )}
              </div>
              <div className="flex items-center space-x-4">
                {user ? (
                  <>
                    <span className="text-sm text-gray-600">{user.email}</span>
                    <form action={handleSignOut}>
                      <button
                        type="submit"
                        className="text-sm text-gray-600 hover:text-gray-900"
                      >
                        Sign out
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
                      Sign in
                    </Link>
                    <Link
                      href="/signup"
                      className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700"
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-white py-4 text-center text-sm text-gray-500">
          Guru Builder - Build better AI assistants through research
        </footer>
      </body>
    </html>
  );
}
```

**Acceptance Criteria:**
- [ ] Navigation shows user email when logged in
- [ ] Sign out button works correctly
- [ ] Sign in/Sign up links shown when logged out
- [ ] Projects link only shown when logged in

---

## Phase 4: Protect API Routes

### Task 4.1: Protect Projects API Routes

**Description:** Add auth checks to /api/projects routes
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.3
**Can run parallel with:** Task 4.2, 4.3

**Implementation:**

Update `app/api/projects/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const projects = await prisma.project.findMany({
    where: { userId: user.id }, // Filter by owner
    include: {
      _count: {
        select: {
          contextLayers: true,
          knowledgeFiles: true,
          researchRuns: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ projects })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, description } = body

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const project = await prisma.project.create({
    data: {
      name,
      description,
      userId: user.id, // Assign to current user
    },
  })

  return NextResponse.json({ project }, { status: 201 })
}
```

Update `app/api/projects/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  try {
    await requireProjectOwnership(id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      contextLayers: { orderBy: { priority: 'asc' } },
      knowledgeFiles: { orderBy: { createdAt: 'desc' } },
      _count: {
        select: {
          contextLayers: true,
          knowledgeFiles: true,
          researchRuns: true,
          snapshots: true,
        },
      },
    },
  })

  return NextResponse.json({ project })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  try {
    await requireProjectOwnership(id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
  }

  const body = await request.json()
  const { name, description } = body

  const project = await prisma.project.update({
    where: { id },
    data: { name, description },
  })

  return NextResponse.json({ project })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  try {
    await requireProjectOwnership(id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
  }

  await prisma.project.delete({ where: { id } })

  return NextResponse.json({ message: 'Project deleted' })
}
```

**Acceptance Criteria:**
- [ ] GET /api/projects returns only user's projects
- [ ] POST /api/projects assigns userId to new projects
- [ ] GET /api/projects/[id] returns 401/403/404 appropriately
- [ ] PATCH /api/projects/[id] validates ownership
- [ ] DELETE /api/projects/[id] validates ownership

---

### Task 4.2: Protect Nested Project API Routes

**Description:** Add auth checks to all nested project routes (context-layers, knowledge-files, research, snapshots, assessment)
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.3, Task 4.1
**Can run parallel with:** Task 4.3

**Implementation Pattern:**

For each nested route under `/api/projects/[id]/*`, add ownership check at the start:

```typescript
import { requireProjectOwnership } from '@/lib/auth'

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  try {
    await requireProjectOwnership(id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
  }

  // ... existing route logic
}
```

**Routes to update:**
- app/api/projects/[id]/apply-recommendations/route.ts
- app/api/projects/[id]/snapshots/route.ts
- app/api/projects/[id]/assessment/config/route.ts
- app/api/projects/[id]/assessment/session/route.ts
- app/api/projects/[id]/assessment/history/route.ts
- app/api/projects/[id]/assessment/results/route.ts
- app/api/projects/[id]/assessment/ground-truth/route.ts
- app/api/projects/[id]/assessment/chat/route.ts
- app/api/projects/[id]/assessment/audit/[messageId]/route.ts

**Acceptance Criteria:**
- [ ] All nested project routes check ownership
- [ ] 401 returned for unauthenticated requests
- [ ] 403 returned for unauthorized access
- [ ] Existing functionality preserved after auth check passes

---

### Task 4.3: Protect Standalone Resource Routes

**Description:** Add auth checks to context-layers, knowledge-files, research-runs, recommendations, snapshots routes
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.3
**Can run parallel with:** Task 4.2

**Implementation Pattern:**

For standalone resources (not nested under project), validate via the resource's project ownership:

```typescript
// Example: app/api/context-layers/[id]/route.ts
import { getCurrentUser, requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const layer = await prisma.contextLayer.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  })

  if (!layer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (layer.project.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ... rest of route logic
}
```

**Routes to update:**
- app/api/context-layers/route.ts (filter by user's projects)
- app/api/context-layers/[id]/route.ts (validate via project)
- app/api/knowledge-files/route.ts (filter by user's projects)
- app/api/knowledge-files/[id]/route.ts (validate via project)
- app/api/research-runs/route.ts (filter by user's projects)
- app/api/research-runs/[id]/route.ts (validate via project)
- app/api/recommendations/route.ts (filter by user's projects)
- app/api/recommendations/[id]/approve/route.ts (validate via project)
- app/api/recommendations/[id]/reject/route.ts (validate via project)
- app/api/snapshots/[id]/route.ts (validate via project)

**Acceptance Criteria:**
- [ ] All standalone resource routes check auth
- [ ] Resources filtered by user's projects where applicable
- [ ] Individual resources validated via project ownership
- [ ] 401/403 returned appropriately

---

## Phase 5: Protect Pages

### Task 5.1: Protect Project Pages

**Description:** Add auth guards to all project-related pages
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.3
**Can run parallel with:** None

**Implementation Pattern:**

For each page, add auth check at the start:

```typescript
import { redirect } from 'next/navigation'
import { getCurrentUser, requireProjectOwnership } from '@/lib/auth'

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  try {
    await requireProjectOwnership(params.id)
  } catch {
    redirect('/projects')
  }

  // ... rest of page
}
```

**Pages to update:**
- app/projects/page.tsx (just auth check, no ownership)
- app/projects/[id]/page.tsx
- app/projects/[id]/research/[runId]/page.tsx
- app/projects/[id]/snapshots/page.tsx
- app/projects/[id]/assessment/page.tsx
- app/projects/[id]/assessment/history/page.tsx
- app/snapshots/[snapshotId]/page.tsx (validate via project)

**Acceptance Criteria:**
- [ ] All project pages require authentication
- [ ] Project detail pages validate ownership
- [ ] Unauthorized access redirects to /projects or /login
- [ ] Pages still function correctly after auth passes

---

## Phase 6: Railway Deployment

### Task 6.1: Update Next.js Config for Standalone

**Description:** Configure Next.js for standalone Docker deployment
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 6.2

**Implementation:**

Update `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Docker deployment
};

export default nextConfig;
```

**Acceptance Criteria:**
- [ ] next.config.ts has output: 'standalone'
- [ ] Build succeeds with standalone output
- [ ] .next/standalone directory created after build

---

### Task 6.2: Create Dockerfile

**Description:** Create optimized multi-stage Dockerfile for Railway deployment
**Size:** Medium
**Priority:** High
**Dependencies:** Task 6.1
**Can run parallel with:** Task 6.3

**Implementation:**

Create `Dockerfile`:

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Build-time environment variables for NEXT_PUBLIC_*
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and generated client for migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

**Acceptance Criteria:**
- [ ] Dockerfile created with multi-stage build
- [ ] NEXT_PUBLIC_* variables passed as ARGs
- [ ] Prisma client included in final image
- [ ] Image builds successfully locally
- [ ] Image size < 200MB

---

### Task 6.3: Create Railway Configuration

**Description:** Create railway.toml for deployment configuration
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 6.2

**Implementation:**

Create `railway.toml`:

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "npx prisma migrate deploy && node server.js"
healthcheckPath = "/"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**Key notes:**
- startCommand runs migrations before starting server
- Healthcheck ensures app is responsive

**Acceptance Criteria:**
- [ ] railway.toml created
- [ ] Uses Dockerfile builder
- [ ] Runs Prisma migrations on deploy
- [ ] Healthcheck configured

---

### Task 6.4: Update .env.example with All Variables

**Description:** Update .env.example with complete production variable list
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 1.2
**Can run parallel with:** Task 6.1-6.3

**Implementation:**

Update `.env.example`:

```bash
# =============================================================================
# DATABASE
# =============================================================================
# Local: postgresql://user:password@localhost:5432/dbname
# Railway: postgresql://postgres:xxx@postgres.railway.internal:5432/railway
DATABASE_URL="postgresql://user:password@localhost:5432/guru_builder"

# =============================================================================
# SUPABASE AUTH
# =============================================================================
# Get from Supabase Dashboard > Settings > API
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# =============================================================================
# APP CONFIGURATION
# =============================================================================
# Local: http://localhost:3002
# Railway: https://your-app.up.railway.app
NEXT_PUBLIC_APP_URL="http://localhost:3002"

# Email whitelist (comma-separated, case-insensitive)
ALLOWED_EMAILS="mbiyimoh@33strategies.ai"

# =============================================================================
# AI APIS
# =============================================================================
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# =============================================================================
# INNGEST (Background Jobs)
# =============================================================================
# Get from Inngest Dashboard
INNGEST_SIGNING_KEY="signkey-prod-xxx"
INNGEST_EVENT_KEY="xxx"

# Local dev only (optional)
# INNGEST_DEV_URL="http://localhost:8288"
```

**Acceptance Criteria:**
- [ ] .env.example has all required variables
- [ ] Variables are documented with comments
- [ ] Local and production examples shown

---

## Phase 7: Testing & Validation

### Task 7.1: Test Auth Flows Locally

**Description:** Manual testing of all auth flows before deployment
**Size:** Medium
**Priority:** High
**Dependencies:** All Phase 1-5 tasks
**Can run parallel with:** None

**Test Checklist:**

1. **Signup Flow:**
   - [ ] Navigate to /signup
   - [ ] Try non-whitelisted email → Should show error
   - [ ] Try whitelisted email → Should create account
   - [ ] Should redirect to /projects

2. **Login Flow:**
   - [ ] Navigate to /login
   - [ ] Try wrong password → Should show error
   - [ ] Try correct credentials → Should login
   - [ ] Should redirect to /projects (or ?redirect param)

3. **Protected Routes:**
   - [ ] When logged out, /projects redirects to /login
   - [ ] When logged in, can access /projects
   - [ ] When logged in, can create new project
   - [ ] Can only see own projects

4. **API Protection:**
   - [ ] GET /api/projects without auth → 401
   - [ ] GET /api/projects with auth → Only own projects
   - [ ] Access other user's project → 403

5. **Navigation:**
   - [ ] Logged out: Shows Sign in / Sign up
   - [ ] Logged in: Shows email and Sign out
   - [ ] Sign out works and redirects to /login

**Acceptance Criteria:**
- [ ] All test scenarios pass
- [ ] No console errors
- [ ] Auth state persists across page refreshes

---

### Task 7.2: Deploy to Railway

**Description:** Deploy application to Railway with all services configured
**Size:** Medium
**Priority:** High
**Dependencies:** All Phase 6 tasks, Task 7.1
**Can run parallel with:** None

**Deployment Steps:**

1. **Create Railway Project:**
   - Go to railway.app
   - Create new project
   - Connect GitHub repository

2. **Add PostgreSQL:**
   - Add PostgreSQL service
   - Copy DATABASE_URL for configuration

3. **Configure Environment Variables:**
   ```
   DATABASE_URL=postgresql://postgres:xxx@postgres.railway.internal:5432/railway
   NEXT_PUBLIC_SUPABASE_URL=<from Supabase>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase>
   NEXT_PUBLIC_APP_URL=https://<your-app>.up.railway.app
   ALLOWED_EMAILS=mbiyimoh@33strategies.ai
   OPENAI_API_KEY=<your key>
   ANTHROPIC_API_KEY=<your key>
   INNGEST_SIGNING_KEY=<from Inngest>
   INNGEST_EVENT_KEY=<from Inngest>
   ```

4. **Deploy:**
   - Push to main branch or trigger deploy
   - Watch build logs for errors
   - Verify healthcheck passes

5. **Configure Supabase:**
   - Add Railway URL to Supabase redirect URLs:
     - Site URL: https://<your-app>.up.railway.app
     - Redirect URLs: https://<your-app>.up.railway.app/**

6. **Sync Inngest:**
   - Go to Inngest dashboard
   - Add app URL: https://<your-app>.up.railway.app/api/inngest
   - Verify functions sync

**Acceptance Criteria:**
- [ ] Railway deployment succeeds
- [ ] Database migrations run on deploy
- [ ] App accessible at Railway URL
- [ ] Auth works in production
- [ ] Inngest functions synced

---

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| 1. Database & Dependencies | 1.1, 1.2 | High |
| 2. Supabase Client | 2.1, 2.2, 2.3, 2.4 | High |
| 3. Auth Pages | 3.1, 3.2, 3.3, 3.4 | High |
| 4. Protect APIs | 4.1, 4.2, 4.3 | High |
| 5. Protect Pages | 5.1 | High |
| 6. Deployment | 6.1, 6.2, 6.3, 6.4 | High |
| 7. Testing | 7.1, 7.2 | High |

**Total Tasks:** 17
**Parallel Opportunities:** Tasks within each phase can often run in parallel
**Critical Path:** Phase 1 → Phase 2 → Phase 3/4/5 (parallel) → Phase 6 → Phase 7
