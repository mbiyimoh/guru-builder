# Task Breakdown: Artifact Viewer Prompt Integration

**Generated**: 2025-12-09
**Source**: specs/feat-artifact-viewer-prompt-integration-lean.md

## Overview

Add prompt viewing and editing capabilities to artifact viewer pages, allowing users to see which prompts generated each artifact version, detect prompt drift, and edit prompts directly from the viewer.

## Phase 1: Data Layer

### Task 1.1: Extend ArtifactDetail Interface with Prompt Fields

**Description**: Add prompt hash fields to artifact queries and interfaces
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (foundation task)

**Files to Modify**:
- `lib/teaching/artifactClient.ts`

**Technical Requirements**:
- Add `systemPromptHash`, `userPromptHash`, and `promptConfigId` fields to `ArtifactDetail` interface
- Update `getArtifactContent()` Prisma query to select these fields
- Update `ArtifactSummary` interface if needed for version list display

**Implementation**:

```typescript
// In lib/teaching/artifactClient.ts

// Update ArtifactDetail interface
export interface ArtifactDetail extends ArtifactSummary {
  content: unknown;
  markdownContent: string | null;
  // Add these fields:
  systemPromptHash: string | null;
  userPromptHash: string | null;
  promptConfigId: string | null;
}

// Update getArtifactContent() query - add to select clause:
const artifact = await prisma.guruArtifact.findFirst({
  where: {
    id: artifactId,
    projectId,
  },
  select: {
    // ... existing fields ...
    systemPromptHash: true,
    userPromptHash: true,
    promptConfigId: true,
  },
});

// Update the return object to include new fields:
return {
  artifact: {
    // ... existing fields ...
    systemPromptHash: artifact.systemPromptHash,
    userPromptHash: artifact.userPromptHash,
    promptConfigId: artifact.promptConfigId,
  },
};
```

**Acceptance Criteria**:
- [ ] `ArtifactDetail` interface includes `systemPromptHash`, `userPromptHash`, `promptConfigId`
- [ ] `getArtifactContent()` returns these fields from database
- [ ] TypeScript compiles without errors
- [ ] Existing artifact viewer pages still work

---

### Task 1.2: Create Prompt Utilities Module

**Description**: Create helper functions for prompt config fetching and drift detection
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Files to Create**:
- `lib/teaching/promptUtils.ts`

**Technical Requirements**:
- Create `getPromptConfigForType()` to fetch current prompt config for an artifact type
- Create `detectPromptDrift()` to compare artifact hashes with current prompts
- Reuse existing `hashPrompt()` from `lib/guruFunctions/promptHasher.ts`
- Reuse `getDefaultPrompts()` from `lib/guruFunctions/prompts/defaults.ts`

**Implementation**:

```typescript
// lib/teaching/promptUtils.ts
import { prisma } from '@/lib/db';
import { hashPrompt } from '@/lib/guruFunctions/promptHasher';
import { getDefaultPrompts } from '@/lib/guruFunctions/prompts/defaults';
import type { GuruArtifactType } from '@prisma/client';
import { ArtifactTypeSlug, getDbTypeFromSlug } from './constants';

export interface PromptConfig {
  systemPrompt: {
    current: string;
    default: string;
    isCustom: boolean;
  };
  userPrompt: {
    current: string;
    default: string;
    isCustom: boolean;
  };
}

/**
 * Fetch current prompt configuration for a specific artifact type.
 * Merges custom config (if exists) with defaults.
 */
export async function getPromptConfigForType(
  projectId: string,
  type: ArtifactTypeSlug
): Promise<PromptConfig> {
  const dbType = getDbTypeFromSlug(type);
  const defaults = getDefaultPrompts(dbType);

  // Check for custom config
  const customConfig = await prisma.projectPromptConfig.findUnique({
    where: {
      projectId_artifactType: {
        projectId,
        artifactType: dbType,
      },
    },
  });

  return {
    systemPrompt: {
      current: customConfig?.systemPrompt ?? defaults.systemPrompt,
      default: defaults.systemPrompt,
      isCustom: !!customConfig?.systemPrompt,
    },
    userPrompt: {
      current: customConfig?.userPromptTemplate ?? defaults.userPromptTemplate,
      default: defaults.userPromptTemplate,
      isCustom: !!customConfig?.userPromptTemplate,
    },
  };
}

/**
 * Detect if current project prompts differ from the prompts used to generate an artifact.
 * Returns true if there is "drift" (prompts have changed since artifact was generated).
 */
export function detectPromptDrift(
  artifact: {
    systemPromptHash: string | null;
    userPromptHash: string | null;
  },
  currentPrompts: {
    systemPrompt: string;
    userPromptTemplate: string;
  }
): boolean {
  // If artifact has no hashes (legacy), assume no drift
  if (!artifact.systemPromptHash && !artifact.userPromptHash) {
    return false;
  }

  const currentSystemHash = hashPrompt(currentPrompts.systemPrompt);
  const currentUserHash = hashPrompt(currentPrompts.userPromptTemplate);

  // Check if either hash differs
  const systemDrift = artifact.systemPromptHash !== null &&
                      artifact.systemPromptHash !== currentSystemHash;
  const userDrift = artifact.userPromptHash !== null &&
                    artifact.userPromptHash !== currentUserHash;

  return systemDrift || userDrift;
}

/**
 * Determine if an artifact was generated with custom prompts.
 * Checks if promptConfigId exists or if hashes differ from defaults.
 */
export function wasGeneratedWithCustomPrompts(
  artifact: {
    systemPromptHash: string | null;
    userPromptHash: string | null;
    promptConfigId: string | null;
  },
  type: GuruArtifactType
): boolean {
  // If has promptConfigId, it used custom prompts
  if (artifact.promptConfigId) {
    return true;
  }

  // Fallback: compare hashes to defaults
  if (artifact.systemPromptHash || artifact.userPromptHash) {
    const defaults = getDefaultPrompts(type);
    const defaultSystemHash = hashPrompt(defaults.systemPrompt);
    const defaultUserHash = hashPrompt(defaults.userPromptTemplate);

    return (
      artifact.systemPromptHash !== defaultSystemHash ||
      artifact.userPromptHash !== defaultUserHash
    );
  }

  return false;
}
```

