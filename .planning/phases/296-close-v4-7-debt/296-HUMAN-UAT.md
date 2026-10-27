---
status: pending
phase: 296-close-v4-7-debt
source: [296-UI-SPEC.md (G-4 lived scenarios), 296-CONTEXT.md D-20 / D-21, 296-05-PLAN.md Task 2-3]
started: 2026-10-27
updated: 2026-10-27
---

# Phase 296 — Human UAT (G-4 lived drive + the D-21 cross-provider board)

## Current state

- **(a) G-4 scenarios 1-8: IN PROGRESS 2026-10-27** — ALL EIGHT PASS (3 after a fix) (2 and 4 need fixtures rebuilt: 289's run A/B, its `s289-ev-*` workflows and both 289 colleague accounts are GONE from the local DB). Optional: 10 PASS, 11 PASS after fix.
  A row is PASS only with a screenshot or DOM/DB evidence path written beside it. A FAIL goes back to
  its owning 296 plan under G-7; it is never closed in the records.
- **(c) the D-21 roster board: DRIVEN by 296-05** (`scripts/run-296-board.py`). Verdicts and evidence
  paths are filled in below.
- **(e) the 287-V-3 cloud read: PASS by effect (2026-10-27). See (e).**

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
| 1 | Two-org create | Sign in as `fhdmrd@gmail.com`. If the account is in ONE org, first add it to a second local org (local SQL: `insert into org_members (org_id, user_id, role) values ('<a second org id>', '<user id>', 'member')`, and record that you did). Switch the org switcher to the SECOND org. Library → New folder `296 G4 two-org folder`. Workflows → New workflow → save a draft named `296 G4 two-org draft`. | **PASS** (2026-10-27) | Local org `296 G4 second org` (`29600000-…0001`, enterprise copied from org 1) + a `member` row for the dev user, ADDED for this row and REMOVED after it. Folder `296 G4 two-org folder` and draft `Cited Stakeholder Update` (`88e24c39…`) both carry `org_id = 29600000-…0001`: `evidence/g4/1-two-org-db.json`, `1-two-org-draft-just-drafted.jpg`. ⚠ Observation (not a 296 regression): the second org's Library and Workflows list the user's first-org folders and workflows, because the lists filter by owner, not by org |
| 2 | Colleague, step 1 withheld | Reuse 289's run **A** `a052667d-8b51-4ef5-9b92-5fd24ae7932f` (owner `fhdmrd@gmail.com`, org `22f9c615-…`, step 1 cites the owner's PRIVATE folder "Weekly reports"). Colleague: `s289r-colleague-b@example.test` (member of `22f9c615-…`); its password was never recorded, so set a fresh one through the LOCAL GoTrue admin API (service-role key from the env, never printed) and sign in as the colleague in a separate browser profile. Open Workflows → run log → run A. | **PASS** (2026-10-27) | 289's run A and both 289 colleagues no longer exist, so rebuilt: owner run `a0df3482…` (definition `b942f3c0…`, project folder = the owner's PRIVATE `Weekly reports` `2a33b3e3…`, step 1 llm_agent 29 citations, step 2 llm_single 0 citations). Colleague `s296-g4-colleague@example.test` (`4ec41a82…`) created through the LOCAL GoTrue admin API, `member` of `22f9c615…`; its password was random, used once, and deleted, never recorded. Its own signup org was named `My organization` (mig 216 / SEED-364 seen live). Colleague view: step 1 `This step's output draws on a document you don't have access to.`, step 2 `This step builds on an earlier step you don't have access to, so its output is withheld too.`, sources `A document you don't have access to`, `Weekly reports` 0 hits on the page (`evidence/g4/2-colleague.jpg`). Owner session restored afterwards (never signed out) |
| 3 | Followed run ends | As the owner, in a chat thread, start a published workflow whose KB step can find nothing in a scoped empty folder and choose "Continue without sources" (the 295-07 fixture `295-07 S1 found nothing` works), and KEEP the thread open, following the run to its end. | **PASS after fix** (2026-10-27; first drive FAIL) | First drive FAIL (`evidence/g4/3-followed-FAIL-no-answer.jpg`): the re-drive shell's stream `run:4d313e4c-…` ended at `run_completed` with no sentinel (TTL -1), so 296-04's onTerminal reconcile never ran (`evidence/g4/3-diagnosis.md`). Fixed (RED `2846a572d`, fix in the following commit: `_wake` finalize → sentinel → EXPIRE; the follow ends its segment on `run_completed`). Re-driven in a fresh thread, never left: the answer rendered and the panel read `Unsourced · continued by fhdmrd@gmail.com (you)` (`evidence/g4/3-followed-PASS-after-fix.jpg`) |
| 4 | Waiting run | Start a workflow whose step is a human ask (e.g. 289's `s289-ev-109449fd`, "Approve the note?") and let it wait past its timeout so it PAUSES. Watch the chat panel. Then restart uvicorn ONCE (the operator's backend) and look again. | **PASS** (2026-10-27) | Fixture planted 2026-10-27 (289's `s289-ev-109449fd` no longer exists): definition `b6df6f89…` (human ask `Approve the note?`, timeout 45 s, then an llm_single), thread `d1d89e51…`, run `95b8864b…`. Before the operator's uvicorn restart: run `paused`, 1 ask prompt, one card, `Waiting`, no `agent stopped`/`RETIRED` (`evidence/g4/4-waiting-before-restart.jpg`). After the restart AND a fresh page load: still `paused`, prompts still 1, one card reading `The answer window has passed. The run is paused and still waiting for your answer.`, no `agent stopped` (`4-waiting-after-restart.jpg`) |
| 5 | Schedule Run now | Workflows → a published workflow with a schedule (create one in the Schedule dialog if none; fill every required input) → press **Run now** on that schedule row. | **PASS** with a note (2026-10-27) | `evidence/g4/5-run-now.jpg`: `✓ Started. It runs in the background — open the run log to watch it.` on the pressed `293 weekly check` row. Note: while in flight the whole list read `Loading…`, not a spinner on the row; the row's `Last ran … · launch_failed` shows a raw status word |
| 6 | Team view | Open any draft with 3+ steps in the builder. Delete one step, then switch the canvas to **Team**. Press Ctrl+Z (⌘Z on macOS), then Ctrl+Y. Then switch back to **Steps**. | **PASS** (2026-10-27) | Draft `copy 2 214.1` (3 steps): deleted step 2 → Team → Ctrl+Z, Ctrl+Y: still 2 steps, no side panel (`evidence/g4/6-team-after-undo-redo.jpg`); back to Steps re-opened the panel (`6-back-to-steps-panel-reopens.jpg`). Draft restored to 3 steps with Undo (DB checked) |
| 7 | Report at 1536px, 4 buttons | Browser window 1536×864. Open a finished run's evidence report that shows FOUR action buttons (owner view of a run that produced a deliverable and has a thread, e.g. 289 run A as the owner). | **PASS** (2026-10-27) | Run `20f97ee5…` (Fill Vendor Intake Sheet, deliverable `vendor-intake.docx`) at viewport 1536 wide: title 1 line (top 101, bottom 133); Download JSON / Print / Open the chat thread / Download the deliverable all on one row at top 201. `evidence/g4/7-report-1536.jpg`. 289 run A no longer exists locally (see the fixture note) |
| 8 | Follow-up chat turn | New chat thread: "Make a PDF with 3 charts about quarterly revenue." Wait for it to finish. Then: "Change the title to Q4 Review." | **PASS** (2026-10-27) | Thread `3586b900…`: turn 1 wrote c1-c3.png + quarterly-revenue-charts.pdf. Turn 2 (`Change the title to Q4 Review.`): its first execute_code failed (the PNGs were gone from the new sandbox), its second rebuilt all four — so the turn-2 card's four files are ALL files that turn wrote (`output_files` of that call). `evidence/g4/8-followup.jpg`. The PNGs beside the PDF are SEED-383 policy. ⚠ Observation: the Workspace panel read `FILES 0 · No files yet` in this thread while both turns produced files |

### Optional rows (user-visible 296 fixes no D-20 scenario covers)

Each of these closes its bug report only on a PASS here; without one the report stays `folded` with
its trigger, never closed blind.

| # | Row | Setup | Pass looks like | Verdict | Evidence |
|---|---|---|---|---|---|
| 9 | BUG-261021-05 escalated seal | Builder: an `llm_agent` step with NO knowledge-base tool; set it to "must prove it" by hand. | **PASS** (2026-10-27) | Draft `copy 2 214.1`, step `survey-library` (llm_agent; tools: find files by name / list a folder's files / folder tree; NO `search_documents`) set to `⛨ Must prove it` by hand: the step reads `Marked to prove its sources, but this step can't search your documents, so nothing is checked when it runs.`; `Checks that run on this step: No checks apply to this step yet` (no locked citations gate); no corner seal on the node (zoomed). `evidence/g4/9-escalated-seal.jpg`. Set back to `Free to think` after. SeedReceipt not applicable (not a freshly seeded draft) |
| 10 | BUG-261024-02 draft kept | Workflows → describe a workflow → let it generate → leave the builder WITHOUT touching anything → come back. | **PASS** (2026-10-27) | Draft `Cited Stakeholder Update` generated, builder left untouched, found in the library and reopened with its 2 steps: `evidence/g4/10-draft-kept-reopened.jpg` |
| 11 | 287-V-4 (folded) | In a chat thread, press Run a workflow, pick one with a REQUIRED input, leave it empty, press Run. | **PASS after fix** (2026-10-27; first drive PARTIAL) | First drive: the refusal sat ~2,000 px below 13 fields (`evidence/g4/11-required-*.jpg`). Fixed by the review-warnings merge (`a04c6d759`: scroll the refusal into view on every refused press; RunModal too). Re-driven: pressed Run with all fields empty → the dialog scrolled (scrollTop 2057) and the sentence sat fully inside the scroller (419-545 of 86-546); typing one character cleared it |
| 12 | 287-V-5 (folded, optional long-message) | A thread with ≥ 50 prior messages: start a workflow in-thread. | **FAIL** (2026-10-27) — new defect, not a regression | Thread `261d5f57…` (78 messages): `293 board: deepseek` started (run `d4a47302…` completed, answer row persisted 4 s later) but the open thread showed no card and no answer; the same in a SHORT thread (`14555c45…`), so it is not about length. The status line `1 phase done… · Step 1 of 1 · 1m 57s` shows at ~2 s, then vanishes; re-entering the thread renders the answer. BISECTED: same on the pre-session StreamsProvider (`07e2e4ba8`), so pre-existing. A FRESH in-thread kickoff's sibling of BUG-261021-04 (that report is the after-an-answer case). `evidence/g4/12-long-thread-no-card.jpg`; diagnosis → `evidence/g4/12-diagnosis.md` |

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
| 287-V-3 | orchestrator | `select version from supabase_migrations.schema_migrations where version like '210%';` | one row | **PASS by effect (2026-10-27).** The planned read returned 0 rows, and that read is the wrong instrument: SQL-editor pastes never write `schema_migrations` (29 rows, latest `20261024044839`, none numbered 2xx). Read instead: `select id, slug, version, status, is_system_global from public.workflow_definitions where id in ('…0210a1','…0210a2','…0210a3')`. It returned all 3 seeded starters (`meeting-notes-to-actions`, `policy-change-impact`, `stakeholder-update`), each v1, `published`, `is_system_global = true`. |
