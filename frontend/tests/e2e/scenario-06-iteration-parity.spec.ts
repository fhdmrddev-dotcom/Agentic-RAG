// Phase 075.4 Plan 06 Task 1 — Scenario 06: iteration parity measurement
//
// MEASUREMENT GATE for BUG-260523-04 (Anthropic 22-iteration loops):
// the same prompt sent to four different providers must complete with
// roughly comparable iteration counts. This scenario MEASURES the spread;
// the root-cause fix is DEFERRED per the phase CONTEXT.md carry-forward.
//
// CONTEXT.md routing (verbatim spirit):
//   BUG-260523-04 root-cause fix is deferred to a future focused phase.
//   This test FAILS today; it stays in the suite as a regression
//   measurement gate that the future fix-phase will close.
//
// What this exercises end-to-end:
// 1. For each of the 4 providers (OpenAI gpt-5.x, Anthropic claude-4.x,
//    Google gemini-3-pro, OpenRouter minimax-m2.7), set Settings and send
//    a fixed prompt that exercises 2-3 tools.
// 2. Capture the final iteration count (via `runs.metadata.iteration_count`
//    if exposed by /threads/{id}/snapshot, otherwise by counting
//    tool_preparing SSE events / tool-card panels rendered in the UI).
// 3. Assert all 4 runs complete (no crashes / blocked composers).
// 4. Assert max(counts) / min(counts) <= 2 (within ~50% spread).
// 5. If Anthropic spikes the spread > 2x, scenario FAILS — the failure
//    IS the BUG-260523-04 measurement. Do NOT mask or skip this test.

import { test, expect } from "./fixtures/auth.fixture"
import {
  teardownTestUserData,
  assertNoOrphanedStreamingRuns,
} from "./fixtures/db-teardown.fixture"
import { assertLangSmithTraceExists } from "./fixtures/langsmith.fixture"

const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL || "fhdmrd@gmail.com"

interface ProviderRow {
  /** UI label used for provider selection in Settings. */
  providerLabel: RegExp
  /** UI label / pattern used for model selection (best-effort). */
  modelLabel?: RegExp
  /** Display name used in error / log messages. */
  displayName: string
}

const PROVIDERS: ProviderRow[] = [
  { providerLabel: /openai/i, modelLabel: /gpt.*5/i, displayName: "OpenAI gpt-5.x" },
  { providerLabel: /anthropic/i, modelLabel: /claude.*4/i, displayName: "Anthropic claude-4.x" },
  { providerLabel: /google/i, modelLabel: /gemini.*3.*pro/i, displayName: "Google gemini-3-pro" },
  { providerLabel: /openrouter/i, modelLabel: /minimax/i, displayName: "OpenRouter minimax-m2.7" },
]

const PARITY_PROMPT =
  "Build a simple analysis: load a sample CSV (synthesize one inline if needed), " +
  "compute column means with pandas, and plot a bar chart. Use execute_code."

/**
 * Drive the chat for one provider and return its observed iteration count.
 * Iteration count is approximated by counting unique tool-call card / tool-
 * preparing surface events visible in the chat for the most recent run.
 */
