# TradeblockGPT - Claude Code Project Documentation

## Overview

This project is building an AI-powered "trader preferences profile" system (TradeblockGPT) that:
1. Pulls comprehensive user data from the Tradeblock database
2. Generates an initial "trader preferences profile" with both direct and calculated/reasoned fields
3. Provides a chat interface where an LLM can update the profile in real-time as it learns about the user
4. Displays the profile alongside the chat for live updates

## Agent Protocols

### Database Queries & Data Pulling

**CRITICAL:** For ALL database queries and data pulling tasks, ALWAYS use the `squad-agent-database-master` agent.

**Why this agent:**
- Has deep understanding of the Tradeblock data model and schema
- Follows protocol to leverage `query-building-blocks.md` for proven query patterns
- Uses knowledge hierarchy: Building blocks → Data model guide → Schema exploration (only when needed)
- Optimized for PostgreSQL + Prisma + Hasura GraphQL architecture

**How to invoke:**
```
Use Task tool with subagent_type: "database-expert" (which maps to squad-agent-database-master)
```

**Never use:**
- Generic SQL queries without consulting the agent
- Direct database exploration without leveraging existing building blocks
- Ad-hoc queries that bypass the established patterns

### Key Resources

The database master agent has access to:
- `query-building-blocks.md` - Battle-tested SQL patterns for user targeting, analytics, product data
- `what-were-building.md` - Tradeblock business context and philosophy
- Existing Python utilities in `basic_capabilities/internal_db_queries_toolbox/`

## Project Architecture

Based on `context-and-knowledge-LLM-synthesis.md` reference architecture:
- **Multi-layer context system**: LLM instructions + user profile as knowledge layer
- **Real-time database updates**: Profile fields update during conversation
- **Side-by-side UI**: Chat interface + live profile view

## Development Phases

### Phase 1: Discovery & Design (Current)
1. Pull comprehensive data for sample user
2. Analyze what calculated/reasoned fields are possible
3. Design trader preferences profile structure

### Phase 2: Data Pipeline
4. Write SQL queries to populate profile fields
5. Create data transformation scripts
6. Design database schema for trader preferences storage

### Phase 3: LLM Chat System
7. Build chat interface with profile update capabilities
8. Implement side-by-side view (chat + profile)
9. Add MCP controls for CRUD operations on profile

## Key Patterns

### Calculated/Reasoned Fields Examples
- New vs Used preference (analyzing trade history conditions)
- Release date recency preference (comparing shoe release dates to trade dates)
- Brand affinity (most traded brands)
- Size consistency (stated preference vs actual trading behavior)
- Price range comfort zone (analyzing accepted offer price ranges)

### Data Quality Notes
- Release dates showing year 1950 are invalid and should be filtered out
- Filter for `deleted_at = 0` on most tables
- Use `validation_passed_date IS NOT NULL` for completed trades
- Leverage `index_cache` JSONB fields for quick product attribute access

## Contact & Collaboration

This is a prototype/proof-of-concept for the broader Tradeblock MCP vision.

## Standard Operating Procedures (SOPs)

### Dev Server Restart Protocol

**CRITICAL:** When restarting the dev server, ALWAYS follow this procedure to avoid stale cache issues:

```bash
# 1. Kill all running Node processes
pkill -9 node

# 2. Clear build cache and dependencies
rm -rf node_modules .next

# 3. Fresh install dependencies
npm install

# 4. Start dev server
npm run dev
```

**Why this is necessary:**
- Next.js Turbopack can have stale cache issues
- Multiple background dev servers can cause port conflicts
- TypeScript compilation errors can persist without clean rebuild
- Lock file conflicts when multiple processes compete for `.next` directory

**When to use:**
- After switching between git branches
- After package.json dependency changes
- When encountering unexplained build errors
- When dev server won't start due to port/lock conflicts
- Before running E2E tests to ensure clean state
