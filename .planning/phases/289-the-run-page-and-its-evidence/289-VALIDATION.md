# Phase 289 Validation: G-4 scenarios and the SC#10 four-axis scoreboard

**Authored:** 2026-10-19 at planning (rows defined now, per D-15 and G-4: failure scenarios fixed at scope time, not post-hoc).
**Driven:** owed — plan 289-05 fills every row below against the live local stack (backend :8000 on the merged `develop`, vite :5173, local Supabase).
**Driver:** to be recorded by 289-05 (claude-in-chrome on a visible tab, or headless Chromium through `frontend/node_modules/playwright`, as 288 did).
**Org:** to be proven first by 289-05 (`org_members` read for the dev account; memory `reference_dev_account_is_in_two_orgs`).
**DB discipline:** local DB only, under the local-DB lock; created ids snapshotted and deleted afterwards; no Supabase MCP write.

Verdict vocabulary: `PASS`, `FAIL` (with what was seen), `BLOCKED` (with the reason and an issue id). A row is never dropped and never left reading `owed` at phase close unless the close is recorded as `human_needed` with the row to run first.

## Fixture (planted by 289-05)

One published workflow with three steps:
1. a KB step: `llm_agent` whose tools include `search_documents`, over a folder that has documents (so it produces a confidence line);
2. a non-KB step: `llm_agent` with no retrieval tool (so it must show nothing);
3. a pause step: `llm_human_input`, `timeout_seconds` 30 (so the window can pass inside a drive).

If the publish judge blocks it (SEED-360 F-2, deferred), it is planted through the local DB and that is said here.

## G-4 scenarios (D-15)

| # | Scenario | The failure the operator would recognise | Verdict |
|---|---|---|---|
| S5 | Let a pause window pass, answer from the card, the run completes; reload reads completed | The card says "agent stopped" or offers no answer; the run sits `active` after the answer; the log shows `re-drive failed` | owed |
| S1 | Finished run with a KB and a non-KB step opens as the report: four sections, snapshot version, KB step shows confidence, the other shows none | The live spine still shows; a section is missing; the non-KB step shows any confidence chip; the version shown is the current one | owed |
| S2 | Edit the workflow after the run, reopen: still the run's version, banner says it changed | The page shows the edited definition, or no banner | owed |
| S3 | Export, compare the export's four sections to the page | The JSON omits the sources, or differs from what the page shows | owed |
| S4 | Another-org user refused (404) for page and export; same-org non-owner reads it with no write controls and no owner email | The outsider sees anything about the run, or a 403; the colleague sees an email, "(you)", a Cancel/Answer control, or a private document name | owed |

S5 runs FIRST: it gates the D-13 sentence restore in `compose_waiting_on`.

### S5 (a paused run that is answered resumes)

Steps: start a run; wait for `workflow_runs.status = 'paused'`; on the run page confirm the card shows the paused line and the Send control, and no "agent stopped"; answer from the card; wait; reload.
Evidence to record: card DOM text before answering; the run's final status from the DB after reload; grep of `backend/logs/backend.<pid>.log` for the run id with `re-drive failed` / `re-drive skipped` / `paused re-drive raised` (expected 0), placed beside the base capture in `289-01-SUMMARY.md` (D-11 before/after); the model the resumed segment ran on.
Verdict: owed.

### S1 (the four sections, the snapshot, confidence only where the KB was used)

