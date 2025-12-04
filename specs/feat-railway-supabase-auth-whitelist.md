# Railway Deployment with Supabase Email Auth and Whitelist Access Control

**Status:** Draft
**Authors:** Claude Code
**Date:** 2025-12-03
**Related:** [Ideation Document](../docs/ideation/railway-deployment-supabase-auth.md)

---

## Overview

Deploy the Guru Builder application to Railway with public URL access and implement user authentication using Supabase. Authentication is limited to email/password only (no OAuth) with an email whitelist to control who can create accounts. Existing projects will be assigned to the first admin user on initial login.

---

## Background / Problem Statement

The Guru Builder application currently has **zero authentication**:
- All 28+ API endpoints are completely unprotected
- Anyone can view, modify, or delete any project
- No user identity or ownership tracking exists
- The application runs only locally with no production deployment

This spec addresses two critical needs:
1. **Production Deployment:** Make the application accessible via a public Railway URL
2. **Access Control:** Implement authentication with email whitelist to restrict access to approved users only

---

## Goals

- Deploy Guru Builder to Railway with a publicly accessible URL
- Implement email/password authentication via Supabase Auth
- Restrict signups to whitelisted email addresses only
- Add user ownership to all projects (users can only see their own data)
- Protect all API routes with authentication checks
- Assign existing orphan projects to the first admin user
- Ensure Inngest background jobs continue working in production

---

## Non-Goals

- Google OAuth or any social login providers (explicitly deferred)
- Email verification flow (whitelist provides access control)
- Password reset UI (use Supabase dashboard for now)
- Custom domain configuration (use *.railway.app)
- Role-based access control (just basic ownership)
- Team/organization features
- Migrating application data to Supabase PostgreSQL

---

## Technical Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `@supabase/supabase-js` | ^2.x | Supabase client SDK |
| `@supabase/ssr` | ^0.x | Server-side auth with cookies |
| Next.js | 15.2.4 | Already installed |
| Prisma | 5.22.0 | Already installed |
| Railway | N/A | Hosting platform |
| Inngest | 3.30.0 | Already installed |

**External Services:**
- Supabase Cloud (Free tier) - Authentication service
- Railway (Hobby tier) - Hosting + PostgreSQL database
- Inngest Cloud - Background job orchestration

---

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RAILWAY PLATFORM                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────┐     ┌──────────────────────┐             │
│  │   Next.js App        │     │  Railway PostgreSQL  │             │
│  │   (Docker Container) │────▶│  (Application Data)  │             │
│  │                      │     │  - Projects          │             │
│  │  Port: 3000          │     │  - Users (synced)    │             │
│  └──────────┬───────────┘     │  - Layers, Files...  │             │
│             │                  └──────────────────────┘             │
│             │                                                        │
└─────────────┼────────────────────────────────────────────────────────┘
              │
              │ Auth Requests
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SUPABASE CLOUD (Auth Only)                      │
├─────────────────────────────────────────────────────────────────────┤
│  - User registration/login                                           │
│  - Session management (JWT + cookies)                                │
│  - Password hashing                                                  │
│  - No application data stored here                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ middleware.ts                                                        │
│ 1. Refresh Supabase session (prevents expiration)                   │
│ 2. Check if route requires auth                                      │
│ 3. Redirect to /login if unauthenticated on protected routes        │
└─────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ API Route / Page                                                     │
│ 1. Call getCurrentUser() or requireUser()                           │
│ 2. Query Prisma with userId filter                                  │
│ 3. Return 401/403 for unauthorized access                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Database Schema Changes

#### New User Model

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
```

#### Modified Project Model

```prisma
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

**Migration Strategy:**
1. Add `userId` as nullable field first
2. Deploy and run migration
3. First admin login triggers orphan project assignment
4. After all projects have owners, optionally make `userId` required

### File Structure

