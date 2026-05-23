// Phase 075.4 Plan 06 Task 1 — Scenario 03: OpenRouter final pptx dedup
//
// Asserts BUG-260523-03a: an OpenRouter run that produces a .pptx (with
// any in-between intermediate iterations) must surface exactly ONE final
// .pptx card in the pinned-outputs panel. Closed structurally by
// Plan 075.4-03 (SHA-256 content-hash sandbox output dedup with
// supersedes detection in harvest_output_files).
//
// What this exercises end-to-end:
// 1. Set Settings → OpenRouter + an OpenRouter model.
// 2. Send a prompt that builds a 3-slide pptx with charts.
// 3. Wait for the run to complete (terminal SSE / Stop button hidden).
// 4. Assert exactly ONE .pptx card visible in the final pinned-outputs panel.
// 5. If a "Replaces:" subline is visible, it points at a different prior
//    filename (the supersedes contract from Plan 03).
// 6. Assert LangSmith trace exists with provider == openrouter.

import { test, expect } from "./fixtures/auth.fixture"
import {
  teardownTestUserData,
  assertNoOrphanedStreamingRuns,
} from "./fixtures/db-teardown.fixture"
import { assertLangSmithTraceExists } from "./fixtures/langsmith.fixture"

const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL || "fhdmrd@gmail.com"

const PPTX_PROMPT =
  "Use execute_code to build a 3-slide PowerPoint about climate change. " +
  "Each slide should have a title, a short body text, and at least one chart " +
  "with sample data (use matplotlib or python-pptx's add_chart). Save as " +
  "climate.pptx and return the file."

test.describe("@075.4 scenario-03 — OpenRouter final pptx exactly-one (BUG-260523-03a)", () => {
  test.beforeEach(async () => {
    await teardownTestUserData(TEST_USER_EMAIL)
  })
  test.afterEach(async () => {
    await assertNoOrphanedStreamingRuns(TEST_USER_EMAIL)
  })

  test("Exactly one .pptx card after an OpenRouter chart-building run", async ({
    authedPage: page,
  }) => {
    // Step 1: switch to OpenRouter via Settings.
    await page.goto("/settings").catch(() => undefined)

    await page
      .getByRole("combobox", { name: /provider|llm provider/i })
      .or(page.getByLabel(/provider/i))
      .first()
      .selectOption({ label: /openrouter/i })
      .catch(async () => {
        await page
          .getByRole("button", { name: /openrouter/i })
          .first()
          .click()
      })

    // Model selection — we don't pin a specific OpenRouter model name because
    // they churn frequently. The default in Settings should be acceptable.

    await page
      .getByRole("button", { name: /save|apply|update/i })
      .first()
      .click()
    await page.waitForTimeout(500)

    // Step 2: navigate to chat and send the pptx prompt.
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
    await composer.fill(PPTX_PROMPT)

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

    // Step 3: wait for completion. pptx generation may take a couple minutes
    // (multi-iteration sandbox + library install on first run). Generous budget.
    await expect(
      page.getByRole("button", { name: /stop|cancel/i }).first(),
    ).toBeHidden({ timeout: 180_000 })

    // Step 4: assert exactly ONE .pptx card in the final pinned-outputs panel.
    // The OutputFileCard renders the filename in a span; we count cards whose
    // filename contains ".pptx" case-insensitively.
    const pptxCards = page
      .locator(
        // Match cards whose visible text includes a .pptx filename. Multiple
        // selectors OR'd so different OutputFileCard styles survive matching.
        '[data-testid*="output-file"], [class*="OutputFile"], [class*="output-file"], a[href*=".pptx"], [class*="FileCard"]',
      )
      .filter({ hasText: /\.pptx/i })

    // The dedup invariant is "exactly one .pptx visible in the final state".
    // If the count is greater, BUG-260523-03 has regressed.
    const cardCount = await pptxCards.count()
    expect(
      cardCount,
      `Expected exactly 1 .pptx card after dedup; got ${cardCount}. BUG-260523-03 may have regressed.`,
    ).toBe(1)

    // Step 5: if a "Replaces:" subline is visible, ensure it cites a prior
    // (different) filename rather than self-referencing. This is the
    // supersedes contract surfaced by OutputFileCard in Plan 075.4-04.
    const replacesText = page.getByText(/Replaces:/i).first()
    if (await replacesText.isVisible().catch(() => false)) {
      const replacesLine = await replacesText.textContent()
      const visibleCardText = await pptxCards.first().textContent()
      expect(
        replacesLine && visibleCardText && replacesLine.includes(visibleCardText.trim()),
        "Replaces: subline must cite a different prior filename, not self-reference",
      ).toBeFalsy()
    }

    // Step 6: LangSmith provider check.
    if (runId) {
      await assertLangSmithTraceExists(runId, "openrouter")
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        "scenario-03: could not parse run_id — skipping LangSmith provider-match assert.",
      )
    }
  })
})
