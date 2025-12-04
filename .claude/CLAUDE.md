# Guru Builder System - Claude Code Project Documentation

## Overview

Guru Builder is a platform for creating AI teaching assistants ("gurus") through an autonomous research-and-apply workflow:

1. **Create** a corpus (context layers + knowledge files) for your guru
2. **Research** autonomously using GPT-4o to find new knowledge
3. **Review** AI-generated recommendations for corpus updates
4. **Apply** approved changes automatically with snapshot backups
5. **Iterate** continuously to improve your guru's knowledge

**Example workflow:** Start with a basic backgammon guru → Run research on "advanced priming strategies" → Review 12 recommendations → Approve 8 → Corpus automatically updated with new expert knowledge.

---

## Core Architecture

### Tech Stack
- **Frontend:** Next.js 15 + React 19 + Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL (Neon) + Prisma ORM
- **Auth:** Supabase (email/password with whitelist)
- **AI:** Vercel AI SDK v5 + OpenAI GPT-4o
- **Background Jobs:** Inngest (asynchronous research runs)
- **Hosting:** Railway (Docker) with health checks
- **Testing:** Playwright E2E

### Production Deployment
- **URL:** https://guru-builder-production.up.railway.app
- **Deployment Guide:** `developer-guides/06-railway-deployment-guide.md`

### Key Data Models

```
Project
├── ContextLayers[] (always-loaded foundational knowledge)
├── KnowledgeFiles[] (conditionally-loaded reference documents)
├── ResearchRuns[] (research history)
│   └── Recommendations[] (structured change proposals)
└── CorpusSnapshots[] (backup/versioning)
```

### Critical Directories

```
app/
├── api/project/[id]/
│   ├── context-layers/      # Layer CRUD
│   ├── knowledge-files/     # File CRUD
│   └── research/            # Research run management
├── projects/[id]/
│   ├── page.tsx             # Corpus overview
│   └── research/[runId]/    # Research results & recommendations

lib/
├── inngest-functions.ts     # Background job orchestration
├── corpusRecommendationGenerator.ts  # GPT-4o structured outputs
├── applyRecommendations.ts  # Applies approved changes
├── contextComposer.ts       # Composes layers into system prompt
└── validation.ts            # Zod schemas for all models

prisma/
└── schema.prisma            # Database schema (source of truth)
```

---

## Authentication System

### Overview
Authentication uses **Supabase email/password** with an email whitelist for access control.

### Key Files
- `lib/auth.ts` - Auth helpers, session management
- `app/auth/callback/route.ts` - OAuth callback, user sync, orphan project assignment
- `middleware.ts` - Route protection
- `app/login/page.tsx` - Login/signup UI

### Email Whitelist
Access is restricted to emails in the `ALLOWED_EMAILS` environment variable (comma-separated).

### Orphan Project Assignment
Projects created before authentication was added are assigned to the admin email (`ADMIN_EMAIL` env var) on their first login. This happens automatically in the auth callback.

### User Flow
1. User visits protected route → Redirected to `/login`
2. User signs up/logs in via Supabase
3. Callback syncs user to Prisma `User` table
4. If admin, orphan projects are assigned
5. Session cookie set, user redirected to `/projects`

---

## Agent Protocols

### Codebase Exploration

**When exploring code or searching for patterns:**
```
Use Task tool with subagent_type: "Explore"
```

This is CRITICAL for:
- Finding how features are implemented
- Understanding code relationships
- Answering architectural questions
- Locating specific patterns across files

**Example queries:**
- "How does research run execution work?"
- "Where are recommendations generated?"
- "What's the structure of the corpus view?"

### Database Schema Changes

**ALWAYS follow this protocol for ANY schema modifications:**

1. **BACKUP FIRST** (mandatory)
   ```bash
   npm run db:backup
   ```

2. **Use safe migration script:**
   ```bash
   npm run migrate:safe -- descriptive-name
   ```

3. **NEVER use these without explicit user approval:**
   ```bash
   # DANGEROUS - Wipes entire database:
   npx prisma db push --force-reset
   npx prisma migrate reset
   ```

See full Database Safety Protocol section below.

### OpenAI Structured Outputs

**CRITICAL for recommendation generation:**

When using OpenAI's `strict: true` mode, optional fields MUST use `.nullable().optional()`:

```typescript
// CORRECT
z.object({
  optionalField: z.string().nullable().optional(),
});

// WRONG - Will cause API error
z.object({
  optionalField: z.string().optional(),
});
```

