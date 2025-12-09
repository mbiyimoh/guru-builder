# Artifact Viewer Prompt Integration

## Status
**Approved**

## Authors
- Claude Code Assistant
- Date: 2025-12-09

## Overview

Add prompt viewing and editing capabilities to artifact viewer pages, allowing users to see which prompts generated each artifact version and edit prompts directly from the viewer.

## Problem Statement

Currently, prompt customization exists only on the dashboard (GuruTeachingManager). When users view artifacts on their dedicated viewer pages (`/projects/[id]/artifacts/teaching/[type]`), they cannot:
- See which prompts were used to generate the displayed artifact
- Know if the artifact was generated with custom or default prompts
- Tell if the project's current prompts differ from those used for the artifact
- Edit prompts or regenerate without navigating back to the dashboard

This creates a fragmented workflow where users must switch between views to understand and modify their content generation settings.

## Goals

1. **Show prompt source** - Display whether the artifact was generated with custom or default prompts
2. **Enable prompt viewing** - Allow users to view the prompts that generated the current artifact
3. **Enable prompt editing** - Allow users to edit prompts directly from the artifact viewer
4. **Show prompt drift** - Indicate when project's current prompts differ from the artifact's prompts
5. **Support regeneration** - Allow "Save & Regenerate" workflow from the viewer

## Non-Goals

- Prompt version history viewer (shows all past prompt changes)
- Side-by-side prompt comparison UI
- Prompt diff visualization
- Exporting prompts
- Bulk prompt operations across multiple artifacts
- Prompt templates library
- Prompt analytics or usage statistics

## Technical Approach

### Overview

1. Extend artifact data fetching to include prompt hash fields
2. Add a prompt indicator/button to ArtifactHeader
3. Reuse existing PromptEditorModal component
4. Add logic to detect "prompt drift" (current vs artifact prompts)

### Key Files to Modify

| File | Change |
|------|--------|
| `lib/teaching/artifactClient.ts` | Add prompt hash fields to queries and interfaces |
| `lib/teaching/artifactPageData.ts` | Fetch prompt config data alongside artifact |
| `components/artifacts/ArtifactHeader.tsx` | Add prompt indicator and edit button |
| `components/artifacts/ArtifactViewerWithVersions.tsx` | Add modal state management and PromptEditorModal integration |
| `app/projects/[id]/artifacts/teaching/mental-model/page.tsx` | Pass prompt info to viewer |
| `app/projects/[id]/artifacts/teaching/curriculum/page.tsx` | Pass prompt info to viewer |
| `app/projects/[id]/artifacts/teaching/drill-series/page.tsx` | Pass prompt info to viewer |

### Reusable Components (No Changes Needed)

- `components/guru/PromptEditorModal.tsx` - Full modal with tabs, validation, save/regenerate
- `lib/guruFunctions/prompts/defaults.ts` - `getDefaultPrompts()` function
- `lib/guruFunctions/promptHasher.ts` - `hashPrompt()` function
- All prompt API routes already exist

## Implementation Details

### 1. Extend ArtifactDetail Interface

In `lib/teaching/artifactClient.ts`:

```typescript
export interface ArtifactDetail extends ArtifactSummary {
  content: unknown;
  markdownContent: string | null;
  // Add these fields:
  systemPromptHash: string | null;
  userPromptHash: string | null;
  promptConfigId: string | null;
}
```

Update `getArtifactContent()` query to select these fields.

### 2. Add Prompt Indicator to ArtifactHeader

Add a visual indicator and button to `ArtifactHeader.tsx`:

```typescript
interface ArtifactHeaderProps {
  // ... existing props
  promptInfo?: {
    isCustom: boolean;           // Was artifact generated with custom prompts?
    hasPromptDrift: boolean;     // Do current project prompts differ?
  };
  onEditPrompts?: () => void;
}
```

UI Elements:
- Badge: "Custom Prompts" or "Default Prompts"
- Warning badge (if drift): "Prompts Changed"
- Button: "View/Edit Prompts" (opens modal)

### 3. Detect Prompt Drift

Create a helper to compare current prompts with artifact's prompt hashes:

```typescript
// In lib/teaching/promptUtils.ts (new file, minimal)
export function detectPromptDrift(
  artifact: { systemPromptHash: string | null; userPromptHash: string | null },
  currentPrompts: { systemPrompt: string; userPromptTemplate: string }
): boolean {
  const currentSystemHash = hashPrompt(currentPrompts.systemPrompt);
  const currentUserHash = hashPrompt(currentPrompts.userPromptTemplate);

  return (
    artifact.systemPromptHash !== currentSystemHash ||
    artifact.userPromptHash !== currentUserHash
  );
}
```

### 4. Page Data Integration

