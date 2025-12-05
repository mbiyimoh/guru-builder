# Railway Deployment + Supabase Authentication

**Slug:** railway-deployment-supabase-auth
**Author:** Claude Code
**Date:** 2025-12-03
**Branch:** preflight/railway-deployment-supabase-auth
**Related:** N/A (new feature)

---

## 1) Intent & Assumptions

**Task brief:** Deploy the Guru Builder application to Railway with a public URL, and implement user authentication using Supabase (supporting email/password and Google SSO).

**Assumptions:**
- Railway is the preferred hosting platform (not Vercel, Fly.io, etc.)
- Supabase Auth is the preferred auth provider (not Auth.js, Clerk, etc.)
- The existing PostgreSQL database schema and Prisma ORM should be preserved
- Inngest background jobs must continue working in production
- Multi-user support is desired (users can only see their own projects)

**Out of scope:**
- Migrating application data to Supabase PostgreSQL (keeping Railway PostgreSQL)
- Role-based access control (admin vs. user) - just basic ownership
- Team/organization features
- Payment/subscription integration
- Email customization beyond basic confirmation

---

## 2) Pre-reading Log

| File | Takeaway |
|------|----------|
| `package.json` | Next.js 15, React 19, Prisma 5.22, Inngest 3.30. No auth libraries present. |
| `prisma/schema.prisma` | No User model exists. Projects have no ownership. 14 models total. |
| `.env.example` | Currently needs: DATABASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY, INNGEST keys |
| `next.config.ts` | Minimal config - needs `output: 'standalone'` for Docker deployment |
| `app/layout.tsx` | No auth providers, no session context. Simple public nav. |
| `app/api/projects/route.ts` | Returns ALL projects to anyone. No auth checks. |
| `lib/inngest-functions.ts` | Background jobs for research runs. Need Inngest Cloud webhook URL. |

---

## 3) Codebase Map

### Primary Components/Modules

| Path | Role | Auth Impact |
|------|------|-------------|
| `app/api/projects/*` | Project CRUD | Add userId filter + ownership checks |
| `app/api/projects/[id]/*` | Project detail APIs | Add ownership validation |
| `app/api/research-runs/*` | Research run management | Add ownership checks |
| `app/api/recommendations/*` | Recommendation approval | Add ownership checks |
| `app/api/snapshots/*` | Backup/restore | Add ownership checks |
| `app/api/inngest/route.ts` | Inngest webhook | Protect with signing key verification |
| `app/projects/*` | Project pages | Add auth guards, redirect to login |
| `app/layout.tsx` | Root layout | Add Supabase provider, nav auth state |

### Shared Dependencies

| Dependency | Location | Notes |
|------------|----------|-------|
| Prisma Client | `lib/db.ts` | Keep for app data on Railway PostgreSQL |
| Inngest Client | `lib/inngest.ts` | Update with production event key |
| Zod Validation | `lib/validation.ts` | Extend with auth schemas |
| API Helpers | `lib/apiHelpers.ts` | Add auth middleware helper |

### Data Flow

```
User Request
    │
    ▼
middleware.ts (NEW) ─────────────────────────────┐
    │ Refresh Supabase session                   │
    │ Check protected routes                     │
    ▼                                            │
API Route / Page                                 │
    │                                            │
    ├── lib/supabase/server.ts (NEW)             │
    │   └── getUser() for auth                   │
    │                                            │
    └── lib/db.ts (Prisma)                       │
        └── Query with userId filter             │
                                                 │
Supabase Auth ◄──────────────────────────────────┘
(External - handles sessions, JWT, OAuth)
```

### Feature Flags/Config

| Config | Current | Needed |
|--------|---------|--------|
| `DATABASE_URL` | Local PostgreSQL | Railway PostgreSQL internal URL |
| `NEXT_PUBLIC_SUPABASE_URL` | N/A | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | N/A | Supabase anon key |
| `INNGEST_SIGNING_KEY` | Dev key | Production signing key |
| `INNGEST_EVENT_KEY` | Dev key | Production event key |

