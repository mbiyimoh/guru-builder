# Knowledge Audit

A systematic audit of base-level knowledge across all frameworks, APIs, and packages in this project. Goal: 8+ score on all critical and important tools.

---

## Phase 1: Tech Stack Inventory

Scan the project to build a comprehensive inventory.

### 1A: Existing Documentation Audit

**Check these locations first**—this is where project documentation typically lives:

- `/docs` — Project documentation directory
- `/developer-guides` — Developer-focused guides and references
- `CLAUDE.md` — Claude-specific project context (root and any subdirectories)
- `.claude/docs/` — Previously generated knowledge docs from this command
- `README.md` — Project overview and setup

Note what documentation already exists and its quality/recency. This baseline determines what gaps actually need filling vs. what's already covered.

### 1B: Dependency & Integration Scan

1. **Package manifests**: Check `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, `Gemfile`, `pyproject.toml`, or equivalent
2. **API integrations**: Look for API clients, SDKs, webhook handlers, or direct HTTP calls to external services
3. **Frameworks**: Identify core frameworks (React, Next.js, Django, Rails, etc.)
4. **Infrastructure/services**: Note any cloud services, databases, auth providers, payment processors, etc. referenced in code or config
5. **Build tools & dev dependencies**: Bundlers, test frameworks, linters that affect development patterns

### Output

Produce two lists:
1. **Existing docs inventory**: What documentation we already have, organized by what tool/topic it covers
2. **Tech stack inventory**: All dependencies and integrations found, noting which ones have existing docs vs. which have none

---

## Phase 2: Criticality Assessment

For each item in the inventory, assess its criticality to the project:

**Critical** (core to the product, bugs here = major problems):
- Primary framework the app is built on
- Payment/billing integrations
- Auth/security systems
- Core data stores
- Primary APIs the product depends on

**Important** (used significantly, worth understanding well):
- Secondary frameworks and major libraries
- Third-party integrations
- Testing frameworks
- Deployment/infrastructure tools

**Peripheral** (used but low-risk, no audit needed):
- Utility libraries
- Dev-only tooling
- Formatting/linting

Present the prioritized list to the user, focusing on Critical and Important items.

---

## Phase 3: Knowledge Gap Audit & Scoring

For each Critical and Important item, conduct an honest self-assessment.

### Self-Assessment Questions

- Do I know the current stable version and any recent breaking changes?
- Am I aware of common gotchas, anti-patterns, or "FAQ" issues developers hit?
- Do I understand the recommended patterns from official docs vs. my general training?
- Are there recent updates (last 6-12 months) that might not be in my training data?
- For APIs: Do I know the actual endpoint signatures, rate limits, error codes, and auth patterns?

### Scoring Scale (1-10)

Rate each tool based on: **How well does our current knowledge match what this project needs?**

| Score | Meaning |
|-------|---------|
| 10 | Bulletproof. Any problem that arises, we can solve immediately. |
| 9 | Near-bulletproof. Rare edge cases might require a quick lookup. |
| 8 | **Target threshold.** Smooth sailing the vast majority of the time. Occasional unknowns but nothing that derails us. |
| 7 | Competent but gaps exist. Will probably hit 1-2 issues that require real research. |
| 6 | Functional knowledge only. Likely to waste time on avoidable mistakes. |
| 5 | Shaky. Know the basics but missing important details. |
| 4 | Dangerous. Enough knowledge to write code, not enough to write it correctly. |
| 1-3 | Should not touch without research first. |

### Output Format

Present a scored table:

```
KNOWLEDGE AUDIT SCORES
Goal: 8+ on all Critical/Important items

Tool/Framework          | Criticality | Score | Gap Summary
------------------------|-------------|-------|------------------
[e.g., Stripe API]      | Critical    | 5/10  | Know basics, unclear on webhooks, error handling, idempotency
[e.g., Next.js 14]      | Critical    | 7/10  | Solid on App Router, fuzzy on caching/revalidation
[e.g., Prisma]          | Important   | 8/10  | Good shape, minor gaps on migrations
...

