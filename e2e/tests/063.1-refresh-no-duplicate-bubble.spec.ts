/**
 * E2E test for Phase 063.1 — Frontend Stream Decoupling Gap Closure.
 *
 * Scenario (Gap-001 regression guard):
 *   1. User signs in, opens a new thread, sends a long-stream prompt.
 *   2. Mid-stream (after ~3s), user presses F5 (page.reload()).
 *   3. Post-reload, ChatArea mounts → reconcile() fires → SSE reattaches.
 *   4. Throughout the post-reload SSE replay window, EXACTLY ONE assistant
 *      bubble is visible at every polled timestamp.
 *
 * Pre-fix behavior (Gap-001): during the replay window the assistant content
 * was rendered in TWO bubbles simultaneously — once as `temp-${run_id}`
 * (filled by reconcile's SSE deltas from offset 0) and once as the persisted
 * DB row (loaded by `loadMessages`). Auto-resolved on terminal event, but
 * was visible flicker for 1-3s.
 *
 * Post-fix behavior: D-063.1-04 dedup-via-runId routes SSE deltas to the
 * persisted DB row (carrying runId from the messages/runs JOIN — D-063.1-13)
 * instead of inserting a parallel temp- placeholder. Single bubble at all times.
 *
 * Pattern source: e2e/tests/063-refresh-mid-stream.spec.ts (verbatim harness +
 * F5 mid-stream + post-reload waitForRequest pattern).
 *
 * PREREQUISITES:
 *   - App running at http://localhost:5173
 *   - Backend running at http://localhost:8000 (with Redis + Supabase)
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD env vars set
 */
import { test, expect, type Page } from "@playwright/test"

// WR-04 fix: fail loudly at module load if creds are missing. Empty-string
// defaults caused confusing downstream failures (sign-in form errors) and
// — worse — a pre-existing test session in the browser context would let
// the test run all the way through with the wrong user via signIn's
// "already signed in" early-return.
const TEST_EMAIL = process.env.TEST_USER_EMAIL
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD
if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error(
    "TEST_USER_EMAIL and TEST_USER_PASSWORD must be set to run 063.1 e2e tests",
  )
}

const LONG_STREAM_PROMPT =
  "List 10 documents from the knowledge base, then for each one give a 30-word summary based on its content."

async function signIn(page: Page) {
  await page.goto("/")
  const emailInput = page.getByRole("textbox", { name: /email/i })
  if ((await emailInput.count()) === 0) return // already signed in
  await emailInput.fill(TEST_EMAIL)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)
  await page.getByRole("button", { name: /sign in/i }).click()
  await expect(page.getByText(/new chat/i)).toBeVisible({ timeout: 15_000 })
}

async function createNewThread(page: Page): Promise<void> {
  await page.getByRole("button", { name: /new chat/i }).click()
  await expect(page.locator("textarea").first()).toBeVisible({ timeout: 10_000 })
}

async function sendMessageInActiveThread(page: Page, text: string): Promise<void> {
  const messageInput = page.getByRole("textbox", { name: /message|type/i }).or(
    page.locator("textarea"),
  )
  await messageInput.first().fill(text)
  await page.keyboard.press("Enter")
  await expect(page.getByText(text)).toBeVisible({ timeout: 5_000 })
}

test.describe("063.1: refresh-mid-stream renders single bubble (Gap-001 regression)", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test("F5 mid-stream: bubble count === 1 at all polled timestamps during replay", async ({
    page,
  }) => {
    // ── Step 1: Create thread + send long prompt ──
    await createNewThread(page)
    await sendMessageInActiveThread(page, LONG_STREAM_PROMPT)

    // Wait for streaming to begin and some tokens to be persisted in the DB.
    await expect(
      page.locator('[data-testid="assistant-message"]').first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3_000)

    // ── Step 2: F5 mid-stream ──
    await page.reload()

    // Wait for the SSE reattach to start (reconcile-on-mount post-reload).
    await page.waitForRequest(
      (req) => req.method() === "GET" && /\/runs\/[^/]+\/stream/.test(req.url()),
      { timeout: 10_000 },
    )

    // ── Step 3: Poll bubble count for ~5s — must be EXACTLY 1 at every check ──
    // Pre-fix (Gap-001): count briefly === 2 (temp-${run_id} from
    // reconcile + DB row from loadMessages). Post-fix (D-063.1-04 dedup):
    // SSE deltas update the persisted DB row in-place, so only ONE
    // assistant-message element exists in the DOM throughout replay.
    const samples: number[] = []
    for (let i = 0; i < 10; i++) {
      const count = await page.locator('[data-testid="assistant-message"]').count()
      samples.push(count)
      await page.waitForTimeout(500)
    }
    const maxBubbles = Math.max(...samples)
    expect(
      maxBubbles,
      `bubble count exceeded 1 during replay: ${samples.join(",")}`,
    ).toBe(1)
  })
})
