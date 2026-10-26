---
status: pending
phase: 296-close-v4-7-debt
source: [296-UI-SPEC.md (G-4 lived scenarios), 296-CONTEXT.md D-20 / D-21, 296-05-PLAN.md Task 2-3]
started: 2026-10-27
updated: 2026-10-27
---

# Phase 296 — Human UAT (G-4 lived drive + the D-21 cross-provider board)

## Current state

- **(a) G-4 scenarios 1-8: PENDING — the orchestrator drives them in Chrome** (executors have no browser).
  A row is PASS only with a screenshot or DOM/DB evidence path written beside it. A FAIL goes back to
  its owning 296 plan under G-7; it is never closed in the records.
- **(c) the D-21 roster board: DRIVEN by 296-05** (`scripts/run-296-board.py`). Verdicts and evidence
  paths are filled in below.
- **(e) the 287-V-3 cloud read: PENDING — orchestrator, Supabase MCP, READ ONLY.**

## Before you start (every scenario)

- Local app: frontend `http://localhost:5173` (`/app`), backend `:8000` (the main checkout, develop at
  `a3cac42da`, which carries every 296 fix). The app has no URL router: a reload lands on home, so
  reopen a thread from the chat list.
- ⚠ **Check the active org first** (memory: the dev account `fhdmrd@gmail.com` can be in TWO orgs).
  Read it from the org switcher and confirm it in the DB:
  `select org_id from org_members where user_id = (select id from auth.users where email = 'fhdmrd@gmail.com');`
- The board's own fixtures were deleted after the drive (`evidence/roster/cleanup.json`); nothing named
  `296 board …` should remain. Fixtures the scenarios below need are named in each row.

## (a) G-4 lived scenarios — D-20, UI-SPEC "Pass looks like" verbatim

