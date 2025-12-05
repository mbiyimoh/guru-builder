# Research Progress Auto-Refresh

## Status
Draft

## Authors
Claude Code - 2025-11-16

## Overview

Add automatic polling to the research progress page that checks every 5 seconds if a running research job has completed, then updates the UI to show completion status and provides a button to view results.

## Problem Statement

Currently, when a user initiates a research run, they see a "Research in progress..." message but must manually refresh the page (F5) to see when the research completes. This creates a poor user experience where users either:
- Constantly refresh the page to check status
- Miss when research completes and wait longer than necessary
- Navigate away and forget to come back

Users naturally expect the page to update automatically when the background job finishes.

## Goals

- Poll the research run status every 5 seconds while status is RUNNING
- Update the UI when status changes from RUNNING to COMPLETED/FAILED/CANCELLED
- Display a "View Results" button when research completes successfully
- Stop polling when research is no longer RUNNING

## Non-Goals

- Real-time WebSocket updates (polling is sufficient for this use case)
- Optimistic UI updates before server confirms
- Configurable polling intervals
- Push notifications when research completes
- Polling for PENDING status (only RUNNING)
- Progress percentage/bar (we don't have this data)
- Auto-navigation to results (user should choose when to view)
- Polling multiple research runs simultaneously
- Caching or background sync

## Technical Approach

### High-Level Implementation

Create a Client Component that wraps the "Research in Progress" section and polls the existing API endpoint.

### Key Files to Change

1. **New file:** `app/projects/[id]/research/[runId]/ResearchStatusPoller.tsx`
   - Client Component with polling logic
   - Uses `useEffect` with `setInterval` for 5-second polling
   - Fetches `/api/research-runs/[id]` to check status

2. **Modify:** `app/projects/[id]/research/[runId]/page.tsx`
   - Import and use `ResearchStatusPoller` for RUNNING status
   - Pass initial run data as props

### External Libraries/Frameworks

None - uses standard React hooks (`useState`, `useEffect`) and native `fetch`

### Integration Points

- **API:** Uses existing `GET /api/research-runs/[id]` endpoint (no changes needed)
- **Database:** Reads ResearchRun.status field (no schema changes)
- **Router:** Uses `next/link` for navigation button

## Implementation Details

### 1. ResearchStatusPoller Component

```typescript
// app/projects/[id]/research/[runId]/ResearchStatusPoller.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ResearchStatusPollerProps {
  runId: string;
  projectId: string;
  initialStatus: string;
}

export default function ResearchStatusPoller({
  runId,
  projectId,
  initialStatus,
}: ResearchStatusPollerProps) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Only poll if status is RUNNING
    if (status !== 'RUNNING') return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/research-runs/${runId}`);
        if (!response.ok) throw new Error('Failed to fetch status');

        const data = await response.json();
        const newStatus = data.run.status;

        if (newStatus !== 'RUNNING') {
          setStatus(newStatus);
          clearInterval(pollInterval);
          // Refresh server component data
          router.refresh();
        }
      } catch (err) {
        setError('Failed to check research status');
        clearInterval(pollInterval);
      }
    }, 5000); // 5 second interval

    return () => clearInterval(pollInterval);
  }, [runId, status, router]);

  // Show running state with spinner
  if (status === 'RUNNING') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex items-center">
          <svg className="animate-spin h-5 w-5 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div>
            <p className="text-blue-900 font-medium">Research in progress...</p>
            <p className="text-blue-700 text-sm">
              This may take several minutes. Page will update automatically when complete.
            </p>
          </div>
        </div>
        {error && (
          <p className="text-red-600 text-sm mt-2">{error}</p>
        )}
      </div>
    );
  }

  // Show completion state with button
  if (status === 'COMPLETED') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-900 font-medium">Research completed!</p>
            <p className="text-green-700 text-sm">
              Review the findings and recommendations below.
            </p>
          </div>
          <Link
            href={`/projects/${projectId}/research/${runId}#recommendations`}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            View Results
          </Link>
        </div>
      </div>
    );
  }

  // Show failure state
  if (status === 'FAILED') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
        <p className="text-red-900 font-medium">Research failed</p>
        <p className="text-red-700 text-sm">
          Check the error details below for more information.
        </p>
      </div>
    );
  }

  // CANCELLED or other status
  return null;
}
```

### 2. Page Integration

```typescript
// In app/projects/[id]/research/[runId]/page.tsx
// Replace the inline RUNNING status display with:

import ResearchStatusPoller from './ResearchStatusPoller';

// ... existing code ...

// Replace lines 187-205 (the RUNNING status block) with:
{(run.status === 'RUNNING' || run.status === 'COMPLETED' || run.status === 'FAILED') && (
  <ResearchStatusPoller
    runId={run.id}
    projectId={run.project.id}
    initialStatus={run.status}
  />
)}
```

### API Changes

None required - the existing `/api/research-runs/[id]` endpoint returns all needed data.

### Data Model Changes

None required - uses existing ResearchRun.status field.

## User Experience

### Status Transitions

1. **RUNNING → COMPLETED**
   - Message changes from "Research in progress..." to "Research completed!"
   - "View Results" button appears
   - Page data refreshes via `router.refresh()` to load recommendations

2. **RUNNING → FAILED**
   - Message changes to "Research failed"
   - Error details are visible in the error section below

3. **User clicks "View Results"**
   - Scrolls to recommendations section (anchor link)

### Visual Feedback

- Spinner continues while polling
- Text indicates auto-update: "Page will update automatically when complete"
- Green success state with prominent "View Results" button
- Red failure state with instruction to check errors

## Testing Approach

### Manual Testing Scenarios

1. **Happy path: Research completes successfully**
   - Start a research run
   - Navigate to research progress page
   - Verify "Research in progress..." displays with spinner
   - Wait for research to complete (or manually update DB status)
   - Verify UI updates to show "Research completed!" without page refresh
   - Verify "View Results" button appears
   - Click button, verify scrolls to recommendations

2. **Research fails**
   - Start a research run that will fail (e.g., invalid configuration)
   - Verify UI updates to "Research failed" state

3. **Polling stops when complete**
   - Open browser DevTools Network tab
   - Verify polling requests stop after status changes from RUNNING

4. **Error handling**
   - Temporarily disable API or network
   - Verify error message appears
   - Verify polling stops

### E2E Test (Optional but recommended)

```typescript
// tests/research-progress-polling.spec.ts
test('research progress page auto-updates when complete', async ({ page }) => {
  // Setup: Create project and start research run
  // Navigate to research progress page
  // Verify "Research in progress" message
  // Wait for status to change (may need to mock or wait)
  // Verify completion message appears
  // Verify "View Results" button is visible
});
```

## Open Questions

1. Should polling continue if the tab is not visible (to save resources)?
   - Initial implementation: Yes, keep polling (simpler)
   - Future improvement: Use `document.visibilityState` to pause when tab hidden

2. Should "View Results" button auto-scroll or just link?
   - Decision: Use anchor link (`#recommendations`) - natural browser behavior

---

## Future Improvements and Enhancements

**⚠️ Everything below is OUT OF SCOPE for initial implementation**

### Performance Optimizations
- Pause polling when browser tab is not visible using `document.visibilityState`
- Increase polling interval after 5 minutes (backoff strategy)
- Use Server-Sent Events (SSE) instead of polling for real-time updates

### Enhanced User Experience
- Show progress bar or estimated time remaining
- Play notification sound when complete
- Browser notification when tab is not focused
- Auto-navigate to results after brief delay
- Show polling indicator (e.g., "Checking status...")

### Additional Features
- Poll for PENDING status too (waiting in queue)
- Show queue position if multiple jobs
- Allow user to cancel running research from this page
- WebSocket for true real-time updates
- Optimistic UI: Pre-render expected completion state

### Robustness
- Exponential backoff on consecutive fetch failures
- Retry failed requests before giving up
- Handle network disconnection gracefully
- Show "last checked at" timestamp

### Testing Enhancements
- Mock research completion in E2E tests
- Test polling with various network conditions
- Stress test with long-running research

---

## References

- Research progress page: `app/projects/[id]/research/[runId]/page.tsx`
- Research run API: `app/api/research-runs/[id]/route.ts`
- Prisma schema: `prisma/schema.prisma` (ResearchRun model, lines 75-102)
- React useEffect docs: https://react.dev/reference/react/useEffect
- Next.js App Router client components: https://nextjs.org/docs/app/building-your-application/rendering/client-components