Evidence to record: the report's four section headings and their row texts; the version label versus the run's `definition_snapshot` version; the KB step's evidence line text exactly; `step-evidence-line` count on the non-KB row (expected 0); and, on a second live run, the spine card's line under the finished KB step (SC#4 run-surface arm).
Verdict: owed.

### S2 (edited since the run)

Evidence to record: the new version (or the edited draft) in the DB; the banner text naming both versions; the step list still matching the snapshot.
Verdict: owed.

### S3 (export matches the page)

Evidence to record: the downloaded file name; for each of `definition`, `phase_log`, `verdicts`, `sources`, the comparison against the page's section text (members equal).
Verdict: owed.

### S4 (another org refused; same-org colleague read-only)

Setup: user B in a NEW local org; user C added to the dev account's org; `visual_workflow_canvas` proven ON for both (Pitfall 2: a canvas 404 looks like an org 404).
Evidence to record: B's page shows "This run isn't available"; B's evidence response body and a random uuid's body, verbatim, stated byte-identical; C's report text; C's button set (expected: Download JSON, Print / save as PDF only); a grep of C's raw response for the owner email (expected 0); masked rows for documents C cannot read (R-01); the human-input step reading "Waited for an answer · answered" with no question or answer text (R-04); C's POST to the run's answer and cancel routes refused.
Accepted risk, observed live (T-289-31, plan 03, W3b): C DOES receive the `output_text` of the non-human steps (and `definition.full` and verdict `checked`, T-289-18). This is by decision, not by accident: the step output is the run's record and the page's purpose, and the owner ran it inside the org. Record the first 80 characters of one such output from C's raw response so the acceptance is seen, not assumed. It is a PASS condition, not a failure; a non-human step output being ABSENT for C would be the surprise to report.
KB label (W3a, R-01 extended): record the label C sees on the KB step's evidence line beside the owner's. Expected: the folder's name only when C can read that folder under RLS, otherwise "the knowledge base". C seeing the owner's private folder name is a FAIL.
Verdict: owed.

## Four-axis scoreboard (D-17, CLAUDE.md SC#10)

**Method:** each row is a real run of the fixture workflow with a per-request `model` + `provider` (the 288 method), scored from `workflow_runs` / `workflow_phases` / `harness_audit` plus the evidence read; no global setting is changed. **Roster derived from `MODEL_CAPABILITIES`** at planning (2026-10-19): providers openai, anthropic, google, deepseek, zhipu, minimax, moonshot, plus openrouter. 289-05 re-derives it and picks the newest registry-backed id per provider.

Per-row checks: (a) KB step `confidence.level` present; (b) non-KB step `confidence` null; (c) the paused-then-answered run reaches `completed`; (d) the resumed segment's actual model (research: `_build_resume_context` uses the owner's default model, a known unfixed divergence).

| Row | Provider / axis | Model id | (a) KB confidence | (b) non-KB none | (c) completes after answer | (d) resumed-segment model | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | OpenAI | owed | owed | owed | owed | owed | owed |
| 2 | Anthropic (native SDK; billing-blocked at 288 — RE-TEST, record the response) | owed | owed | owed | owed | owed | owed |
| 3 | Google | owed | owed | owed | owed | owed | owed |
| 4 | DeepSeek | owed | owed | owed | owed | owed | owed |
| 5 | Zhipu / GLM | owed | owed | owed | owed | owed | owed |
| 6 | MiniMax | owed | owed | owed | owed | owed | owed |
| 7 | Moonshot / Kimi (emit_tier coerce) | owed | owed | owed | owed | owed | owed |
| 8 | OpenRouter (non-native tool path) | owed | owed | owed | owed | owed | owed |
| M | Multi-tool: the KB step's prompt drives `search_documents` + `execute_code` in one step | owed | owed | owed | owed | owed | owed |
| P | Parallel thread: thread A's run paused while thread B runs a second workflow; the card and waiting-on belong to A only; B completes | owed | owed | owed | owed | owed | owed |
| L | Long message: a kickoff of 5 KB or more | owed | owed | owed | owed | owed | owed |

## Known gaps carried in (not failures of this phase; recorded so they are not mistaken for one)

- The chat panel's `PendingAskStack` has no run status, so its card stays countdown-driven for a paused workflow run (research Open Q4); the run page is the surface D-13 fixes. Decided at plan revision by reading the code, not assumed: the stack's only run signals are the thread lock and the phases (`PendingAskCard.tsx:828-830`); the lock has no status field (`streamsStore.ts:98-144`), `reconcilePhases` discards the wire's `run_status` (`StreamsProvider.tsx:4640-4641`), and a paused human step reads `running` (`phaseState.ts:61`). Deriving it needs a new store field or fetch on G-5 FIRING files, so plan 05 plants it as a seed. Full evidence: `289-01-SUMMARY.md` `## Named gap: PendingAskStack`.
- A resumed segment runs on the owner's default model, not the run's per-request model (research "Not fixed"); row (d) records it.
- The run-level confidence on the final chat message uses default buckets (research F3); per-phase confidence uses the owner's buckets, like chat.
- SEED-360 F-2 (judge blocks the planted pause workflow) and F-4 (`auto_answered` note unmounts with the gauntlet) are deferred.

## Cleanup

To be recorded by 289-05: ids created, ids deleted, row counts before and after.