| # | Scenario | Setup (exact) | Pass looks like (UI-SPEC, verbatim) | Verdict | Evidence |
|---|---|---|---|---|---|
| 1 | Two-org create | Sign in as `fhdmrd@gmail.com`. If the account is in ONE org, first add it to a second local org (local SQL: `insert into org_members (org_id, user_id, role) values ('<a second org id>', '<user id>', 'member')`, and record that you did). Switch the org switcher to the SECOND org. Library → New folder `296 G4 two-org folder`. Workflows → New workflow → save a draft named `296 G4 two-org draft`. | Folder + workflow appear in the second org (no UI copy change) | | DB: `select org_id from folders where name = '296 G4 two-org folder'` and `select org_id from workflow_definitions where name = '296 G4 two-org draft'` both equal the switcher's org (= the `X-Org-Id` header in DevTools) |
| 2 | Colleague, step 1 withheld | Reuse 289's run **A** `a052667d-8b51-4ef5-9b92-5fd24ae7932f` (owner `fhdmrd@gmail.com`, org `22f9c615-…`, step 1 cites the owner's PRIVATE folder "Weekly reports"). Colleague: `s289r-colleague-b@example.test` (member of `22f9c615-…`); its password was never recorded, so set a fresh one through the LOCAL GoTrue admin API (service-role key from the env, never printed) and sign in as the colleague in a separate browser profile. Open Workflows → run log → run A. | Step 2 reads `This step builds on an earlier step you don't have access to, so its output is withheld too.` | | screenshot `evidence/g4/2-colleague.png`; DOM text of step 2 |
| 3 | Followed run ends | As the owner, in a chat thread, start a published workflow whose KB step can find nothing in a scoped empty folder and choose "Continue without sources" (the 295-07 fixture `295-07 S1 found nothing` works), and KEEP the thread open, following the run to its end. | Final answer + `◌ Unsourced` visible with no reopen | | screenshot `evidence/g4/3-followed.png`; no thread switch between the answer and the shot |
| 4 | Waiting run | Start a workflow whose step is a human ask (e.g. 289's `s289-ev-109449fd`, "Approve the note?") and let it wait past its timeout so it PAUSES. Watch the chat panel. Then restart uvicorn ONCE (the operator's backend) and look again. | One live ask card; panel step reads `! Waiting`; no `agent stopped` | | screenshot before AND after the restart (`evidence/g4/4-waiting-*.png`); DB: `select count(*) from messages where thread_id = '<thread>' and tool_calls @> '[{"kind":"ask_user_prompt"}]'` unchanged across the restart |
| 5 | Schedule Run now | Workflows → a published workflow with a schedule (create one in the Schedule dialog if none; fill every required input) → press **Run now** on that schedule row. | Spinner on the row, then `✓ Started. It runs in the background — open the run log to watch it.` on that row | | screenshot `evidence/g4/5-run-now.png` (the result line is on the pressed row, not a banner) |
| 6 | Team view | Open any draft with 3+ steps in the builder. Delete one step, then switch the canvas to **Team**. Press Ctrl+Z (⌘Z on macOS), then Ctrl+Y. Then switch back to **Steps**. | ⌘Z does nothing; no side panel; back to Steps re-opens it | | screenshot `evidence/g4/6-team.png`; step count unchanged by the keys while Team shows |
| 7 | Report at 1536px, 4 buttons | Browser window 1536×864. Open a finished run's evidence report that shows FOUR action buttons (owner view of a run that produced a deliverable and has a thread, e.g. 289 run A as the owner). | Title on ≤ 2 lines; buttons on their own row | | screenshot `evidence/g4/7-report-1536.png`; title `getClientRects().length` ≤ 2 |
| 8 | Follow-up chat turn | New chat thread: "Make a PDF with 3 charts about quarterly revenue." Wait for it to finish. Then: "Change the title to Q4 Review." | Only that turn's file cards | | screenshot `evidence/g4/8-followup.png`; the second turn's cards list only files that turn produced (a regenerated PDF; not the first turn's unchanged files). The chart PNGs beside the PDF are the SEED-383 policy question, not a FAIL |

### Optional rows (user-visible 296 fixes no D-20 scenario covers)

Each of these closes its bug report only on a PASS here; without one the report stays `folded` with
its trigger, never closed blind.

| # | Row | Setup | Pass looks like | Verdict | Evidence |
|---|---|---|---|---|---|
| 9 | BUG-261021-05 escalated seal | Builder: an `llm_agent` step with NO knowledge-base tool; set it to "must prove it" by hand. | No corner seal on the node, no locked citations gate row; the step says `Marked to prove its sources, but this step can't search your documents, so nothing is checked when it runs.` (Also look at the SeedReceipt: it may still list the step with its shipped reason "it was set to must prove it by hand" — 296-07 flagged it; record what it says.) | | |
| 10 | BUG-261024-02 draft kept | Workflows → describe a workflow → let it generate → leave the builder WITHOUT touching anything → come back. | The generated draft is in the library and opens with its steps | | |
| 11 | 287-V-4 (folded) | In a chat thread, press Run a workflow, pick one with a REQUIRED input, leave it empty, press Run. | `<Field label> is required` appears, nothing starts (and it clears as you type, 287-IN-01) | | |
| 12 | 287-V-5 (folded, optional long-message) | A thread with ≥ 50 prior messages: start a workflow in-thread. | The run starts and its card appears in that thread | | |

## (c) D-21 cross-provider roster board

Roster: derived by `scripts/run-296-board.py --roster` from the effective registry (`MODEL_CAPABILITIES`
overlaid by `model_capabilities_overrides`, newest registry-backed id per provider; OpenRouter forced to
a registry-backed `deepseek/*` id) — 8 rows, 7 natives + OpenRouter
(`evidence/roster/roster.txt`). Per-request `model` + `provider` on `POST /threads/{id}/messages`; no
global setting was changed. OpenRouter and Moonshot were PROBED live first (`evidence/roster/probe.json`).

⚠ **The live :8000 backend predates the 296-06 merge.** Its `/openapi.json` carries 296-02's
`ScheduleTriggerResult.outcome` but none of 296-06's `AutoAnsweredNote` / `needs_task` /
`unplaced_sentences`, which the main checkout's source has; no workflow run it started carries
`metadata.provider` (0 rows ever). Rows that exercise 296-06 code are marked **re-run after restart**.

| Provider (roster model) | 291-S6-F8 first step names `Lisbon` | 293-F-4 emit pinned to `gpt-5.6-luna` | 293-F-4 emit pinned to `deepseek-v4-pro` | SEED-362 resume on the starting model | multi-tool axis + 292.1 markup scan |
|---|---|---|---|---|---|
| openai `gpt-5.6-luna` | **PASS** `first-step-openai.json` | n/a (own provider; control unpinned **PASS** `pinned-emit-control-openai.json`) | **PASS** `pinned-emit-openai.json` | re-run after restart | **PASS** `multi-tool-openai.json` (markup 0) |
| anthropic `claude-opus-5-5` | **PASS** `first-step-anthropic.json` | **FAIL** `pinned-emit-anthropic.json` (OpenAI 400, see below) | **PASS** `pinned-emit-pin-deepseek-anthropic.json` | re-run after restart | **PASS** `multi-tool-anthropic.json` |
| google `gemini-3.8-flash` | **PASS** `first-step-google.json` | **FAIL** `pinned-emit-google.json` | **PASS** `pinned-emit-pin-deepseek-google.json` | mechanics PASS (pause → answer 200 → re-drive → completed) but **FAIL** on the record: `metadata.provider` null — the stale backend (`resume-model-google.json`); re-run after restart | **PASS** `multi-tool-google.json` |
| deepseek `deepseek-v4-pro` | **PASS** `first-step-deepseek.json` | **FAIL** `pinned-emit-deepseek.json` | n/a (own provider; control unpinned **PASS** `pinned-emit-control-deepseek.json`) | re-run after restart | **PASS** `multi-tool-deepseek.json` (DeepSeek first, markup 0) |
| zhipu `glm-5.3-flash` | **PASS** `first-step-zhipu.json` | **FAIL** `pinned-emit-zhipu.json` | **PASS** `pinned-emit-pin-deepseek-zhipu.json` | re-run after restart | **PASS** `multi-tool-zhipu.json` |
| minimax `MiniMax-M3` | **PASS** `first-step-minimax.json` | **FAIL** `pinned-emit-minimax.json` | **PASS** `pinned-emit-pin-deepseek-minimax.json` | re-run after restart | **PASS** `multi-tool-minimax.json` |
| moonshot `kimi-k3.1-pro-highspeed` | ⛔ account suspended for insufficient balance — live 429 (`probe.json`), BUG-261024-01 | ⛔ same | ⛔ same | ⛔ same (`resume-model-moonshot.json`) | ⛔ same |
| openrouter `deepseek/deepseek-v4-pro` | ⛔ 402 insufficient credit — live probe (`probe.json`), BUG-261024-03 | ⛔ same (`pinned-emit-openrouter.json`) | ⛔ same | ⛔ same (`resume-model-openrouter.json`) | ⛔ same |

**293-F-4 reading (`evidence/roster/pinned-emit-diagnosis.json`):** the emit step DOES go to the pinned
model's provider (every failed row's `emit_failed` audit names `openai` / `gpt-5.6-luna`, with the
OpenAI key injected). OpenAI then answers 400 `Function tools with reasoning_effort are not supported
for gpt-5.6-luna in /v1/chat/completions` on all three rungs, because the API surface is resolved under
the RUN provider's settings. Reproduced on 296-06 worktree code by one direct `forced_emit` shot (run
settings on DeepSeek → 400; on OpenAI → emits). A pin to a chat-completions model passes from every
run provider. **Not closed; a G-7 routing decision for the orchestrator.**

