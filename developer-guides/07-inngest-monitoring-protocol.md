# Inngest Monitoring Protocol

**Created:** 2025-12-16
**Purpose:** Protocol for monitoring Inngest background jobs during development and debugging

---

## Overview

Inngest is the background job orchestration system used for:
- Research run execution
- Teaching artifact generation (Mental Model, Curriculum, Drill Series)
- Claim verification against ground truth engines
- Any long-running async operations

**CRITICAL REQUIREMENT:** Claude Code MUST check Inngest logs when:
1. Working on any code in `lib/inngest-functions.ts`
2. Debugging teaching artifact generation issues
3. Investigating drill series or curriculum failures
4. Any task involving background job modifications

---

## Quick Reference: Monitoring Script

A convenience script is available at `scripts/inngest-monitor.sh`:

```bash
# View last 5 runs
./scripts/inngest-monitor.sh

# View last 10 runs
./scripts/inngest-monitor.sh 10
```

### What the Script Shows

```
-------------------------------------------------------------------
Run: 01J5ABC123...
   Function: guru-builder/mental-model-generation
   Status: COMPLETED / RUNNING / FAILED
   Ended: 2025-12-16T10:30:00Z or "Still running..."
   Error: (if failed) First 200 chars of error message
-------------------------------------------------------------------
```

---

## Inngest Dev Server

### Starting the Server

```bash
npx inngest-cli dev
```

The Inngest dev server runs at: **http://localhost:8288**

### Dev Server UI Features

1. **Runs Tab**: View all function executions
2. **Events Tab**: See all events that triggered runs
3. **Functions Tab**: List registered functions
4. **Timeline View**: Step-by-step execution breakdown

### Accessing Run Details

From the UI:
1. Click on any run in the Runs tab
2. View step-by-step execution with timing
3. Expand steps to see:
   - Input data passed to each step
   - Output/return values
   - Error stack traces
   - Retry attempts

---

## GraphQL API (Programmatic Access)

The dev server exposes a GraphQL endpoint at `http://localhost:8288/v0/gql`

### Query Recent Runs

```graphql
query {
  runs(first: 10, filter: { from: "2024-01-01T00:00:00Z" }, orderBy: [{ field: QUEUED_AT, direction: DESC }]) {
    edges {
      node {
        id
        status
        endedAt
        output
        function {
          name
        }
      }
    }
  }
}
```

### Query Run by ID

```graphql
query {
  run(id: "01J5ABC123...") {
    id
    status
    startedAt
    endedAt
    steps {
      id
      name
      status
      output
    }
  }
}
```

---

## Common Debugging Scenarios

### 1. ZodError / Schema Validation Failures

**Symptom:** Run fails with `ZodError` in output

**What to Check:**
1. Open Inngest UI → Find failed run → Expand error
2. Look for the specific field that failed validation
3. Check if GPT returned malformed JSON

**Common Causes:**
- GPT returning empty response
- Missing required fields in structured output
- OpenAI rate limiting (429 TPM exceeded)

**Fix Pattern:**
```typescript
// Add diagnostic logging before Zod parse
console.log('[DrillDesigner] Raw response:', JSON.stringify(rawResponse).slice(0, 500));
```

### 2. Rate Limit Errors (429)

**Symptom:** Run fails with HTTP 429 or "Rate limit exceeded"

**What to Check:**
1. Inngest UI → Timeline → Look for retry patterns
2. Check if multiple functions running simultaneously

**Mitigation:**
- Inngest automatically retries with backoff
- For persistent issues, add `maxRetries` to step config
- Consider reducing concurrency

### 3. Ground Truth Engine Timeouts

**Symptom:** Verification step times out or fails

**What to Check:**
1. Inngest UI → Find run → Expand verification step
2. Check `engineUrl` in step input
3. Look for connection timeouts

**Fix:**
- Verify engine URL is accessible
- Check engine health endpoint
- Increase `ENGINE_QUERY_TIMEOUT` if needed

### 4. Drill Generation Failures

**Symptom:** Drill series generation fails mid-way

**What to Check:**
1. Inngest UI → Find the drill series run
2. Expand each step to find where it failed
3. Look for:
   - Position seeding failures (no positions in library)
   - Schema validation errors
   - Token limit exceeded

**Key Steps to Monitor:**
- `fetch-project`
- `seed-positions`
- `generate-drills`
- `verify-claims`
- `save-artifact`

---

## Inngest Functions Reference

### Registered Functions

| Function ID | Trigger Event | Purpose |
|-------------|--------------|---------|
| `guru-builder/mental-model-generation` | `guru/mental-model.generate` | Generate mental model artifact |
| `guru-builder/curriculum-generation` | `guru/curriculum.generate` | Generate curriculum artifact |
| `guru-builder/drill-series-generation` | `guru/drill-series.generate` | Generate drill series artifact |
| `guru-builder/research-orchestrator` | `research/run.started` | Execute research workflow |

### Event Chain Pattern

Many operations trigger chained events:

```
research/run.started
  → guru-builder/research-orchestrator
    → (generates recommendations)
    → research/recommendations.generated (internal signal)
```

**Race Condition Warning:** The UI may observe `COMPLETED` status before recommendations are fully persisted. Always poll for final state.

---

## Mandatory Checks Before PR

When modifying Inngest-related code, ALWAYS:

1. **Run the monitoring script** to verify recent runs are healthy:
   ```bash
   ./scripts/inngest-monitor.sh 5
   ```

2. **Check for FAILED runs** in the Inngest UI

3. **Verify step execution** for the modified function:
   - Open Inngest UI
   - Find a recent run of the modified function
   - Confirm all steps completed successfully

4. **Test the full flow** end-to-end:
   - Trigger artifact generation from UI
   - Watch the run in Inngest UI
   - Verify artifact appears in database

---

## Environment Variables

```bash
# Local development (defaults work)
INNGEST_SIGNING_KEY="signkey-dev-local"
INNGEST_EVENT_KEY="inngest-dev-local"

# Production (Railway)
INNGEST_SIGNING_KEY="[production key]"
INNGEST_EVENT_KEY="[production key]"
```

---

## Troubleshooting Checklist

| Issue | First Check | Solution |
|-------|-------------|----------|
| Functions not registering | Inngest UI → Functions tab | Restart dev server |
| Runs stuck in RUNNING | Timeline → Look for hanging step | Check for infinite loops or await issues |
| Events not triggering | Events tab → Recent events | Verify event name matches function trigger |
| Steps timing out | Increase timeout in step config | `step.run('name', fn, { timeout: '5m' })` |
| Retry storms | Check error patterns | Add `retries: 0` to stop retries for known errors |

---

## Integration with CLAUDE.md

The following has been added to CLAUDE.md to enforce monitoring requirements:

```markdown
### Inngest Monitoring Protocol

**CRITICAL:** When working with Inngest-dependent code:
1. ALWAYS check Inngest logs at http://localhost:8288 or via `./scripts/inngest-monitor.sh`
2. Verify recent runs are successful before and after changes
3. Monitor the run in real-time when testing artifact generation
4. Include Inngest run status in debugging reports

See `developer-guides/07-inngest-monitoring-protocol.md` for full details.
```

---

## Related Documentation

- `lib/inngest-functions.ts` - Main function definitions
- `lib/inngest.ts` - Client configuration
- `app/api/inngest/route.ts` - Webhook handler
- `developer-guides/05-research-run-functionality-guide.md` - Research workflow details
