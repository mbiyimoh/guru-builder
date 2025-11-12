# Guru Builder E2E Test Suite

## Overview
Comprehensive Playwright end-to-end tests for the Guru Builder application, verifying the complete user workflow from project creation through research execution.

## Test Coverage

### 1. Project Creation Tests (9 tests - ALL PASSING ✅)
**File:** `tests/project-creation.spec.ts`

Tests cover:
- ✅ Homepage navigation and display
- ✅ Navigation from home to projects page
- ✅ Empty projects state display
- ✅ Opening new project modal
- ✅ Form validation for required fields
- ✅ Creating project with name only
- ✅ Creating project with name and description
- ✅ Navigation back to projects list
- ✅ Verifying new project appears in list

**Key Verification:** All "Create Project" functionality is fully working and tested.

### 2. Research Workflow Tests (10 tests - ALL PASSING ✅)
**File:** `tests/research-workflow.spec.ts`

Tests cover:
- ✅ Navigation to new research page from project detail
- ✅ Display of new research form with all elements
- ✅ Validation of required instructions field
- ✅ Creating research runs with QUICK depth
- ✅ Creating research runs with MODERATE depth
- ✅ Creating research runs with DEEP depth
- ✅ Display of research run in project detail page
- ✅ Canceling research creation
- ✅ Navigation to research run from project detail
- ✅ Display of research depth options and descriptions

### 3. Recommendations Flow Tests (5 tests passing, 2 skipped)
**File:** `tests/recommendations.spec.ts`

Tests cover:
- ✅ Display of research run page after creation
- ✅ Show pending/running/completed status
- ✅ Navigation back to project from research run page
- ✅ Display of research run URL structure
- ✅ Maintaining research run state on page reload
- ⏭️ **SKIPPED:** Display recommendations after research completes (requires live Inngest)
- ⏭️ **SKIPPED:** Approving recommendations (requires completed research)

## Test Results Summary

```
Total Tests: 26
Passed: 24 (92.3%)
Skipped: 2 (7.7%)
Failed: 0
Duration: ~9 seconds
```

## Page Object Models

All tests use the Page Object Model pattern for maintainability:

- **HomePage** (`tests/pages/HomePage.ts`) - Landing page interactions
- **ProjectsListPage** (`tests/pages/ProjectsListPage.ts`) - Project listing and creation
- **ProjectDetailPage** (`tests/pages/ProjectDetailPage.ts`) - Individual project view
- **NewResearchPage** (`tests/pages/NewResearchPage.ts`) - Research creation form
- **ResearchRunPage** (`tests/pages/ResearchRunPage.ts`) - Research run detail view

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run specific test suite
```bash
npm run test:e2e tests/project-creation.spec.ts
npm run test:e2e tests/research-workflow.spec.ts
npm run test:e2e tests/recommendations.spec.ts
```

### Run tests in UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Debug specific test
```bash
npm run test:e2e:debug
```

### View HTML report
```bash
npm run test:e2e:report
```

## Test Cleanup

### Automatic Cleanup
Tests are configured to **automatically clean up** all test projects after test runs complete. This is handled by the `global-teardown.ts` script configured in `playwright.config.ts`.

When tests finish, you'll see:
```
🧹 Starting test cleanup...
🗑️  Found X test projects to clean up...
✅ Cleaned up X test projects successfully!
```

### Manual Cleanup
If you need to manually clean up test projects (e.g., after a test failure or interrupted run):

```bash
npm run test:cleanup
```

This will remove all projects with "Test" or "test" in their names, along with all related data:
- Context layers
- Knowledge files
- Research runs
- Recommendations
- Snapshots
- Apply changes logs

### Cleanup Protocol

**IMPORTANT:** Tests should always clean up after themselves unless there's a specific, compelling reason to persist test data for deeper investigation.

The cleanup happens automatically in these cases:
- ✅ After all Playwright tests complete successfully
- ✅ After a test suite is interrupted (global teardown still runs)
- ✅ When manually running the cleanup script

**When to keep test data:**
- 🔍 Investigating a specific test failure that requires database inspection
- 🔍 Debugging data relationships or cascade behavior
- 🔍 Manual testing in the UI with specific test scenarios

In these cases, you can skip cleanup by commenting out the `globalTeardown` in `playwright.config.ts`.

## Prerequisites

Before running tests:

1. **Database must be initialized:**
   ```bash
   npx prisma db push
   ```

2. **Next.js dev server must be running on port 3002:**
   ```bash
   npm run dev
   ```

3. **Playwright browsers must be installed:**
   ```bash
   npx playwright install chromium
   ```

## Test Configuration

Configuration file: `playwright.config.ts`

Key settings:
- **Base URL:** http://localhost:3002
- **Browser:** Chromium only (for faster execution)
- **Reporters:** HTML report + list output
- **Screenshots:** Captured on failure
- **Traces:** Captured on first retry

## Skipped Tests

Two tests are intentionally skipped because they require:
1. Inngest dev server running (`npx inngest-cli@latest dev`)
2. Several minutes of execution time for actual research completion
3. Live GPT Researcher integration (not just POC mode)

These tests can be enabled by:
1. Starting the Inngest dev server
2. Removing the `.skip` prefix from the test declarations
3. Increasing test timeout appropriately

## Known Issues & Resolutions

### Issue 1: Database Tables Not Found
**Error:** `The table 'public.Project' does not exist`
**Resolution:** Run `npx prisma db push` before tests

### Issue 2: Multiple Button Selectors
**Error:** Strict mode violation with "New Project" button
**Resolution:** Use `.first()` selector as there may be buttons in both header and empty state

### Issue 3: Research Status in POC Mode
**Issue:** Research completes immediately with COMPLETED status (not PENDING/RUNNING)
**Resolution:** Tests now accept PENDING, RUNNING, or COMPLETED status

## Test Patterns Used

1. **Semantic Selectors:** Tests use `getByRole`, `getByLabel`, `getByText` over CSS selectors
2. **Proper Waits:** All async operations use `waitForURL` or expect with timeout
3. **Data Isolation:** Each test creates unique timestamped data
4. **Idempotent Tests:** Tests can run multiple times without conflicts
5. **Descriptive Names:** Test names clearly describe what is being verified

## CI/CD Integration

Tests are ready for CI/CD integration with:
- Automatic retries on failure (in CI mode)
- Single worker execution on CI
- HTML and list reporters
- Screenshot and trace capture on failure

## Future Enhancements

1. Add visual regression tests for UI components
2. Add API response validation tests
3. Add performance/load testing
4. Add accessibility (a11y) testing
5. Add mobile viewport testing
6. Integrate with CI/CD pipeline (GitHub Actions, etc.)
7. Add test coverage for context layers and knowledge files
8. Add test coverage for snapshots and rollback functionality

## Success Metrics

✅ **PRIMARY GOAL ACHIEVED:** Create Project functionality is fully verified and working
✅ All core user flows are tested end-to-end
✅ Tests run fast (~9 seconds total)
✅ Zero flaky tests
✅ High maintainability with Page Object Model
✅ Clear documentation and reports
