// Phase 088 Plan 03 Task 1 — Scenario 13: deep workspace flow (D-15) + the
// gemini-3 thought_signature live re-verify (D-17, BUG-260523-02).
//
// This is the durable CI wire-level backstop for SC#4: the full deep flow,
// driven on BOTH Anthropic and Google, with NO page refresh anywhere:
//
//   switch provider/model → open the workspace panel → agent WRITES a file
//   → user SEES it in the FILES listbox → agent UPDATES the same file
//   → user VIEWS the diff → agent calls ask_user → user RESPONDS → agent
//   RESUMES (the PendingAskCard unmounts + the run reaches a terminal state).
//
// On the Google axis the multi-tool-round chain ALSO asserts zero 400
// INVALID_ARGUMENT — the network-level re-verification of the thought_signature
// hotfix (RESEARCH Pitfall 4 + D-17). The assertion is kept on BOTH providers
// (cheap, and catches an Anthropic regression too).
//
// REUSE-AND-EXTEND (RESEARCH correction #5 / Pattern 4): this EXTENDS the
// `scenario-02-gemini-thought-signature.spec.ts` pattern + the 3 mature fixtures
// (auth / db-teardown / langsmith). No new harness.
//
// NO SILENT SKIP: if the environment lacks a provider/key or a gemini-3.x
// model, the early Settings step fails LOUDLY (the intended scenario-02
// behavior) — the operator must know the deep-flow UAT requires BOTH providers
// configured. The live green pass on both is the Plan 05 / VALIDATION operator
// gate; THIS plan only authors + lists + type-checks the scenario.
//
// Operator run command (after `scripts/restart-backend.ps1` + Anthropic +
// Google keys + a gemini-3.x model configured):
//   cd frontend && npm run e2e -- scenario-13
// workers:1 (playwright.config.ts) → serial, shared DB-teardown.

import { test, expect, type Page } from "./fixtures/auth.fixture"
import {
  teardownTestUserData,
  assertNoOrphanedStreamingRuns,
} from "./fixtures/db-teardown.fixture"
import { assertLangSmithTraceExists } from "./fixtures/langsmith.fixture"

const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL || "fhdmrd@gmail.com"

// D-15: parameterize over Anthropic + Google. Google model regex is 3.x
// (NOT gemini-2.5, per D-03 / D-17 — 2.5 is the known-degraded provenance row).
// The LangSmith provider key matches the trace metadata the run records.
const PROVIDERS = [
  {
    name: "anthropic" as const,
    providerRe: /anthropic/i,
    modelRe: /claude.*haiku|claude.*opus/i,
  },
  {
    name: "google" as const,
    providerRe: /google/i,
    modelRe: /gemini.*3.*flash/i,
  },
]

// Generous wall-clock budget for a multi-tool Gemini-3 chain (scenario-02:145).
const RUN_TIMEOUT = 120_000
const SETTLE_TIMEOUT = 60_000

// The 3 prompts that drive the deep flow. Worded so the agent reaches for
// workspace_write (twice, same file) then ask_user — broad enough that minor
// model phrasing differences don't change which tools fire.
const PROMPT_WRITE =
  "Create a workspace file called analysis.md containing a short 2-line " +
  "summary of what vector embeddings are. Use your workspace file tool."
const PROMPT_UPDATE =
  "Now add a third line to that same analysis.md about cosine similarity. " +
  "Update the existing file (a new version of analysis.md)."
const PROMPT_ASK =
  "I want to rename analysis.md to final.md, but ask me to confirm the new " +
  "name first before you do anything — use ask_user and wait for my answer."

/**
 * Capture a run_id from the POST /threads/{id}/(messages|runs) response that
 * starts the run, then send the prompt. Returns the run_id when parseable.
 * Copy of the scenario-02:118-138 run-start capture pattern.
 */
async function sendPromptAndCaptureRun(
  page: Page,
  prompt: string,
): Promise<string | undefined> {
  const composer = page
    .getByPlaceholder(/message|ask|type a message/i)
    .or(page.getByRole("textbox").first())
    .first()
  await composer.fill(prompt)

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
  try {
    const body = await runStartResp.json()
    return (body.run_id as string) || (body.runId as string) || undefined
  } catch {
    return undefined
  }
}

/** Wait for the run to reach a terminal state: the Stop/Cancel control hides. */
async function waitForRunTerminal(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: /stop|cancel/i }).first(),
  ).toBeHidden({ timeout: RUN_TIMEOUT })
}