```
lib/
├── supabase/
│   ├── client.ts          # Browser client (createBrowserClient)
│   ├── server.ts          # Server client (createServerClient with cookies)
│   └── middleware.ts      # updateSession helper for middleware
├── auth.ts                # Auth helpers: getCurrentUser, requireUser, isWhitelisted
└── db.ts                  # Existing Prisma client (unchanged)

middleware.ts              # Root middleware for session refresh + route protection

app/
├── (auth)/                # Route group for auth pages (public)
│   ├── login/
│   │   ├── page.tsx       # Login form
│   │   └── actions.ts     # Server action: login
│   └── signup/
│       ├── page.tsx       # Signup form with whitelist notice
│       └── actions.ts     # Server action: signup with whitelist check
├── auth/
│   └── callback/
│       └── route.ts       # Auth callback: sync to Prisma + assign orphans
└── layout.tsx             # Updated with auth nav state

Dockerfile                 # Multi-stage optimized build
railway.toml               # Railway configuration
```

### Implementation Details

#### 1. Supabase Client Setup

**lib/supabase/client.ts** (Browser):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**lib/supabase/server.ts** (Server Components, Route Handlers, Server Actions):
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
          }
        },
      },
    }
  )
}
```

#### 2. Auth Helpers

**lib/auth.ts**:
```typescript
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { cache } from 'react'

// Whitelist check
export function isEmailWhitelisted(email: string): boolean {
  const whitelist = process.env.ALLOWED_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || []
  return whitelist.includes(email.toLowerCase())
}

// Get current user (cached per request)
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

// Require user (throws if not authenticated)
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

// Require ownership of a project
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

// Sign out helper
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
```

#### 3. Middleware

**middleware.ts**:
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

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublicRoute = PUBLIC_ROUTES.some(route =>
    path === route || path.startsWith('/auth/')
  )
  const isApiRoute = path.startsWith('/api/')

  // Redirect unauthenticated users on protected routes
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

#### 4. Signup with Whitelist Check

**app/(auth)/signup/actions.ts**:
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
    return { error: 'This email is not authorized to create an account. Contact an administrator for access.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/projects')
}
```

#### 5. Auth Callback with Orphan Project Assignment