**Diagnostic location:** Check Inngest logs at http://localhost:8288 for schema validation errors.

---

## Key Resources & Patterns

### Implementation Specification
→ `specs/feat-guru-builder-system-mvp.md`
- Complete feature requirements (1,341 lines)
- Database schemas
- API endpoint contracts
- 5-phase implementation plan

### Project Scaffold (Reusability Analysis)
→ `project-context/guru-builder-project-scaffold.md`
- What exists vs. what needs building
- ~40% foundation already implemented
- Component reusability guide
- Data flow diagrams

### Foundation Code Templates
→ `reference/guru-builder-foundation-code.md`
- Reusable component patterns (~860 lines)
- API route patterns
- Layer management patterns

### Research Integration
The research workflow uses:
1. **GPT-4o** for corpus analysis and recommendation generation
2. **Inngest** for background job execution
3. **Structured outputs** with Zod schemas for type-safe recommendations

Key files:
- `lib/inngest-functions.ts` - Research run orchestration
- `lib/corpusRecommendationGenerator.ts` - GPT-4o prompt engineering
- `lib/applyRecommendations.ts` - Applies changes to corpus

---

## Standard Operating Procedures (SOPs)

### Dev Server Clean Restart Protocol

**CRITICAL:** When restarting the dev server, ALWAYS follow this procedure to avoid stale cache issues:

```bash
# 1. Kill all running processes
pkill -f "next dev" || true
pkill -f "inngest-cli dev" || true

# 2. Clean caches
rm -rf .next
rm -rf node_modules/.cache

# 3. Regenerate Prisma client
npx prisma generate

# 4. Start servers
# Terminal 1: Next.js (port 3002)
PORT=3002 npm run dev

# Terminal 2: Inngest dev server
npx inngest-cli dev
```

**Quick restart (no dependency changes):**
```bash
npm run clean && PORT=3002 npm run dev
```

**Why this is necessary:**
- Next.js Turbopack can have stale cache issues
- Multiple background dev servers cause port conflicts
- TypeScript compilation errors persist without clean rebuild
- Prisma client changes require regeneration

### Database Safety Protocol

**BEFORE ANY SCHEMA MODIFICATION:**

1. **Create backup** (MANDATORY)
   ```bash
   npm run db:backup
   # Creates timestamped backup in backups/ directory
   ```

2. **Use proper migrations**
   ```bash
   # CORRECT
   npm run migrate:safe -- add-new-feature

   # WRONG - Wipes database
   npx prisma db push --force-reset
   ```

3. **Handle existing data**
   - Provide defaults for new required fields
   - Review migration SQL before applying
   - Test on backup first if unsure

**Forbidden commands (require explicit user approval):**
- `npx prisma db push --force-reset`
- `npx prisma migrate reset`
- `npx prisma db push --accept-data-loss`

**Recovery from data loss:**
```bash
psql $DATABASE_URL < backups/backup_TIMESTAMP.sql
```

### Research Run Debugging

**When research runs fail or produce poor results:**

1. Check Inngest Dev UI: http://localhost:8288
2. Review logs for:
   - Full GPT-4o prompts (what AI receives)
   - Raw GPT-4o responses (what it returns)
   - Recommendation parsing errors
   - Confidence filtering metrics (threshold: 0.4)

3. Common issues:
   - Empty corpus (no layers/files to analyze)
   - Schema validation failures (see OpenAI Structured Outputs above)
   - Confidence too low (all recommendations filtered out)

### E2E Test Protocol

**Test cleanup is automatic:**
- All test projects MUST include "Test" or "test" in name
- Global teardown removes test data after completion
- Manual cleanup: `npm run test:cleanup`

**Running tests:**
```bash
npm run test:e2e              # All tests
npm run test:e2e:ui           # Interactive mode
npm run test:e2e:headed       # See browser
npm run test:e2e:report       # View results
```

---

## Port Assignments

- **3002** - Next.js dev server
- **8288** - Inngest dev server
- **5432** - PostgreSQL database
- **5555** - Prisma Studio (`npx prisma studio`)

**Check availability:**
```bash
lsof -i :3002 -P -n | grep LISTEN || echo "Available"
```

---

## Environment Variables

