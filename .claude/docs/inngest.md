# Inngest v3.x - Project Reference

**Version:** 3.30.0 | **Last updated:** 2025-12-06

## TL;DR

Functions re-execute from the start for each step—completed steps are memoized. **ALL non-deterministic code (DB, APIs, `Date.now()`) MUST be inside `step.run()` or it re-runs every time.** Default: 4 retries per step. Use `step.sendEvent()` for event chaining (not `inngest.send()`).

## Gotchas

| Issue | Severity | Fix |
|-------|----------|-----|
| **Code outside `step.run()` re-executes** | CRITICAL | Wrap ALL DB calls, API calls, timestamps in steps |
| **Changing step IDs breaks running functions** | HIGH | Never rename step IDs; use function versioning |
| **Multiple side effects per step** | HIGH | One step = one side effect (prevents partial completion) |
| **Variable assignment without return** | HIGH | Always `const x = await step.run()`, never assign in closure |
| **Hot reload doesn't work** | MEDIUM | Full clean restart: `pkill -f "next dev" && rm -rf .next` |

### Project-Specific Gotchas

| Issue | Location | Fix |
|-------|----------|-----|
| **Tavily 400-char query limit** | `researchOrchestrator.ts` | Always `.slice(0, 400)` programmatically |
| **Empty string vs NULL in FK** | `inngest-functions.ts:262` | Use `null`, not `""` for ADD action FKs |
| **Research race condition** | Polling logic | Poll until `status === 'COMPLETED' AND recommendationCount > 0` |

## Key Patterns

### Correct Step Usage

```typescript
// WRONG: DB call outside step (re-executes!)
const user = await db.users.find(userId); // Creates duplicates!
await step.run('send-email', () => sendEmail(user));

// CORRECT: DB call inside step (memoized)
const user = await step.run('fetch-user', async () => {
  return await db.users.find(userId);
});
await step.run('send-email', async () => {
  return await sendEmail(user);
});
```

### Event Chaining (Your Pattern)

```typescript
// Fire-and-forget (current research→recommendations pattern)
await step.sendEvent('trigger-recommendations', {
  name: 'research/completed',
  data: { runId: researchRun.id },
});

// If you need the result synchronously:
const result = await step.invoke('generate-recs', {
  function: recommendationGenerationJob,
  data: { runId },
});
```

### Error Handling

```typescript
import { NonRetriableError, RetryAfterError } from 'inngest';

await step.run('validate-input', async () => {
  if (!event.data.email) {
    throw new NonRetriableError('Email required'); // Fails immediately
  }
});

await step.run('call-api', async () => {
  const res = await fetch(url);
  if (res.status === 429) {
    throw new RetryAfterError('Rate limited', '60s'); // Retry after delay
  }
  return res.json();
});
```

### Concurrency Configuration

```typescript
export const researchJob = inngest.createFunction(
  {
    id: 'research-orchestrator',
    concurrency: {
      limit: 5,                        // Max 5 concurrent
      key: 'event.data.projectId',    // Per-project limit (optional)
    },
    retries: 4,                        // Per step (default)
  },
  { event: 'research/requested' },
  async ({ event, step }) => { /* ... */ }
);
```

## Quick Reference

### Step Methods

| Method | Purpose | Example |
|--------|---------|---------|
| `step.run()` | Execute retriable code | `await step.run('save', () => db.save(x))` |
| `step.sendEvent()` | Trigger other functions | `await step.sendEvent('id', { name: 'event' })` |
| `step.invoke()` | Call function, get result | `await step.invoke('id', { function: fn })` |
| `step.sleep()` | Delay for duration | `await step.sleep('wait', '1h')` |
| `step.sleepUntil()` | Delay until timestamp | `await step.sleepUntil('id', date)` |
| `step.waitForEvent()` | Pause until event | `await step.waitForEvent('id', { event: 'x' })` |

### Concurrency vs Throttle

| Feature | Concurrency | Throttle |
|---------|-------------|----------|
| Controls | Executing steps (capacity) | New starts (rate) |
| Use case | "Max 5 jobs running" | "Max 100 starts/min" |
| Config | `concurrency: { limit: 5 }` | `throttle: { limit: 100, period: '1m' }` |

### Clean Restart Protocol

```bash
# When functions don't update:
pkill -f "next dev" || true
pkill -f "inngest-cli dev" || true
rm -rf .next node_modules/.cache
npx prisma generate
PORT=3002 npm run dev   # Terminal 1
npx inngest-cli dev     # Terminal 2
```

## Debugging

### Inngest Dev Dashboard (http://localhost:8288)
- **Events tab:** View triggered events with payloads
- **Functions tab:** See runs, step execution, timings
- **Replay:** Re-run failed functions with same inputs

### Common Issues

| Symptom | Check |
|---------|-------|
| Step not executing | Step ID unique? Previous step completed? |
| Function not triggering | Event name exact match? Dev server detected function? |
| Unexpected re-execution | Non-deterministic code outside `step.run()`? |
| Retries exhausted | Should be `NonRetriableError`? |

## Production Checklist

- [ ] `INNGEST_SIGNING_KEY` set (from dashboard)
- [ ] `INNGEST_EVENT_KEY` set (from dashboard)
- [ ] `INNGEST_DEV` NOT set (disables security)
- [ ] Failure handlers configured for critical functions
- [ ] Step IDs are descriptive and won't change