### Potential Blast Radius

**HIGH IMPACT (breaking changes):**
- Every API route needs auth checks
- All database queries need userId filtering
- Project pages need ownership validation
- Database schema needs User model + foreign keys

**MEDIUM IMPACT (configuration):**
- Environment variables for production
- Inngest webhook URL update
- Next.js config for standalone output

**LOW IMPACT (additions):**
- New auth pages (login, signup)
- New Supabase client utilities
- New middleware file

---

## 4) Root Cause Analysis

**N/A** - This is a feature addition, not a bug fix.

---

## 5) Research Findings

### Potential Solutions

#### Solution 1: Supabase Auth + Railway PostgreSQL (RECOMMENDED)

**Description:** Use Supabase Cloud solely for authentication. Keep application data in Railway PostgreSQL with Prisma.

**Pros:**
- Keeps existing Prisma schema and migrations
- Railway PostgreSQL is cheaper ($5-15/month vs Supabase $25+/month)
- Full control over application database
- Managed auth without vendor lock-in for data
- Inngest integration remains unchanged

**Cons:**
- Two separate systems to manage
- Cannot use Supabase Row Level Security
- Must sync user records between Supabase Auth and Prisma User model
- Slightly more complex middleware setup

**Complexity:** Medium
**Cost:** ~$10-25/month (Railway Hobby + Supabase Free tier)

---

#### Solution 2: Full Supabase (Auth + Database)

**Description:** Migrate everything to Supabase - auth and PostgreSQL database.

**Pros:**
- Single managed platform
- Row Level Security integration
- Built-in realtime subscriptions
- Simpler auth integration

**Cons:**
- Must migrate existing schema to Supabase
- Higher cost at scale ($25/month Pro tier minimum)
- May need to rewrite Prisma queries to Supabase client
- Inngest needs to connect to Supabase DB instead

**Complexity:** High (migration required)
**Cost:** $25+/month (Supabase Pro)

---

#### Solution 3: Auth.js (NextAuth) + Railway

**Description:** Use Auth.js instead of Supabase for authentication.

**Pros:**
- Native Next.js integration
- No external auth service dependency
- Flexible provider support
- Sessions stored in same database

**Cons:**
- More setup required for OAuth providers
- Must manage JWT secrets and session storage
- No managed auth dashboard
- More code to maintain

**Complexity:** Medium-High
**Cost:** ~$5-15/month (Railway only)

---

### Recommendation

**Solution 1: Supabase Auth + Railway PostgreSQL**

**Rationale:**
1. Preserves existing Prisma schema and investments
2. Lowest cost for MVP stage
3. Managed auth reduces security risks
4. Can migrate to full Supabase later if needed
5. Clear separation of concerns (auth vs. data)

---

## 6) Clarification Questions for User

1. **User data retention:** When a user deletes their account, should their projects be:
   - A) Deleted permanently
   - B) Anonymized but retained
   - C) Transferred to an admin account

2. **Google OAuth branding:** Do you have a Google Cloud project set up, or should I guide you through creating one?

3. **Email verification:** Should users be required to verify their email before accessing the app, or can they start using it immediately?

4. **Existing data:** There appear to be existing projects in the database. Should these be:
   - A) Assigned to the first admin user who signs up
   - B) Deleted before going to production
   - C) Left as-is (accessible to anyone logged in)

5. **Custom domain:** Do you have a domain ready for the Railway deployment, or will you use the `*.railway.app` subdomain initially?

---

## 7) Implementation Work Items

### Phase 1: Database Schema (Est. 1-2 hours)

- [ ] Add `User` model to Prisma schema (synced with Supabase user.id)
- [ ] Add `userId` foreign key to `Project` model
- [ ] Create migration: `npm run migrate:safe -- add-user-model`
- [ ] Update `Project` indexes for user filtering

