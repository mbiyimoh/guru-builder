# Ideation: Drill Series UX Improvements

**Created:** 2025-12-24
**Status:** Ideation Complete

## Problem Discovery

### User-Reported Issues

1. **No granular progress tracking** - During drill generation, users see phase-based progress (7 phases) but no visibility into individual drill progress (e.g., "5 of 25 drills complete"). Long generation times feel stuck.

2. **Error popup blocks navigation** - When artifact loading fails, a popup error prevents users from navigating back to retry generation. They're stuck on the drill-series page.

3. **Missing pre-generation configuration** - Users expected to configure drill count and game phases before generation, but only see a single "Generate" button. The `DrillConfigurationPanel` exists but isn't integrated into Simple Mode.

### Root Cause Analysis

1. **Progress tracking**: Inngest job updates `progressStage` (phase-based) but doesn't update `subTaskProgress` with drill counts during the GENERATING_CONTENT phase.

2. **Error blocking**: The drill-series page's `fetchArtifactPageData()` can throw during SSR, and the error isn't gracefully handled. Additionally, deprecated `ArtifactDetailPanel` uses `alert()` for some errors.

3. **Missing config**: `DrillConfigurationPanel` was designed for Advanced Mode per the unified-teaching-artifact-page spec, but users expected basic configuration in Simple Mode too.

## Solution Direction

1. **Progress**: Update Inngest job to report drill counts in `subTaskProgress`, display in `FullWidthProgressTracker`
2. **Error handling**: Wrap page data fetch in try/catch, show inline error with navigation options
3. **Config UI**: Add simplified drill config to `SimpleToolbar` when `artifactType === 'drill-series'`

## Key Files

- `components/artifacts/SimpleToolbar.tsx` - Add drill config for drill-series type
- `components/artifacts/UnifiedArtifactPage.tsx` - Pass config to generation, handle errors
- `components/guru/FullWidthProgressTracker.tsx` - Display drill count progress
- `app/projects/[id]/artifacts/teaching/drill-series/page.tsx` - Error handling
- `lib/inngest-functions.ts` - Update drill progress during generation
