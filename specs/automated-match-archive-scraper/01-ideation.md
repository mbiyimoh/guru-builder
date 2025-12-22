# Automated Match Archive Scraper

**Slug:** automated-match-archive-scraper
**Author:** Claude Code
**Date:** 2025-12-15
**Branch:** feat/automated-match-archive-scraper
**Related:** specs/match-archive-import-system/01-specification.md

---

## 1) Intent & Assumptions

- **Task brief:** Create an automated scraper that fetches .txt match archive files from Hardy's Backgammon Pages (and potentially other collections) and stores positions directly in the database for immediate drill generation - eliminating the manual upload step entirely.

- **Assumptions:**
  - Hardy's Backgammon Pages is a public community resource and scraping is acceptable
  - The existing match import pipeline (parser, replay engine, phase classifier, GNUBG verification) is production-ready and can be reused
  - User wants positions available immediately after scraping completes
  - Inngest is the appropriate tool for background job orchestration
  - Duplicate positions will be handled via existing `positionId` deduplication

- **Out of scope:**
  - BigBrother and LittleSister collections (different structure, larger scale)
  - Manual file upload UI changes (already implemented)
  - Changes to the verification pipeline
  - Real-time progress streaming (existing polling is sufficient)

---

## 2) Pre-reading Log

- `specs/match-archive-import-system/01-specification.md`: Complete spec for manual import system. Line 1492 notes "manual upload only for MVP - licensing concerns" but user explicitly wants automated scraping.

- `lib/matchImport/jellyFishParser.ts`: Parses JellyFish .txt format. Functions: `parseJellyFishMatch()`, `enrichMatchMetadata()`. Handles move notation, player info extraction.

- `lib/matchImport/replayEngine.ts`: Reconstructs board positions by replaying moves. Key functions: `replayMatch()`, `applyMoves()`, `boardStateToMCPFormat()`.

- `lib/matchImport/phaseClassifier.ts`: Classifies positions into OPENING, EARLY, MIDDLE, BEAROFF based on pip count and board state.

- `lib/inngest-functions.ts` (lines 1237-1612): Two Inngest functions - `matchArchiveImportJob` (parse/replay/store) and `verifyPositionBatchJob` (GNUBG verification in batches of 50).

- `prisma/schema.prisma` (lines 649-763): MatchArchive, ImportedMatch, PositionLibrary models with proper relationships.

- `app/api/match-import/route.ts`: Current upload endpoint. Creates MatchArchive record, triggers Inngest event.

---

## 3) Codebase Map

### Primary components/modules
| Path | Role |
|------|------|
| `lib/matchImport/` | Core parser, replay, classifier |
| `lib/inngest-functions.ts` | Background job orchestration |
| `app/api/match-import/` | REST endpoints for import |
| `prisma/schema.prisma` | Database models |

### Shared dependencies
- `lib/groundTruth/mcpClient.ts` - GNUBG communication
- `lib/inngest.ts` - Inngest client registration
- `lib/db.ts` - Prisma client

### Data flow
```
Scraper discovers URLs → Downloads .txt →
parseJellyFishMatch() → replayMatch() → classifyPhase() →
PositionLibrary.create() → verifyPositionBatchJob → GNUBG →
PositionLibrary.update(bestMove)
```

### Feature flags/config
- `MATCH_ARCHIVE_STORAGE` env var for file storage path
- No feature flags currently

### Potential blast radius
- New Inngest function for scraping
- New API endpoint for triggering scrapes
- Minor UI addition to GroundTruthEngineManager
- No changes to existing import pipeline

---

## 4) Root Cause Analysis

N/A - This is a new feature, not a bug fix.

---

## 5) Research

### Hardy's Backgammon Pages Structure

**URL:** `https://www.hardyhuebener.de/engl/matches.html`

**File Link Pattern:**
```
../downloads/[YEAR][tournament_abbrev]_[round]_[player1]-[player2].txt
```

**Examples:**
- `../downloads/2011_mc_final_suzuki_vs_gullota.txt`
- `../downloads/2005mc_round2_jonas-tardieu.txt`

**Base URL for downloads:** `https://www.hardyhuebener.de/downloads/`

**Metadata available in HTML:**
- Tournament name and location
- Round designation (Final, Semifinal, etc.)
- Player names with country codes (JPN, ITA, USA, etc.)
- Year/date when specified

**Page structure:** Single page, no pagination, ~100+ match files

### Potential Solutions

#### Option 1: Standalone Node.js Script
**Pros:**
- Simple to implement
- Can run locally or as cron job
- No dependency on web app running

**Cons:**
- Requires manual execution
- No progress visibility in UI
- Separate from main codebase

#### Option 2: Inngest Background Job (Recommended)
**Pros:**
- Consistent with existing architecture
- Progress tracking via UI polling
- Automatic retries on failure
- Throttling built-in
- Runs within existing infrastructure

**Cons:**
- Slightly more complex setup
- Requires Inngest running

#### Option 3: API Endpoint with Streaming
**Pros:**
- Real-time progress updates

**Cons:**
- Complex SSE implementation
- Timeout issues for long-running operations
- Not consistent with existing patterns

