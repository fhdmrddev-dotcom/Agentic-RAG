---
seed_id: SEED-190
title: A run has no door except its own chat thread — there is nowhere to see the runs, and chat cannot tell a workflow run from a conversation
created: 2026-08-20
planted_during: Phase 200 run-surface re-port (operator, watching a run open from the chat thread list)
status: shipped-in-part
shipped: 2026-08-20
surface: Agentic-RAG
relates_to:
  - SEED-185 — the app has no URL router, so a run cannot be deep-linked and every route to one
    goes through a click path. The log opens a run the same way.
  - Phase 200 — built the run SURFACE (`WorkflowRunPage`). This was the missing DOOR to it.
  - `docs/HOT-FILE-LEDGER.md` → `frontend/src/pages/WorkflowsPage.tsx` /
    `library/WorkflowCard.tsx` / `frontend/src/lib/api.ts` — the three hot files the shipped
    half touched; all three FIRE G-5.
trigger_when: >
  ⚠ THE FIRST HALF SHIPPED 2026-08-20 (`GET /workflow-runs` + the run log surface + two
  doors). What remains is the SECOND half named at the foot of this file — marking a
  workflow-run thread in the chat sidebar — which is unblocked, cheap, and where the
  operator's complaint actually started. Re-open on the next phase that touches the chat
  thread list, `ThreadRunLine.tsx`, or `threads.active_workflow_run_id`.
---

## The complaint, in the operator's words

> *"since we have a card for each individual workflow we should have an option to view the run
> history of that specific workflow, because currently in the chat area I cannot distinguish
> between any regular chat or any workflow run. We should have one place to see, on workflow
> level, the history of the runs and view it."*

## ⚠ THE SCOPE WAS WRONG WHEN THIS WAS PLANTED, AND THE CORRECTION IS THE POINT

This seed was planted as **a per-workflow history**, reachable from a workflow card. When it
came to be built the operator corrected it to **one log of every run**, which the card's door
then filters. The original framing is kept above rather than rewritten, because the reason it
was wrong is reusable:

**A per-workflow list answers the complaint only if you already know which workflow to look
inside.** The sentence underneath the request is *"in the chat area I cannot distinguish
between any regular chat or any workflow run"* — that is a question about **all** runs, asked
by somebody who has lost one. Scoping the answer to a workflow they would have to name first
returns them to the problem.

The seed also read the operator's own words too literally: *"on workflow level"* describes
where the DOOR is, not what is behind it. A card-level door onto a filtered view of one log is
both things at once; a card-level door onto a per-card surface is only the smaller one.

## What shipped, 2026-08-20

| Piece | Where |
|---|---|
| `GET /workflow-runs` — owner-scoped list, optional `?slug=`, `limit`/`offset`, `count=exact` | `backend/app/api/workflow_runs.py` |
| The path registered in the canvas gate (same commit) | `backend/app/middleware/canvas_gate.py` |
| `listWorkflowRuns` + `WorkflowRunListItem` | `frontend/src/lib/api.ts` |
| The log surface | `frontend/src/components/workflows/history/RunLogPanel.tsx` |
| Its wire→facts resolver, its strings, its tone mirror | `history/runLogRow.ts` · `runLogVocabulary.ts` · `runLogTone.ts` |
| Door 1 — the whole log, from the Workflows header | `frontend/src/pages/WorkflowsPage.tsx` |
| Door 2 — one workflow's runs, from the card's `⋯` | `library/WorkflowCard.tsx` |

**Nothing was re-derived.** The outcome word is `library/runFacts.ts`' — the same sentence the
card prints about the same run, asserted by comparison rather than by a copied literal. The age
bands are `relativeChanged.ts`'. The duration is `phaseDuration.runSpan`'s, fed the same
`min(started_at) → max(completed_at)` pair the backend pre-reduces, so the log and the run page
cannot disagree about how long a run took.

## The traps, and what each one turned out to be

- ✅ **`versions`, not `version`.** Confirmed live, not merely anticipated: filtering
  `pm-weekly-status-report` returns **21 runs across 3 definition rows**. The wire takes a
  **slug** and resolves every definition sharing it. A `definition_id` filter would have shown
  a version's history under the workflow's name.
- ✅ **An unknown slug must be an EMPTY log, not an unfiltered one.** The route early-returns
  on zero resolved ids. Without it the `in` filter is skipped and the caller is handed every
  run under the name of a workflow that does not exist — the failure a `if ids:` guard invites.
- ✅ **`never run` vs `not by you`** — sidestepped rather than re-derived. Every row of the log
  IS a run of the caller's, so only `runFacts`' `ran` and `unknown` arms are reachable and the
  four-arm problem does not arise a fifth time.
- ✅ **A run survives its workflow.** Deleting a workflow does not delete its runs; the row
  renders as *"Deleted workflow"* and stays openable. Asserted at both tiers.
- ✅ **The span is the PHASES', never the run row's.** `created_at` is when the row was
  inserted. Measured: **10 of 580** phase rows carry both instants (migration 121, no
  backfill), so most rows honestly read *"time not recorded"* — and never `0s`.
- ⚠ **No URL router** (`SEED-185`), so this is a click path: the log cannot be linked or
  bookmarked, and a browser reload returns to Chat. Unchanged, and recorded rather than
  worked around.

## ⚠ WHAT DID **NOT** SHIP — the half the complaint actually started with

> *"in the chat area I cannot distinguish between any regular chat or any workflow run"*

**Still true.** A workflow run creates an ordinary thread and the sidebar renders it exactly
like a conversation. Measured: **230 runs, 226 threads, none of them marked.** The information
is already there — `threads.active_workflow_run_id`, and the run rows themselves — and the
thread list spends none of it.

This is the cheaper half and it is now the *only* remaining half. It is also strictly better
than the log at the specific thing the operator described, because it fixes the surface they
were looking at when they said it.

## Two smaller things noticed while building this, neither taken

1. **No index on `workflow_runs.definition_id`.** 230 rows today; the recorded re-open trigger
   for every unindexed read in this area is ~10k runs. `_LAST_RUN_LATERAL_SQL`'s docblock says
   the same thing about the same column.
2. **The log has no filter of its own** — no outcome chip, no date range, no search. At 230
   rows with a 50-row page that is livable; it is the first thing to want at 1,000.
