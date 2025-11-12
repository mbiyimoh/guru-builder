# Research Workflow Developer Guide

**Component:** Background research execution and recommendation generation
**Files:** `lib/inngest-functions.ts`, `lib/researchOrchestrator.ts`, `lib/corpusRecommendationGenerator.ts`

## Overview

The research workflow orchestrates long-running AI research tasks and generates corpus improvement recommendations through a multi-stage Inngest pipeline.

```
API Request → Inngest Event → Research Job → Save Results →
Completion Event → Recommendation Job → Save Recommendations → Done
```

**See also:** `05-research-run-functionality-guide.md` for complete details on research execution, Python integration, and UI components.

## Architecture

```
POST /api/research-runs
    ↓
Create ResearchRun (DB)
    ↓
Send Inngest event: "research/requested"
    ↓
┌────────────────────────────────────────┐
│ researchJob (lib/inngest-functions.ts) │
│  1. Execute GPT Researcher subprocess  │
│  2. Save results to DB                 │
│  3. Send "research/completed" event    │
└────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────┐
│ recommendationGenerationJob                      │
│  1. Fetch research run + project context         │
│  2. Call OpenAI GPT-4 with structured outputs    │
│  3. Save recommendations to DB                   │
└──────────────────────────────────────────────────┘
```

## Key Functions

### research Job (`lib/inngest-functions.ts:33-100`)

**Trigger:** `research/requested` event

**Input:**
```typescript
{
  researchId: string;      // ResearchRun.id
  instructions: string;    // What to research
  depth: "quick" | "moderate" | "deep";
}
```

**Steps:**
1. **execute-research:** Call `executeResearch()` → Spawns Python subprocess
2. **save-to-database:** Update ResearchRun with results
3. **send-completion-event:** Trigger `research/completed`

**Output:**
```typescript
{
  researchId: string;
  success: boolean;
  executionTime: number;
  summary?: string;
}
```

**Critical Details:**
- Concurrency limit: 5 jobs max
- Timeout: 10 minutes (600000ms)
- Uses Prisma.JsonNull for failed research data

### recommendationGenerationJob (`lib/inngest-functions.ts:105-196`)

**Trigger:** `research/completed` event

**Steps:**
1. **fetch-research-run:** Get research data + project context (layers, files)
2. **generate-recommendations:** Call `generateCorpusRecommendations()`
3. **save-recommendations:** Bulk insert into Recommendation table

**OpenAI Call:**
- Model: `gpt-4o-2024-08-06`
- Uses structured outputs (Zod schema → JSON schema)
- Returns array of ADD/EDIT/DELETE recommendations