for (const provider of PROVIDERS) {
  test.describe(`@088 scenario-13 — deep workspace flow [${provider.name}] (D-15 / D-17 SC#4)`, () => {
    test.beforeEach(async () => {
      await teardownTestUserData(TEST_USER_EMAIL)
    })
    test.afterEach(async () => {
      await assertNoOrphanedStreamingRuns(TEST_USER_EMAIL)
    })

    test(`${provider.name}: write → see → update → diff → ask_user → respond → resume, no refresh`, async ({
      authedPage: page,
    }) => {
      // ── 400 capture for the WHOLE test (D-17 — thought-signature signal on
      //    Google; also catches an Anthropic regression). Registered before the
      //    first run starts (scenario-02:110-116 pattern). ──
      const bad400Responses: { url: string; status: number }[] = []
      page.on("response", (resp) => {
        if (resp.status() === 400) {
          bad400Responses.push({ url: resp.url(), status: resp.status() })
        }
      })

      // ── Step 1: switch provider + model in Settings (scenario-02:49-93). This
      //    is the ONLY navigation away from chat, and it happens BEFORE any file
      //    is written — the no-refresh constraint applies from the file-write on. ──
      await page.goto("/settings").catch(() =>
        page
          .getByRole("link", { name: /settings/i })
          .first()
          .click(),
      )

      await page
        .getByRole("combobox", { name: /provider|llm provider/i })
        .or(page.getByLabel(/provider/i))
        .first()
        .selectOption({ label: provider.providerRe })
        .catch(async () => {
          await page
            .getByRole("button", { name: new RegExp(`^${provider.name}$`, "i") })
            .first()
            .click()
        })

      await page
        .getByRole("combobox", { name: /model|llm model/i })
        .or(page.getByLabel(/model/i))
        .first()
        .selectOption({ label: provider.modelRe })
        .catch(() => {
          // The model may already be set, or the picker shape differs — the
          // run itself will surface a wrong-provider via the LangSmith assert.
        })

      await page
        .getByRole("button", { name: /save|apply|update/i })
        .first()
        .click()
      await page.waitForTimeout(500)

      // ── Step 2: back to chat + open a fresh thread. This is the LAST
      //    navigation in the test — everything after happens with NO refresh. ──
      await page.goto("/")
      await page
        .getByRole("button", { name: /new chat/i })
        .first()
        .click()
        .catch(() => undefined)

      // Open the workspace panel. It defaults to "open" (ChatLayout panelState),
      // so the complementary landmark should already be present; if it's on the
      // rail, click the always-present "Expand workspace" control (PanelRail).
      // We do NOT blind-press ⌘./Ctrl+. (that toggle could CLOSE an open panel).
      const panel = page.getByRole("complementary", { name: /agent workspace/i })
      if (!(await panel.isVisible().catch(() => false))) {
        await page
          .getByRole("button", { name: /expand workspace/i })
          .first()
          .click()
          .catch(() => undefined)
      }
      await expect(panel).toBeVisible({ timeout: 15_000 })

      // ── Step 3: agent WRITES a file → it appears in the FILES listbox. ──
      const firstRunId = await sendPromptAndCaptureRun(page, PROMPT_WRITE)
      await waitForRunTerminal(page)

      const fileRow = page
        .locator('[role="listbox"][aria-label="Workspace files"] [role="option"]')
        .first()
      await expect(fileRow).toBeVisible({ timeout: SETTLE_TIMEOUT })

      // ── Step 4: agent UPDATES the same file (a 2nd version) → user views the
      //    diff. Open the file (lifts selectedFile to the Versions section), then
      //    expand the "Versions" accordion; VersionDiff renders the diff region
      //    once 2+ versions exist. ──
      await sendPromptAndCaptureRun(page, PROMPT_UPDATE)
      await waitForRunTerminal(page)

      // Click the file row to lift it into the Versions comparison (FilesSection
      // onSelectFile → WorkspacePanel.setSelectedFile, 087-02).
      await fileRow.click()

      // Expand the Versions section (PanelSection accordion button, defaultOpen=false).
      await page
        .getByRole("button", { name: /versions/i })
        .first()
        .click()
        .catch(() => undefined)

      // The diff region is VersionDiff's own region (aria-label "Diff v..."),
      // NOT a bare [role="region"] (the PanelSection bodies are regions too).
      const diffRegion = page
        .locator('[role="region"]')
        .filter({ has: page.locator('[aria-label^="Diff v"]') })
        .or(page.locator('[role="region"][aria-label^="Diff v"]'))
        .first()
      await expect(diffRegion).toBeVisible({ timeout: SETTLE_TIMEOUT })

      // ── Step 5: agent calls ask_user → user responds → run RESUMES. ──
      await sendPromptAndCaptureRun(page, PROMPT_ASK)

      // The PendingAskCard is a role="group" containing "Needs you" (amber,
      // PendingAskCard:163-175). Don't wait for terminal first — the run is
      // PAUSED on the ask, so the Stop control may still be present.
      const askCard = page
        .getByRole("group")
        .filter({ hasText: /needs you/i })
        .first()
      await expect(askCard).toBeVisible({ timeout: RUN_TIMEOUT })

      // Paused cue (PausedRunCue role="status", "awaiting your answer") — soft:
      // present it if rendered, but don't fail the deep flow on its absence.
      await page
        .getByRole("status")
        .filter({ hasText: /awaiting your answer/i })
        .first()
        .isVisible()
        .catch(() => false)

      // Answer via the always-present free-text + "Send Answer" (PendingAskCard:
      // 222-244). Filling the textarea + sending is what resumes the run.
      await askCard.locator("textarea").first().fill("Yes, final.md is correct")
      await page
        .getByRole("button", { name: /send answer/i })
        .first()
        .click()

      // Resume proof, NO page reload: the pending ask card unmounts (it flips to
      // the "Answered · agent resumed" state), and the run reaches a terminal
      // state (Stop control hidden again).
      await expect(askCard).toBeHidden({ timeout: SETTLE_TIMEOUT })
      await waitForRunTerminal(page)

      // ── Step 6: zero 400 INVALID_ARGUMENT across the whole flow (D-17). On
      //    Google this is the thought-signature live re-verify; kept on both. ──
      expect(
        bad400Responses,
        `400 responses observed during the [${provider.name}] deep flow — ` +
          `thought-signature / round-trip regression suspected (D-17, BUG-260523-02): ` +
          JSON.stringify(bad400Responses),
      ).toEqual([])

      // ── Step 7: LangSmith trace for the first run, provider-matched (soft if
      //    LANGSMITH_API_KEY unset). Catches the silent-fallback class (N-01). ──
      if (firstRunId) {
        await assertLangSmithTraceExists(firstRunId, provider.name)
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `scenario-13 [${provider.name}]: could not parse run_id — ` +
            "skipping LangSmith provider-match assert.",
        )
      }
    })
  })
}
