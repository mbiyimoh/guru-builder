# Phase 1 POC Testing Guide

**Status**: Phase 1 Implementation Complete ✅
**Date**: 2025-11-08
**Purpose**: Guide for testing the integrated POC of all three core technologies

---

## Prerequisites

### 1. Environment Setup

Create a `.env` file in the project root (copy from `.env.example`):

```bash
# Required for testing
OPENAI_API_KEY=sk-proj-xxxxx  # Get from https://platform.openai.com/api-keys

# Required for Inngest (optional for basic testing)
INNGEST_SIGNING_KEY=signkey-prod-xxxxx  # Get from https://app.inngest.com
INNGEST_EVENT_KEY=inngest-xxxxx

# Not required for Phase 1
DATABASE_URL=postgresql://user:pass@localhost:5432/guru_builder
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Python dependencies already installed in python/venv/
# To verify:
source python/venv/bin/activate && python --version
```

### 3. Start Development Server

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start Inngest Dev Server (for background jobs)
npx inngest-cli@latest dev
```

Your app will be available at:
- Next.js: http://localhost:3000
- Inngest Dashboard: http://localhost:8288

---

## Testing Workflow

### Test 1: Python Research Agent (Standalone)

**Purpose**: Verify Python script works independently

```bash
# Navigate to python directory
cd python

# Activate virtual environment
source venv/bin/activate

# Test in POC mode (works without API key)
python research_agent.py "How to learn backgammon" "quick"

# Test with API key (if configured)
# Should return detailed research
```

**Expected Output**:
```json
{
  "query": "How to learn backgammon",
  "depth": "quick",
  "summary": "...",
  "fullReport": "...",
  "sources": [...],
  "sourcesAnalyzed": 2,
  "metadata": {...}
}
```

**Success Criteria**:
- ✅ Script runs without errors
- ✅ Returns valid JSON
- ✅ POC mode works without API key
- ✅ Full mode works with API key (1-2 minutes)

---

### Test 2: Next.js → Python Integration

**Purpose**: Verify Next.js can spawn Python subprocess and parse results

**Method 1: Browser**
```
Navigate to: http://localhost:3000/api/research/test
View GET response for usage info
```

**Method 2: cURL**
```bash
curl -X POST http://localhost:3000/api/research/test \
  -H "Content-Type: application/json" \
  -d '{"instructions": "How to learn chess", "depth": "quick"}'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "query": "How to learn chess",
    "summary": "...",
    "fullReport": "...",
    "sources": [...]
  },
  "executionTime": 1234
}
```

**Success Criteria**:
- ✅ Next.js spawns Python subprocess
- ✅ JSON parsed correctly
- ✅ Errors handled gracefully
- ✅ Timeout works (2 minutes)

---

### Test 3: Inngest Background Jobs

**Purpose**: Verify Inngest can handle long-running tasks

**Prerequisite**: Inngest Dev Server must be running (`npx inngest-cli@latest dev`)

**Test 3a: Simple Job (5 seconds)**
```bash
curl -X POST "http://localhost:3000/api/inngest-test?type=simple"
```

**Expected Response**:
```json
{
  "success": true,
  "type": "simple",
  "eventIds": ["..."],
  "message": "Simple test job triggered successfully",
  "note": "Job will complete in ~5 seconds"
}
```

**Monitoring**:
1. Check Inngest Dashboard: http://localhost:8288
2. You should see the job appear and complete in ~5 seconds
3. Server logs will show job execution

**Test 3b: Research Job (1-5 minutes)**
```bash
curl -X POST "http://localhost:3000/api/inngest-test?type=research" \
  -H "Content-Type: application/json" \
  -d '{"instructions": "Learn backgammon strategy", "depth": "quick"}'