**Schema changes:**
```prisma
model User {
  id        String   @id // Matches Supabase user.id (UUID)
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  projects  Project[]
}

model Project {
  // ... existing fields
  userId    String
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

---

### Phase 2: Supabase Setup (Est. 30 min)

- [ ] Create Supabase project at supabase.com
- [ ] Enable Email provider in Authentication settings
- [ ] Enable Google OAuth provider
- [ ] Configure redirect URLs for localhost and production
- [ ] Copy `SUPABASE_URL` and `SUPABASE_ANON_KEY`

**Google OAuth setup:**
1. Create Google Cloud project
2. Enable OAuth consent screen
3. Create OAuth 2.0 credentials
4. Add Supabase callback URL: `https://<project>.supabase.co/auth/v1/callback`

---

### Phase 3: Supabase Client Integration (Est. 2-3 hours)

- [ ] Install packages: `npm install @supabase/supabase-js @supabase/ssr`
- [ ] Create `lib/supabase/client.ts` (browser client)
- [ ] Create `lib/supabase/server.ts` (server client with cookies)
- [ ] Create `lib/supabase/middleware.ts` (session refresh logic)
- [ ] Create `lib/auth.ts` (helper functions: getCurrentUser, requireUser)
- [ ] Create root `middleware.ts` (session refresh + route protection)

**Key files to create:**
```
lib/
├── supabase/
│   ├── client.ts      # createBrowserClient
│   ├── server.ts      # createServerClient with cookies
│   └── middleware.ts  # updateSession helper
├── auth.ts            # getCurrentUser, requireUser, signOut
```

---

### Phase 4: Auth Pages (Est. 2-3 hours)

- [ ] Create `app/(auth)/login/page.tsx` - Email + Google login
- [ ] Create `app/(auth)/login/actions.ts` - Server actions
- [ ] Create `app/(auth)/signup/page.tsx` - Registration form
- [ ] Create `app/(auth)/signup/actions.ts` - Server actions
- [ ] Create `app/auth/callback/route.ts` - OAuth callback + user sync
- [ ] Create `app/auth/confirm/route.ts` - Email confirmation

**Route structure:**
```
app/
├── (auth)/           # Auth pages (public)
│   ├── login/
│   │   ├── page.tsx
│   │   └── actions.ts
│   └── signup/
│       ├── page.tsx
│       └── actions.ts
├── auth/             # Auth API routes
│   ├── callback/route.ts    # OAuth callback, sync to Prisma
│   └── confirm/route.ts     # Email verification
```

---

### Phase 5: Protect API Routes (Est. 3-4 hours)

- [ ] Update `app/api/projects/route.ts` - Filter by userId
- [ ] Update `app/api/projects/[id]/route.ts` - Ownership validation
- [ ] Update all nested project routes - Add auth checks
- [ ] Update research run routes - Ownership validation
- [ ] Update recommendation routes - Ownership validation
- [ ] Update snapshot routes - Ownership validation
- [ ] Add auth middleware helper for DRY code

**Pattern for protected routes:**
```typescript
import { requireUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await requireUser() // Throws if not authenticated

  const projects = await prisma.project.findMany({
    where: { userId: user.id }
  })

  return NextResponse.json({ projects })
}
```

---

### Phase 6: Protect Pages (Est. 1-2 hours)

- [ ] Update `app/projects/page.tsx` - Redirect if not logged in
- [ ] Update `app/projects/[id]/page.tsx` - Ownership check
- [ ] Update all project subpages - Ownership checks
- [ ] Update `app/layout.tsx` - Add auth state to nav

**Pattern for protected pages:**
```typescript
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default async function ProjectsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // ... render page
}
```

---

### Phase 7: Railway Deployment (Est. 1-2 hours)

- [ ] Update `next.config.ts` with `output: 'standalone'`
- [ ] Create `Dockerfile` (multi-stage, optimized)
- [ ] Create `railway.toml` configuration
- [ ] Create Railway project and PostgreSQL service
- [ ] Configure environment variables in Railway
- [ ] Run `prisma migrate deploy` on Railway database
- [ ] Deploy via GitHub integration
- [ ] Configure custom domain (optional)