Items below 8 need attention.
```

---

## Phase 4: Recommendations

Present findings and get user approval:

```
RECOMMENDED RESEARCH (items scoring <8):

1. [Tool] (current: X/10, target: 8+)
   - Key gaps: [1-2 sentence summary]
   - Why it matters for this project: [specific risk]

2. [Tool] (current: X/10, target: 8+)
   - Key gaps: [...]
   - Why it matters: [...]

ALREADY SOLID (no research needed):
- [Tool] (8/10): [one line on why we're good]
- [...]

Which items should I research? Any to skip or add?
```

**Wait for user feedback before proceeding.**

---

## Phase 5: Deep Research Runs

For each approved item, conduct focused research.

### Research Sources (in priority order)

1. Official documentation (always primary)
2. GitHub repo: README, changelogs, migration guides
3. Official blog/announcements for recent changes
4. Stack Overflow: common issues and solutions
5. GitHub issues: known bugs, limitations, workarounds

### Research Focus

Gather knowledge on:
- Current version & recent breaking changes
- Core mental models (how does this thing actually work?)
- Recommended patterns from official sources
- **Gotchas, footguns, and anti-patterns** (highest value)
- Error handling patterns and failure modes
- For APIs: auth, rate limits, key endpoints, error codes

---

## Phase 6: Playback & Documentation

After research, present findings to the user before writing any docs.

### Playback Format

For each researched item:

```
## [TOOL NAME] - Research Summary

**Previous score:** X/10 → **Post-research score:** Y/10

### Key Learnings
[3-5 bullet points of the most important discoveries—things that would have saved us time or prevented bugs if known earlier]

### Gotchas & Footguns
[The stuff that bites people. Be specific.]

### Recommended Patterns
[How to use this correctly in our project context]

### What's NOT Relevant
[Explicitly note what we researched but intentionally excluded because it doesn't apply to our use case—this prevents over-documentation]

### Documentation Recommendation
[Proposed structure/contents for the final doc. Keep it minimal.]
```

After playback, ask: **"Does this capture what matters? Anything to add or cut before I write the final docs?"**

---

## Phase 7: Write Concise Documentation

### The Brevity Mandate

Good documentation is **short**. Every line must earn its place. Our goal is documentation that:
- Fits comfortably in context without bloating it
- Can be scanned in 30 seconds for the relevant bit
- Contains zero filler, zero "obvious" information, zero redundancy

### Brevity Strategies

1. **Project-specific filtering**: Ruthlessly exclude anything not relevant to how WE use this tool. If we only use 20% of an API, document only that 20%.

2. **Density over length**: Say it in fewer words. Prefer tables over paragraphs. Prefer examples over explanations.

3. **Gotcha-first structure**: Lead with what will bite us. Save "how it works" theory for only when necessary.

4. **No preamble**: Skip "This document covers..." introductions. Just start.

### Documentation Template

```markdown
# [Tool Name] - Project Reference

**Version:** X.X | **Last updated:** [date]

## TL;DR
[2-3 sentences max. The one thing to remember.]

## Gotchas
- [Specific trap]: [How to avoid]
- [...]

## Key Patterns
[Code snippets or terse descriptions of correct usage for our use cases]

## Quick Reference
[Tables, cheatsheets, or lookup info we'll actually need]

## Error Handling
[Common errors and what they actually mean]
```

### Save Location

Save to `.claude/docs/[tool-name].md`

---

## Usage Notes

- Run at project start, after major dependency updates, or when hitting mysterious bugs
- Be genuinely honest in self-assessment—the goal is surfacing unknown unknowns
- Target 8+ scores on all Critical/Important items
- Brevity is a feature, not a compromise. Over-documentation wastes context and attention.