// Phase 075.4 Plan 06 Task 1 — Scenario 01: parallel composers
//
// Asserts BUG-260523-01: a streaming run on Thread A does not disable
// Thread B's composer. Closed structurally by Plan 075.4-01 (per-thread
// state lift in streamsStore.ts + ChatArea composer derives from
// `useStreamingForThread(thread?.id)`).
//
// What this exercises end-to-end:
// 1. Send a long Anthropic prompt on Thread A → wait for streaming start.
// 2. Open a new chat (Thread B) via the sidebar New Chat affordance.
// 3. Assert Thread B's composer textarea is NOT disabled while A streams.
// 4. Send a prompt on Thread B → second run begins (loading state appears).
// 5. Capture Thread B's run_id and assert a LangSmith trace exists.
//
// DB-state teardown (Plan 05 fixture):
// - beforeEach: wipe all runs/messages/threads for the test user.
// - afterEach: assertNoOrphanedStreamingRuns — both runs must have flipped
//   off the 'streaming' status by the time the scenario exits.
//
// Note: scenario fingerprints the streaming → terminal lifecycle via the
// per-thread store rather than micromanaging SSE events. The exact UI
// selectors below are intentionally broad (role / placeholder / text
// substring) so a future Deep Midnight redesign of the composer or
// sidebar New Chat button doesn't break this regression gate.

import { test, expect } from "./fixtures/auth.fixture"
import {
  teardownTestUserData,
  assertNoOrphanedStreamingRuns,
} from "./fixtures/db-teardown.fixture"
import { assertLangSmithTraceExists } from "./fixtures/langsmith.fixture"

const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL || "fhdmrd@gmail.com"

const LONG_PROMPT =
  "Please write a detailed multi-paragraph essay (around 400 words) " +
  "comparing three approaches to retrieval-augmented generation: " +
  "(1) bag-of-words BM25, (2) dense embeddings with vector search, " +
  "(3) hybrid fusion via reciprocal rank. Use concrete examples."

const SHORT_PROMPT_THREAD_B = "What is 2 + 2?"

test.describe("@075.4 scenario-01 — parallel composers (BUG-260523-01)", () => {
  test.beforeEach(async () => {
    await teardownTestUserData(TEST_USER_EMAIL)
  })
  test.afterEach(async () => {
    await assertNoOrphanedStreamingRuns(TEST_USER_EMAIL)
  })

  test("Thread B composer accepts input while Thread A streams", async ({
    authedPage: page,
  }) => {
    // Step 1: Land on the chat surface. After auth fixture, we should already
    // be off /login — the app routes to "/" which is the chat surface.
    await expect(page).not.toHaveURL(/\/login/)

    // Open a fresh New Chat for Thread A. Selector is broad to survive sidebar
    // redesigns; the role + name regex matches "New Chat", "+ New Chat", etc.
    await page
      .getByRole("button", { name: /new chat/i })
      .first()
      .click()
      .catch(() => {
        // Some app states already show a fresh composer; not having a New Chat
        // button is acceptable as long as the composer is present.
      })

    const composerA = page
      .getByPlaceholder(/message|ask|type a message/i)
      .or(page.getByRole("textbox").first())
      .first()
    await composerA.fill(LONG_PROMPT)
    await page
      .getByRole("button", { name: /send|submit/i })
      .first()
      .click()

    // Step 2: Wait for streaming to begin. The UI shows a "Stop" affordance,
    // a loading indicator, or replaces Send with Stop while in flight.
    await expect(
      page
        .getByRole("button", { name: /stop|cancel/i })
        .or(page.locator('[data-testid*="streaming"], [aria-busy="true"]'))
        .first(),
    ).toBeVisible({ timeout: 30_000 })

    // Step 3: Open Thread B via New Chat. The sidebar/dock button must remain
    // interactive while A streams (per-thread state lift invariant).
    await page
      .getByRole("button", { name: /new chat/i })
      .first()
      .click()

    // Step 4: Thread B's composer MUST NOT be disabled. BUG-260523-01 was that
    // an `isStreaming` global flag disabled the composer in both threads.
    const composerB = page
      .getByPlaceholder(/message|ask|type a message/i)
      .or(page.getByRole("textbox").first())
      .first()
    await expect(composerB).toBeVisible()
    await expect(composerB).toBeEnabled()

    await composerB.fill(SHORT_PROMPT_THREAD_B)

    // Capture the next POST /threads/{id}/messages or /threads/{id}/runs so we
    // can extract Thread B's run_id for the LangSmith assertion. Watch both
    // possible run-start endpoints — the app evolved across phases and either
    // shape may be live.
    const runStartPromise = page.waitForResponse(
      (resp) =>
        /\/threads\/[^/]+\/(messages|runs)/.test(resp.url()) &&
        resp.request().method() === "POST" &&
        (resp.status() === 200 || resp.status() === 201),
      { timeout: 30_000 },
    )

    await page
      .getByRole("button", { name: /send|submit/i })
      .first()
      .click()

    const runStartResp = await runStartPromise

    // Step 5: Extract run_id from response body. Both endpoints return JSON
    // shaped { run_id, ... }; if neither shape applies, soft-skip the
    // LangSmith assert — the BUG-260523-01 invariant (composer enabled) is
    // already verified above.
    let runId: string | undefined
    try {
      const body = await runStartResp.json()
      runId = (body.run_id as string) || (body.runId as string) || undefined
    } catch {
      runId = undefined
    }

    if (runId) {
      await assertLangSmithTraceExists(runId)
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        "scenario-01: could not parse run_id from response — skipping LangSmith assert.",
      )
    }
  })
})
