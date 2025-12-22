# Simplified Frontend Wrapper - E2E Testing Plan

**Status:** In Progress
**Created:** 2025-12-19
**Related:** `specs/simplified-frontend-wrapper/02-specification.md`

---

## Overview

This document defines a tiered E2E testing strategy for the Simplified Frontend Wrapper (wizard flow). Tests are organized by priority and dependency, allowing incremental validation with checkpoints between tiers.

**Testing Philosophy:**
- The wizard is a **UI layer** over existing, tested backend functionality
- Primary risk is **navigation breaks** and **component rendering issues**
- AI-dependent features should be conditional or skipped
- Follow existing test patterns (Page Object Model, "Test" naming for cleanup)

---

## Prerequisites

### Authentication Context
**RESOLVED:** Authentication IS required. All `/projects/*` routes (including `/projects/new/*`) are protected.

**Solution implemented:** `tests/utils/test-auth.ts` provides `loginAsTestUser()` function.
- Requires `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` environment variables
- Tests must call login before accessing protected routes
- Global setup could be enhanced to pre-authenticate and save storage state

### Database Seeding
- PedagogicalDimensions must be seeded (6 dimensions)
- Run: `npx ts-node prisma/seeds/pedagogical-dimensions.ts` before tests

### Test Naming Convention
All test projects must include "Test" in name for automatic cleanup via `global-teardown.ts`.

---

## Tier 1: Critical Path Smoke Tests

**Goal:** Verify wizard pages are navigable and render without crashing.
**Priority:** HIGH
**Estimated Tests:** 6-8
**Dependencies:** None (no AI required)

### Test Cases

| ID | Test Name | Description | Status |
|----|-----------|-------------|--------|
| T1.1 | `wizard-navigation-renders` | WizardNavigation component shows 4 phases | ⬜ Pending |
| T1.2 | `profile-page-renders` | Profile page loads, shows 3 mode tabs (Chat/Voice/Document) | ⬜ Pending |
| T1.3 | `research-page-renders` | Research page loads with projectId, shows chat + plan panels | ⬜ Pending |
| T1.4 | `readiness-page-renders` | Readiness page loads, shows score and dimension cards | ⬜ Pending |
| T1.5 | `artifacts-page-renders` | Artifacts page loads, shows 3 artifact cards + test chat | ⬜ Pending |
| T1.6 | `wizard-phase-navigation` | Can click between phases via WizardNavigation | ⬜ Pending |
| T1.7 | `public-guru-404` | `/g/invalid-id` returns 404 gracefully | ⬜ Pending |

### Page Objects Needed
- `WizardProfilePage.ts`
- `WizardResearchPage.ts`
- `WizardReadinessPage.ts`
- `WizardArtifactsPage.ts`

### Success Criteria
- All Tier 1 tests pass
- No console errors during navigation
- Pages render in < 3 seconds

---

## Tier 2: Core Interaction Tests

**Goal:** Test primary user interactions without requiring AI calls.
**Priority:** MEDIUM
**Estimated Tests:** 10-12
**Dependencies:** Tier 1 passing

### Test Cases

| ID | Test Name | Description | Status |
|----|-----------|-------------|--------|
| T2.1 | `profile-mode-switching` | Switch between Chat/Voice/Document tabs, verify UI updates | ⬜ Pending |
| T2.2 | `profile-voice-browser-warning` | Voice mode shows unsupported browser message (if applicable) | ⬜ Pending |
| T2.3 | `profile-document-upload-ui` | Document mode shows file input, accepts PDF/DOCX/TXT | ⬜ Pending |
| T2.4 | `profile-name-required` | Cannot proceed without project name | ⬜ Pending |
| T2.5 | `research-plan-display` | Research plan panel shows placeholder when no plan | ⬜ Pending |
| T2.6 | `research-suggestions-display` | Gap-based suggestions render if dimensions have gaps | ⬜ Pending |
| T2.7 | `readiness-score-calculation` | Score displays with correct format (0-100%) | ⬜ Pending |
| T2.8 | `readiness-dimension-cards` | All 6 dimension cards render with coverage info | ⬜ Pending |
| T2.9 | `artifacts-generate-buttons` | Generate buttons show correct state (enabled/disabled based on deps) | ⬜ Pending |
| T2.10 | `artifacts-test-chat-limit` | Test chat shows message limit warning after threshold | ⬜ Pending |
| T2.11 | `publish-button-state` | Publish button enabled only when requirements met | ⬜ Pending |
| T2.12 | `dimension-tag-confirm-reject` | Dimension tags can be confirmed/rejected via UI | ⬜ Pending |

### Success Criteria
- All Tier 2 tests pass
- Interactions don't cause state corruption
- Error states handled gracefully

---

## Tier 3: Integration Tests (AI-Dependent)

**Goal:** Test flows that require AI/backend integration.
**Priority:** LOWER (conditional - skip if no API key or slow CI)
**Estimated Tests:** 6-8
**Dependencies:** Tier 1 + Tier 2 passing, OPENAI_API_KEY set

### Test Cases

