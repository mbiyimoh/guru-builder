# Claude Code Development Protocols

This document defines standard protocols for AI-assisted development on this project.

---

## 🔄 Clean Rebuild Protocol

**When to use:** After any meaningful coding/implementation work, before deployment, or when experiencing build issues.

### Standard Clean Rebuild Procedure

```bash
# 1. Stop all running servers
# Kill Next.js dev server
pkill -f "next dev" || true

# Kill Inngest dev server
pkill -f "inngest-cli dev" || true

# 2. Clean all caches and build artifacts
rm -rf .next
rm -rf node_modules/.cache
rm -rf playwright-report
rm -rf test-results
rm -rf .turbo

# 3. Clean install dependencies
rm -rf node_modules
npm install

# 4. Regenerate Prisma client
npx prisma generate

# 5. Apply database migrations (if needed)
npx prisma migrate deploy  # Production
# OR
npx prisma db push        # Development

# 6. Verify TypeScript compilation
npx tsc --noEmit

# 7. Start servers
# Terminal 1: Next.js on port 3002
PORT=3002 npm run dev

# Terminal 2: Inngest dev server
npx inngest-cli dev
```

### Quick Clean Restart (No node_modules wipe)

```bash
# For faster restarts when dependencies haven't changed
rm -rf .next
rm -rf node_modules/.cache
npx prisma generate
PORT=3002 npm run dev
```

### NPM Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "clean": "rm -rf .next node_modules/.cache playwright-report test-results",
    "clean:full": "rm -rf .next node_modules/.cache playwright-report test-results node_modules",
    "rebuild": "npm run clean && npm install && npx prisma generate",
    "rebuild:full": "npm run clean:full && npm install && npx prisma generate",
    "dev:clean": "npm run clean && PORT=3002 npm run dev"
  }
}
```

---

## 🧪 Testing Protocol

### Before Committing Code

```bash
# 1. Type check
npx tsc --noEmit

# 2. Run E2E tests
npm run test:e2e

# 3. Check for console errors
npm run dev  # Manually verify in browser

# 4. Database migrations check
npx prisma migrate status

# 5. Verify test cleanup ran
# After tests complete, check that test projects were auto-cleaned
```

### After Major Feature Implementation

```bash
# 1. Clean rebuild
npm run rebuild

# 2. Full E2E test suite
npm run test:e2e

# 3. Manual smoke test
# - Create project
# - Run research
# - Apply recommendations
# - Check snapshots

# 4. Review test coverage
npm run test:e2e:report
```

### Test Cleanup Protocol

**IMPORTANT:** All E2E tests automatically clean up test data after completion.

#### Automatic Cleanup
- Tests use a global teardown hook that removes all test projects
- Runs automatically after all Playwright tests complete
- Cleans up: projects, context layers, knowledge files, research runs, recommendations

#### Manual Cleanup
If you need to manually clean up test projects:
```bash
npm run test:cleanup
```

#### When to Persist Test Data
Only keep test data when:
- 🔍 Investigating a specific test failure requiring database inspection
- 🔍 Debugging data relationships or cascade behavior
- 🔍 Manual testing in the UI with specific scenarios

Otherwise, **ALWAYS let automatic cleanup run** to keep the database clean.

#### Test Naming Convention
All test projects MUST include "Test" or "test" in their name:
- ✅ `Test Project ${Date.now()}`
- ✅ `Research Test Project ${timestamp}`
- ❌ `My Project` (will not be auto-cleaned)

---

## 📦 Deployment Protocol

### Pre-Deployment Checklist

```bash
# 1. Full clean rebuild
npm run rebuild:full

# 2. Production build test
npm run build

# 3. Database migrations ready
npx prisma migrate deploy --preview-feature

# 4. Environment variables verified
# Check .env.production has all required keys

# 5. All tests passing
npm run test:e2e

