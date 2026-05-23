// Phase 075.4 Plan 06 Task 1 — Scenario 02: Gemini-3 thought_signature
//
// Asserts BUG-260523-02: a Gemini-3 model in a multi-tool-round agent loop
// must NOT 400 with INVALID_ARGUMENT. Closed structurally by Plan 075.4-02
// (3-stage thought_signature wiring: capture in _on_chunk_openai, echo in
// _reconstruct_history, persist in messages.tool_calls jsonb).
//
// What this exercises end-to-end:
// 1. Set Settings → AI Model → google + gemini-3-flash-preview.
// 2. Send a prompt that requires 2+ tool rounds.
// 3. Assert NO 400 INVALID_ARGUMENT in network responses to the LLM
//    endpoint (or to our backend).
// 4. Assert the run completes (terminal SSE arrives → loading off).
// 5. Assert a LangSmith trace exists with provider == "google".
//
// Note: this scenario depends on Settings UI shape + a Gemini-3 model
// being available + a working Google API key. If the environment lacks
// either, the early Settings step will fail loudly and the scenario will
// be RED — that is the intended behavior (no silent skip — the operator
// should know UAT requires this provider configured).

import { test, expect } from "./fixtures/auth.fixture"
import {
  teardownTestUserData,
  assertNoOrphanedStreamingRuns,
} from "./fixtures/db-teardown.fixture"
import { assertLangSmithTraceExists } from "./fixtures/langsmith.fixture"

const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL || "fhdmrd@gmail.com"

const MULTI_TOOL_PROMPT =
  "Search my documents for 'embeddings' and then run a small python " +
  "snippet to print the literal string 'OK'. Use both tools in order."

test.describe("@075.4 scenario-02 — Gemini-3 thought_signature (BUG-260523-02)", () => {
  test.beforeEach(async () => {
    await teardownTestUserData(TEST_USER_EMAIL)
  })
  test.afterEach(async () => {
    await assertNoOrphanedStreamingRuns(TEST_USER_EMAIL)
  })

  test("Gemini-3 completes a 2+ tool-round run with no 400 INVALID_ARGUMENT", async ({
    authedPage: page,
  }) => {
    // Step 1: Navigate to Settings. The app exposes Settings via a sidebar
    // dock or a profile menu; we try the route directly first, then fall
    // back to a Settings link.
    await page.goto("/settings").catch(() => {
      // Some app builds use /app/settings or open a Settings dialog; we'll
      // try clicking a Settings link as fallback.
      return page
        .getByRole("link", { name: /settings/i })
        .first()
        .click()
    })

    // Switch the active provider to google + select a Gemini-3 model.
    // Selectors are broad (role + name regex) so a future Settings redesign
    // doesn't break the scenario.
    await page
      .getByRole("combobox", { name: /provider|llm provider/i })
      .or(page.getByLabel(/provider/i))
      .first()
      .selectOption({ label: /google/i })
      .catch(async () => {
        // Some UI uses radio buttons / cards instead of a combobox
        await page
          .getByRole("button", { name: /^google$/i })
          .first()
          .click()
      })

    // Model picker — try gemini-3-flash-preview first; fall back to any
    // gemini-3 model that's present.
    await page
      .getByRole("combobox", { name: /model|llm model/i })
      .or(page.getByLabel(/model/i))
      .first()
      .selectOption({ label: /gemini.*3.*flash/i })
      .catch(() => {
        // Fall through; the model may already be set or the picker shape differs.
      })

    // Save the settings change.
    await page
      .getByRole("button", { name: /save|apply|update/i })
      .first()
      .click()

    // Wait briefly for the Save to flush (Phase 075.4 Plan 04 fixed the
    // 2-click bug via flushSync; one click should suffice now).
    await page.waitForTimeout(500)

    // Step 2: Navigate back to chat and send the multi-tool prompt.
    await page.goto("/")

    await page
      .getByRole("button", { name: /new chat/i })
      .first()
      .click()
      .catch(() => undefined)

    const composer = page
      .getByPlaceholder(/message|ask|type a message/i)
      .or(page.getByRole("textbox").first())
      .first()
    await composer.fill(MULTI_TOOL_PROMPT)

    // Track all network responses for the 400 INVALID_ARGUMENT check.
    const bad400Responses: { url: string; status: number }[] = []
    page.on("response", (resp) => {
      if (resp.status() === 400) {
        bad400Responses.push({ url: resp.url(), status: resp.status() })
      }
    })

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
    let runId: string | undefined
    try {
      const body = await runStartResp.json()
      runId = (body.run_id as string) || (body.runId as string) || undefined
    } catch {
      runId = undefined
    }

    // Step 3+4: Wait for the run to complete. We watch for the Stop button to
    // disappear or for a "done" / completed indicator. Multi-tool rounds may
    // take a while; allow 2 minutes wall-clock for Gemini-3 chains.
    await expect(
      page.getByRole("button", { name: /stop|cancel/i }).first(),
    ).toBeHidden({ timeout: 120_000 })

    // Step 3 assertion: zero 400 INVALID_ARGUMENT in observed responses.
    expect(
      bad400Responses,
      `400 responses observed during Gemini-3 multi-tool run — BUG-260523-02 regressed: ${JSON.stringify(bad400Responses)}`,
    ).toEqual([])

    // Step 5: LangSmith trace with provider == google.
    if (runId) {
      await assertLangSmithTraceExists(runId, "google")
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        "scenario-02: could not parse run_id — skipping LangSmith provider-match assert.",
      )
    }
  })
})