**Required (Local Dev):**
```bash
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="sk-..."  # For GPT-4o research
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

**Authentication:**
```bash
ALLOWED_EMAILS="user1@email.com,user2@email.com"  # Whitelist
ADMIN_EMAIL="admin@email.com"  # Gets orphan projects
```

**For Inngest (background jobs):**
```bash
# Optional for local dev - defaults work
INNGEST_SIGNING_KEY="signkey-dev-local"
INNGEST_EVENT_KEY="inngest-dev-local"
```

**Production (Railway):**
See `developer-guides/06-railway-deployment-guide.md` for full list including:
- `NEXT_PUBLIC_APP_URL` - Production URL for redirects
- All Supabase/Inngest keys for production

---

## Async Job Race Condition Prevention Checklist

**CRITICAL:** When implementing features with Inngest background jobs, ALWAYS check for race conditions.

**The Problem:**
When a background job triggers a follow-up job (e.g., research → recommendation generation), the UI may observe the first job as "complete" before the second job runs. This causes users to see incomplete data.

**Example:** Research status becomes COMPLETED, but recommendations are generated 10-60 seconds LATER by a separate async job.

**Before implementing any feature with background jobs:**

- [ ] Identify all jobs in the event chain (`step.sendEvent` triggers)
- [ ] Document which job produces the "final state" the user cares about
- [ ] Ensure UI polling waits for final state, not intermediate states
- [ ] Add appropriate timeouts with user feedback (60 second max)
- [ ] Add `Cache-Control: no-store` headers to polling endpoints
- [ ] Use `export const dynamic = 'force-dynamic'` on pages displaying async results
- [ ] Test the race condition scenario explicitly (refresh immediately after status change)
- [ ] Update developer guides with async pattern documentation

**Key files for reference:**
- `app/projects/[id]/research/[runId]/ResearchStatusPoller.tsx` - Correct polling pattern
- `lib/inngest-functions.ts:91` - Event chain example (`step.sendEvent`)
- `developer-guides/05-research-run-functionality-guide.md` - Race condition documentation

**Pattern for correct polling:**
```typescript
// WRONG: Stop polling when status changes
if (newStatus !== 'RUNNING') {
  router.refresh(); // May show incomplete data!
}

// CORRECT: Wait for final state (recommendations exist)
if (newStatus === 'COMPLETED') {
  if (recommendationCount > 0) {
    router.refresh(); // All data ready
  } else {
    // Keep polling - async job not done yet
    setProgressMessage('Generating recommendations...');
  }
}
```

---

## Quick Reference Commands

```bash
# Development servers
PORT=3002 npm run dev              # Next.js
npx inngest-cli dev                # Inngest

# Clean restart (when broken)
npm run clean && PORT=3002 npm run dev

# Full rebuild (after major changes)
npm run rebuild:full && PORT=3002 npm run dev

# Database (ALWAYS backup first!)
npm run db:backup                  # Create backup
npm run migrate:safe -- name       # Safe migration
npx prisma studio                  # GUI browser
npx prisma generate                # Regenerate client

# Testing
npm run test:e2e                   # Run all E2E tests
npm run test:cleanup               # Manual test cleanup

# Type checking
npx tsc --noEmit                   # Check for errors
```

---

## Development Phases (from spec)

1. **Phase 1: Validation & POC** - Technology validation (COMPLETE)
2. **Phase 2: Core Infrastructure** - Database models, API routes
3. **Phase 3: Research Orchestration** - GPT-4o integration, Inngest jobs
4. **Phase 4: Recommendation Engine** - Structured outputs, approval workflow
5. **Phase 5: Polish & Testing** - E2E tests, error handling, UX

---

## Troubleshooting Quick Guide

| Problem | Solution |
|---------|----------|
| Port conflict | `lsof -ti:3002 \| xargs kill -9` |
| Stale cache | `npm run clean && PORT=3002 npm run dev` |
| Prisma client error | `npx prisma generate` |
| Research run stuck | Check Inngest UI at http://localhost:8288 |
| Schema mismatch | `npm run db:backup && npm run migrate:safe -- fix` |
| TypeScript errors | `npx tsc --noEmit` to see all errors |
| OpenAI API error | Check logs for Zod schema validation issues |
| Railway healthcheck fails | See `developer-guides/06-railway-deployment-guide.md` |
| "Missing apiKey" during build | Make OpenAI client lazy-loaded (see guide) |
| Prisma "libssl.so.1.1 not found" | Use `node:20-bullseye-slim` base image |

---

**Project:** Guru Builder System
**Stack:** Next.js 15 + PostgreSQL + Prisma + OpenAI + Inngest + Supabase
**Port:** 3002 (dev server)
**Production:** https://guru-builder-production.up.railway.app
**Last Updated:** 2025-12-04