**Required Railway environment variables:**
```
DATABASE_URL=postgresql://...@postgres.railway.internal:5432/railway
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

---

### Phase 8: Inngest Production Setup (Est. 30 min)

- [ ] Create Inngest Cloud account (if not exists)
- [ ] Get production event key and signing key
- [ ] Update environment variables
- [ ] Deploy app and verify Inngest webhook syncs
- [ ] Test research run execution in production

---

### Phase 9: Testing & Validation (Est. 1-2 hours)

- [ ] Test email/password signup flow
- [ ] Test email/password login flow
- [ ] Test Google OAuth flow
- [ ] Test email confirmation
- [ ] Test protected routes (logged out → redirects)
- [ ] Test project ownership (can't see others' projects)
- [ ] Test research run execution in production
- [ ] Test recommendation workflow end-to-end

---

## 8) Files to Create (Complete List)

```
NEW FILES:
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser Supabase client
│   │   ├── server.ts              # Server Supabase client
│   │   └── middleware.ts          # Session update helper
│   └── auth.ts                    # Auth helper functions
├── middleware.ts                  # Root middleware for auth
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   ├── page.tsx           # Login page
│   │   │   └── actions.ts         # Login server actions
│   │   └── signup/
│   │       ├── page.tsx           # Signup page
│   │       └── actions.ts         # Signup server actions
│   └── auth/
│       ├── callback/route.ts      # OAuth callback handler
│       └── confirm/route.ts       # Email confirmation handler
├── Dockerfile                     # Optimized production build
└── railway.toml                   # Railway configuration

MODIFIED FILES:
├── prisma/schema.prisma           # Add User model, userId to Project
├── next.config.ts                 # Add output: 'standalone'
├── package.json                   # Add Supabase packages
├── .env.example                   # Add Supabase env vars
├── app/layout.tsx                 # Add auth state to nav
├── app/api/projects/route.ts      # Add auth + user filtering
├── app/api/projects/[id]/route.ts # Add ownership validation
├── app/api/projects/[id]/*        # Add auth to all nested routes
├── app/api/research-runs/*        # Add ownership validation
├── app/api/recommendations/*      # Add ownership validation
├── app/projects/page.tsx          # Add auth guard
└── app/projects/[id]/*            # Add ownership checks
```

---

## 9) Estimated Total Effort

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| 1. Database Schema | 1-2 hours | None |
| 2. Supabase Setup | 30 min | None |
| 3. Supabase Client | 2-3 hours | Phase 2 |
| 4. Auth Pages | 2-3 hours | Phase 3 |
| 5. Protect APIs | 3-4 hours | Phases 1, 3 |
| 6. Protect Pages | 1-2 hours | Phases 3, 5 |
| 7. Railway Deploy | 1-2 hours | Phases 1-6 |
| 8. Inngest Setup | 30 min | Phase 7 |
| 9. Testing | 1-2 hours | All phases |

**Total Estimate:** 12-18 hours of implementation work

---

## 10) Risk Considerations

| Risk | Mitigation |
|------|------------|
| Database migration breaks existing data | Backup first with `npm run db:backup`, use `migrate:safe` |
| OAuth redirect URL mismatch | Double-check Supabase + Google Console URLs match exactly |
| Inngest functions fail in production | Test locally first, check signing key verification |
| NEXT_PUBLIC_ vars not available | Use Dockerfile ARG/ENV for build-time injection |
| Session not persisting | Verify middleware runs on all routes, check cookie settings |
| Existing projects orphaned | Create migration script to assign to first admin |

---

## Sources

- [Railway Documentation](https://docs.railway.com/)
- [Supabase Server-Side Auth](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Creating Supabase SSR Client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Google OAuth with Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Railway PostgreSQL](https://docs.railway.com/guides/postgresql)
- [Custom Docker for Next.js on Railway](https://apvarun.com/blog/custom-docker-for-next-app-on-railway)
- [Inngest Next.js Integration](https://www.inngest.com/docs/getting-started/nextjs-quick-start)