**Acceptance Criteria**:
- [ ] `getPromptConfigForType()` returns merged config with isCustom flags
- [ ] `detectPromptDrift()` correctly identifies when prompts have changed
- [ ] `wasGeneratedWithCustomPrompts()` accurately detects custom prompt usage
- [ ] All functions handle null/undefined artifact hashes gracefully
- [ ] TypeScript compiles without errors

---

### Task 1.3: Extend ArtifactPageData with Prompt Info

**Description**: Add prompt information to page data fetching
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: None

**Files to Modify**:
- `lib/teaching/artifactPageData.ts`

**Technical Requirements**:
- Import prompt utilities from Task 1.2
- Add `promptInfo` to `ArtifactPageData` interface
- Fetch prompt config and compute drift in `fetchArtifactPageData()`

**Implementation**:

```typescript
// lib/teaching/artifactPageData.ts

import {
  getPromptConfigForType,
  detectPromptDrift,
  wasGeneratedWithCustomPrompts,
  type PromptConfig
} from './promptUtils';

export interface PromptInfo {
  isCustom: boolean;           // Was artifact generated with custom prompts?
  hasPromptDrift: boolean;     // Do current project prompts differ?
  currentConfig: PromptConfig; // Full config for modal
}

export interface ArtifactPageData {
  artifact: ArtifactDetail;
  previousArtifact: ArtifactDetail | null;
  allVersions: ArtifactSummary[];
  showDiff: boolean;
  // Add this:
  promptInfo: PromptInfo;
}

// Inside fetchArtifactPageData(), after fetching artifact:

// Fetch prompt configuration
const promptConfig = await getPromptConfigForType(projectId, type);

// Compute prompt info
const promptInfo: PromptInfo = {
  isCustom: wasGeneratedWithCustomPrompts(artifact, artifact.type),
  hasPromptDrift: detectPromptDrift(artifact, {
    systemPrompt: promptConfig.systemPrompt.current,
    userPromptTemplate: promptConfig.userPrompt.current,
  }),
  currentConfig: promptConfig,
};

// Add to return object:
return {
  artifact,
  previousArtifact,
  allVersions: versions,
  showDiff: diff !== undefined,
  promptInfo, // Add this
};
```

**Acceptance Criteria**:
- [ ] `ArtifactPageData` includes `promptInfo` field
- [ ] `fetchArtifactPageData()` computes and returns prompt info
- [ ] Prompt info correctly reflects custom/default and drift status
- [ ] TypeScript compiles without errors

---

## Phase 2: UI Components

### Task 2.1: Add Prompt Indicators to ArtifactHeader

**Description**: Add visual badges and edit button to ArtifactHeader component
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.3
**Can run parallel with**: Task 2.2

**Files to Modify**:
- `components/artifacts/ArtifactHeader.tsx`

**Technical Requirements**:
- Add `promptInfo` prop to component
- Add `onEditPrompts` callback prop
- Display "Custom" or "Default" badge based on `isCustom`
- Display "Prompts Changed" warning badge if `hasPromptDrift`
- Add "View/Edit Prompts" button
- Use responsive design - badges stack on narrow screens
- Add tooltips for clarity

**Implementation**:

```typescript
// components/artifacts/ArtifactHeader.tsx

interface PromptInfo {
  isCustom: boolean;
  hasPromptDrift: boolean;
}

interface ArtifactHeaderProps {
  artifact: ArtifactDetail;
  projectId: string;
  showJson?: boolean;
  onToggleJson?: () => void;
  showDiff?: boolean;
  canShowDiff?: boolean;
  children?: React.ReactNode;
  // Add these:
  promptInfo?: PromptInfo;
  onEditPrompts?: () => void;
}

// Inside the component, add after the existing badges:

{/* Prompt indicator badges */}
{promptInfo && (
  <div className="flex items-center gap-2 flex-wrap">
    {/* Custom/Default badge */}
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        promptInfo.isCustom
          ? 'bg-purple-100 text-purple-800'
          : 'bg-gray-100 text-gray-600'
      }`}
      title={
        promptInfo.isCustom
          ? 'This artifact was generated using customized prompts'
          : 'This artifact was generated using default prompts'
      }
    >
      {promptInfo.isCustom ? 'Custom Prompts' : 'Default Prompts'}
    </span>

    {/* Drift warning badge */}
    {promptInfo.hasPromptDrift && (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
        title="Project prompts have changed since this was generated. Regenerate to use current prompts."
      >
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        Prompts Changed
      </span>
    )}
  </div>
)}

{/* Edit prompts button */}
{onEditPrompts && (
  <button
    onClick={onEditPrompts}
    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    title="View or edit the prompts used to generate this content"
  >
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
    View/Edit Prompts
  </button>
)}
```

**Acceptance Criteria**:
- [ ] "Custom Prompts" badge displays when artifact used custom prompts (purple)
- [ ] "Default Prompts" badge displays when artifact used defaults (gray)
- [ ] "Prompts Changed" warning displays when drift detected (amber with icon)
- [ ] "View/Edit Prompts" button displays when `onEditPrompts` provided
- [ ] All badges have informative tooltips
- [ ] Layout is responsive - badges wrap on narrow screens
- [ ] Button triggers `onEditPrompts` callback when clicked

---

### Task 2.2: Add Modal Integration to ArtifactViewerWithVersions

**Description**: Add state management for PromptEditorModal in the viewer component
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.3
**Can run parallel with**: Task 2.1

**Files to Modify**:
- `components/artifacts/ArtifactViewerWithVersions.tsx`

**Technical Requirements**:
- Import existing `PromptEditorModal` component
- Add state for modal open/close
- Pass `promptInfo` to `ArtifactHeader`
- Handle save and save-and-regenerate callbacks
- Refresh page data after save

**Implementation**:

```typescript
// components/artifacts/ArtifactViewerWithVersions.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PromptEditorModal } from '@/components/guru/PromptEditorModal';
import type { PromptInfo } from '@/lib/teaching/artifactPageData';

interface ArtifactViewerWithVersionsProps {
  artifact: ArtifactDetail;
  previousArtifact: ArtifactDetail | null;
  allVersions: ArtifactSummary[];
  projectId: string;
  showDiff: boolean;
  // Add this:
  promptInfo: PromptInfo;
}

