// Phase 075.7 Plan 03 Task 3 — Scenario 08: Focus mode collapse
//
// Asserts R-4 + R-5 + R-6: past tool cards collapse to `→ {summary}` one-
// liner sourced from the TOOL_SUMMARIES registry (Plan 01); auto-collapse
// fires on terminal+tools; click on the collapsed-row restores the full
// body visibility.
//
// What this exercises end-to-end:
// 1. Send a 2+ tool prompt (search_documents + read_document is a common
//    real-world combo).
// 2. Wait for RunCard auto-collapse on terminal.
// 3. Click the collapsed-row → body re-renders.
// 4. Assert `[data-testid="tool-result-summary"]` rows are present with text
//    starting with the literal `→` character (U+2192).
//
// Covers R-4 (registry-driven `→ {summary}` per-tool one-liner) and R-5
// (auto-collapse + click-to-expand behavior).

import { test, expect } from "./fixtures/auth.fixture"
import {
  teardownTestUserData,
  assertNoOrphanedStreamingRuns,
} from "./fixtures/db-teardown.fixture"

const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL || "fhdmrd@gmail.com"

const MULTI_TOOL_PROMPT =
  "Search my documents for any mention of 'agent' and then read the first " +
  "matching document. Use search_documents then read_document in order."

test.describe("@075.7 scenario-08 — Focus mode collapse", () => {
  test.beforeEach(async () => {
    await teardownTestUserData(TEST_USER_EMAIL)
  })
  test.afterEach(async () => {
    await assertNoOrphanedStreamingRuns(TEST_USER_EMAIL)
  })

  test("Past tools collapse to → {summary}; click expand restores full visibility", async ({
    authedPage: page,
  }) => {
    // Auth gated by authedPage fixture; /login URL persists post-auth.

    await page
      .getByRole("button", { name: /new chat/i })
      .first()
      .click()
      .catch(() => {})

    const composer = page
      .getByPlaceholder(/message|ask|type a message/i)
      .or(page.getByRole("textbox").first())
      .first()
    await composer.fill(MULTI_TOOL_PROMPT)
    await page
      .getByRole("button", { name: /send|submit/i })
      .first()
      .click()

    // RunCard mounts during streaming
    await expect(page.locator('[data-testid="run-card"]').first()).toBeVisible({
      timeout: 30_000,
    })

    // Wait for auto-collapse on terminal — 2-tool run can take up to ~150s
    // across providers.
    const collapsedRow = page.locator('[data-testid="run-card-collapsed"]').first()
    await expect(collapsedRow).toBeVisible({ timeout: 150_000 })

    // Click to expand
    await collapsedRow.click()

    // Body re-renders → `→ {summary}` rows must appear on collapsed past tools.
    const summaryRows = page.locator('[data-testid="tool-result-summary"]')
    await expect(summaryRows.first()).toBeVisible({ timeout: 5_000 })

    const summaryCount = await summaryRows.count()
    expect(summaryCount).toBeGreaterThanOrEqual(1)

    // Each summary row text must start with the literal `→` (U+2192) per
    // UI-SPEC §7.5 + R-4 prefix contract.
    for (let i = 0; i < summaryCount; i++) {
      const text = await summaryRows.nth(i).textContent()
      expect(text?.trim().startsWith("→")).toBe(true)
    }
  })
})
