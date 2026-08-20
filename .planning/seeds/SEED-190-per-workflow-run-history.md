---
seed_id: SEED-190
title: A workflow has no run history — you cannot see a workflow's past runs from anywhere, and chat cannot tell a workflow run from a normal conversation
created: 2026-08-20
planted_during: Phase 200 run-surface re-port (operator, watching a run open from the chat thread list)
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-185 — the app has no URL router, so a run cannot be deep-linked and every route to one
    goes through a click path. Any history surface has to open a run the same way.
  - Phase 200 — built the run SURFACE (`WorkflowRunPage`). This is the missing DOOR to it.
  - `docs/HOT-FILE-LEDGER.md` → `frontend/src/pages/WorkflowsPage.tsx` / `library/WorkflowCard.tsx`
    — the card that would carry the affordance; both FIRE G-5.
trigger_when: >
  The next phase that touches the workflow library card, the run surface's entry points, or the
  chat thread list — whichever comes first. It is ALSO unblocked on its own: nothing about it
  depends on branching, connections or any other foundation.
---

## The complaint, in the operator's words

> *"since we have a card for each individual workflow we should have an option to view the run
> history of that specific workflow, because currently in the chat area I cannot distinguish
> between any regular chat or any workflow run. We should have one place to see, on workflow
> level, the history of the runs and view it."*

## Why it is real, and measured

**There is exactly one door to a run today, and it is in the wrong place.** `WorkflowRunPage`
is entered through `ChatLayout`'s `openRunSurface`, whose only production caller is the
workspace panel's run seam — i.e. **you must already be inside the run's chat thread** to open
its run page. To get there you pick a thread out of the chat history list.

⚠ **And that list does not mark them.** A workflow run creates an ordinary thread; in the
sidebar it sits among "New Chat" and "generate weekly report" with nothing to say it was a run.
Measured on the local database: **228 workflow runs**, every one of them anchored to a thread
that the chat list renders exactly like any other conversation.

⚠ **The library card knows a run happened and cannot show you it.** `db/workflows.py`'s library
feeds already carry a per-workflow `LEFT JOIN LATERAL … LIMIT 1` for the LAST run — which is
what paints *"Worked 2 min ago"* / *"Failed 5 days ago"* / *"Never run"* on the card
(`library/runFacts.ts`'s four arms). So the card states a fact about a run it offers no way to
open, and knows nothing about the run before it.

## What it would take

Smaller than it sounds, because the surface it opens already exists:

1. **A read**: runs for one definition — `workflow_runs` already carries `definition_id`,
   `status`, `created_at`, `updated_at`, and since migration 121 the per-step timings that make
   an honest duration derivable. ⚠ The existing lateral returns ONE run; this needs a list, and
   it must be **owner-scoped in the query** the way `get_workflow_run` is (these feeds bypass
   RLS — `db/workflows.py` records `r.user_id = $1` as security-bearing).
2. **A door on the card** — the natural place, and the one the operator named.
3. **A list surface** reusing what Phase 200 built: `runFacts.ts`'s arms for the outcome word,
   `phaseDuration`'s resolver for the duration, `relativeChanged.ts`'s nine bands for the age.
   Each row opens `WorkflowRunPage` through the callback that already exists.

## The traps this will hit, named now

- ⚠ **`versions`, not `version`.** A workflow's runs span its published versions, and
  `workflow_runs.definition_id` points at ONE version row. "This workflow's history" means
  every definition sharing the slug, not the current one — a naive `definition_id` filter shows
  the history of a *version* and calls it the workflow's.
- ⚠ **`never run` vs `not by you` is already a solved four-arm problem** (`runFacts.ts`, CR-01):
  the lateral is owner-scoped, so an empty list means *"no runs of yours"*, which is NOT
  *"never run"*. Re-deriving that distinction here would be the fifth time this repo gets it
  wrong.
- ⚠ **No URL router** (`SEED-185`), so this is a click path and cannot be linked or bookmarked.
- ⚠ **A run belongs to a thread, and deleting the workflow does not delete the thread**
  (`WorkflowDeleteSheet` says so: *"chat threads become normal chats"*). A history list must
  survive its workflow being deleted, or say honestly that it cannot.

## The adjacent half the operator also named

*"I cannot distinguish between any regular chat or any workflow run"* is a **separate, smaller
fix on the chat side**: the thread list has the information (`threads.active_workflow_run_id`,
and the run rows themselves) and spends none of it. Marking a workflow-run thread in the
sidebar is worth doing whether or not the history surface ships, and it is the cheaper half.