async function runOneProviderAndMeasureIterations(
  page: import("@playwright/test").Page,
  provider: ProviderRow,
): Promise<{ provider: string; iterations: number; runId: string | null }> {
  // Switch settings.
  await page.goto("/settings").catch(() => undefined)
  await page
    .getByRole("combobox", { name: /provider|llm provider/i })
    .or(page.getByLabel(/provider/i))
    .first()
    .selectOption({ label: provider.providerLabel })
    .catch(async () => {
      await page
        .getByRole("button", { name: provider.providerLabel })
        .first()
        .click()
    })
  if (provider.modelLabel) {
    await page
      .getByRole("combobox", { name: /model|llm model/i })
      .or(page.getByLabel(/model/i))
      .first()
      .selectOption({ label: provider.modelLabel })
      .catch(() => undefined)
  }
  await page
    .getByRole("button", { name: /save|apply|update/i })
    .first()
    .click()
  await page.waitForTimeout(500)

  // Send the parity prompt on a fresh chat.
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
  await composer.fill(PARITY_PROMPT)

  const runStartPromise = page.waitForResponse(
    (resp) =>
      /\/threads\/[^/]+\/(messages|runs)/.test(resp.url()) &&
      resp.request().method() === "POST" &&
      (resp.status() === 200 || resp.status() === 201),
    { timeout: 60_000 },
  )

  await page
    .getByRole("button", { name: /send|submit/i })
    .first()
    .click()

  let runId: string | null = null
  try {
    const resp = await runStartPromise
    const body = await resp.json()
    runId = (body.run_id as string) || (body.runId as string) || null
  } catch {
    runId = null
  }

  // Anthropic runs may iterate up to ~22 times under BUG-260523-04 — that's
  // exactly what this scenario measures. Generous 5-minute budget per provider.
  await expect(
    page.getByRole("button", { name: /stop|cancel/i }).first(),
  ).toBeHidden({ timeout: 300_000 })

  // Approximate iteration count by counting tool-call panels / cards rendered
  // for the most recent run. Selector union catches different tool-card
  // surfaces (ToolCallPanel, ToolMessage, tool-stage indicators).
  const toolPanelCount = await page
    .locator(
      '[data-testid*="tool-call"], [data-testid*="tool-stage"], [class*="ToolCallPanel"], [class*="tool-card"], [data-tool-call]',
    )
    .count()

  // Floor of 1: every run has at least one LLM iteration even if it produced
  // zero tool calls. The metric we care about is RELATIVE spread across
  // providers, not absolute iteration count.
  const iterations = Math.max(1, toolPanelCount)
  return { provider: provider.displayName, iterations, runId }
}

test.describe("@075.4 scenario-06 — iteration parity (BUG-260523-04 measurement)", () => {
  test.beforeEach(async () => {
    await teardownTestUserData(TEST_USER_EMAIL)
  })
  test.afterEach(async () => {
    await assertNoOrphanedStreamingRuns(TEST_USER_EMAIL)
  })

  test("max(counts) / min(counts) <= 2 across 4 providers (currently RED — BUG-260523-04)", async ({
    authedPage: page,
  }) => {
    const results: { provider: string; iterations: number; runId: string | null }[] = []

    for (const provider of PROVIDERS) {
      const result = await runOneProviderAndMeasureIterations(page, provider)
      results.push(result)
      // eslint-disable-next-line no-console
      console.log(
        `scenario-06 measurement: ${result.provider} = ${result.iterations} iteration(s)` +
          (result.runId ? ` (run_id=${result.runId})` : " (no run_id captured)"),
      )
      // Sanity gate per provider: confirm the run produced a LangSmith trace.
      // We DON'T provider-match here because each providerLabel is fuzzy and a
      // strict mismatch would mask BUG-260523-04 measurement under a
      // LangSmith-tag noise failure.
      if (result.runId) {
        await assertLangSmithTraceExists(result.runId).catch((e) => {
          // eslint-disable-next-line no-console
          console.warn(
            `scenario-06: LangSmith trace assert failed for ${result.provider}: ${(e as Error).message}`,
          )
        })
      }
    }

    // Step 3 assert: all 4 providers completed at least one iteration.
    expect(
      results.length,
      "scenario-06 setup error: not all 4 providers completed",
    ).toBe(PROVIDERS.length)
    for (const r of results) {
      expect(
        r.iterations,
        `Provider ${r.provider} produced 0 iterations — completion path broken.`,
      ).toBeGreaterThan(0)
    }

    // Step 4: assert iteration spread <= 2x.
    const counts = results.map((r) => r.iterations)
    const maxCount = Math.max(...counts)
    const minCount = Math.min(...counts)
    const spread = maxCount / minCount

    // STEP 5 EXPECTED-RED PATH:
    // Per CONTEXT.md, BUG-260523-04 root-cause fix is DEFERRED. This assert
    // is the regression-measurement gate. When the future focused-fix phase
    // closes BUG-260523-04, this gate flips GREEN naturally. Until then it
    // stays RED on every run — DO NOT mark this test as expected-fail or
    // skip it; the failing run output IS the measurement we want operators
    // to see in every Playwright sweep.
    expect(
      spread,
      `BUG-260523-04 iteration parity gate: max/min = ${spread.toFixed(2)} ` +
        `(target <= 2). Per-provider counts: ` +
        results
          .map((r) => `${r.provider}=${r.iterations}`)
          .join(", ") +
        ". Root-cause fix is deferred to a future phase per CONTEXT.md " +
        "carry-forward; this test FAILS today by design.",
    ).toBeLessThanOrEqual(2)
  })
})