| ID | Test Name | Description | Status |
|----|-----------|-------------|--------|
| T3.1 | `profile-chat-synthesis` | Chat mode → type brain dump → synthesize → preview shows | ⬜ Pending |
| T3.2 | `profile-document-synthesis` | Upload document → parse → synthesize → preview shows | ⬜ Pending |
| T3.3 | `research-plan-refinement` | Send message → AI responds → plan updates | ⬜ Pending |
| T3.4 | `research-execute-plan` | Execute plan → research run starts → status polling works | ⬜ Pending |
| T3.5 | `guru-test-chat-response` | Send message in test chat → streaming response received | ⬜ Pending |
| T3.6 | `full-wizard-flow` | Profile → Research → Readiness → Artifacts (happy path) | ⬜ Pending |
| T3.7 | `publish-and-view` | Publish guru → navigate to /g/{shortId} → renders correctly | ⬜ Pending |
| T3.8 | `unpublish-guru` | Unpublish → /g/{shortId} returns 404 | ⬜ Pending |

### Conditional Execution
```typescript
test.skip(({ }) => !process.env.OPENAI_API_KEY, 'Requires OPENAI_API_KEY');
```

### Success Criteria
- All Tier 3 tests pass (when API key available)
- AI calls complete within timeout (60s)
- Graceful handling of API failures

---

## Test File Structure

```
tests/
├── wizard-smoke.spec.ts          # Tier 1 tests
├── wizard-interactions.spec.ts   # Tier 2 tests
├── wizard-integration.spec.ts    # Tier 3 tests
├── pages/
│   ├── WizardProfilePage.ts
│   ├── WizardResearchPage.ts
│   ├── WizardReadinessPage.ts
│   └── WizardArtifactsPage.ts
└── utils/
    └── wizard-helpers.ts         # Shared test utilities
```

---

## Execution Workflow

### Phase 1: Tier 1 Execution
1. Create page objects
2. Write Tier 1 tests
3. Run until all pass
4. **CHECKPOINT:** Review Tier 2/3 tests for needed updates

### Phase 2: Tier 2 Execution
1. Update tests based on Tier 1 learnings
2. Write Tier 2 tests
3. Run until all pass
4. **CHECKPOINT:** Review Tier 3 tests for needed updates

### Phase 3: Tier 3 Execution
1. Update tests based on Tier 1+2 learnings
2. Write Tier 3 tests (with conditional skips)
3. Run until all pass
4. **COMPLETE:** Full wizard flow validated

---

## Progress Tracking

### Current Status: Tier 3 In Progress

| Tier | Status | Tests Passing | Notes |
|------|--------|---------------|-------|
| Tier 1 | ✅ Complete | 8/8 | All tests passing with test user credentials |
| Tier 2 | ✅ Complete | 9/9 | Profile interactions, navigation, accessibility |
| Tier 3 | 🟡 In Progress | 3/8 | T3.1, T3.2, T3.3 passing; T3.4-T3.8 not yet implemented |

### Checkpoint Log

| Date | Tier Completed | Issues Found | Updates Made |
|------|----------------|--------------|--------------|
| 2025-12-19 | Tier 1 | `/g/*` routes not public | Added `/g/` to PUBLIC_PREFIXES in middleware.ts |
| 2025-12-19 | Tier 1 | Auth required for wizard routes | Created test-auth.ts utility, tests skip when no credentials |
| 2025-12-19 | Tier 1 | Code review findings | Added T1.1 WizardNavigation test, tightened T1.4/T1.5 assertions, added error handling to global-setup |
| 2025-12-19 | Tier 1+2 | Test user setup | Created test user in Supabase with email confirmation disabled |
| 2025-12-19 | Tier 2 | All 9 tests passing | Profile interactions, document upload UI, navigation, accessibility |
| 2025-12-19 | Tier 3 (partial) | T3.1 needed wait for AI typing indicator | Fixed chat flow to wait for "Thinking..." state, T3.1-T3.3 now passing |

---

## Open Questions

1. ~~**Auth verification needed:** Do existing tests work because of dev-mode bypass? Need to confirm before writing tests.~~
   **RESOLVED:** Auth IS required. Created `test-auth.ts` utility. Tests skip when credentials unavailable.

2. **Voice mode testing:** Web Speech API requires real browser. Consider skipping or using browser-specific test config.

3. ~~**Document upload testing:** Need sample PDF/DOCX/TXT files. Should these live in `tests/fixtures/`?~~
   **RESOLVED:** Created `tests/fixtures/` with sample backgammon TXT files.

4. ~~**Seeding PedagogicalDimensions:** Should this be in global setup or assume pre-seeded?~~
   **RESOLVED:** Added to `tests/global-setup.ts` with proper error handling for parallel runs.

---

## Appendix: Existing Test Patterns Reference

From `tests/core-journeys.spec.ts`:
- Uses Page Object Model (`tests/pages/*.ts`)
- Projects named with timestamp for uniqueness
- Waits for URL patterns with regex
- Uses `expect().toBeVisible()` for assertions

From `tests/guru-profile-onboarding.spec.ts`:
- Uses `test.beforeAll` for setup
- Conditional logic for feature availability
- Skips AI-dependent tests when no API key