export function ArtifactViewerWithVersions({
  artifact,
  previousArtifact,
  allVersions,
  projectId,
  showDiff,
  promptInfo,
}: ArtifactViewerWithVersionsProps) {
  const router = useRouter();
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  // Map artifact type to the format expected by PromptEditorModal
  const artifactTypeForModal = artifact.type as 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES';

  const handlePromptSave = () => {
    setIsPromptModalOpen(false);
    // Refresh to show updated prompt info
    router.refresh();
  };

  const handlePromptSaveAndRegenerate = () => {
    setIsPromptModalOpen(false);
    // Navigate to project page where regeneration will show
    router.push(`/projects/${projectId}`);
  };

  return (
    <div className="flex flex-col h-full">
      <ArtifactHeader
        artifact={artifact}
        projectId={projectId}
        showDiff={showDiff}
        canShowDiff={artifact.version > 1}
        promptInfo={{
          isCustom: promptInfo.isCustom,
          hasPromptDrift: promptInfo.hasPromptDrift,
        }}
        onEditPrompts={() => setIsPromptModalOpen(true)}
      >
        {/* ViewModeToggle slot */}
      </ArtifactHeader>

      {/* ... rest of component ... */}

      {/* Prompt Editor Modal */}
      {isPromptModalOpen && (
        <PromptEditorModal
          projectId={projectId}
          artifactType={artifactTypeForModal}
          systemPrompt={promptInfo.currentConfig.systemPrompt}
          userPrompt={promptInfo.currentConfig.userPrompt}
          onClose={() => setIsPromptModalOpen(false)}
          onSave={handlePromptSave}
          onSaveAndRegenerate={handlePromptSaveAndRegenerate}
        />
      )}
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Modal opens when "View/Edit Prompts" button clicked
- [ ] Modal receives correct prompt config data
- [ ] Save closes modal and refreshes page
- [ ] Save & Regenerate closes modal and navigates to project page
- [ ] Cancel closes modal without changes
- [ ] Modal displays correct artifact type label

---

## Phase 3: Page Integration

### Task 3.1: Update Artifact Pages to Pass Prompt Info

**Description**: Update all three artifact page components to pass promptInfo to viewer
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2
**Can run parallel with**: None

**Files to Modify**:
- `app/projects/[id]/artifacts/teaching/mental-model/page.tsx`
- `app/projects/[id]/artifacts/teaching/curriculum/page.tsx`
- `app/projects/[id]/artifacts/teaching/drill-series/page.tsx`

**Technical Requirements**:
- All three pages follow same pattern
- Pass `promptInfo` from `fetchArtifactPageData()` result to `ArtifactViewerWithVersions`

**Implementation** (same for all three pages):

```typescript
// Example: app/projects/[id]/artifacts/teaching/mental-model/page.tsx

import { ArtifactViewerWithVersions } from '@/components/artifacts/ArtifactViewerWithVersions';
import NoArtifactPlaceholder from '@/components/artifacts/NoArtifactPlaceholder';
import { fetchArtifactPageData } from '@/lib/teaching/artifactPageData';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string; diff?: string }>;
}

export default async function MentalModelPage({ params, searchParams }: PageProps) {
  const { id: projectId } = await params;
  const resolvedSearchParams = await searchParams;

  const data = await fetchArtifactPageData(projectId, 'mental-model', resolvedSearchParams);

  if (!data) {
    return <NoArtifactPlaceholder type="mental-model" projectId={projectId} />;
  }

  return (
    <ArtifactViewerWithVersions
      artifact={data.artifact}
      previousArtifact={data.previousArtifact}
      allVersions={data.allVersions}
      projectId={projectId}
      showDiff={data.showDiff}
      promptInfo={data.promptInfo}  // Add this line
    />
  );
}
```

**Acceptance Criteria**:
- [ ] Mental Model page passes promptInfo to viewer
- [ ] Curriculum page passes promptInfo to viewer
- [ ] Drill Series page passes promptInfo to viewer
- [ ] All pages compile without TypeScript errors
- [ ] Prompt indicators display correctly on all three artifact types

---

## Phase 4: Testing & Validation

### Task 4.1: Manual Testing Checklist

**Description**: Verify all functionality works end-to-end
**Size**: Small
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: None

**Test Scenarios**:

1. **Default Prompts Indicator**
   - Generate a new artifact (should use default prompts)
   - Navigate to artifact viewer page
   - Verify "Default Prompts" badge is displayed (gray)
   - Verify no drift warning is shown

2. **Custom Prompts Indicator**
   - Edit prompts for an artifact type on dashboard
   - Regenerate the artifact
   - Navigate to artifact viewer page
   - Verify "Custom Prompts" badge is displayed (purple)

3. **Prompt Drift Detection**
   - Have an artifact generated with certain prompts
   - Edit the project's prompts (don't regenerate)
   - Navigate to artifact viewer page
   - Verify "Prompts Changed" warning badge is displayed (amber)
   - Regenerate artifact
   - Verify warning badge disappears

4. **Modal Functionality**
   - Click "View/Edit Prompts" button
   - Verify modal opens with correct data
   - Verify System/User tabs work
   - Edit a prompt, verify Save button enables
   - Click Save, verify modal closes
   - Refresh page, verify changes persisted

5. **Save & Regenerate Flow**
   - Open prompt modal, make changes
   - Click "Save & Regenerate"
   - Verify navigation to project page
   - Verify regeneration starts

6. **Version Navigation**
   - View v1 of an artifact
   - Check prompt indicators
   - Switch to v2
   - Verify indicators update for v2's prompt state

**Acceptance Criteria**:
- [ ] All 6 test scenarios pass
- [ ] No console errors during testing
- [ ] UI is responsive on different screen sizes

---

## Summary

| Phase | Tasks | Size | Parallel Opportunities |
|-------|-------|------|------------------------|
| Phase 1: Data Layer | 3 tasks | Small-Medium | None (sequential) |
| Phase 2: UI Components | 2 tasks | Medium | Task 2.1 & 2.2 can run in parallel |
| Phase 3: Page Integration | 1 task | Small | None |
| Phase 4: Testing | 1 task | Small | None |

**Total Tasks**: 7
**Critical Path**: 1.1 → 1.2 → 1.3 → 2.1/2.2 → 3.1 → 4.1

**Recommended Execution Order**:
1. Task 1.1 (interfaces)
2. Task 1.2 (utilities)
3. Task 1.3 (page data)
4. Tasks 2.1 + 2.2 (parallel - UI components)
5. Task 3.1 (page integration)
6. Task 4.1 (testing)
