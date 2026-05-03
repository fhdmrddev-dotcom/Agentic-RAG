/**
 * E2E test for Phase 063 — Frontend Stream Decoupling.
 *
 * Scenario (D-063-01 / SC#1 — refresh-mid-stream reattach via active-runs):
 *   1. User signs in, opens a new thread, sends a long-stream prompt.
 *   2. Mid-stream (after ~3s), user presses F5 (page.reload()).
 *   3. After reload, ChatArea mounts → useMessages.reconcile() →
 *      GET /threads/{tid}/active-runs → for each active run,
 *      GET /runs/{rid}/stream?since=0 reattaches to the live producer.
 *   4. The assistant message bubble continues filling with token deltas
 *      from the reattached stream — proving the run survived the F5
 *      and the new D-063-01 architecture (POST returns JSON; streaming
 *      lives on /runs/{rid}/stream) works.
 *
 * RED reason at this commit (Wave 0):
 *   - The frontend still calls the legacy POST-streams contract — POST
 *     /threads/{tid}/messages returns SSE on the same response, not JSON.
 *   - There is no /runs/{rid}/stream subscription wired up post-reload.
 *   - active-runs polling is not yet hooked into ChatArea reconcile.
 *   The waitForRequest for /threads/{tid}/active-runs will TIME OUT, the
 *   test fails — RED for the right reason (Plan 03/04 wires this path).
 *
 * Pattern source: e2e/tests/060-thread-race.spec.ts (signIn helper,
 * LONG_STREAM_PROMPT, sendMessageInActiveThread, request listener).
 *
 * PREREQUISITES:
 *   - App running at http://localhost:5173
 *   - Backend running at http://localhost:8000
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD env vars set
 */
import { test, expect, type Page } from "@playwright/test"

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? ""
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? ""

// Deterministic prompt that yields >= 5s of streaming via multi-tool
// retrieval + extended reasoning. Mirrors 060-thread-race.spec.ts:25-26.
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

test.describe("Phase 063 — Refresh mid-stream reattach (SC#1)", () => {
  test.beforeEach(async ({ page }) => {
    // Credentials are required (see PREREQUISITES). Without them, signIn
    // hard-fails — which is the correct RED behavior for unconfigured
    // environments (Phase 064 browser harness owns the configured runs).
    await signIn(page)
  })

  test("F5 mid-stream: assistant message reattaches via active-runs", async ({
    page,
  }) => {
    // ── Capture stream activity (proves the new architecture is wired) ──
    // We watch both:
    //   GET /threads/{tid}/active-runs — fired by the reconcile hook on mount
    //   GET /runs/{rid}/stream         — fired for each active run reattach
    // Pattern source: 060-thread-race.spec.ts:65-84
    const streamActivity: Array<{
      url: string
      method: string
      kind: "active-runs" | "run-stream"
      status: "started" | "finished"
    }> = []

    page.on("request", (req) => {
      if (
        req.method() === "GET" &&
        /\/threads\/[^/]+\/active-runs$/.test(req.url())
      ) {
        streamActivity.push({
          url: req.url(),
          method: req.method(),
          kind: "active-runs",
          status: "started",
        })
      }
      if (req.method() === "GET" && /\/runs\/[^/]+\/stream/.test(req.url())) {
        streamActivity.push({
          url: req.url(),
          method: req.method(),
          kind: "run-stream",
          status: "started",
        })
      }
    })
    page.on("requestfinished", (req) => {
      if (
        req.method() === "GET" &&
        /\/threads\/[^/]+\/active-runs$/.test(req.url())
      ) {
        streamActivity.push({
          url: req.url(),
          method: req.method(),
          kind: "active-runs",
          status: "finished",
        })
      }
      if (req.method() === "GET" && /\/runs\/[^/]+\/stream/.test(req.url())) {
        streamActivity.push({
          url: req.url(),
          method: req.method(),
          kind: "run-stream",
          status: "finished",
        })
      }
    })

    // ── Step 1: Create new thread + send long-stream prompt ──
    await createNewThread(page)
    await sendMessageInActiveThread(page, LONG_STREAM_PROMPT)

    // Wait for streaming to actually begin (assistant bubble visible).
    await expect(
      page.locator('[data-role="assistant"], .bg-muted').first(),
    ).toBeVisible({ timeout: 15_000 })

    // Snapshot pre-reload assistant content length so we can assert
    // post-reload growth (proving the reattached stream wrote new tokens).
    await page.waitForTimeout(3_000) // let some tokens stream
    const preReloadBodyText = await page.locator("body").innerText()

    // ── Step 2: F5 mid-stream ──
    await page.reload()

    // ── Step 3: Assert the reconcile hook fired ──
    // After reload, ChatArea should mount → useMessages.reconcile() →
    // GET /threads/{tid}/active-runs. If the new architecture is wired,
    // this request fires within 10s. Plan 03/04 wires this; on master it
    // never fires (RED for the right reason — not a flaky test).
    const activeRunsReq = await page.waitForRequest(
      (req) =>
        req.method() === "GET" &&
        /\/threads\/[^/]+\/active-runs$/.test(req.url()),
      { timeout: 10_000 },
    )
    expect(activeRunsReq.url()).toMatch(/\/active-runs$/)

    // ── Step 4: Assert /runs/{rid}/stream reattach happened ──
    // Once active-runs returns the in-flight run, useMessages should open
    // a fresh GET /runs/{rid}/stream subscription to resume token delivery.
    expect(
      streamActivity.some(
        (a) => a.kind === "run-stream" && /\/runs\/[^/]+\/stream/.test(a.url),
      ),
    ).toBe(true)

    // ── Step 5: Assert assistant bubble grew post-reload ──
    // Read body text again after a short settle window; expect it to be
    // longer than the pre-reload snapshot (the reattached stream is still
    // appending deltas).
    await page.waitForTimeout(3_000)
    const postReloadBodyText = await page.locator("body").innerText()
    expect(postReloadBodyText.length).toBeGreaterThan(preReloadBodyText.length)
  })
})
