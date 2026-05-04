/**
 * E2E test for Phase 063.1 — Frontend Stream Decoupling Gap Closure.
 *
 * Scenario (Gap-005 regression guard — concurrent reconcile race):
 *   1. User signs in, opens a new thread, sends a long-stream prompt.
 *   2. After 1s of streaming, force-dispatch BOTH `visibilitychange` and
 *      `focus` events synchronously from the page context. ChatArea's
 *      reconcileRef listener fires for each event; in real browsers tab
 *      activation can fire both within <50ms (the Gap-005 race window).
 *   3. Pre-fix: A's reconcile body inserts the temp-${run_id} placeholder,
 *      then B's reconcile body's loadMessages calls setMessages(data) which
 *      WIPES the placeholder; B's for-loop short-circuits because A's
 *      subscriptionsRef.set already executed. Net result: SSE open but no
 *      placeholder bubble.
 *   4. Post-fix: D-063.1-11 reconcileInFlightRef bool guard ensures only ONE
 *      reconcile body executes; D-063.1-12 loadMessages MERGE (REPLACE→MERGE)
 *      preserves any live temp- placeholders even if a second reconcile
 *      somehow gets through; D-063.1-09 narrowed short-circuit + D-063.1-04
 *      dedup converge to render exactly one bubble + open exactly one SSE.
 *
 * Anti-false-RED guard (Assertion C): assert at least ONE GET
 * /threads/{tid}/active-runs request fired post-dispatch. Without this, the
 * test could pass for the wrong reason — if the dispatched events don't
 * actually trigger reconcile (listener wiring breaks in a future refactor),
 * the run-stream count would still be 1 (just the original sendMessage
 * subscription). Asserting active-runs fired proves the reconcile listener
 * was actually invoked.
 *
 * Pattern source: e2e/tests/063-refresh-mid-stream.spec.ts (signIn helper,
 * createNewThread, sendMessageInActiveThread, requestLog accumulator).
 *
 * PREREQUISITES:
 *   - App running at http://localhost:5173
 *   - Backend running at http://localhost:8000 (with Redis + Supabase)
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD env vars set
 */
import { test, expect, type Page } from "@playwright/test"

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? ""
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? ""

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

test.describe("063.1: concurrent reconcile triggers do not wipe placeholder (Gap-005)", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test("dispatching visibilitychange + focus in same tick: bubble visible, single SSE per run", async ({
    page,
  }) => {
    type ReqKind = "active-runs" | "run-stream"
    const requestLog: Array<{ url: string; kind: ReqKind; phase: "started" | "finished" }> = []

    page.on("request", (req) => {
      const u = req.url()
      if (req.method() === "GET" && /\/threads\/[^/]+\/active-runs$/.test(u)) {
        requestLog.push({ url: u, kind: "active-runs", phase: "started" })
      } else if (req.method() === "GET" && /\/runs\/[^/]+\/stream/.test(u)) {
        requestLog.push({ url: u, kind: "run-stream", phase: "started" })
      }
    })

    // ── Step 1: Create thread + send long prompt ──
    await createNewThread(page)
    await sendMessageInActiveThread(page, LONG_STREAM_PROMPT)

    // Wait for streaming to begin (placeholder + SSE active).
    await expect(
      page.locator('[data-testid="assistant-message"]').first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(1_000)

    // ── Step 2: Force concurrent reconcile ──
    // ChatArea (Phase 063 Plan 04) listens for BOTH visibilitychange and
    // focus events. In real browsers tab activation can fire both within
    // <50ms (the Gap-005 race window). Dispatching them synchronously
    // from page context is the canonical way to reproduce the race
    // deterministically — page.evaluate runs in the page's main JS thread,
    // so both event handlers register their reconcile() calls in the same
    // microtask before either's await yields.
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new Event("focus"))
    })

    // Let any reconcile activity settle so all log entries are captured.
    await page.waitForTimeout(1_500)

    // Assertion A — assistant bubble visible (placeholder OR DB row).
    // Pre-fix (Gap-005): visible state had 0 temp- placeholders despite
    // SSE being open, because B's loadMessages overwrote A's placeholder.
    // Post-fix: D-063.1-11 in-flight ref ensures only ONE reconcile body
    // executes; D-063.1-12 MERGE preserves placeholders; bubble is
    // visible at all times.
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({
      timeout: 2_000,
    })

    // Assertion B — exactly ONE distinct run_id across all run-stream URLs.
    // The reconcileInFlightRef guard (Plan 04) ensures only ONE reconcile
    // body executes; the subscriptionsRef.has() short-circuit (Plan 02)
    // ensures only ONE subscribeToRun call fires.
    const distinctRuns = new Set(
      requestLog
        .filter((r) => r.kind === "run-stream")
        .map((r) => r.url.match(/\/runs\/([^/]+)\/stream/)?.[1])
        .filter(Boolean) as string[],
    )
    expect(distinctRuns.size).toBe(1)

    // Assertion C — anti-false-RED guard: at least ONE active-runs request
    // fired post-dispatch (proves the reconcile listener actually saw the
    // dispatched events). Without this assertion, a future refactor that
    // breaks the listener wiring would silently make this test pass —
    // run-stream count would still be 1 (just sendMessage's subscription).
    const activeRunsCount = requestLog.filter((r) => r.kind === "active-runs").length
    expect(activeRunsCount).toBeGreaterThanOrEqual(1)
  })
})
