// Phase 075.4 Plan 06 Task 1 — Scenario 04: done latency
//
// Asserts BUG-260523-03b: when the SSE `done` event arrives, the UI must
// settle (loading spinner gone, Stop button hidden) within 500ms.
// Closed structurally by Plan 075.4-03 (terminal-status race fix:
// _shielded_finalize step swap so DB UPDATE precedes SSE 'done' sentinel).
//
// What this exercises end-to-end:
// 1. Send a short prompt → wait for it to complete.
// 2. Capture timestamp when the SSE `done` event arrives via CDP network
//    events (Playwright exposes them through page.on('response')).
// 3. Capture timestamp when the UI settles: Stop button hidden / aria-busy
//    cleared / loading indicator gone.
// 4. Assert delta < 500ms.
//
// Note: we cannot easily intercept individual SSE events from Playwright
// without setting up a CDP session. We approximate via: (a) the moment the
// last POST response stream closes (a proxy for terminal event arrival),
// and (b) the moment the Stop button disappears (UI settled). On modern
// fetch streams Playwright observes the response close at the moment the
// server closes the stream, which is right after the terminal sentinel
// per Plan 075.4-03's step ordering.

import { test, expect } from "./fixtures/auth.fixture"
import {
  teardownTestUserData,
  assertNoOrphanedStreamingRuns,
} from "./fixtures/db-teardown.fixture"
import { assertLangSmithTraceExists } from "./fixtures/langsmith.fixture"

const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL || "fhdmrd@gmail.com"

const SHORT_PROMPT = "Say hello in one short sentence."

test.describe("@075.4 scenario-04 — done latency <500ms (BUG-260523-03b)", () => {
  test.beforeEach(async () => {
    await teardownTestUserData(TEST_USER_EMAIL)
  })
  test.afterEach(async () => {
    await assertNoOrphanedStreamingRuns(TEST_USER_EMAIL)
  })

  test("SSE done -> UI settled latency is under 500ms", async ({
    authedPage: page,
  }) => {
    await page
      .getByRole("button", { name: /new chat/i })
      .first()
      .click()
      .catch(() => undefined)

    const composer = page
      .getByPlaceholder(/message|ask|type a message/i)
      .or(page.getByRole("textbox").first())
      .first()
    await composer.fill(SHORT_PROMPT)

    const runStartPromise = page.waitForResponse(
      (resp) =>
        /\/threads\/[^/]+\/(messages|runs)/.test(resp.url()) &&
        resp.request().method() === "POST" &&
        (resp.status() === 200 || resp.status() === 201),
      { timeout: 30_000 },
    )

    // Hook into response 'close' to capture the moment the SSE stream ends.
    // The response 'finished' event in Playwright fires when the HTTP stream
    // closes — which is right after the server emits its terminal sentinel
    // and finalize_run UPDATE per Plan 075.4-03 ordering.
    let sseEndTimestamp: number | null = null
    page.on("response", (resp) => {
      const url = resp.url()
      if (
        /\/threads\/[^/]+\/(messages|runs|stream|subscribe)/.test(url) &&
        (resp.request().method() === "POST" || resp.request().method() === "GET")
      ) {
        resp
          .finished()
          .then(() => {
            if (sseEndTimestamp === null) sseEndTimestamp = Date.now()
          })
          .catch(() => undefined)
      }
    })

    await page
      .getByRole("button", { name: /send|submit/i })
      .first()
      .click()

    const runStartResp = await runStartPromise
    let runId: string | undefined
    try {
      const body = await runStartResp.json()
      runId = (body.run_id as string) || (body.runId as string) || undefined
    } catch {
      runId = undefined
    }

    // Wait for the run to finish — Stop button hidden = UI settled.
    await expect(
      page.getByRole("button", { name: /stop|cancel/i }).first(),
    ).toBeHidden({ timeout: 60_000 })

    const uiSettledTimestamp = Date.now()

    expect(
      sseEndTimestamp,
      "scenario-04 setup error: never observed SSE/POST stream close",
    ).not.toBeNull()

    const delta = uiSettledTimestamp - (sseEndTimestamp as number)
    // The acceptance budget per Plan 075.4-03 SC#4 is < 500ms. We allow a
    // small slack for the response.finished() observer event-loop delay.
    expect(
      delta,
      `done → UI-settled latency ${delta}ms exceeds 500ms budget. ` +
        `Terminal-status race may have regressed (Plan 075.4-03 _shielded_finalize step swap).`,
    ).toBeLessThan(500)

    // LangSmith trace assertion — confirms the run reached the LLM layer
    // and produced a trace (sanity gate; not the primary assertion here).
    if (runId) {
      await assertLangSmithTraceExists(runId)
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        "scenario-04: could not parse run_id — skipping LangSmith assert.",
      )
    }
  })
})