**BUG-261024-01 (Moonshot emit schema):** unit-proven (`test_296_moonshot_schema.py`); the live row is
⛔ until the account is reinstated.

Every board thread and definition was deleted afterwards: `evidence/roster/cleanup.json`
(`threads 33 · left 0`, `definitions 22 · left 0`). No evidence file contains `Bearer ` or `sk-`;
provider error bodies have `org-…` / `ak-…` ids redacted.

## (d) The four axes

| Axis | Row | Verdict | Evidence |
|---|---|---|---|
| Cross-provider | the board above: 7 natives + OpenRouter, 6 reachable, 2 ⛔ with reasons | first-step 6/6 PASS · multi-tool 6/6 PASS · pinned emit: chat-completions pins 5/5 PASS, `gpt-5.6-luna` pins 5/5 FAIL (⚠ routed) · resume re-run owed | `evidence/roster/` |
| Multi-tool | `search_documents` then `execute_code` in one prompt, per provider | **PASS** 6/6 (both tools ran, 0 markup hits by the shipped `detect_markup`) | `multi-tool-*.json` |
| Parallel-thread | thread A streaming (`runs.status = streaming` when B was sent) while thread B accepts a prompt, google | **PASS** (B 201; both completed, each in its own thread) | `parallel-google.json` |
| Long-message | a 6,606-byte prompt (the 273 CSV with notes), deepseek | **PASS** (completed, answer non-empty) | `long-deepseek.json` |

## (e) Cloud read — 287-V-3 (migration 210 in cloud)

| Row | Who | Exact read (Supabase MCP `execute_sql`, READ ONLY, no approval needed) | Pass looks like | Result |
|---|---|---|---|---|
| 287-V-3 | orchestrator | `select version from supabase_migrations.schema_migrations where version like '210%';` | one row | |