```

**Expected Response**:
```json
{
  "success": true,
  "type": "research",
  "researchId": "test-1234567890",
  "eventIds": ["..."],
  "message": "Research job triggered successfully",
  "note": "Check Inngest dashboard for job status"
}
```

**Monitoring**:
1. Check Inngest Dashboard: http://localhost:8288
2. Click on the job to see execution details
3. Job will spawn Python subprocess and complete research
4. Check server logs for `[Research Job test-xxxxx]` output

**Success Criteria**:
- ✅ Jobs trigger successfully
- ✅ Inngest dashboard shows job status
- ✅ Simple job completes in ~5 seconds
- ✅ Research job handles 1-5 minute execution
- ✅ Errors logged and tracked

---

### Test 4: OpenAI Structured Outputs

**Purpose**: Verify OpenAI returns 100% valid JSON with complex schemas

**Prerequisite**: `OPENAI_API_KEY` must be set in `.env`

**Method 1: With Sample Data**
```bash
curl -X POST http://localhost:3000/api/recommendations/test
```

**Method 2: With Custom Research Findings**
```bash
curl -X POST http://localhost:3000/api/recommendations/test \
  -H "Content-Type: application/json" \
  -d '{
    "researchFindings": {
      "query": "How to learn piano",
      "summary": "Piano requires practice...",
      "fullReport": "Detailed findings...",
      "sources": [{"url": "https://example.com", "title": "Source"}],
      "sourcesAnalyzed": 1,
      "metadata": {"depth": "quick"}
    }
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "topic": "backgammon strategy",
    "overview": "...",
    "estimatedTimeToMastery": "3-6 months",
    "learningPath": [
      {
        "phase": "Week 1-2",
        "goal": "...",
        "skills": [...],
        "successCriteria": "..."
      }
    ],
    "recommendedResources": [...],
    "practiceDrills": [...],
    "commonPitfalls": [...],
    "expertTips": [...],
    "nextSteps": "..."
  },
  "usage": {
    "promptTokens": 1234,
    "completionTokens": 5678,
    "totalTokens": 6912
  },
  "executionTime": 3456
}
```

**Success Criteria**:
- ✅ Returns valid JSON 100% of the time
- ✅ Schema matches Zod validation
- ✅ All nested objects populated
- ✅ Costs reasonable (<$0.05 per request)
- ✅ Execution time < 30 seconds

---

### Test 5: End-to-End POC

**Purpose**: Test complete workflow with all three technologies

**Prerequisite**:
- Inngest Dev Server running
- `OPENAI_API_KEY` configured

**Trigger Workflow**:
```bash
curl -X POST http://localhost:3000/api/poc/end-to-end \
  -H "Content-Type: application/json" \
  -d '{"topic": "backgammon", "depth": "quick"}'
```

**Expected Response**:
```json
{
  "success": true,
  "pocId": "poc-1234567890",
  "topic": "backgammon",
  "depth": "quick",
  "eventIds": ["..."],
  "message": "End-to-end POC workflow initiated successfully",
  "workflow": [
    "✓ API request received",
    "✓ Inngest background job triggered",
    "⏳ Job will execute GPT Researcher (Python subprocess)",
    "⏳ Research results will be processed by OpenAI Structured Outputs",
    "⏳ Final recommendations will be generated"
  ],
  "monitoring": {
    "inngestDashboard": "http://localhost:8288",
    "serverLogs": "Look for [Research Job poc-xxxxx] in console"
  }
}
```

**Monitor Execution**:

1. **Inngest Dashboard** (http://localhost:8288):
   - Click on the triggered job
   - Watch execution progress
   - View step-by-step execution

2. **Server Logs**:
   ```
   [POC poc-xxxxx] Starting end-to-end workflow for topic: "backgammon" (quick)
   [POC poc-xxxxx] Inngest job triggered with event IDs: [...]
   [Research Job poc-xxxxx] Starting: "Research how to learn and master backgammon..." (quick)
   [Research Job poc-xxxxx] Completed in 65432ms - Success: true
   ```

3. **Expected Timeline**:
   - API Response: Immediate
   - Python Research: 1-2 minutes (quick), 3-5 minutes (moderate), 5-10 minutes (deep)
   - OpenAI Processing: 10-30 seconds
   - Total: ~2-3 minutes for "quick" mode

**Success Criteria**:
- ✅ Workflow triggers successfully
- ✅ All technologies work together
- ✅ Complete execution in < 10 minutes
- ✅ Research findings generated
- ✅ Recommendations structured and valid
- ✅ Costs reasonable (<$0.01 per run)

---

## Troubleshooting

### Python Script Errors

**Error**: `OPENAI_API_KEY environment variable not set`
```bash
# Solution: Create .env file with OPENAI_API_KEY
cp .env.example .env
# Edit .env and add your API key
```

**Error**: `ModuleNotFoundError: No module named 'gpt_researcher'`
```bash
# Solution: Reinstall Python dependencies
cd python
source venv/bin/activate
pip install -r requirements.txt
```

### Inngest Not Working

**Error**: `Failed to trigger Inngest job`
```bash
# Solution: Start Inngest Dev Server
npx inngest-cli@latest dev