**app/auth/callback/route.ts**:
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
      if (user.email === ADMIN_EMAIL) {
        const orphanProjects = await prisma.project.findMany({
          where: { userId: null },
          select: { id: true },
        })

        if (orphanProjects.length > 0) {
          await prisma.project.updateMany({
            where: { userId: null },
            data: { userId: user.id },
          })
          console.log(`[Auth] Assigned ${orphanProjects.length} orphan projects to admin`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

#### 6. Protected API Route Pattern

**app/api/projects/route.ts** (example):
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

#### 7. Dockerfile (Optimized Multi-Stage)

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

# Build-time environment variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

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

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

#### 8. Railway Configuration

**railway.toml**:
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node server.js"
healthcheckPath = "/"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**next.config.ts** update:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Docker deployment
};

export default nextConfig;
```

### Environment Variables

#### Development (.env.local)
```bash
# Database (local)
DATABASE_URL="postgresql://user:password@localhost:5432/guru_builder"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# App URL (for auth redirects)
NEXT_PUBLIC_APP_URL="http://localhost:3002"

# Email whitelist (comma-separated)
ALLOWED_EMAILS="mbiyimoh@33strategies.ai"

# Inngest (dev)
INNGEST_SIGNING_KEY="signkey-dev-local"
INNGEST_EVENT_KEY="inngest-dev-local"

# AI APIs
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
```

#### Production (Railway)
```bash
# Database (Railway PostgreSQL internal URL)
DATABASE_URL="postgresql://postgres:xxx@postgres.railway.internal:5432/railway"

# Supabase Auth (same as dev)
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# App URL (Railway domain)
NEXT_PUBLIC_APP_URL="https://guru-builder-production.up.railway.app"

# Email whitelist
ALLOWED_EMAILS="mbiyimoh@33strategies.ai,other@example.com"

# Inngest (production keys from Inngest Cloud)
INNGEST_SIGNING_KEY="signkey-prod-xxx"
INNGEST_EVENT_KEY="xxx"

# AI APIs
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
```

---

## User Experience

### Login Flow
1. User navigates to `/login`
2. Enters email and password
3. On success, redirected to `/projects`
4. On failure, sees error message

### Signup Flow
1. User navigates to `/signup`
2. Page displays notice: "Signup is restricted to approved email addresses"
3. Enters email and password
4. If email not on whitelist: "This email is not authorized..."
5. If email on whitelist: account created, redirected to `/projects`

### Navigation (Authenticated)
```
┌─────────────────────────────────────────────────────────────────┐
│  Guru Builder     Projects     [user@email.com ▼]  [Logout]    │
└─────────────────────────────────────────────────────────────────┘
```

### Access Denied Handling
- API routes return `401 Unauthorized` for unauthenticated requests
- API routes return `403 Forbidden` for accessing other users' resources
- Pages redirect to `/login` with `?redirect=` parameter

---

## Testing Strategy

### Unit Tests
- `isEmailWhitelisted()` - Test whitelist matching (case insensitive, trimming)
- `getCurrentUser()` - Mock Supabase client, test caching behavior
- `requireProjectOwnership()` - Test authorization logic

### Integration Tests
- Signup with whitelisted email (should succeed)
- Signup with non-whitelisted email (should fail with clear message)
- Login with valid credentials (should succeed)
- Login with invalid credentials (should fail)
- API routes without auth token (should return 401)
- API routes accessing other user's project (should return 403)

### E2E Tests (Playwright)

**tests/auth-flow.spec.ts**:
```typescript
test.describe('Authentication', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show error for non-whitelisted signup', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('[name="email"]', 'notallowed@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await expect(page.locator('.error')).toContainText('not authorized')
  })

  test('should allow whitelisted user to signup and access projects', async ({ page }) => {
    // This test requires a test email in the whitelist
    await page.goto('/signup')
    await page.fill('[name="email"]', process.env.TEST_WHITELISTED_EMAIL!)
    await page.fill('[name="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/projects/)
  })
})
```

### Test Environment Setup
- Add `TEST_WHITELISTED_EMAIL` to CI environment
- Create separate Supabase project for testing (or use Supabase local)
- Mock Supabase in unit tests with `vitest` or `jest`

---

## Performance Considerations

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| Auth check on every request | Minor latency | Session caching via `cache()`, middleware refresh |
| Prisma user lookup | ~5-10ms per request | Cached via React `cache()` per request |
| Docker image size | Cold start time | Multi-stage build reduces to ~100MB |
| Railway cold starts | First request delay | Use hobby tier with always-on, or scale to 1 |

---

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Password security | Supabase handles hashing (bcrypt) |
| Session hijacking | HTTP-only cookies, secure flag in production |
| CSRF | Supabase uses secure cookie settings |
| Brute force | Supabase has built-in rate limiting |
| SQL injection | Prisma parameterized queries |
| Unauthorized access | Server-side auth check with `getUser()` (not `getSession()`) |
| Whitelist bypass | Check whitelist server-side before Supabase call |
| Orphan project exposure | Assign to admin on first login, filter by userId |

**Critical Security Note:**
Always use `supabase.auth.getUser()` in server code, never `getSession()`. The `getUser()` method verifies the JWT with Supabase servers, while `getSession()` can be spoofed.

---

## Documentation Updates

- [ ] Update `README.md` with deployment instructions
- [ ] Update `.env.example` with new variables
- [ ] Add `DEPLOYMENT.md` guide for Railway setup
- [ ] Update `CLAUDE.md` with auth patterns for future development

---

## Implementation Phases

### Phase 1: Database & Auth Foundation
1. Add User model to Prisma schema
2. Add userId to Project model (nullable)
3. Run migration
4. Install Supabase packages
5. Create Supabase client utilities
6. Create auth helper functions
7. Create middleware

### Phase 2: Auth Pages & Actions
1. Create login page and server action
2. Create signup page with whitelist check
3. Create auth callback route with orphan assignment
4. Update layout with auth navigation

### Phase 3: Protect API Routes
1. Update `/api/projects` routes
2. Update `/api/projects/[id]/*` nested routes
3. Update `/api/research-runs/*` routes
4. Update `/api/recommendations/*` routes
5. Update `/api/snapshots/*` routes
6. Update `/api/context-layers/*` routes
7. Update `/api/knowledge-files/*` routes

### Phase 4: Protect Pages
1. Update projects list page
2. Update project detail page
3. Update all project subpages
4. Update research run pages

### Phase 5: Railway Deployment
1. Update `next.config.ts` with standalone output
2. Create Dockerfile
3. Create `railway.toml`
4. Create Railway project
5. Add PostgreSQL service
6. Configure environment variables
7. Deploy via GitHub integration
8. Verify Inngest webhook sync

### Phase 6: Testing & Validation
1. Test signup flow (whitelisted and non-whitelisted)
2. Test login flow
3. Test protected routes (auth required)
4. Test ownership (can't see others' projects)
5. Test orphan project assignment
6. Test Inngest jobs in production

---

## Open Questions

1. **Supabase Project Creation:** Does the user already have a Supabase account/project, or should guidance be included?
   - *Recommendation:* Include step-by-step Supabase setup in deployment guide

2. **Railway GitHub Integration:** Should deployment be via GitHub auto-deploy or manual?
   - *Recommendation:* GitHub integration for automatic deploys on push

3. **Password Requirements:** Should we enforce minimum password strength?
   - *Recommendation:* Use Supabase defaults (6+ characters)

4. **Session Duration:** How long should sessions last before requiring re-login?
   - *Recommendation:* Use Supabase defaults (1 week with refresh)

---

## References

- [Supabase SSR Auth Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Railway Deployment Docs](https://docs.railway.com/)
- [Next.js Standalone Output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Inngest Production Deployment](https://www.inngest.com/docs/deploy)
- [Ideation Document](../docs/ideation/railway-deployment-supabase-auth.md)

---

## Appendix: API Routes Requiring Auth Updates

| Route | Methods | Auth Check | Ownership Check |
|-------|---------|------------|-----------------|
| `/api/projects` | GET, POST | requireUser | Filter by userId |
| `/api/projects/[id]` | GET, PATCH, DELETE | requireUser | requireProjectOwnership |
| `/api/projects/[id]/apply-recommendations` | POST | requireUser | requireProjectOwnership |
| `/api/projects/[id]/snapshots` | GET, POST | requireUser | requireProjectOwnership |
| `/api/projects/[id]/assessment/*` | ALL | requireUser | requireProjectOwnership |
| `/api/context-layers` | GET, POST | requireUser | Filter/assign by userId |
| `/api/context-layers/[id]` | GET, PATCH, DELETE | requireUser | Via project ownership |
| `/api/knowledge-files` | GET, POST | requireUser | Filter/assign by userId |
| `/api/knowledge-files/[id]` | GET, PATCH, DELETE | requireUser | Via project ownership |
| `/api/research-runs` | GET, POST | requireUser | Filter/assign by userId |
| `/api/research-runs/[id]` | GET | requireUser | Via project ownership |
| `/api/recommendations` | GET | requireUser | Filter by owned projects |
| `/api/recommendations/[id]/approve` | POST | requireUser | Via project ownership |
| `/api/recommendations/[id]/reject` | POST | requireUser | Via project ownership |
| `/api/snapshots/[id]` | GET, POST (restore) | requireUser | Via project ownership |
| `/api/inngest` | ALL | Inngest signing key | N/A (webhook) |
