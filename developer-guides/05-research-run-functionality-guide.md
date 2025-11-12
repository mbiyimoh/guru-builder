# Research Run Functionality - Complete Guide

**Component:** Full research execution system including Python integration, GPT Researcher, and UI
**Last Updated:** 2025-11-10

## Overview

The Research Run functionality is the core feature of the Guru Builder system. It executes autonomous web research using GPT Researcher (Python) and generates actionable recommendations for improving the knowledge corpus.

## Architecture

```
User clicks "Start Research" in UI
    ↓
NewResearchForm.tsx submits POST /api/research-runs
    ↓
Create ResearchRun (status: PENDING) in database
    ↓
Send Inngest event: "research/requested"
    ↓
┌─────────────────────────────────────────────────────┐
│ researchJob (lib/inngest-functions.ts)              │
│  1. Call executeResearch()                          │
│  2. Spawn Python subprocess: research_agent.py      │
│  3. GPT Researcher conducts web research            │
│  4. Return JSON findings via stdout                 │
│  5. Save results to DB (status: COMPLETED)          │
│  6. Send "research/completed" event                 │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ recommendationGenerationJob                         │
│  1. Fetch research run + project context            │
│  2. Call OpenAI GPT-4 with structured outputs       │
│  3. Generate ADD/EDIT/DELETE recommendations        │
│  4. Save recommendations to DB                      │
└─────────────────────────────────────────────────────┘
    ↓
User reviews recommendations in UI
```

## Python-TypeScript Integration

### Architecture Decision

**Design:** Research runs as isolated Python subprocess spawned by Node.js

**Why subprocess model:**
- Isolation: Each research request gets own process with isolated stdout
- Simplicity: No need for long-running Python service
- Clean IPC: JSON over stdout/stderr
- Fault tolerance: Process crashes don't affect Next.js

**Communication Protocol:**
```typescript
// Node.js spawns Python
const pythonProcess = spawn('python3', [
  '/path/to/research_agent.py',
  instructions,
  depth.toLowerCase()
]);

// Python writes JSON to stdout
{ "query": "...", "summary": "...", "fullReport": "...", "sources": [...] }

// Node.js reads stdout and parses JSON
const findings = JSON.parse(output);
```

### Python Environment Setup

**Location:** `python/` directory in project root

**Structure:**
```
python/
├── venv/                    # Python virtual environment
│   ├── bin/python3         # Python interpreter (arm64)
│   └── lib/                # Installed packages
├── research_agent.py       # Main research script
├── requirements.txt        # Dependencies (if using)
└── .env                    # Environment variables (symlinked from root)
```

**Setup Instructions:**

1. **Create virtual environment:**
   ```bash
   cd python
   python3 -m venv venv
   ```

2. **Activate venv:**
   ```bash
   source venv/bin/activate
   ```

3. **Upgrade pip:**
   ```bash
   pip install --upgrade pip
   ```

4. **Install dependencies:**
   ```bash
   pip install python-dotenv openai gpt-researcher
   ```

5. **Verify installation:**
   ```bash
   python3 -c "import gpt_researcher; print('GPT Researcher installed')"
   ```

**Architecture Note (Apple Silicon):**
- Packages with C extensions (pydantic, httpx) must match system architecture
- If seeing "mach-o file, but is an incompatible architecture" errors:
  - Delete venv: `rm -rf venv`
  - Recreate with correct architecture (as shown above)
  - Packages will compile for arm64 automatically

### research_agent.py Implementation

**Location:** `python/research_agent.py`

**Purpose:** Standalone script that executes GPT Researcher and returns JSON findings

**Key Features:**

1. **Logging Configuration (lines 26-41):**
   - All logs go to stderr (stdout reserved for JSON)
   - Suppresses noisy third-party loggers (httpx, langchain, etc.)
   - Configurable via `RESEARCH_LOG_LEVEL` environment variable

2. **Research Depth Configuration (lines 49-73):**
   ```python
   DEPTH_SETTINGS = {
       "quick": {
           "max_sources": 5,
           "max_iterations": 2,
           "report_type": "research_report",
       },
       "moderate": {
           "max_sources": 10,
           "max_iterations": 4,
           "report_type": "research_report",
       },
       "deep": {
           "max_sources": 20,
           "max_iterations": 6,
           "report_type": "detailed_report",
       },
   }
   ```

