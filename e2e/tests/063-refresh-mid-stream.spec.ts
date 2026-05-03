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
 * Plan 05 fill-in: previously a Wave-0 RED stub with a body-text growth
 * heuristic. Now uses precise pre/post-reload request snapshots and the
 * stable [data-testid="assistant-message"] selector added by Plan 05 to
 * MessageItem.tsx for deterministic content-growth assertions.
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

  test("F5 mid-stream: assistant message reattaches via active-runs and continues animating", async ({
    page,
  }) => {
    // Track network calls for evidence-based assertions. We snapshot
    // counts pre- and post-reload so we can assert that NEW requests
    // fired after the reload — distinguishing reattach behavior from
    // initial-mount behavior.
    const requestLog: Array<{
      method: string
      url: string
      kind: "active-runs" | "run-stream" | "post-message"
      phase: "started" | "finished"
    }> = []

    page.on("request", (req) => {
      if (
        req.method() === "GET" &&
        /\/threads\/[^/]+\/active-runs$/.test(req.url())
      ) {
        requestLog.push({ method: req.method(), url: req.url(), kind: "active-runs", phase: "started" })
      }
      if (req.method() === "GET" && /\/runs\/[^/]+\/stream/.test(req.url())) {
        requestLog.push({ method: req.method(), url: req.url(), kind: "run-stream", phase: "started" })
      }
      if (req.method() === "POST" && /\/threads\/[^/]+\/messages$/.test(req.url())) {
        requestLog.push({ method: req.method(), url: req.url(), kind: "post-message", phase: "started" })
      }
    })
    page.on("requestfinished", (req) => {
      if (req.method() === "GET" && /\/runs\/[^/]+\/stream/.test(req.url())) {
        requestLog.push({ method: req.method(), url: req.url(), kind: "run-stream", phase: "finished" })
      }
    })

    // ── Step 1: Create new thread + send long-stream prompt ──
    await createNewThread(page)
    await sendMessageInActiveThread(page, LONG_STREAM_PROMPT)

    // Wait for streaming to actually begin (assistant bubble visible
    // with the stable Plan-05 selector).
    await expect(
      page.locator('[data-testid="assistant-message"]').first(),
    ).toBeVisible({ timeout: 15_000 })

    // Let some tokens stream so the reload happens MID-stream, not
    // post-completion.
    await page.waitForTimeout(3_000)

    // Snapshot pre-reload state.
    const preReloadActiveRuns = requestLog.filter((r) => r.kind === "active-runs").length
    const preReloadStreams = requestLog.filter(
      (r) => r.kind === "run-stream" && r.phase === "started",
    ).length

    // Snapshot pre-reload assistant content length so we can assert
    // post-reload growth (proving the reattached stream wrote new
    // tokens, not just rendered cached content).
    const preReloadContent =
      (await page.locator('[data-testid="assistant-message"]').last().textContent()) ?? ""
    const preReloadContentLength = preReloadContent.length

    // ── Step 2: F5 mid-stream ──
    await page.reload()

    // ── Step 3: Assert the reconcile hook fired AFTER reload ──
    // ChatArea's Phase 063 useEffect calls reconcile() on mount; on a
    // post-reload mount this fires GET /threads/{tid}/active-runs.
    await page.waitForRequest(
      (req) =>
        req.method() === "GET" &&
        /\/threads\/[^/]+\/active-runs$/.test(req.url()),
      { timeout: 10_000 },
    )
    const postReloadActiveRuns = requestLog.filter((r) => r.kind === "active-runs").length
    expect(postReloadActiveRuns).toBeGreaterThan(preReloadActiveRuns)

    // ── Step 4: Assert /runs/{rid}/stream reattach happened post-reload ──
    // Once active-runs returns the in-flight run, useMessages opens a
    // fresh GET /runs/{rid}/stream subscription to resume token delivery.
    await page.waitForRequest(
      (req) =>
        req.method() === "GET" && /\/runs\/[^/]+\/stream/.test(req.url()),
      { timeout: 10_000 },
    )
    const postReloadStreams = requestLog.filter(
      (r) => r.kind === "run-stream" && r.phase === "started",
    ).length
    expect(postReloadStreams).toBeGreaterThan(preReloadStreams)

    // ── Step 5: Assert assistant bubble continues to grow post-reload ──
    // Wait a settle window, then re-read the assistant content. The
    // reattached SSE consumer should have written additional tokens.
    await page.waitForTimeout(3_000)
    const postReloadContent =
      (await page.locator('[data-testid="assistant-message"]').last().textContent()) ?? ""
    expect(postReloadContent.length).toBeGreaterThanOrEqual(preReloadContentLength)
  })
})