Extend `fetchArtifactPageData()` in `lib/teaching/artifactPageData.ts` to also fetch prompt config:

```typescript
// In lib/teaching/artifactPageData.ts
import { getPromptConfigForType } from './promptUtils';

export interface ArtifactPageData {
  artifact: ArtifactDetail;
  previousArtifact: ArtifactDetail | null;
  allVersions: ArtifactSummary[];
  showDiff: boolean;
  // Add these:
  promptInfo: {
    isCustom: boolean;
    hasPromptDrift: boolean;
    currentConfig: PromptConfig; // For modal
  };
}

// Inside fetchArtifactPageData():
const promptConfig = await getPromptConfigForType(projectId, type);
const promptInfo = {
  isCustom: promptConfig.systemPrompt.isCustom || promptConfig.userPrompt.isCustom,
  hasPromptDrift: detectPromptDrift(artifact, {
    systemPrompt: promptConfig.systemPrompt.current,
    userPromptTemplate: promptConfig.userPrompt.current
  }),
  currentConfig: promptConfig,
};
```

The page components pass `promptInfo` to `ArtifactViewerWithVersions`.

### 5. Modal Integration

When user clicks "View/Edit Prompts", open PromptEditorModal:

```typescript
<PromptEditorModal
  projectId={projectId}
  artifactType={artifactType}
  systemPrompt={currentConfig.systemPrompt}
  userPrompt={currentConfig.userPrompt}
  onClose={() => setModalOpen(false)}
  onSave={handleSave}
  onSaveAndRegenerate={handleSaveAndRegenerate}
/>
```

The modal is fully implemented and handles:
- Tab switching (System/User prompts)
- Required variable validation
- Save vs Save & Regenerate workflows
- Reset to defaults

## Testing Approach

### Key Scenarios to Test

1. **Custom prompt indicator displays correctly**
   - Generate artifact with default prompts → shows "Default Prompts"
   - Edit prompts, regenerate → shows "Custom Prompts"

2. **Prompt drift detection works**
   - Generate artifact → no drift warning
   - Edit prompts (don't regenerate) → shows "Prompts Changed" warning
   - Regenerate → drift warning clears

3. **Edit workflow functions**
   - Click "View/Edit Prompts" → modal opens with correct data
   - Edit prompts, click Save → modal closes, indicator updates
   - Edit prompts, click "Save & Regenerate" → generation starts

4. **Navigation and state**
   - Refresh page → indicators persist correctly
   - Switch between artifact versions → indicators update per version

### Test Execution

Run via Playwright against a test project with existing artifacts.

## User Experience

### Visual Design

The prompt indicator area in ArtifactHeader:

```
┌─────────────────────────────────────────────────────────────┐
│ Mental Model v2                    [Custom] ⚠️ Prompts Changed │
│ Generated Dec 9, 2025              [View/Edit Prompts]        │
└─────────────────────────────────────────────────────────────┘
```

- "Custom" badge: Blue/purple styling (matches dashboard)
- "Prompts Changed" warning: Yellow/amber with info icon
- "View/Edit Prompts" button: Secondary styling, gear/edit icon

### Tooltip Text

- **"Custom" badge**: "This artifact was generated using customized prompts"
- **"Prompts Changed" warning**: "Project prompts have changed since this was generated. Regenerate to use current prompts."

## Open Questions

~~1. **Should the drift warning auto-dismiss?**~~ **RESOLVED**: No, it persists until regeneration
~~2. **Mobile layout**~~ **RESOLVED**: Use responsive design best practices - badges stack vertically on narrow screens

## Future Improvements and Enhancements

**These items are OUT OF SCOPE for initial implementation.**

### Prompt History & Comparison
- Add prompt version history viewer showing all past prompt edits
- Side-by-side diff visualization comparing current vs artifact prompts
- Timeline view of prompt changes with dates and change types

### Enhanced Prompt Management
- Copy/export prompts to reuse across projects
- Prompt templates library with community sharing
- Prompt analytics showing which prompts produce best results
- A/B testing framework for comparing prompt effectiveness

### UI Refinements
- Inline prompt preview without opening modal
- Quick-edit mode for minor prompt tweaks
- Keyboard shortcuts for power users
- Prompt search/filter in history

### Performance & Technical
- Cache prompt comparisons to reduce hash computations
- Prefetch prompt data for smoother modal opening
- Batch prompt operations across multiple artifact types

## References

- Existing implementation: `components/guru/PromptEditorModal.tsx`
- Prompt API routes: `app/api/projects/[id]/guru/prompts/`
- Artifact viewer: `components/artifacts/ArtifactHeader.tsx`
- Per-Project Prompt Customization spec: `specs/feat-per-project-prompt-customization.md`
