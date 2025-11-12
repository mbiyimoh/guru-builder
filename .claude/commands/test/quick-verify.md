---
description: Quick E2E test to verify recently implemented features work as expected
allowed-tools: Read, Write, Bash, Task, Grep, Glob
argument-hint: "<what-to-test>"
category: workflow
---

Run a quick E2E test to verify: $ARGUMENTS

## Task Overview

This command creates and executes a lean Playwright test focused on demonstrating that the implemented feature works outside of edge cases. It's designed for rapid validation during development, not exhaustive testing.

## Step 1: Analyze Context

Review the conversation history to understand:
- What was recently implemented or is currently being worked on
- Key files that were modified
- Expected behavior and user flows
- Any specific concerns or edge cases mentioned

If no recent implementation is obvious, ask the user to clarify what feature they want to test.

## Step 2: Understand Test Requirements

Based on the user's prompt ($ARGUMENTS), determine:
- **What feature/functionality** needs to be tested
- **What URLs/routes** are involved
- **What UI interactions** are necessary (clicks, form fills, etc.)
- **What outcomes** should be verified (text appears, navigation works, data persists)
- **What could realistically go wrong** (not edge cases, but obvious failures)

## Step 3: Check E2E Test Infrastructure

Before creating the test, verify the E2E setup is ready:

**Check 1: Test environment**
```bash
npx tsx scripts/verify-e2e-setup.ts
```

If any checks fail, inform the user and suggest running:
```bash
npm run db:seed:test
```

**Check 2: Test constants**
Read `lib/e2e-utils.ts` to get:
- Mock user ID: `getMockE2EUser().id`
- Mock project ID: `getMockE2EProjectId()`
- These will be used in the test

**Check 3: Existing test patterns**
Use Grep to find similar tests in `tests/*.spec.ts` to understand:
- Common patterns (page navigation, element waiting, assertions)
- Selectors used (data-testid, text content, roles)
- How authentication is handled (should be automatic with E2E_TEST_MODE)

## Step 4: Create Lean Test Plan

Create a focused test plan document: `tests/plans/<feature-name>-quick-test-plan.md`

**Plan Structure**:
```markdown
# Quick Test: <Feature Name>

## What We're Testing
[1-2 sentences describing the feature and what "working" means]

## Test User Journey
1. [Step 1: Navigate to X]
2. [Step 2: Click Y]
3. [Step 3: Verify Z appears]
[Keep it to 3-7 steps - the critical path only]

## Success Criteria
- ✅ [Outcome 1]
- ✅ [Outcome 2]
- ✅ [Outcome 3]

## Known Limitations
This test does NOT cover:
- [Edge case 1]
- [Edge case 2]
- [Complex scenario X]

## Test File
`tests/<feature-name>-quick.spec.ts`
```

## Step 5: Create Playwright Test

Generate a new Playwright test file: `tests/<feature-name>-quick.spec.ts`

**Test Template**:
```typescript
import { test, expect } from '@playwright/test'

// Test constants from E2E infrastructure
const PROJECT_ID = 'cmg30m2ll00001cs8vu82357k'
const BASE_URL = 'http://localhost:3009'

test.describe('<Feature Name> - Quick Verification', () => {
  test('<User Action> works correctly', async ({ page }) => {
    // Step 1: Navigate to starting page
    await page.goto(`${BASE_URL}/path/to/feature`)
    await page.waitForLoadState('networkidle')

    // Step 2: Perform user actions
    // [Fill in based on user journey from plan]

    // Step 3: Verify expected outcome
    // [Add assertions based on success criteria]
  })
})
```

**Key Guidelines**:
- Use `data-testid` attributes when available, fall back to text content or roles
- Wait for `networkidle` after navigation
- Add `await page.waitForTimeout(500)` if elements need time to render
- Use `expect(locator).toBeVisible()` for UI elements
- Use `expect(locator).toContainText()` for text verification
- Keep assertions focused on the happy path

**Example Patterns**:
```typescript
// Wait for element and click
await page.click('button:has-text("Save")')

// Fill form field
await page.fill('input[placeholder="Project name"]', 'Test Project')

// Wait for navigation
await page.waitForURL('**/projects/**')

// Check element visibility
await expect(page.locator('[data-testid="success-message"]')).toBeVisible()

// Check text content
await expect(page.locator('h1')).toContainText('Welcome')

// Check network response
const response = await page.waitForResponse(resp =>
  resp.url().includes('/api/') && resp.status() === 200
)
```

## Step 6: Execute Test with Playwright Expert

Use the Task tool to execute the test with the playwright-expert subagent.

**Important**: You will call the Task tool directly (not shown in the command output). The syntax is:

```
Invoke Task tool with:
- subagent_type: playwright-expert
- description: Execute quick verification test for <feature-name>
- prompt: (Full instructions below)
```

**Prompt to send to playwright-expert**:

```
Execute the Playwright test at tests/<feature-name>-quick.spec.ts

Test Setup:
- Test plan: tests/plans/<feature-name>-quick-test-plan.md
- Test file: tests/<feature-name>-quick.spec.ts
- Run command: npm run test:e2e <feature-name>-quick

Instructions:
1. Verify dev server is running on port 3009 (check with: lsof -ti:3009)
2. Run test with: npx playwright test tests/<feature-name>-quick.spec.ts
3. Capture full output (pass/fail status, errors, screenshots)
4. If test fails, investigate:
   - Check error message and stack trace
   - Review screenshot/video if available (in test-results/)
   - Identify specific step that failed (line number)
   - Check browser console for errors
5. Report results with specific details

Expected Outcome:
Test should pass, demonstrating that <feature-name> works correctly for the happy path.

If test fails, provide:
- Exact error message
- Which step failed (with line number from test file)
- Screenshot/video evidence path if available
- Suggested fix or investigation steps
```

## Step 7: Report Results

After the playwright-expert completes execution, summarize results for the user:

**If Test Passed**:
```
✅ Quick Verification Test: PASSED

Feature: <feature-name>
Test Duration: <duration>
Steps Verified: <count>

All critical functionality working as expected:
- ✅ <Success criterion 1>
- ✅ <Success criterion 2>
- ✅ <Success criterion 3>

Test file: tests/<feature-name>-quick.spec.ts
Test plan: tests/plans/<feature-name>-quick-test-plan.md

Note: This test covers the happy path only. For comprehensive testing, run the full E2E suite.
```

**If Test Failed**:
```
❌ Quick Verification Test: FAILED

Feature: <feature-name>
Failed at: <step-description> (line <number>)
Error: <error-message>

What Failed:
<Detailed description of what went wrong>

Evidence:
- Screenshot: <path-to-screenshot>
- Error log: <relevant-error-details>

Investigation Steps:
1. <Diagnostic step 1>
2. <Diagnostic step 2>
3. <Diagnostic step 3>

Suggested Fix:
<Specific recommendation based on error>

Test file: tests/<feature-name>-quick.spec.ts
Test plan: tests/plans/<feature-name>-quick-test-plan.md
```

## Usage Examples

### Example 1: Test Recently Added Feature
```
User: /test:quick-verify the new file upload component I just added
```

Response:
1. Analyze chat history to find file upload implementation
2. Create lean test plan for file upload happy path
3. Generate Playwright test that uploads a file and verifies success
4. Execute test via playwright-expert
5. Report: "✅ File upload works correctly - file appears in list after upload"

### Example 2: Test Feature After Bug Fix
```
User: /test:quick-verify that the compass chat streaming is working now
```

Response:
1. Review recent bug fix commits
2. Create test plan focused on streaming chat behavior
3. Generate test that sends message and verifies streaming response
4. Execute test
5. Report: "✅ Streaming works - messages appear progressively without blank responses"

### Example 3: Test New Page/Route
```
User: /test:quick-verify the new personas management page
```

Response:
1. Find personas page implementation
2. Create test plan for basic CRUD operations
3. Generate test that navigates to page, creates persona, verifies it appears
4. Execute test
5. Report: "✅ Personas page loads and Create button works correctly"

## Important Notes

**This is NOT comprehensive testing**:
- Focuses on critical path / happy path only
- Skips edge cases, error states, complex scenarios
- Meant for rapid validation during development
- Full E2E test suite should be run before deployment

**When to use this command**:
- After implementing a new feature
- After fixing a bug
- Before committing changes
- To quickly verify something works

**When NOT to use this command**:
- For production-readiness verification (use full test suite)
- For testing complex multi-step workflows (create dedicated E2E plan)
- For testing error handling (create dedicated error state tests)

**Test Files Created**:
- Test plan: `tests/plans/<feature-name>-quick-test-plan.md`
- Test file: `tests/<feature-name>-quick.spec.ts`

Both files can be committed to the repository for future reference.

## Troubleshooting

**If E2E setup verification fails**:
1. Run `npm run db:seed:test` to seed test data
2. Check that dev server is running: `lsof -ti:3009`
3. Verify environment variables are set (E2E_TEST_MODE, etc.)
4. See `tests/README.md` for complete setup instructions

**If test execution fails with authentication errors**:
- E2E_TEST_MODE should be set automatically by playwright.config.ts
- Test user and project should be seeded automatically
- Check `middleware.ts`, `lib/auth.ts`, and `contexts/AuthContext.tsx` for E2E bypasses

**If test times out**:
- Increase timeout in test file: `test.setTimeout(60000)` for 60 seconds
- Check if dev server is actually running and responding
- Verify network requests aren't being blocked

**If test is flaky**:
- Add `await page.waitForTimeout(500)` between actions
- Use `waitForLoadState('networkidle')` after navigation
- Check for race conditions in UI rendering
- Consider using `expect(locator).toBeVisible({ timeout: 10000 })`
