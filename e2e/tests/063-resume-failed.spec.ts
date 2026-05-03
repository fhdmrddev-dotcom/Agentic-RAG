/**
 * E2E test for Phase 063 — Frontend Stream Decoupling.
 *
 * Scenario (D-063-04 / SC#7 — Resume button on failed runs):
 *   1. User signs in and opens a thread that has a failed run on its
 *      most recent assistant message.
 *   2. The Resume button (RotateCcw icon, "Resume" text) MUST surface
 *      ONLY on assistant messages whose corresponding `runs.status` is
 *      'failed'. Per D-063-04, no auto-retry — explicit user click only.
 *   3. The button must NOT appear on completed runs, cancelled runs, or
 *      currently-streaming runs.
 *
 * RED reason at this commit (Wave 0):
 *   - The Resume button is not yet rendered anywhere in the UI; Plan 04
 *     adds it to MessageItem.tsx adjacent to the existing MessageFeedback
 *     slot (063-PATTERNS.md "Pattern to apply — Resume button").
 *   - The current spec asserts a Resume button is visible by name ≥ 1
 *     time across the page — on master that count is 0 → RED.
 *
 * Plan 04 work needed before this test can be GREEN:
 *   - Backend: extend the message API/types to surface runStatus on
 *     assistant messages (already in scope per 063-PATTERNS.md
 *     "frontend/src/types/index.ts — extend Message" section).
 *   - Frontend: render Resume button conditional on
 *     `message.runStatus === 'failed'`.
 *   - Test: inject a failed-run fixture (mocked or real via Phase 062
 *     redis_down test pattern) so the button has a target message.
 *
 * Pattern source: e2e/tests/060-thread-race.spec.ts (signIn helper +
 * Playwright getByRole locator pattern).
 *
 * PREREQUISITES:
 *   - App running at http://localhost:5173
 *   - Backend running at http://localhost:8000
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD env vars set
 *   - TODO (Plan 04): inject a failed-run fixture in a `test.beforeEach`
 *     block so the test has a known target message. For Wave 0, the
 *     test asserts the button is ABSENT (RED — count 0 against count >=
 *     1 expectation).
 */
import { test, expect, type Page } from "@playwright/test"

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? ""
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? ""

async function signIn(page: Page) {
  await page.goto("/")
  const emailInput = page.getByRole("textbox", { name: /email/i })
  if ((await emailInput.count()) === 0) return // already signed in
  await emailInput.fill(TEST_EMAIL)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)
  await page.getByRole("button", { name: /sign in/i }).click()
  await expect(page.getByText(/new chat/i)).toBeVisible({ timeout: 15_000 })
}

test.describe("Phase 063 — Resume button on failed runs (SC#7)", () => {
  test.beforeEach(async ({ page }) => {
    // Credentials are required (see PREREQUISITES). Without them, signIn
    // hard-fails — which is the correct RED behavior for unconfigured
    // environments (Phase 064 browser harness owns the configured runs).
    await signIn(page)
  })

  test("Resume button visible only on failed runs", async ({ page }) => {
    // TODO: inject failed run via fixture in Plan 04. The fixture should:
    //   - Create a thread for the test user.
    //   - Insert a runs row with status='failed' and an error message.
    //   - Insert the corresponding assistant message stub.
    //   - Open that thread in the UI before assertions.
    //
    // For Wave 0, we navigate to whatever default chat surface exists post
    // sign-in and assert the Resume affordance is currently NOT in the DOM.
    // This RED-fails on master because the button has not yet been added by
    // Plan 04 — count >= 1 fails when the actual count is 0.

    // Navigate to (or stay on) the chat surface.
    await page.goto("/")
    await expect(page.getByText(/new chat/i)).toBeVisible({ timeout: 10_000 })

    // Pattern: Plan 04 adds a shadcn Button with text "Resume" rendered next
    // to MessageFeedback when message.runStatus === 'failed'. We assert via
    // accessible role + name regex (case-insensitive) so any minor copy
    // change doesn't break the test.
    const resumeButton = page.getByRole("button", { name: /resume/i })

    // RED-form (Wave 0): the Resume button is not yet rendered anywhere on
    // master. Plan 04 adds it; with the failed-run fixture, the count goes
    // from 0 → 1 and this expectation flips green.
    //
    // We use toHaveCount(1) (not toHaveCount(0)) deliberately so the test
    // RED-fails post-fixture as well if the button is missing — the goal of
    // SC#7 is that the button IS present on failed runs. The Wave 0 RED
    // surface is identical: actual count 0 != expected 1.
    await expect(resumeButton).toHaveCount(1, { timeout: 5_000 })
  })
})
