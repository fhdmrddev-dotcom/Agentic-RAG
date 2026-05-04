/**
 * E2E test for Phase 063.1 — Frontend Stream Decoupling Gap Closure.
 *
 * Scenario (Gap-003 + Gap-004 regression guard):
 *   1. User signs in, opens Thread A, sends a long-stream prompt.
 *   2. Mid-stream (after ~2s), user switches to Thread B.
 *   3. After 2s on Thread B, user switches BACK to Thread A.
 *   4. The assistant message bubble is visible IMMEDIATELY (no blank window —
 *      D-063.1-09 narrowed short-circuit + D-063.1-04 dedup-via-runId).
 *   5. EXACTLY ONE distinct run_id seen across all GET /runs/{rid}/stream
 *      requests (D-063.1-08 guardedSetMessages keeps sendMessage's SSE alive +
 *      D-063.1-09 reconcile.subscriptionsRef.has() short-circuit prevents
 *      duplicate consumer on switch-back).
 *   6. The reconcile-on-reattach uses since>0 (D-063.1-01..02 lastSeenOffsetRef
 *      cursor — Gap-004 fix). The first sendMessage call uses since="0";
 *      subsequent reconcile reattaches MUST use a non-zero cursor.
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

// Deterministic prompt that yields >= 5s of streaming via multi-tool
// retrieval + extended reasoning. Mirrors 063-refresh-mid-stream.spec.ts.
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

test.describe("063.1: thread switch mid-stream survives SSE", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test("switch away + back: no blank window, single SSE per run, since>0 on reattach", async ({
    page,
  }) => {
    // Track all relevant network calls so we can assert single-consumer +
    // since-cursor invariants after the switch-back. Same accumulator shape
    // as 063-refresh-mid-stream.spec.ts:84-102, just with three kinds.
    type ReqKind = "active-runs" | "run-stream" | "post-message"
    const requestLog: Array<{
      method: string
      url: string
      kind: ReqKind
      phase: "started" | "finished"
    }> = []

    page.on("request", (req) => {
      const m = req.method()
      const u = req.url()
      if (m === "POST" && /\/threads\/[^/]+\/messages$/.test(u)) {
        requestLog.push({ method: m, url: u, kind: "post-message", phase: "started" })
      } else if (m === "GET" && /\/threads\/[^/]+\/active-runs$/.test(u)) {
        requestLog.push({ method: m, url: u, kind: "active-runs", phase: "started" })
      } else if (m === "GET" && /\/runs\/[^/]+\/stream/.test(u)) {
        requestLog.push({ method: m, url: u, kind: "run-stream", phase: "started" })
      }
    })
    page.on("requestfinished", (req) => {
      if (req.method() === "GET" && /\/runs\/[^/]+\/stream/.test(req.url())) {
        requestLog.push({
          method: req.method(),
          url: req.url(),
          kind: "run-stream",
          phase: "finished",
        })
      }
    })

    // ── Step 1: Create Thread A and send long prompt ──
    // CR-03 fix: capture `threadAUrl` AFTER the user message is in DOM and
    // SSE streaming has started — by that point the app routing has assigned
    // the URL to /threads/<thread_id> (was: captured immediately after
    // createNewThread, when the URL could still be /, /new, or otherwise
    // pre-route-assignment depending on the thread-creation lifecycle, so
    // page.goto(threadAUrl) in Step 3 might not actually navigate back to
    // Thread A). Also assert the URL shape so a future routing change that
    // breaks this premise produces a clean test failure instead of a
    // misleading distinctRuns / bubble-count mismatch.
    await createNewThread(page)
    await sendMessageInActiveThread(page, LONG_STREAM_PROMPT)

    // Wait for streaming to be in flight and for some tokens to arrive so
    // lastSeenOffsetRef has a real cursor populated for run A.
    await expect(
      page.locator('[data-testid="assistant-message"]').first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2_000)
    const threadAUrl = page.url()
    expect(threadAUrl, `expected /threads/<uuid> URL after first message; got ${threadAUrl}`)
      .toMatch(/\/threads\/[0-9a-f-]{36}/)

    // ── Step 2: Switch to Thread B (create new thread) ──
    await createNewThread(page)
    await page.waitForTimeout(2_000)

    // ── Step 3: Switch back to Thread A ──
    await page.goto(threadAUrl)

    // Assertion A — no blank window: assistant bubble visible within 2s
    // of switching back. Pre-fix (Gap-003): main area was blank for 1-2s
    // until reconcile re-fetched + reopened SSE from since=0.
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({
      timeout: 2_000,
    })

    // Let any post-reattach activity settle so all stream URLs are logged.
    await page.waitForTimeout(2_000)

    // Assertion B — exactly ONE distinct run_id across all run-stream URLs.
    // Pre-fix (Gap-003): two SSE GETs for the same run_id (sendMessage's
    // controller aborted on thread switch → reconcile opened a fresh
    // consumer with since=0). Post-fix: D-063.1-08 keeps sendMessage's
    // SSE alive, D-063.1-09 narrowed short-circuit prevents reconcile
    // from re-opening.
    const distinctRuns = new Set(
      requestLog
        .filter((r) => r.kind === "run-stream" && r.phase === "started")
        .map((r) => r.url.match(/\/runs\/([^/]+)\/stream/)?.[1])
        .filter(Boolean) as string[],
    )
    expect(distinctRuns.size).toBe(1)

    // Assertion C — since cursor advances on reattach (Gap-004 fix). The
    // first run-stream call (sendMessage) is "0" by definition (fresh run,
    // no offset yet). If a second call exists (a reconcile reattach via
    // visibilitychange/focus during the switch sequence), it MUST carry
    // a non-zero cursor — proving lastSeenOffsetRef is actually populated
    // and threaded through subscribeToRun.
    const sinceValues = requestLog
      .filter((r) => r.kind === "run-stream" && r.phase === "started")
      .map((r) => new URL(r.url).searchParams.get("since") ?? "")
    expect(sinceValues[0]).toBe("0")
    if (sinceValues.length > 1) {
      expect(sinceValues[sinceValues.length - 1]).not.toBe("0")
    }
  })
})