# 6. No TypeScript errors
npx tsc --noEmit
```

### Environment-Specific Builds

**Development:**
```bash
PORT=3002 npm run dev
```

**Production:**
```bash
npm run build
npm start
```

**Staging:**
```bash
NODE_ENV=staging npm run build
NODE_ENV=staging npm start
```

---

## 🐛 Troubleshooting Protocol

### When Things Break

1. **Check running processes:**
   ```bash
   lsof -i :3002 -P -n
   lsof -i :8288 -P -n
   ```

2. **Check logs:**
   ```bash
   # Next.js logs in terminal
   # Inngest logs at http://localhost:8288
   # Database logs: check PostgreSQL logs
   ```

3. **Database issues:**
   ```bash
   # Check connection
   npx prisma db execute --stdin <<< "SELECT 1;"

   # View database
   npx prisma studio

   # Reset database (DANGER: deletes all data)
   npx prisma migrate reset
   ```

4. **Prisma client issues:**
   ```bash
   # Regenerate client
   npx prisma generate

   # Check binary targets (Apple Silicon)
   # Ensure schema.prisma has:
   # generator client {
   #   provider      = "prisma-client-js"
   #   binaryTargets = ["native", "darwin-arm64"]
   # }
   ```

5. **Port conflicts:**
   ```bash
   # Kill process on port
   lsof -ti:3002 | xargs kill -9
   lsof -ti:8288 | xargs kill -9
   ```

6. **Cache corruption:**
   ```bash
   npm run clean:full
   npm install
   npx prisma generate
   ```

7. **OpenAI API issues:**
   ```bash
   # Check Inngest logs for OpenAI errors
   # Inngest Dev UI: http://localhost:8288

   # Common error: Zod schema validation failures
   # Look for: "uses `.optional()` without `.nullable()`"
   ```

### OpenAI Structured Outputs Schema Requirements

**CRITICAL:** When using OpenAI's `strict: true` mode with structured outputs, optional fields **MUST** use `.nullable().optional()` - not just `.optional()` alone.

**Correct pattern:**
```typescript
const schema = z.object({
  // ✅ CORRECT - Required by OpenAI API
  optionalField: z.string().nullable().optional(),
});
```

**Incorrect pattern:**
```typescript
const schema = z.object({
  // ❌ WRONG - Will cause API error
  optionalField: z.string().optional(),
});
```

**Why this matters:**
OpenAI's strict mode can handle three cases:
1. Field present with a value
2. Field present with `null`
3. Field omitted entirely

Only `.nullable().optional()` covers all three cases.

**How to diagnose:**
1. Check Inngest logs at http://localhost:8288
2. Look for error: `Zod field uses .optional() without .nullable()`
3. Update the schema to use `.nullable().optional()`
4. Update TypeScript types to match: `field?: string | null;`
5. Restart servers with clean rebuild

**Related logging:**
The recommendation generation system has comprehensive logging:
- Full GPT-4o prompts (see what the AI receives)
- Raw GPT-4o responses (see what it returns)
- Parsed recommendations with confidence scores
- Confidence filtering metrics (threshold: 0.4)
- Empty corpus detection telemetry

Check these logs in Inngest Dev UI or terminal output.

---

## 📝 Code Quality Protocol

### Before Pull Request

1. **Self-review checklist:**
   - [ ] No console.log statements (except intentional logging)
   - [ ] No commented-out code
   - [ ] No TODO/FIXME comments (or documented in issues)
   - [ ] All TypeScript errors resolved
   - [ ] Tests added for new features
   - [ ] Documentation updated

2. **Automated checks:**
   ```bash
   # Type safety
   npx tsc --noEmit

   # Find TODOs
   grep -r "TODO\|FIXME\|HACK" --include="*.ts" --include="*.tsx" app/ lib/

   # Test coverage
   npm run test:e2e
   ```

---

## 🎯 Port Assignments

**Standard ports for this project:**
- **3002** - Next.js dev server
- **8288** - Inngest dev server
- **5432** - PostgreSQL database
- **5555** - Prisma Studio

**Checking port availability:**
```bash
lsof -i :3002 -P -n | grep LISTEN || echo "Available"
```

---

## 🔐 Environment Variables

**Required for development:**
```bash
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="sk-..."
INNGEST_SIGNING_KEY="signkey-dev-local"
INNGEST_EVENT_KEY="inngest-dev-local"
```

**Optional:**
```bash
INNGEST_DEV_URL="http://localhost:8288"
GPT_RESEARCHER_MODE="local"
```

**Verify environment:**
```bash
# Check if .env exists and has required keys
grep -E "DATABASE_URL|OPENAI_API_KEY|INNGEST" .env
```

---

## 📚 Documentation Updates

**After implementing new features:**

1. Update relevant developer guides in `/developer-guides/`
2. Update API documentation if endpoints changed
3. Update README.md if user-facing changes
4. Update IMPLEMENTATION_COMPLETE.md with new metrics

---

## 🚀 Quick Reference

### Most Common Commands

```bash
# Start development
PORT=3002 npm run dev                    # Start Next.js
npx inngest-cli dev                      # Start Inngest

# Clean restart (when things are broken)
npm run clean && PORT=3002 npm run dev

# Full rebuild (after major changes)
npm run rebuild:full && PORT=3002 npm run dev

# Run tests
npm run test:e2e                         # All E2E tests
npm run test:e2e:ui                      # Interactive mode
npm run test:e2e:report                  # View results

# Database
npx prisma studio                        # GUI for database
npx prisma migrate dev                   # Create migration
npx prisma db push                       # Sync schema (dev only)
npx prisma generate                      # Regenerate client

# Type checking
npx tsc --noEmit                         # Check types
```

---

**Last Updated:** 2025-11-08
**Project:** Guru Builder System
**Maintainer:** Development Team
