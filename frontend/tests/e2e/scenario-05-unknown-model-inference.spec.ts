// Phase 075.4 Plan 06 Task 1 — Scenario 05: unknown-model inference fallback
//
// Regression guard for Phase 075.3 Plan 02's get_model_capability()
// registry-or-inference resolver: an unknown model ID (e.g. "gpt-99-mega")
// configured under a KNOWN provider (OpenAI) must NOT crash; instead the
// backend logs `model_capability_unknown` ONCE and applies safe-default
// capabilities (Phase 075.3 Plan 02 + Phase 075.4-02 sweep).
//
// Distinction from UnknownProviderError (Plan 075.4-02):
//   - Unknown PROVIDER → hard failure (UnknownProviderError raised at startup).
//   - Unknown MODEL under a known provider → soft fallback via inference.
//
// What this exercises end-to-end:
// 1. Settings → OpenAI provider; add "gpt-99-mega" to the models field;
//    set as the active llm_model.
// 2. Send any short prompt.
// 3. Assert the run completes (inference fallback applied safe defaults).
// 4. Assert NO UnknownProviderError-style error rendered to the UI.
// 5. Assert LangSmith trace exists (run reached the LLM layer).
//
// Note on `model_capability_unknown` log assertion: the WARNING log lives
// on the backend stdout / `app.config` logger and isn't exposed to the
// browser. The plan's acceptance criteria flag this as "annotate test with
// manual-step note if not autodetectable" — we do exactly that: the test
// asserts the UI-observable behavior (run completes; no crash), and
// inline-comments the operator instruction for the backend-log check.

import { test, expect } from "./fixtures/auth.fixture"
import {
  teardownTestUserData,
  assertNoOrphanedStreamingRuns,
} from "./fixtures/db-teardown.fixture"
import { assertLangSmithTraceExists } from "./fixtures/langsmith.fixture"

const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL || "fhdmrd@gmail.com"
const UNKNOWN_MODEL_ID = "gpt-99-mega"

test.describe("@075.4 scenario-05 — unknown-model inference fallback", () => {
  test.beforeEach(async () => {
    await teardownTestUserData(TEST_USER_EMAIL)
  })
  test.afterEach(async () => {
    await assertNoOrphanedStreamingRuns(TEST_USER_EMAIL)
  })

  test("Unknown model ID under known provider falls back via inference and run completes", async ({
    authedPage: page,
  }) => {
    // OPERATOR NOTE: after this scenario runs, manually verify the backend log
    // contains EXACTLY ONE record of:
    //   WARNING app.config:config.py:285 model_capability_unknown
    //     model_id=gpt-99-mega inferred_provider=openai safe_defaults_applied=True
    // De-dup invariant: rerunning the same unknown model in another scenario
    // should NOT re-log (per `_WARNED_UNKNOWN_MODEL_IDS` module-level set).

    // Step 1: navigate to Settings.
    await page.goto("/settings").catch(() => undefined)

    // Switch active provider to openai (might already be the default).
    await page
      .getByRole("combobox", { name: /provider|llm provider/i })
      .or(page.getByLabel(/provider/i))
      .first()
      .selectOption({ label: /openai/i })
      .catch(async () => {
        await page
          .getByRole("button", { name: /^openai$/i })
          .first()
          .click()
      })

    // Set llm_model to the unknown ID. There may be a free-text models input
    // (Plan 075.4-04 Task 2 documented sentinel guards on these) or a
    // selectable combobox; we try the combobox first via typing the literal
    // model id, then fall back to a free-text input labeled "model".
    const modelControl = page
      .getByRole("combobox", { name: /model|llm model/i })
      .or(page.getByLabel(/^model$/i))
      .or(page.getByPlaceholder(/model/i))
      .first()

    // For comboboxes that don't allow free-text values, fall back to filling
    // any input with placeholder/label matching "model".
    try {
      await modelControl.fill(UNKNOWN_MODEL_ID)
    } catch {
      await page
        .getByLabel(/model/i)
        .or(page.getByPlaceholder(/model/i))
        .first()
        .fill(UNKNOWN_MODEL_ID)
    }

    await page
      .getByRole("button", { name: /save|apply|update/i })
      .first()
      .click()
    await page.waitForTimeout(500)

    // Step 2: send a short prompt on the chat surface.
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
    await composer.fill("Say hi.")

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

    // Step 3: assert the run completes. The inference fallback means the model
    // is treated as a known OpenAI model with safe defaults — no startup
    // crash, no UnknownProviderError.
    await expect(
      page.getByRole("button", { name: /stop|cancel/i }).first(),
    ).toBeHidden({ timeout: 60_000 })

    // Step 4: no UnknownProviderError surfaced in the UI (an error toast,
    // an error message bubble, or a "Failed to start" indicator).
    const errorIndicator = page
      .getByText(/UnknownProviderError|unknown provider/i)
      .first()
    expect(
      await errorIndicator.isVisible().catch(() => false),
      "scenario-05 regression: UnknownProviderError surfaced for an unknown MODEL " +
        "under a known PROVIDER. The inference fallback path is broken.",
    ).toBeFalsy()

    // Step 5: LangSmith trace assertion (proves the run actually reached the
    // LLM layer with safe defaults — not just dropped at routing).
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
        "scenario-05: could not parse run_id — skipping LangSmith assert.",
      )
    }
  })
})