# Verify it's running at http://localhost:8288
```

**Error**: `Connection refused to Inngest`
```bash
# Solution: Make sure Inngest Dev Server is running in separate terminal
# Alternative: Configure production Inngest credentials in .env
```

### OpenAI Errors

**Error**: `Invalid API key`
```bash
# Solution: Check your OPENAI_API_KEY in .env
# Make sure it starts with sk-proj- or sk-
# Get new key from https://platform.openai.com/api-keys
```

**Error**: `Model not found: gpt-4o-2024-08-06`
```bash
# Solution: You may need GPT-4 API access
# Alternative: Change model in lib/recommendationGenerator.ts to "gpt-4o" or "gpt-4-turbo"
```

### Next.js Errors

**Error**: `Cannot find module '@/lib/...'`
```bash
# Solution: Restart Next.js dev server
npm run dev
```

---

## Performance Benchmarks

### Expected Metrics

| Test | Expected Time | Expected Cost |
|------|---------------|---------------|
| Python Script (POC mode) | < 1 second | $0.00 |
| Python Script (Quick) | 1-2 minutes | ~$0.001 |
| Python Script (Moderate) | 3-5 minutes | ~$0.003 |
| Python Script (Deep) | 5-10 minutes | ~$0.006 |
| OpenAI Recommendations | 10-30 seconds | ~$0.002 |
| End-to-End (Quick) | 2-3 minutes | ~$0.003 |
| End-to-End (Moderate) | 4-6 minutes | ~$0.005 |
| End-to-End (Deep) | 6-11 minutes | ~$0.008 |

### Cost Estimation

Based on typical usage:
- GPT Researcher (gpt-4o-mini): ~$0.001-0.006 per research
- OpenAI Structured Outputs (gpt-4o): ~$0.002 per recommendation
- Total per complete workflow: ~$0.003-0.008

**Phase 1 Budget**: Well under $1 for all testing

---

## Next Steps After Testing

### If All Tests Pass ✅

**Phase 1 Status**: VALIDATED
**Recommendation**: PROCEED TO PHASE 2

**Phase 2 Priorities**:
1. Database setup (Prisma + PostgreSQL)
2. User authentication (Clerk)
3. Project and research data models
4. Save/retrieve workflow results
5. Basic UI for project management

### If Tests Fail ❌

**Action**: Debug and resolve issues before Phase 2

**Common Issues**:
1. Missing API keys → Add to .env
2. Python dependencies → Reinstall
3. Inngest not running → Start dev server
4. Port conflicts → Change ports in config

---

## Support & Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Inngest Docs**: https://www.inngest.com/docs
- **OpenAI Structured Outputs**: https://platform.openai.com/docs/guides/structured-outputs
- **GPT Researcher**: https://github.com/assafelovic/gpt-researcher

For issues with this POC, check:
1. Server logs (Terminal 1)
2. Inngest dashboard logs (http://localhost:8288)
3. Browser console (F12)
4. PHASE1-STATUS.md for known issues
