/**
 * E2E test for Phase 063 — Frontend Stream Decoupling.
 *
 * Scenario (D-063-04 / SC#7 — Resume button on failed runs):
 *   1. User signs in.
 *   2. User sends a real message in a fresh thread to populate the
 *      thread + at least one assistant message.
 *   3. Test fixture POST /__test__/inject-failed-run/{thread_id}
 *      injects a runs row with status='failed' linked to a freshly-
 *      inserted assistant message stub.
 *   4. After page.reload(), useMessages.reconcile() refetches messages;
 *      the failed assistant message now carries runStatus='failed' and
 *      MessageItem renders the Resume button (Plan 04 ships this).
 *   5. Clicking Resume fires resumeFromFailed → sendMessage → postMessage
 *      → POST /threads/{tid}/messages, which the test asserts via
 *      page.waitForRequest.
 *
 * Plan 05 fill-in: Wave-0 form was a count-based assertion that failed
 * because nothing produced a failed run. The fixture endpoint
 * /__test__/inject-failed-run (gated by ENABLE_TEST_FIXTURES=1 in the
 * backend env) deterministically injects the row so the test is stable.
 *
 * PREREQUISITES:
 *   - App running at http://localhost:5173
 *   - Backend running at http://localhost:8000 with ENABLE_TEST_FIXTURES=1
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD env vars set
 */
import { test, expect, type Page } from "@playwright/test"

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? ""
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? ""
const API_BASE_URL = process.env.VITE_API_BASE_URL ?? "http://localhost:8000"

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

/**
 * Find the active thread id from the URL. Frontend routes typically
 * follow /chat/{tid} or include the tid as a query parameter; this
 * helper tries both patterns. Returns null if no id is found.
 */
async function getActiveThreadId(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const path = window.location.pathname
    // Try /chat/{tid}, /threads/{tid}, /t/{tid}, or any UUID-shaped segment.
    const segMatch = path.match(/\/(?:chat|threads|t)\/([0-9a-f-]{36})/i)
    if (segMatch) return segMatch[1]
    const uuidInPath = path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    if (uuidInPath) return uuidInPath[0]
    const sp = new URLSearchParams(window.location.search)
    return sp.get("thread") ?? sp.get("threadId") ?? sp.get("tid")
  })
}

/**
 * Read the active Supabase access token from the page context. The
 * frontend stashes the Supabase client on window so the e2e harness can
 * borrow its bearer token for direct backend calls (the inject-failed-run
 * endpoint is auth-gated like any production endpoint).
 */
async function getAccessToken(page: Page): Promise<string | null> {
  return await page.evaluate(async () => {
    // The Supabase JS client persists the session in localStorage by
    // default. Look up any sb-*-auth-token key and return its
    // access_token field.
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && /sb-.*-auth-token/.test(key)) {
        try {
          const raw = window.localStorage.getItem(key)
          if (!raw) continue
          const parsed = JSON.parse(raw)
          if (parsed?.access_token) return parsed.access_token as string
        } catch {
          // Ignore and continue scanning.
        }
      }
    }
    return null
  })
}

test.describe("Phase 063 — Resume button on failed runs (SC#7)", () => {
  test.beforeEach(async ({ page }) => {
    // Credentials are required (see PREREQUISITES). Without them, signIn
    // hard-fails — which is the correct RED behavior for unconfigured
    // environments (Phase 064 browser harness owns the configured runs).
    await signIn(page)
  })

  test("Resume button visible only on failed runs and re-POSTs on click", async ({ page, request }) => {
    // ── Step 1: send a real message to create a thread + first assistant
    //           message (so the test fixture has a thread to attach to). ──
    await createNewThread(page)
    await sendMessageInActiveThread(page, "Hello, what is 2+2?")

    // Wait for the assistant bubble to render. We don't need to wait for
    // it to FINISH — the fixture-injected failed run is a separate row.
    await expect(
      page.locator('[data-testid="assistant-message"]').first(),
    ).toBeVisible({ timeout: 15_000 })

    // ── Step 2: capture thread_id and access token ──
    const threadId = await getActiveThreadId(page)
    expect(threadId, "thread id must be discoverable from URL").toBeTruthy()

    const accessToken = await getAccessToken(page)
    expect(
      accessToken,
      "access token must be available in localStorage (Supabase session)",
    ).toBeTruthy()

    // ── Step 3: inject a failed run via the test fixture endpoint ──
    // This requires the backend to be started with ENABLE_TEST_FIXTURES=1.
    // Without that env var the endpoint returns 404 and this test fails
    // loudly with the right error, instead of silently passing.
    const fixtureResp = await request.post(
      `${API_BASE_URL}/__test__/inject-failed-run/${threadId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        // No body needed — fixture defaults handle everything.
        data: "{}",
      },
    )
    expect(
      fixtureResp.ok(),
      `fixture endpoint must succeed (start backend with ENABLE_TEST_FIXTURES=1); got ${fixtureResp.status()}`,
    ).toBeTruthy()

    // ── Step 4: trigger reconcile via page reload ──
    // Reload remounts ChatArea → useMessages.reconcile() → loadMessages()
    // refetches the message list including the new failed assistant row.
    await page.reload()

    // ── Step 5: assert the Resume button appears ──
    // MessageItem renders the button only when runStatus === 'failed'.
    // We use accessible role + aria-label for a stable selector.
    await expect(
      page.getByRole("button", { name: /resume failed run/i }),
    ).toBeVisible({ timeout: 15_000 })

    // ── Step 6: click Resume → assert a fresh POST /threads/{tid}/messages fires ──
    // resumeFromFailed re-sends the immediately-preceding user message.
    // For the fixture-injected failed run, the preceding message is the
    // user's "Hello, what is 2+2?" from Step 1.
    const postPromise = page.waitForRequest(
      (req) =>
        req.method() === "POST" && /\/threads\/[^/]+\/messages$/.test(req.url()),
      { timeout: 10_000 },
    )
    await page.getByRole("button", { name: /resume failed run/i }).first().click()
    await postPromise
  })
})