3. **Stdout Capture Architecture (lines 155-198):**
   - Uses `StringIO` to temporarily redirect stdout during research
   - Prevents third-party print statements from corrupting JSON output
   - Logs captured output on errors for debugging
   - Restores stdout in finally block

   **CRITICAL:** This is safe for subprocess model but would NOT be safe for long-running service (concurrent requests would corrupt each other's output)

4. **POC Fallback Mode (lines 113-147):**
   - If GPT Researcher can't be imported, returns test data
   - Includes clear warnings and installation instructions
   - Useful for development without API keys

5. **Data Validation (lines 200-228):**
   - Validates report is string, sources is array
   - Ensures URLs are strings
   - Filters empty/None URLs
   - Adds metadata about research configuration

**Usage:**
```bash
# From project root
python3 python/research_agent.py "Research backgammon strategies" "moderate"

# Output (JSON to stdout)
{
  "query": "Research backgammon strategies",
  "depth": "moderate",
  "summary": "First 500 chars of report...",
  "fullReport": "Full markdown report...",
  "sources": [
    {"url": "https://...", "title": "Source 1"},
    ...
  ],
  "sourcesAnalyzed": 10,
  "metadata": {
    "maxSources": 10,
    "maxIterations": 4,
    "reportType": "research_report"
  }
}
```

**Environment Variables Required:**
- `OPENAI_API_KEY` - For GPT Researcher
- `TAVILY_API_KEY` - (Optional) For enhanced search

### TypeScript Research Orchestrator

**Location:** `lib/researchOrchestrator.ts`

**Key Function:**
```typescript
export async function executeResearch(params: {
  instructions: string;
  depth: ResearchDepth;
  timeout?: number;
}): Promise<ResearchResult>
```

**Implementation:**
- Spawns Python subprocess with `child_process.spawn()`
- Captures stdout and stderr separately
- Parses JSON from stdout
- Returns structured ResearchResult object
- Handles errors with detailed error messages

**Integration Point:**
- Called by `researchJob` in `lib/inngest-functions.ts`
- Results saved to ResearchRun.researchData in database

## UI Components

### Research Form Page

**Location:** `app/projects/[id]/research/new/page.tsx`

**Purpose:** Server component page for creating new research runs

**Features:**
- Fetches project details (id, name, description)
- Returns 404 if project doesn't exist
- Breadcrumb navigation back to project
- Renders `NewResearchForm` client component

### NewResearchForm Component

**Location:** `components/research/NewResearchForm.tsx`

**Purpose:** Client component form for configuring research runs

**Features:**

1. **Instructions Input:**
   - Large textarea (6 rows)
   - Character counter
   - Placeholder with example
   - Required field validation

2. **Depth Selection:**
   - Three visual cards: QUICK, MODERATE, DEEP
   - Each shows:
     - Icon and name
     - Time estimate
     - Description of what depth means
   - Selected state: blue border, blue background
   - Hover effects

3. **Info Box:**
   - Explains how research works
   - Lists 4 key steps in process
   - Helps set user expectations

4. **Error Handling:**
   - Error state display (red background)
   - Shows error message from API
   - Non-intrusive error UI

5. **Loading States:**
   - Submit button shows spinner when submitting
   - "Starting Research..." text
   - Disabled state during submission

6. **Form Submission:**
   - POSTs to `/api/research-runs`
   - Sends: projectId, instructions, depth
   - On success: Redirects to project page with router.refresh()
   - On error: Shows error, keeps user on page

### Project Page Research Section

**Location:** `app/projects/[id]/page.tsx` (lines 109-174)

**Features:**

1. **Header with Action Button:**
   - "Start New Research" button always visible
   - Button navigates to `/projects/{id}/research/new`
   - Blue styling matching site theme

2. **Research Run List:**
   - Shows last 5 research runs (ordered by createdAt desc)
   - Each run displays:
     - Instructions (truncated)
     - Depth (lowercase)
     - Recommendation count
     - Created date
     - Status badge (colored by status)
   - Clickable to view run details

3. **Empty State:**
   - Shows when no research runs exist
   - Search icon illustration
   - Encouraging message to start first research
   - Does NOT show button here (button is in header)

## Common Issues and Solutions

### Issue 1: POC/Test Data Instead of Real Research

**Symptoms:**
- Research completes but shows "POC MODE" in summary
- Sources are example.com URLs
- Report mentions test data

**Root Causes:**
1. GPT Researcher not installed in Python venv
2. ImportError when trying to import gpt_researcher

**Solution:**
```bash
# 1. Activate venv
cd python && source venv/bin/activate

# 2. Check if installed
pip list | grep gpt-researcher

# 3. If not installed or wrong architecture
pip install gpt-researcher

# 4. If architecture mismatch (x86_64 vs arm64 on Mac)
cd .. && rm -rf python/venv
cd python && python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install python-dotenv openai gpt-researcher

# 5. Verify
python3 -c "import gpt_researcher; print('OK')"
```

**Prevention:**
- Always use virtual environment
- Document Python setup in README
- Add health check endpoint that tests Python imports

### Issue 2: "Unexpected token" JSON Parse Error

**Symptoms:**
- Research job fails with JSON parse error
- Error mentions unexpected token at start of JSON
- Logs show library warnings in output

**Root Cause:**
Third-party libraries (Tavily, BeautifulSoup, PyMuPDF) print to stdout, corrupting JSON

**Solution:**
Already implemented in `research_agent.py`:
- StringIO stdout capture during research
- Warnings logged to stderr instead
- Clean JSON output on stdout

**If error persists:**
1. Check Python script is using latest version with stdout capture
2. Verify all print statements in research_agent.py go to stderr
3. Test manually: `python3 python/research_agent.py "test" "quick" | jq .`

### Issue 3: Research Runs Stuck in RUNNING Status

**Symptoms:**
- Status shows RUNNING for > 15 minutes
- No updates in Inngest dashboard
- No error message

**Debugging:**

1. **Check Inngest dashboard:**
   - Visit http://localhost:8288
   - Find the research job
   - Look for step failures or timeouts

2. **Check Python process:**
   ```bash
   # See if Python process is still running
   ps aux | grep research_agent.py

   # If hung, kill it
   pkill -f research_agent.py
   ```

3. **Check logs:**
   ```bash
   # Look for Python errors in stderr
   grep -A 10 "Research Job" logs/dev.log
   ```

4. **Manual test:**
   ```bash
   # Run research agent directly to see errors
   cd python
   source venv/bin/activate
   python3 research_agent.py "test query" "quick"
   ```

**Common Causes:**
- Python environment not activated when Next.js spawns subprocess
- OPENAI_API_KEY not in environment
- Network issues preventing web scraping
- Timeout too short for depth level

**Solutions:**
- Ensure .env has OPENAI_API_KEY
- Increase timeout in inngest-functions.ts if needed
- Check Python venv path is correct in executeResearch()

### Issue 4: No Recommendations Generated

**Symptoms:**
- Research completes successfully
- researchData saved to database
- But recommendations table empty for that run

**Debugging:**

1. **Check research/completed event:**
   - Inngest dashboard → Events
   - Verify event was sent
   - Check if recommendationGenerationJob triggered

2. **Check OpenAI API key:**
   ```bash
   echo $OPENAI_API_KEY
   ```

3. **Check recommendation job logs:**
   - Inngest dashboard → Jobs → recommendationGenerationJob
   - Look for OpenAI errors
   - Check if job completed successfully

4. **Verify research data format:**
   ```bash
   # In Prisma Studio or via API
   GET /api/research-runs/[id]
   # Verify researchData is not null and has expected structure
   ```

**Common Causes:**
- OpenAI API key invalid/expired
- researchData is null (research failed but status shows COMPLETED)
- OpenAI structured outputs schema mismatch
- Network/API rate limits

**Solutions:**
- Verify OPENAI_API_KEY is valid: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`
- Check OpenAI API status page
- Review schema in corpusRecommendationGenerator.ts
- Add retry logic for transient errors

## Testing Research Functionality

### Manual Testing Flow

1. **Start servers:**
   ```bash
   # Terminal 1: Next.js
   PORT=3002 npm run dev

   # Terminal 2: Inngest
   npx inngest-cli dev
   ```

2. **Navigate to project:**
   - Go to http://localhost:3002/projects
   - Click on a project (or create one)

3. **Start research:**
   - Click "Start New Research" button
   - Enter instructions: "Research opening strategies in backgammon"
   - Select depth: MODERATE
   - Click "Start Research"

4. **Monitor progress:**
   - Wait for redirect to project page
   - Refresh page to see status changes
   - Or watch Inngest dashboard: http://localhost:8288

5. **Verify results:**
   - Check research run shows COMPLETED status
   - Verify recommendations were generated
   - Check report makes sense for the query

### Automated Testing (Future)

**Unit Tests:**
- `research_agent.py`: Test with mocked GPT Researcher
- `researchOrchestrator.ts`: Test subprocess spawn and JSON parsing
- `NewResearchForm.tsx`: Test form validation and submission

**Integration Tests:**
- Full research flow with POC mode
- Database persistence of results
- Inngest event triggering

**E2E Tests:**
- Complete user flow from form to recommendations
- Error handling scenarios
- Multiple concurrent research runs

## Performance Considerations

### Research Execution Time

**Expected timings:**
- QUICK: 1-3 minutes (5 sources, 2 iterations)
- MODERATE: 5-7 minutes (10 sources, 4 iterations)
- DEEP: 10-15 minutes (20 sources, 6 iterations)

**Factors affecting time:**
- Number of sources to scrape
- Network latency
- Web page load times
- OpenAI API response times

### Resource Usage

**Memory:**
- Python subprocess: ~200-500MB per research run
- Node.js: Minimal overhead (just JSON parsing)

**CPU:**
- Mostly waiting on network I/O
- Python: Light processing for scraping and parsing
- GPT Researcher handles parallelization internally

**Concurrency:**
- Max 5 concurrent research jobs (configured in inngest-functions.ts)
- Prevents API rate limits and resource exhaustion
- Inngest queues additional requests

### Optimization Opportunities

1. **Caching:**
   - Cache research results by instructions hash
   - Expire after 7 days (research goes stale)
   - Saves time and API costs

2. **Progressive Results:**
   - Stream research findings as they're discovered
   - Update UI with partial results
   - Requires WebSocket or SSE implementation

3. **Parallel Recommendation Generation:**
   - Generate recommendations per category in parallel
   - Requires refactoring OpenAI calls
   - Could reduce latency by 2-3x

## Configuration Reference

### Environment Variables

**Required:**
- `OPENAI_API_KEY` - OpenAI API key for GPT Researcher
- `DATABASE_URL` - PostgreSQL connection string

**Optional:**
- `TAVILY_API_KEY` - Enhanced web search (GPT Researcher uses if available)
- `RESEARCH_LOG_LEVEL` - Python logging level (default: WARNING)
- `GPT_RESEARCHER_MODE` - "local" or "online" (default: local)

### Research Depth Configuration

Edit in `python/research_agent.py` if needed:

```python
DEPTH_SETTINGS = {
    "quick": {
        "max_sources": 5,      # Number of web sources to analyze
        "max_iterations": 2,    # Research refinement iterations
        "report_type": "research_report",
    },
    "moderate": {
        "max_sources": 10,
        "max_iterations": 4,
        "report_type": "research_report",
    },
    "deep": {
        "max_sources": 20,
        "max_iterations": 6,
        "report_type": "detailed_report",  # More comprehensive format
    },
}
```

### Inngest Job Configuration

Edit in `lib/inngest-functions.ts` if needed:

```typescript
export const researchJob = inngest.createFunction(
  {
    id: "research-job",
    concurrency: {
      limit: 5,  // Max concurrent research executions
    },
    timeout: 600000,  // 10 minutes (adjust for DEEP research)
  },
  // ...
);

export const recommendationGenerationJob = inngest.createFunction(
  {
    id: "recommendation-generation-job",
    concurrency: {
      limit: 3,  // Max concurrent recommendation generations
    },
  },
  // ...
);
```

## Debugging Checklist

When research isn't working:

- [ ] Python venv exists and has correct architecture
- [ ] GPT Researcher installed: `pip list | grep gpt-researcher`
- [ ] OPENAI_API_KEY set in .env
- [ ] Next.js dev server running
- [ ] Inngest dev server running
- [ ] Database accessible: `npx prisma studio`
- [ ] No port conflicts: `lsof -i :3002` and `lsof -i :8288`
- [ ] Python script executable: `python3 python/research_agent.py "test" "quick"`
- [ ] Logs show no errors: Check console and Inngest dashboard

---

**Related Guides:**
- `01-overall-architecture.md` - System overview
- `02-research-workflow-guide.md` - Background job details
- `04-recommendation-system-guide.md` - Recommendation generation