**Critical Details:**
- Concurrency limit: 3 jobs max
- Skips if research failed
- Returns empty array on OpenAI errors (doesn't fail job)

## Configuration

**Inngest Setup:**
```typescript
// lib/inngest.ts
export const inngest = new Inngest({
  id: "guru-builder",
  name: "Guru Builder",
});
```

**Function Registration:**
```typescript
// app/api/inngest/route.ts
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions, // From lib/inngest-functions.ts
});
```

## Development Workflow

### Running Locally

1. **Start Inngest dev server:**
   ```bash
   npx inngest-cli dev
   ```
   Dashboard: http://localhost:8288

2. **Start Next.js:**
   ```bash
   PORT=3002 npm run dev
   ```

3. **Trigger research via UI (recommended):**
   - Navigate to http://localhost:3002/projects
   - Click on a project
   - Click "Start New Research" button
   - Fill out form and submit

4. **Or trigger via API:**
   ```bash
   curl -X POST http://localhost:3002/api/research-runs \
     -H "Content-Type: application/json" \
     -d '{
       "projectId": "clx123",
       "instructions": "Research backgammon openings",
       "depth": "QUICK"
     }'
   ```

5. **Monitor in Inngest dashboard:**
   - View running jobs
   - See step-by-step execution
   - Check error logs

### Testing Individual Steps

**Test Research Execution:**
```typescript
// lib/__tests__/researchOrchestrator.test.ts
import { executeResearch } from "../researchOrchestrator";

const result = await executeResearch({
  instructions: "Test query",
  depth: "quick",
  timeout: 60000,
});

expect(result.success).toBe(true);
expect(result.data).toBeDefined();
```

**Test Recommendation Generation:**
```typescript
// lib/__tests__/corpusRecommendationGenerator.test.ts
import { generateCorpusRecommendations } from "../corpusRecommendationGenerator";

const recs = await generateCorpusRecommendations({
  researchFindings: mockResearchData,
  currentLayers: [],
  currentKnowledgeFiles: [],
  instructions: "Test",
});

expect(recs.length).toBeGreaterThan(0);
```

## Common Issues

### Research Job Fails Immediately

**Symptoms:** Status goes RUNNING → FAILED quickly

**Causes:**
1. Python subprocess error (GPT Researcher not installed)
2. Invalid research instructions
3. Timeout too short
4. Architecture mismatch (x86_64 vs arm64 on Apple Silicon)

**Fix:**
```bash
# Check Python environment
cd python && source venv/bin/activate
python3 -c "import gpt_researcher; print('OK')"

# If architecture error (mach-o file incompatible)
# See 05-research-run-functionality-guide.md for full solution
cd .. && rm -rf python/venv
cd python && python3 -m venv venv && source venv/bin/activate
pip install --upgrade pip
pip install python-dotenv openai gpt-researcher

# Check logs
grep "Research Job" logs/dev.log

# Increase timeout if needed (lib/inngest-functions.ts)
timeout: 600000  // 10 minutes
```

### Recommendations Not Generated

**Symptoms:** Research completes but no recommendations

**Debugging:**
1. Check Inngest dashboard for `research/completed` event
2. Verify OpenAI API key: `echo $OPENAI_API_KEY`
3. Check recommendationGenerationJob logs
4. Verify researchData is not null

**Common cause:** OpenAI API key invalid

### Inngest Events Not Triggering

**Symptoms:** Research run created but job never starts

**Fix:**
```bash
# 1. Check Inngest is running
curl http://localhost:8288/health

# 2. Restart Inngest dev server
npx inngest-cli dev

# 3. Check Next.js can reach Inngest
curl http://localhost:3000/api/inngest

# 4. Verify event was sent (check API logs)
```

## Modifying the Workflow

### Adding a New Research Depth

1. **Update Prisma enum:**
   ```prisma
   enum ResearchDepth {
     QUICK
     MODERATE
     DEEP
     ULTRA_DEEP  // NEW
   }
   ```

2. **Update validation:**
   ```typescript
   // app/api/research-runs/route.ts
   depth: z.enum(["QUICK", "MODERATE", "DEEP", "ULTRA_DEEP"])
   ```

3. **Handle in research orchestrator:**
   ```typescript
   // lib/researchOrchestrator.ts
   const depthConfig = {
     quick: { sources: 5, timeout: 120000 },
     moderate: { sources: 10, timeout: 300000 },
     deep: { sources: 20, timeout: 600000 },
     ultra_deep: { sources: 50, timeout: 1200000 },  // NEW
   };
   ```

4. **Run migration:**
   ```bash
   npx prisma migrate dev --name add-ultra-deep
   ```

### Adding Post-Research Processing

**Example:** Send email notification when research completes

```typescript
// lib/inngest-functions.ts (in researchJob)

// After sending completion event
await step.run("send-notification", async () => {
  await sendEmail({
    to: "user@example.com",
    subject: `Research completed: ${instructions}`,
    body: `Your research is ready. View at /research-runs/${researchId}`,
  });
});
```

## Performance Considerations

**Research Execution Time:**
- QUICK: 1-2 minutes
- MODERATE: 3-5 minutes
- DEEP: 5-10 minutes

**Bottlenecks:**
1. Python subprocess spawn time (~2-5 seconds)
2. GPT Researcher web scraping (depends on depth)
3. OpenAI API call for recommendations (~5-30 seconds)

**Optimization:**
- Cache research results by instructions hash
- Use faster OpenAI models for simple recommendations
- Parallelize recommendation generation per recommendation type

## Error Handling

**Automatic Retries:**
- Inngest retries each step on failure (3 times by default)
- Exponential backoff between retries

**Manual Error Recovery:**
```bash
# 1. Find failed job in Inngest dashboard
# 2. Click "Rerun" to retry from failed step
# 3. Or cancel and create new research run
```

**Graceful Degradation:**
- If recommendation generation fails, research results still saved
- Empty recommendation array is valid outcome

## Monitoring

**Key Metrics to Track:**
- Research job success rate
- Average execution time by depth
- Recommendation generation success rate
- OpenAI API costs

**Where to Check:**
- Inngest dashboard: Job status, step timings
- Database: Query ResearchRun.status distribution
- Logs: grep for "[Research Job]" and "[Recommendation Job]"

---

**Next:** See `03-database-api-guide.md` for database schema details
