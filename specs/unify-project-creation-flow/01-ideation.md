# Ideation: Unify Project Creation Flow

**Created:** 2025-12-24
**Status:** Ideation Complete

## Problem Discovery

### User-Reported Issues

1. **Wrong Entry Point**: "Create New Guru" button opens a modal (`GuruProfileOnboardingModal`) instead of the full-page wizard at `/projects/new/profile` that has domain detection and GT prompt integration.

2. **Wrong Redirect**: After profile creation in `/projects/new/profile`, the page redirects to `/projects/[id]/dashboard` (non-existent route, shows blank page) instead of `/projects/[id]` (the actual dashboard).

3. **Missing GT Indicator**: After enabling Ground Truth engine via the domain tools prompt, there's no indicator on the main dashboard that GT is active. The GT status panel (`AccuracyToolsPanel`) only appears on the teaching artifacts page.

### Root Cause Analysis

The codebase has **two parallel project creation flows** that evolved separately:
- **Modal Flow**: `CreateProjectButton` → `GuruProfileOnboardingModal` → Direct to `/projects/[id]`
- **Full-Page Flow**: `/projects/new/profile` → Domain detection → GT prompt → `/projects/[id]/dashboard` (broken)

The Ground Truth simplified integration (Task 282) added domain detection to the **full-page flow**, but users were using the **modal flow** by default.

## Solution Direction

Simple three-part fix:
1. Change `CreateProjectButton` to navigate to `/projects/new/profile` instead of opening modal
2. Fix the redirect in `/projects/new/profile/page.tsx` from `/dashboard` to just `/projects/[id]`
3. Add a simple GT status indicator to `SimplifiedDashboard`

## Key Files

- `app/projects/CreateProjectButton.tsx` - Change button behavior
- `app/projects/new/profile/page.tsx` - Fix redirect path
- `components/dashboard/SimplifiedDashboard.tsx` - Add GT indicator
- `components/artifacts/AccuracyToolsPanel.tsx` - Reference for GT status display logic
