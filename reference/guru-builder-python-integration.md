# Guru Builder Python Integration
## GPT Researcher Integration for Autonomous Research

This document contains the complete Python integration code for GPT Researcher, which enables autonomous research runs in the Guru Builder system.

---

## Table of Contents

1. [Overview](#overview)
2. [Python Environment Setup](#python-environment-setup)
3. [GPT Researcher Script](#gpt-researcher-script)
4. [Integration with Next.js](#integration-with-nextjs)
5. [Testing & Validation](#testing--validation)
6. [Troubleshooting](#troubleshooting)

---

## Overview

The Guru Builder system uses GPT Researcher to autonomously:
1. Research topics based on user instructions
2. Analyze multiple web sources
3. Synthesize findings into structured reports
4. Return JSON data to Next.js backend

**Communication Flow**:
```
Next.js API Route → Python subprocess → GPT Researcher → OpenAI API → Research Findings → Next.js
```

---

## Python Environment Setup

### Step 1: Install Python Dependencies

Create `requirements.txt`:

```txt
gpt-researcher==0.8.0
langchain==0.1.0
langchain-openai==0.0.2
python-dotenv==1.0.0
```

Install dependencies:

```bash
# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Environment Variables

Ensure `.env` contains:

```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

---

## GPT Researcher Script

### research_agent.py

Create `research_agent.py` in project root:

```python
#!/usr/bin/env python3
"""
GPT Researcher Agent for Guru Builder System

This script performs autonomous research using GPT Researcher and returns
structured JSON output to the Next.js backend via subprocess communication.

Usage:
  python research_agent.py "<instructions>" "<depth>"

Example:
  python research_agent.py "Research backgammon opening strategies" "moderate"

Output:
  JSON object with research findings, sources, and summary
"""

import sys
import json
import os
from typing import Dict, List, Any, Literal
from dotenv import load_dotenv
from gpt_researcher import GPTResearcher

# Load environment variables
load_dotenv()

# Type definitions
ResearchDepth = Literal["quick", "moderate", "deep"]

class ResearchConfig:
    """Configuration for research depth levels."""

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

    @classmethod
    def get_settings(cls, depth: ResearchDepth) -> Dict[str, Any]:
        """Get configuration settings for a given research depth."""
        return cls.DEPTH_SETTINGS.get(depth, cls.DEPTH_SETTINGS["moderate"])


async def conduct_research(
    instructions: str,
    depth: ResearchDepth = "moderate"
) -> Dict[str, Any]:
    """
    Conduct autonomous research using GPT Researcher.

    Args:
        instructions: Research query or instructions
        depth: Research depth level (quick, moderate, deep)

    Returns:
        Dictionary containing research findings, sources, and metadata
    """

    # Get depth-specific settings
    config = ResearchConfig.get_settings(depth)

    # Initialize GPT Researcher
    researcher = GPTResearcher(
        query=instructions,
        report_type=config["report_type"],
        config_path=None,  # Use default config
    )

    # Conduct research
    await researcher.conduct_research()

    # Generate report
    report = await researcher.write_report()

    # Get sources
    sources = researcher.get_source_urls()

    # Structure findings
    findings = {
        "query": instructions,
        "depth": depth,
        "summary": report[:500] + "..." if len(report) > 500 else report,
        "fullReport": report,
        "sources": [
            {
                "url": url,
                "title": f"Source {idx + 1}",  # GPT Researcher doesn't provide titles
            }
            for idx, url in enumerate(sources[:config["max_sources"]])
        ],
        "sourcesAnalyzed": len(sources),
        "metadata": {
            "maxSources": config["max_sources"],
            "maxIterations": config["max_iterations"],
            "reportType": config["report_type"],
        },
    }

    return findings


def main():
    """Main entry point for the research agent."""

    # Validate arguments
    if len(sys.argv) < 3:
        error = {
            "error": "Missing required arguments",
            "usage": "python research_agent.py '<instructions>' '<depth>'",
            "example": "python research_agent.py 'Research backgammon' 'moderate'",
        }
        print(json.dumps(error), file=sys.stderr)
        sys.exit(1)

    instructions = sys.argv[1]
    depth = sys.argv[2]

    # Validate depth
    if depth not in ["quick", "moderate", "deep"]:
        error = {
            "error": f"Invalid depth: {depth}",
            "valid_depths": ["quick", "moderate", "deep"],
        }
        print(json.dumps(error), file=sys.stderr)
        sys.exit(1)

    # Validate OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        error = {
            "error": "OPENAI_API_KEY environment variable not set",
            "solution": "Set OPENAI_API_KEY in .env file",
        }
        print(json.dumps(error), file=sys.stderr)
        sys.exit(1)

    # Conduct research (async)
    import asyncio

    try:
        findings = asyncio.run(conduct_research(instructions, depth))

        # Output JSON to stdout (consumed by Next.js subprocess)
        print(json.dumps(findings, indent=2))
        sys.exit(0)

    except Exception as e:
        error = {
            "error": "Research failed",
            "message": str(e),
            "type": type(e).__name__,
        }
        print(json.dumps(error), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

### Key Features

1. **Type Safety**: Uses type hints for better IDE support
2. **Error Handling**: Comprehensive error messages with exit codes
3. **Configurable Depth**: Three research depth levels with different settings
4. **JSON Output**: Structured JSON for easy parsing in Next.js
5. **Environment Variables**: Uses python-dotenv for configuration
6. **Async Support**: Uses asyncio for GPT Researcher's async API

---

## Integration with Next.js

### TypeScript Types

Add to `lib/types.ts`:

```typescript
// Research types
export interface ResearchSource {
  url: string
  title: string
}

export interface ResearchFindings {
  query: string
  depth: 'quick' | 'moderate' | 'deep'
  summary: string
  fullReport: string
  sources: ResearchSource[]
  sourcesAnalyzed: number
  metadata: {
    maxSources: number
    maxIterations: number
    reportType: string
  }
}

export interface ResearchRunConfig {
  instructions: string
  depth: 'quick' | 'moderate' | 'deep'
  scope: {
    layers: 'all' | string[]
    files: 'all' | string[]
  }
}
```

### Research Orchestrator

Update `lib/researchOrchestrator.ts`:

```typescript
import { spawn } from 'child_process'
import { ResearchFindings, ResearchRunConfig } from './types'

export async function performDeepResearch(
  instructions: string,
  depth: 'quick' | 'moderate' | 'deep'
): Promise<ResearchFindings> {
  return new Promise((resolve, reject) => {
    // Spawn Python process
    const python = spawn('python3', ['research_agent.py', instructions, depth])

    let stdout = ''
    let stderr = ''

    // Collect stdout
    python.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    // Collect stderr
    python.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    // Handle process completion
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const findings = JSON.parse(stdout)
          resolve(findings)
        } catch (error) {
          reject(new Error(`Failed to parse research output: ${error}`))
        }
      } else {
        let errorMessage = 'Research failed'
        try {
          const errorObj = JSON.parse(stderr)
          errorMessage = errorObj.error || errorObj.message || errorMessage
        } catch {
          errorMessage = stderr || errorMessage
        }
        reject(new Error(errorMessage))
      }
    })

    // Handle spawn errors
    python.on('error', (error) => {
      reject(new Error(`Failed to spawn Python process: ${error.message}`))
    })
  })
}
```

### API Route (Test)

Create `app/api/research/test/route.ts` for Phase 1 validation:

```typescript
import { NextResponse } from 'next/server'
import { performDeepResearch } from '@/lib/researchOrchestrator'

export async function POST(req: Request) {
  try {
    const { instructions, depth } = await req.json()

    if (!instructions) {
      return NextResponse.json(
        { error: 'Missing required field: instructions' },
        { status: 400 }
      )
    }

    const validDepths = ['quick', 'moderate', 'deep']
    if (!validDepths.includes(depth)) {
      return NextResponse.json(
        { error: `Invalid depth. Must be one of: ${validDepths.join(', ')}` },
        { status: 400 }
      )
    }

    console.log(`[Research Test] Starting ${depth} research: ${instructions}`)

    const findings = await performDeepResearch(instructions, depth)

    console.log(`[Research Test] Completed. Sources analyzed: ${findings.sourcesAnalyzed}`)

    return NextResponse.json({ findings })
  } catch (error) {
    console.error('[Research Test] Error:', error)
    return NextResponse.json(
      {
        error: 'Research failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
```

---

## Testing & Validation

### Phase 1: Python Script Testing

Test the Python script directly:

```bash
# Test quick research
python3 research_agent.py "What are the best backgammon opening moves?" "quick"

# Test moderate research
python3 research_agent.py "Explain backgammon priming strategy" "moderate"

# Test deep research (may take 5-10 minutes)
python3 research_agent.py "Compare positional vs aggressive backgammon styles" "deep"
```

**Expected Output**:
```json
{
  "query": "What are the best backgammon opening moves?",
  "depth": "quick",
  "summary": "The best backgammon opening moves focus on...",
  "fullReport": "...",
  "sources": [
    {
      "url": "https://example.com/article",
      "title": "Source 1"
    }
  ],
  "sourcesAnalyzed": 5,
  "metadata": {
    "maxSources": 5,
    "maxIterations": 2,
    "reportType": "research_report"
  }
}
```

### Phase 2: Next.js Integration Testing

Test via API route:

```bash
# Start Next.js dev server
npm run dev

# Call test endpoint
curl -X POST http://localhost:3000/api/research/test \
  -H "Content-Type: application/json" \
  -d '{
    "instructions": "Research backgammon opening strategies",
    "depth": "quick"
  }'
```

**Success Criteria**:
- ✅ Python subprocess spawns successfully
- ✅ GPT Researcher returns structured data
- ✅ JSON parsing works correctly
- ✅ Response time acceptable (quick: 1-2min, moderate: 3-5min, deep: 5-10min)
- ✅ Cost per run under $0.01

### Phase 3: Error Handling Testing

Test error scenarios:

```bash
# Test missing API key
unset OPENAI_API_KEY
python3 research_agent.py "test query" "moderate"

# Test invalid depth
python3 research_agent.py "test query" "invalid"

# Test missing arguments
python3 research_agent.py "test query"

# Test empty query
python3 research_agent.py "" "moderate"
```

**Expected**: Proper error messages with exit code 1

---

## Troubleshooting

### Issue 1: Python Not Found

**Error**: `spawn python3 ENOENT`

**Solutions**:
```bash
# Check Python installation
which python3

# Install Python (macOS)
brew install python3

# Install Python (Ubuntu)
sudo apt install python3 python3-pip

# Update spawn command to use full path
const python = spawn('/usr/local/bin/python3', ['research_agent.py', instructions, depth])
```

---

### Issue 2: Module Not Found

**Error**: `ModuleNotFoundError: No module named 'gpt_researcher'`

**Solution**:
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt

# Verify installation
pip list | grep gpt-researcher
```

---

### Issue 3: OpenAI API Key Errors

**Error**: `openai.error.AuthenticationError: Incorrect API key provided`

**Solution**:
```bash
# Check .env file
cat .env | grep OPENAI_API_KEY

# Test API key directly
python3 -c "import os; from dotenv import load_dotenv; load_dotenv(); print(os.getenv('OPENAI_API_KEY')[:10] + '...')"

# Regenerate API key at https://platform.openai.com/api-keys
```

---

### Issue 4: JSON Parsing Errors

**Error**: `Failed to parse research output: Unexpected token`

**Cause**: Python script printed debug output to stdout

**Solution**:
- Ensure all print statements use `file=sys.stderr` for debugging
- Only final JSON should go to stdout
- Use `python3 -u` for unbuffered output if needed

```typescript
const python = spawn('python3', ['-u', 'research_agent.py', instructions, depth])
```

---

### Issue 5: Timeout Errors

**Error**: Research takes >10 minutes

**Solutions**:
1. **Use "quick" depth** for faster results
2. **Implement timeout** in Next.js:

```typescript
function performResearchWithTimeout(
  instructions: string,
  depth: string,
  timeoutMs: number = 600000  // 10 minutes
): Promise<ResearchFindings> {
  return Promise.race([
    performDeepResearch(instructions, depth),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Research timeout')), timeoutMs)
    ),
  ]) as Promise<ResearchFindings>
}
```

3. **Optimize query**: Make instructions more specific

---

## Performance & Cost Optimization

### Performance Metrics

Expected performance by depth:

| Depth    | Duration | Sources | Iterations | Cost  |
|----------|----------|---------|------------|-------|
| Quick    | 1-2 min  | 5       | 2          | $0.01 |
| Moderate | 3-5 min  | 10      | 4          | $0.05 |
| Deep     | 5-10 min | 20      | 6          | $0.10 |

### Cost Optimization Tips

1. **Start with "quick" depth** for MVP
2. **Cache results** for identical queries
3. **Limit concurrent research runs** to avoid rate limits
4. **Monitor OpenAI usage** at https://platform.openai.com/usage

---

## Alternative: HTTP Service

For production, consider running GPT Researcher as an HTTP service instead of subprocess:

### research_service.py

```python
from flask import Flask, request, jsonify
import asyncio
from research_agent import conduct_research

app = Flask(__name__)

@app.route('/research', methods=['POST'])
async def research():
    data = request.json
    instructions = data.get('instructions')
    depth = data.get('depth', 'moderate')

    findings = await conduct_research(instructions, depth)
    return jsonify(findings)

if __name__ == '__main__':
    app.run(port=8000)
```

### Next.js Integration

```typescript
export async function performDeepResearch(
  instructions: string,
  depth: string
): Promise<ResearchFindings> {
  const response = await fetch('http://localhost:8000/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructions, depth }),
  })

  if (!response.ok) {
    throw new Error('Research failed')
  }

  return await response.json()
}
```

**Benefits**:
- More reliable than subprocess
- Better error handling
- Can run on separate server
- Easier to scale

---

## Deployment Considerations

### Vercel Deployment

Vercel has limited Python support. Options:

1. **Use Vercel Serverless Functions** (experimental):
```json
// package.json
{
  "scripts": {
    "build": "python3 -m pip install -r requirements.txt && next build"
  }
}
```

2. **Deploy Python as separate service**:
- Deploy research service to Railway, Render, or Fly.io
- Use HTTP service approach instead of subprocess
- Configure API endpoint in environment variables

### Railway Deployment

Railway fully supports Python:

```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "python3 research_service.py"
```

---

**End of Python Integration Reference**
**Last Updated**: 2025-01-08
