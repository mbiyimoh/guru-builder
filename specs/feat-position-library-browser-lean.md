# Position Library Browser

## Status
Implemented (2025-12-16)

## Authors
Claude | 2025-12-16

## Overview

A browsable UI component that allows users to explore positions stored in the Position Library. Users can filter by game phase, view ASCII board representations, see move analysis with equity values, and access match metadata (tournament, players, countries) for positions sourced from imported matches.

## Problem Statement

The Position Library currently contains 460+ verified positions extracted from match archives, but this valuable data is only accessible programmatically. Users have no way to:
- Browse and explore available positions
- Understand what positions are being used for drill generation
- View the rich metadata associated with positions (player names, tournaments, match context)
- Verify the quality of imported positions

Making this data browsable transforms it from a hidden backend resource into a valuable learning and verification tool.

## Goals

- Allow users to browse all positions in the Position Library
- Filter positions by game phase (OPENING, EARLY, MIDDLE, BEAROFF)
- Display ASCII board representation for each position
- Show move analysis (best move, equity, alternatives)
- Display match metadata for positions sourced from match imports

## Non-Goals

- Editing or deleting positions through the UI
- Manually importing positions through this interface
- Position comparison or diff views
- Exporting positions to external formats
- Search by player name or tournament (can filter, not search)
- Interactive board manipulation
- Mobile-optimized layout (desktop-first, can scroll horizontally)

## Technical Approach

### Architecture

This is a **UI-only feature** that leverages existing infrastructure:
- **Database**: No changes - PositionLibrary model has all required fields
- **API**: Minor enhancement to include relations in existing endpoint
- **Components**: New PositionLibraryBrowser component

### Key Files to Create/Modify

**New Files:**
- `components/position-library/PositionLibraryBrowser.tsx` - Main browser component
- `components/position-library/PositionCard.tsx` - Individual position display
- `components/position-library/PositionDetailModal.tsx` - Full position details

**Modified Files:**
- `app/api/position-library/route.ts` - Add `include: { archive, match }` to queries
- `components/ground-truth/GroundTruthEngineManager.tsx` - Add click handler to open browser

### Integration Points

1. **Entry Point**: Click on position counts in GroundTruthEngineManager
2. **Data Source**: Existing `/api/position-library` endpoint
3. **Rendering**: Existing `lib/positionLibrary/asciiRenderer.ts`

## Implementation Details

### 1. API Enhancement

Update `/api/position-library/route.ts` to include relations:

```typescript
const positions = await prisma.positionLibrary.findMany({
  where: {
    engineId,
    ...(gamePhase && { gamePhase }),
  },
  include: {
    archive: {
      select: { filename: true, sourceCollection: true }
    },
    match: {
      select: {
        player1Name: true,
        player1Country: true,
        player2Name: true,
        player2Country: true,
        tournamentName: true,
        matchLength: true,
      }
    }
  },
  orderBy: [
    { gamePhase: 'asc' },
    { diceRoll: 'asc' }
  ],
  take: limit,
  skip: offset,
})
```

### 2. Position Library Browser Component

```typescript
interface PositionLibraryBrowserProps {
  engineId: string
  initialPhase?: GamePhase
  onClose: () => void
}
```

**Features:**
- Phase filter tabs (OPENING, EARLY, MIDDLE, BEAROFF) with counts
- Paginated position list (20 per page)
- Click position to open detail modal

### 3. Position Card Component

Compact display showing:
- Dice roll (e.g., "3-1")
- Best move with equity (e.g., "8/5 6/5 (+0.23)")
- Source badge (OPENING_CATALOG, MATCH_IMPORT, CURATED)
- Game phase badge

### 4. Position Detail Modal

Full display including:
- ASCII board (monospace, pre-formatted)
- Dice roll and player to move
- Best move with equity
- Alternative moves (2nd, 3rd) with equities if available
- Match metadata (if MATCH_IMPORT source):
  - Player names and countries
  - Tournament name
  - Match length
  - Game number and move number

### 5. ASCII Board Rendering

Use existing `renderOpeningBoard()` or `renderAsciiBoard()`:

```tsx
<pre className="font-mono text-xs bg-slate-900 text-green-400 p-4 rounded overflow-x-auto">
  {position.asciiBoard}
</pre>
```

## User Experience

### Entry Point

In GroundTruthEngineManager, the position counts display becomes clickable:

```
Position Library: 460 positions
├── OPENING: 21  [click to browse]
├── EARLY: 93
├── MIDDLE: 272
└── BEAROFF: 74
```