### Recommendation

**Use Option 2: Inngest Background Job**

This aligns with the existing match import architecture. The implementation will:

1. Create a **scraper utility** (`lib/matchImport/scraper.ts`) that:
   - Fetches Hardy's matches.html page
   - Parses all .txt file links with regex
   - Extracts metadata from surrounding HTML
   - Downloads each file and returns content

2. Create an **Inngest job** (`scrapeMatchArchiveJob`) that:
   - Calls scraper to discover all archive URLs
   - For each archive:
     - Download file content
     - Create MatchArchive record with `sourceUrl` populated
     - Trigger existing `matchArchiveImportJob`
   - Track progress in a new `ScrapeSession` model (optional)

3. Create an **API endpoint** (`/api/match-import/scrape`) that:
   - Accepts collection name (e.g., "Hardy")
   - Triggers the Inngest scraper job
   - Returns job ID for tracking

4. Add **UI trigger** to GroundTruthEngineManager:
   - "Scrape Hardy's Collection" button
   - Shows scraping progress alongside import progress

---

## 6) Clarifications

1. **Scope of collections:** Should we implement only Hardy's Backgammon Pages now, or also prepare architecture for BigBrother/LittleSister later?
   - **Recommendation:** Hardy's only for now, but design interface to be extensible

2. **Deduplication behavior:** If a match archive was already imported, should we:
   - Skip it entirely?
   - Re-download but let PositionLibrary upsert handle dedup?
   - **Recommendation:** Skip already-imported archives (check by filename in MatchArchive)

3. **Failure handling:** If some downloads fail, should we:
   - Stop the entire scrape job?
   - Continue and report failures at end?
   - **Recommendation:** Continue processing, log failures, report summary

4. **Run frequency:** Should this be:
   - One-time manual trigger?
   - Scheduled periodic job?
   - **Recommendation:** Manual trigger initially, can add scheduling later

5. **Verification throttling:** With ~100 archives (~14K positions), verification will take ~30-45 minutes. Is this acceptable?
   - **Recommendation:** Yes, user can monitor via existing progress UI

---

## 7) Proposed Implementation

### New Files

```
lib/matchImport/
├── scraper.ts                    # URL discovery & download
├── scraperTypes.ts               # Scraper-specific types
└── collections/
    └── hardy.ts                  # Hardy's-specific parsing

app/api/match-import/
└── scrape/
    └── route.ts                  # POST to trigger scrape

lib/inngest-functions.ts          # Add scrapeMatchArchiveJob
```

### Database Changes (Optional)

```prisma
// Optional: Track scrape sessions
model ScrapeSession {
  id              String   @id @default(cuid())
  collection      String   // "Hardy", "BigBrother", etc.
  status          ScrapeStatus
  totalArchives   Int      @default(0)
  processedCount  Int      @default(0)
  failedCount     Int      @default(0)
  createdAt       DateTime @default(now())
  completedAt     DateTime?
}

enum ScrapeStatus {
  PENDING
  DISCOVERING
  DOWNLOADING
  COMPLETED
  FAILED
}
```

### Key Functions

```typescript
// lib/matchImport/scraper.ts

interface DiscoveredArchive {
  url: string
  filename: string
  metadata: {
    tournamentName: string
    round?: string
    player1: { name: string; country?: string }
    player2: { name: string; country?: string }
    year?: number
  }
}

export async function discoverHardyArchives(): Promise<DiscoveredArchive[]>
export async function downloadArchive(url: string): Promise<string>
```

```typescript
// lib/inngest-functions.ts

export const scrapeMatchArchiveJob = inngest.createFunction(
  { id: 'scrape-match-archives', retries: 1 },
  { event: 'match-archive/scrape.started' },
  async ({ event, step }) => {
    const { collection, engineId } = event.data

    // Step 1: Discover archives
    const archives = await step.run('discover', () => discoverHardyArchives())

    // Step 2: Filter already-imported
    const newArchives = await step.run('filter', () =>
      filterAlreadyImported(archives)
    )

    // Step 3: Process each archive
    for (const archive of newArchives) {
      await step.run(`import-${archive.filename}`, async () => {
        const content = await downloadArchive(archive.url)

        // Create MatchArchive record
        const record = await prisma.matchArchive.create({
          data: {
            filename: archive.filename,
            sourceUrl: archive.url,
            sourceCollection: 'Hardy',
            importStatus: 'PENDING',
          }
        })

        // Store file content
        await storeArchiveFile(record.id, content)

        // Trigger existing import job
        await inngest.send({
          name: 'match-archive/import.started',
          data: { archiveId: record.id, engineId }
        })
      })
    }
  }
)
```

### Estimated Effort

| Task | Effort |
|------|--------|
| Scraper utility (discovery + download) | 1-2 hours |
| Inngest scrape job | 1 hour |
| API endpoint | 30 min |
| UI trigger button | 30 min |
| Testing | 1 hour |
| **Total** | **4-5 hours** |

---

## 8) Next Steps

1. User confirms scope (Hardy's only vs. extensible)
2. User confirms deduplication behavior
3. Create specification from this ideation
4. Implement in order: scraper → Inngest job → API → UI
