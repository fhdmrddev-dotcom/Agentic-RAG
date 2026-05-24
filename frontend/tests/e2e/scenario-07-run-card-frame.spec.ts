// Phase 075.7 Plan 03 Task 3 — Scenario 07: RunCard frame
//
// Asserts R-3 + R-5 + Plan 02 visual frame: a tool-bearing assistant turn
// mounts <RunCard data-testid="run-card"> with a STICKY header (position:
// sticky against the Radix ScrollArea Viewport from MessageList.tsx:91)
// and a brand-pulse avatar during streaming. On terminal+tools, the body
// auto-collapses to <button data-testid="run-card-collapsed">.
//
// What this exercises end-to-end:
// 1. Send a tool-using prompt (default provider/model — exercises whichever
//    model is currently active in Settings; if no tool fires, the scenario
//    will fail loudly which IS the intended UAT signal).
// 2. Assert RunCard mounts during streaming.
// 3. Assert sticky header is position: sticky via getComputedStyle (R-5).
// 4. Assert brand-pulse class is present on the avatar div during streaming.
// 5. Wait for terminal — RunCard auto-collapses to a single row.
//
// DB-state teardown (Plan 075.4-05 fixture pattern):
// - beforeEach: wipe all runs/messages/threads for the test user.
// - afterEach: assertNoOrphanedStreamingRuns — run must have flipped off
//   the 'streaming' status by the time the scenario exits.

import { test, expect } from "./fixtures/auth.fixture"
import {
  teardownTestUserData,
  assertNoOrphanedStreamingRuns,
} from "./fixtures/db-teardown.fixture"

const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL || "fhdmrd@gmail.com"

const TOOL_PROMPT =
  "Search my documents for any reference to 'embeddings'. Use search_documents."

test.describe("@075.7 scenario-07 — RunCard frame", () => {
  test.beforeEach(async () => {
    await teardownTestUserData(TEST_USER_EMAIL)
  })
  test.afterEach(async () => {
    await assertNoOrphanedStreamingRuns(TEST_USER_EMAIL)
  })

  test("RunCard mounts on tool-bearing turn + sticky header pins + auto-collapses on terminal", async ({
    authedPage: page,
  }) => {
    // Auth gated by authedPage fixture (composer-visible assertion).
    // /login URL persists post-auth — see auth.fixture.ts comment.

    // Open a fresh New Chat
    await page
      .getByRole("button", { name: /new chat/i })
      .first()
      .click()
      .catch(() => {
        // composer already present is acceptable
      })

    // Send a tool-using prompt. Type via pressSequentially (more reliable on
    // React controlled inputs than .fill()) and submit via Enter — the Send
    // button click path was unreliable in 075.7 UAT due to canSend timing.
    const composer = page.getByPlaceholder(/ask anything|message|ask/i).first()
    await composer.click()
    await composer.pressSequentially(TOOL_PROMPT, { delay: 5 })
    await composer.press("Enter")

    // Step 1: Assert RunCard mounts during streaming (or shortly after the
    // first tool_call is registered — give it 30s of slack for cold model
    // load).
    const runCard = page.locator('[data-testid="run-card"]').first()
    await expect(runCard).toBeVisible({ timeout: 30_000 })

    // Step 2: Verify sticky header has position: sticky via getComputedStyle
    // (R-5 acceptance). The header must pin against the Radix ScrollArea
    // Viewport (RESEARCH §3.2 — verified no intermediate transform/overflow
    // ancestor breaks sticky behavior).
    const header = runCard.locator("header").first()
    const headerPosition = await header.evaluate(
      (el) => getComputedStyle(el).position,
    )
    expect(headerPosition).toBe("sticky")

    // Step 3: Brand-pulse avatar present during streaming. The avatar div
    // carries `animate-brandPulse` IFF runStatus === "streaming" (mirrors
    // MessageItem.tsx:137 predicate).
    const pulsingAvatars = await header.locator("div.animate-brandPulse").count()
    expect(pulsingAvatars).toBeGreaterThanOrEqual(1)

    // Step 4: Wait for terminal — RunCard auto-collapses to a single row
    // (R-6 + CONTEXT D-05/D-07). Give it 120s of slack for tool-using runs
    // across providers (Anthropic + OpenAI both observed ~30-60s end-to-end
    // for a single search_documents round).
    const collapsedRow = page.locator('[data-testid="run-card-collapsed"]').first()
    await expect(collapsedRow).toBeVisible({ timeout: 120_000 })
  })
})