Clicking any phase opens the browser filtered to that phase.

### Browser Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Position Library Browser                              [X]  │
├─────────────────────────────────────────────────────────────┤
│ [OPENING (21)] [EARLY (93)] [MIDDLE (272)] [BEAROFF (74)]  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│ │ 3-1             │ │ 4-2             │ │ 5-3             ││
│ │ 8/5 6/5 (+0.23) │ │ 8/4 6/4 (+0.18) │ │ 13/8 24/21...   ││
│ │ [OPENING]       │ │ [OPENING]       │ │ [MATCH_IMPORT]  ││
│ └─────────────────┘ └─────────────────┘ └─────────────────┘│
│                                                             │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│ │ ...             │ │ ...             │ │ ...             ││
│ └─────────────────┘ └─────────────────┘ └─────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                    < 1 2 3 4 5 ... 23 >                    │
└─────────────────────────────────────────────────────────────┘
```

### Detail Modal

```
┌─────────────────────────────────────────────────────────────┐
│ Position Details                                      [X]  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐│
│ │ +13-14-15-16-17-18-+BAR+19-20-21-22-23-24-+            ││
│ │ | O           O    |   | O              X |            ││
│ │ | O           O    |   | O              X |            ││
│ │ |             O    |   |                  |            ││
│ │ |                  |   |                  |            ││
│ │ |                  |   |                  |            ││
│ │ |                  |   |                  |            ││
│ │ |                  |   |                  |            ││
│ │ |             X    |   |                  |            ││
│ │ | X           X    |   | X              O |            ││
│ │ | X           X    |   | X              O |            ││
│ │ +12-11-10--9--8--7-+---+-6--5--4--3--2--1-+            ││
│ │        Dice: 3-1    White (X) to move                  ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Best Move: 8/5 6/5                          Equity: +0.234 │
│ 2nd Best:  24/21 6/5                        Equity: +0.198 │
│ 3rd Best:  8/5 8/7                          Equity: +0.156 │
│                                                             │
│ ───────────────────────────────────────────────────────────│
│ Source: MATCH_IMPORT                                        │
│ Match: Suzuki Mochy (JPN) vs Falafel Nick (USA)            │
│ Tournament: World Championship 2023                         │
│ Position: Game 5, Move 12                                   │
└─────────────────────────────────────────────────────────────┘
```

## Testing Approach

### Essential Tests

1. **API returns positions with relations**
   - Verify positions include match/archive data when available
   - Verify pagination works correctly

2. **Browser renders and filters**
   - Phase tabs filter correctly
   - Position cards display key info
   - Clicking card opens detail modal

3. **Detail modal displays all data**
   - ASCII board renders correctly (monospace, preserved whitespace)
   - Move analysis shows best + alternatives
   - Match metadata shows when available, hidden when not

### Manual Verification

- ASCII board is readable and properly aligned
- Country codes display correctly (JPN, USA, etc.)
- Large position counts (460+) paginate smoothly

## Open Questions

1. **Modal vs. Slide-out Panel**: Should detail view be a modal or a slide-out panel? Modal is simpler; panel allows browsing while viewing.
   - **Default**: Start with modal for simplicity

2. **Source filtering**: Should users be able to filter by source type (OPENING_CATALOG vs MATCH_IMPORT)?
   - **Default**: Not in initial implementation; add to Future Improvements

---

## Future Improvements and Enhancements

**The following are OUT OF SCOPE for initial implementation:**

### Enhanced Filtering & Search
- Full-text search by player name or tournament
- Filter by source type (OPENING_CATALOG, MATCH_IMPORT, CURATED)
- Filter by equity range
- Sort options (by equity, by dice roll, by date imported)

### Interactive Features
- Copy position ID to clipboard
- Share position link
- Export position to GNUBG format
- Print-friendly view

### Visual Enhancements
- Graphical board rendering (SVG instead of ASCII)
- Side-by-side position comparison
- Position history timeline view
- Mobile-responsive design

### Analytics & Insights
- Position usage statistics (how often used in drills)
- Equity distribution charts by phase
- Player statistics across imported matches

### Batch Operations
- Select multiple positions for drill generation
- Bulk delete/archive positions
- Export selected positions

## References

- PositionLibrary schema: `prisma/schema.prisma:716-763`
- Existing API: `app/api/position-library/route.ts`
- ASCII renderer: `lib/positionLibrary/asciiRenderer.ts`
- UI patterns: `components/ground-truth/GroundTruthEngineManager.tsx`
- Type definitions: `lib/positionLibrary/types.ts`
