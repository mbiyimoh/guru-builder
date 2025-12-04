# Railway Deployment Guide

This guide covers deploying Guru Builder to Railway with Docker, including all the critical configuration details discovered through troubleshooting.

---

## Quick Reference

**Production URL:** https://guru-builder-production.up.railway.app

**Key Files:**
- `Dockerfile` - Multi-stage Docker build configuration
- `railway.toml` - Railway deployment settings
- `app/api/health/route.ts` - Healthcheck endpoint

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Railway       │     │   Neon          │     │   Supabase      │
│   (Hosting)     │────▶│   (PostgreSQL)  │     │   (Auth)        │
│                 │     │                 │     │                 │
│   Next.js App   │     │   Database      │     │   Email/Pass    │
│   Docker        │     │                 │     │   Whitelist     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Critical Configuration

### The HOSTNAME Fix (Most Important!)

**Problem:** Railway healthchecks fail with "service unavailable" even though the app shows "Ready" in logs.

**Root Cause:** Next.js standalone mode binds to `localhost` by default, which Railway's healthcheck system cannot reach from outside the container.

**Solution:** Set `HOSTNAME=0.0.0.0` in the Dockerfile:

```dockerfile
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"  # CRITICAL: Allows external healthcheck access
ENV PORT=3000
```

**Why This Works:** Setting HOSTNAME to 0.0.0.0 tells Next.js to bind to all network interfaces, not just localhost. Railway's healthcheck comes from outside the container and needs to reach the app through the container's network interface.

---

## Dockerfile Configuration

### Complete Working Dockerfile

```dockerfile
# Stage 1: Dependencies
FROM node:20-bullseye-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Stage 2: Build
FROM node:20-bullseye-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
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
FROM node:20-bullseye-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"  # CRITICAL for Railway healthcheck
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and generated client (runtime only)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

### Key Configuration Decisions

| Decision | Reasoning |
|----------|-----------|
| `node:20-bullseye-slim` | Debian Bullseye includes OpenSSL 1.1.x which Prisma 5.x requires |
| `npm ci --legacy-peer-deps` | Required due to react-diff-viewer peer dependency conflict |
| No auto-migration | Database is managed locally; schema already synced |
| `CMD ["node", "server.js"]` | Direct node execution (not npm) for proper signal handling |

---

## Railway Configuration

### railway.toml

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node server.js"
healthcheckPath = "/api/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### Required Environment Variables

Set these in Railway dashboard:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string | `postgresql://...@neon.tech/neondb?sslmode=require` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key (optional) | `sk-ant-...` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `eyJ...` |
| `NEXT_PUBLIC_APP_URL` | Production URL | `https://guru-builder-production.up.railway.app` |
| `ALLOWED_EMAILS` | Comma-separated whitelist | `user1@email.com,user2@email.com` |
| `ADMIN_EMAIL` | Admin for orphan projects | `admin@email.com` |
| `INNGEST_SIGNING_KEY` | Inngest signing key | `signkey-...` |
| `INNGEST_EVENT_KEY` | Inngest event key | `inngest-...` |

---

## Health Endpoint

A simple health endpoint is required for Railway's healthcheck system:

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: Date.now() });
}
```

**Why a dedicated endpoint?**
- Root path `/` redirects to `/login` for unauthenticated users
- Redirects (302/308) fail healthchecks - only HTTP 200 passes
- Auth pages may have database dependencies that slow response

---

## Common Issues and Solutions

### 1. Healthcheck Fails with "Service Unavailable"

**Symptoms:**
- Build succeeds
- Logs show "Ready in Xms"
- Healthcheck retries fail

**Solutions:**
1. Verify `HOSTNAME="0.0.0.0"` is set in Dockerfile
2. Use `/api/health` endpoint (not pages that redirect)
3. Ensure health endpoint returns HTTP 200

### 2. Prisma "libssl.so.1.1 not found"

**Symptoms:**
```
Error loading shared library libssl.so.1.1: No such file or directory
```

**Solution:** Use `node:20-bullseye-slim` instead of `node:20-alpine` or `node:20-slim`

**Why:** Alpine 3.22+ and Debian Bookworm use OpenSSL 3.x. Prisma 5.x requires OpenSSL 1.1.x which is only in Debian Bullseye.

### 3. "Missing OPENAI_API_KEY" During Build

**Symptoms:**
```
Error: Missing credentials. Please pass an `apiKey`
```

**Solution:** Make OpenAI client initialization lazy:

```typescript
// WRONG - runs at import time (during build)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// CORRECT - runs only when called
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}
```

### 4. Public Folder Not Found

**Symptoms:**
```
ERROR: "/app/public": not found
```

**Solution:** Create a `public/.gitkeep` file if you don't have static assets.

### 5. Prisma Migration Fails with Version Error

**Symptoms:**
```
The datasource property `url` is no longer supported
```

**Cause:** Railway's `npx` picks up latest Prisma (v7) instead of project version (v5).

**Solution:** Either use local binary (`./node_modules/.bin/prisma`) or skip auto-migration if DB is already synced.

---

## Deployment Checklist

Before deploying:

- [ ] `next.config.ts` has `output: 'standalone'`
- [ ] `Dockerfile` has `HOSTNAME="0.0.0.0"`
- [ ] `/api/health` endpoint exists
- [ ] `railway.toml` points to `/api/health`
- [ ] `public/` folder exists (even if empty with `.gitkeep`)
- [ ] OpenAI/Anthropic clients are lazy-loaded
- [ ] All `NEXT_PUBLIC_*` vars are in Railway env vars

After deploying:

- [ ] Update `NEXT_PUBLIC_APP_URL` in Railway to match deployed URL
- [ ] Add Railway URL to Supabase redirect URLs
- [ ] Update Supabase Site URL
- [ ] Test login/signup flow
- [ ] Verify existing projects are accessible

---

## Railway CLI Commands

```bash
# Link to project
railway link

# Check status
railway status

# View environment variables
railway variables

# View build logs
railway logs --build -n 100

# View runtime logs
railway logs --deployment -n 100

# Get public URL
railway domain
```

---

## Supabase Configuration for Production

After Railway deployment, update Supabase:

1. **Site URL:** `https://guru-builder-production.up.railway.app`

2. **Redirect URLs:**
   - `https://guru-builder-production.up.railway.app/auth/callback`
   - `http://localhost:3002/auth/callback` (for local dev)

---

## Troubleshooting Workflow

When healthcheck fails:

1. **Check build logs:** `railway logs --build -n 100`
2. **Check runtime logs:** `railway logs --deployment -n 100`
3. **Verify HOSTNAME:** Ensure `0.0.0.0` in Dockerfile
4. **Test health endpoint:** Verify `/api/health` returns 200
5. **Check env vars:** `railway variables`

**Key insight from research:** Railway's healthcheck runs from OUTSIDE the container. The container must listen on `0.0.0.0` (all interfaces), not `localhost` (loopback only).

---

## References

- [Railway Healthchecks Documentation](https://docs.railway.com/reference/healthchecks)
- [Next.js Docker Example](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile)
- [Prisma OpenSSL Requirements](https://www.prisma.io/docs/orm/reference/system-requirements)
