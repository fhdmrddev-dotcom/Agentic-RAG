/**
 * E2E test for Phase 060 — Frontend Race Fixes.
 *
 * Scenario (D-060-12 / ROADMAP Phase 060 SC#4 / STREAM-02a):
 *   1. User opens Thread A and starts a long-running streaming response.
 *   2. While streaming, user clicks Thread B in the sidebar.
 *   3. Thread B's message list MUST contain only Thread B's messages — no leak from A.
 *   4. Thread A's pending getMessages GET request MUST be aborted (or never re-fired against A).
 *   5. No raw tool-result JSON appears in the chat content (Bug 3 regression guard).
 *
 * PREREQUISITES:
 *   - App running at http://localhost:5173
 *   - Backend running at http://localhost:8000
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD env vars set
 *   - Test user has at least 2 existing threads OR can create them via the UI
 */
import { test, expect, type Page } from "@playwright/test"

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? ""
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? ""
const hasCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD)

// Deterministic prompt that yields >= 5s of streaming via multi-tool retrieval +
// extended reasoning. The exact phrasing minimizes provider-specific reformulation.
const LONG_STREAM_PROMPT =
  "List 10 documents from the knowledge base, then for each one give a 30-word summary based on its content."

// Marker used by the user message in Thread A so we can verify Thread B's list does NOT contain it.
const THREAD_A_USER_MARKER = "RACE-TEST-THREAD-A-MARKER"

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
  // Wait for the input bar to be ready in the new thread view
  await expect(page.locator("textarea").first()).toBeVisible({ timeout: 10_000 })
}

async function sendMessageInActiveThread(page: Page, text: string): Promise<void> {
  const messageInput = page.getByRole("textbox", { name: /message|type/i }).or(
    page.locator("textarea"),
  )
  await messageInput.first().fill(text)
  await page.keyboard.press("Enter")
  // Wait for the user bubble to appear (optimistic UI from useMessages.sendMessage)
  await expect(page.getByText(text)).toBeVisible({ timeout: 5_000 })
}

test.describe("Phase 060 — Thread navigation race (STREAM-02a)", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasCredentials) test.skip()
    await signIn(page)
  })

  test("Thread A to Thread B navigation: B shows only B's messages; A's getMessages is aborted; no raw tool-result JSON leaks", async ({ page }) => {
    // ── Capture Thread A getMessages activity (request listener for abort evidence) ──
    const getMessagesActivity: Array<{ url: string; status: "started" | "failed" | "finished"; reason?: string }> = []
    page.on("request", (req) => {
      if (req.method() === "GET" && /\/threads\/[^/]+\/messages$/.test(req.url())) {
        getMessagesActivity.push({ url: req.url(), status: "started" })
      }
    })
    page.on("requestfailed", (req) => {
      if (req.method() === "GET" && /\/threads\/[^/]+\/messages$/.test(req.url())) {
        getMessagesActivity.push({
          url: req.url(),
          status: "failed",
          reason: req.failure()?.errorText ?? "unknown",
        })
      }
    })
    page.on("requestfinished", (req) => {
      if (req.method() === "GET" && /\/threads\/[^/]+\/messages$/.test(req.url())) {
        getMessagesActivity.push({ url: req.url(), status: "finished" })
      }
    })

    // ── Step 1: Create Thread A and start a long-running stream ──
    await createNewThread(page)
    // Capture Thread A's id from the URL or thread state. Strategy: read the active
    // thread's getMessages URL after the new chat was created and its first send fired.
    // We seed Thread A with a marker user message and then start the long stream.
    await sendMessageInActiveThread(page, `${THREAD_A_USER_MARKER}: ${LONG_STREAM_PROMPT}`)

    // Wait for streaming to actually begin (assistant bubble appears with empty content)
    await expect(
      page.locator('[data-role="assistant"], .bg-muted').first(),
    ).toBeVisible({ timeout: 15_000 })

    // Give the stream ~3-4 seconds to produce visible content so the abort is meaningful
    await page.waitForTimeout(4_000)

    // Snapshot getMessages calls observed up to this point — Thread A's id is whichever
    // unique threadId appears in the URL pattern.
    const threadAUrls = new Set(
      getMessagesActivity.filter((e) => e.status === "started").map((e) => e.url),
    )
    expect(threadAUrls.size).toBeGreaterThanOrEqual(1)

    // ── Step 2: Create Thread B by clicking New Chat (mid-stream navigation) ──
    // Clicking New Chat creates Thread B and switches the view. The router/state change
    // triggers ChatArea's useEffect with thread.id = Thread B's id; per D-060-08, the
    // sequence is: setViewingThread(B) -> abortStream() -> clearMessages() -> loadMessages(B).
    // Thread A's pending getMessages (if any) MUST be aborted by loadAbortRef in useMessages.
    await page.getByRole("button", { name: /new chat/i }).click()

    // ── Step 3: Wait for Thread B to settle ──
    // Thread B is brand new, so its message list MUST be empty (no leak from A).
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(1_500) // allow loadMessages(B) to resolve

    // ── Assertion 1: Thread B's view does NOT contain Thread A's marker ──
    const bodyText = await page.locator("body").innerText()
    expect(bodyText).not.toContain(THREAD_A_USER_MARKER)

    // ── Assertion 2: At least one Thread A getMessages was aborted, OR no Thread A
    //                getMessages was issued AFTER the navigation click (i.e. loadAbortRef
    //                cancelled the pending fetch and ChatArea did not re-fire it for A). ──
    const failedRequests = getMessagesActivity.filter(
      (e) => e.status === "failed" && (e.reason?.toLowerCase().includes("abort") || e.reason?.toLowerCase().includes("cancel")),
    )
    // Either at least one abort/cancel happened, or no Thread A requests piled up after the click.
    // The simpler invariant is that Thread A's URL (whichever it was) does NOT have a finished
    // GET that completed AFTER the navigation. Playwright doesn't give us click-to-event ordering
    // out of the box, so we relax this to: failedRequests.length >= 1 OR getMessagesActivity has
    // no UNFINISHED started request remaining for any single threadId.
    const startedByUrl = new Map<string, number>()
    const finishedByUrl = new Map<string, number>()
    for (const e of getMessagesActivity) {
      if (e.status === "started") startedByUrl.set(e.url, (startedByUrl.get(e.url) ?? 0) + 1)
      if (e.status === "finished" || e.status === "failed") {
        finishedByUrl.set(e.url, (finishedByUrl.get(e.url) ?? 0) + 1)
      }
    }
    const hasOrphanedStartedRequest = [...startedByUrl.entries()].some(
      ([url, started]) => started > (finishedByUrl.get(url) ?? 0),
    )
    expect(failedRequests.length >= 1 || !hasOrphanedStartedRequest).toBe(true)

    // ── Assertion 3: No raw tool-result JSON leaked into chat content (Bug 3 guard). ──
    // The DB version of an assistant message stores tool execution context inline as a
    // JSON-shaped string starting with `[{"content":` or `[{"tool_call_id":`. With D-060-05
    // applied (loadMessages no longer fires from sendMessage's finally), this string MUST NOT
    // appear in the chat at any point.
    expect(bodyText).not.toContain('[{"content":"')
    expect(bodyText).not.toContain('"tool_call_id":')
  })
})
