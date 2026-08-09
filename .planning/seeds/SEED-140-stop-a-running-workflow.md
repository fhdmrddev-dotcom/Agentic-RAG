---
id: SEED-140
title: A user cannot stop a workflow mid-run — the run surface has no stop control, though an owned cancel endpoint and a `cancelled` status already exist
status: open
planted: 2026-08-08
planted_by: Operator, during the 189-16 owed-rows UAT (2026-08-08) — "first we should have a stop button or something to stop the workflow during execution"
surface: Agentic-RAG
severity: warning
category: product / run control + operator safety
priority: high
scope: Small-Medium (likely UI + a reuse of the existing cancel path; needs one investigation first — see below)
affected_areas: [frontend/workflow-run-surface, backend/runs, workflow-runs, harness-engine]
related_seeds: [SEED-139, SEED-141]
re_open_trigger: >
  Re-open when ANY of these is true: (1) any phase touches the workflow run surface header or its
  controls — add the stop there rather than returning a third time; (2) Phase 190 lands live egress,
  at which point "stop before it sends" stops being a convenience and becomes a safety control;
  (3) a run hangs in front of a user with no way out (the golden-run 7200 s hang recorded in Phase
  189 is the precedent — it was survivable only because no user was watching); (4) a business user
  asks how to cancel a run.
---

# SEED-140 — there is no way to stop a running workflow

## The observation (operator, 2026-08-08)

> "first we should have a stop button or something to stop the workflow during execution"

Confirmed on the live run surface during the 189-16 UAT. A workflow was launched and ran through
three phases; the surface's only controls throughout were:

```
["Workflows", "Open the chat thread", "⌥ Technical names"]
```

There is no stop, no cancel, no abort. Once launched, a run goes to completion, fails on its own, or
sits there.

## What already exists — this is probably not a from-scratch build

Two pieces are already in the tree, which is why this is scoped Small-Medium rather than larger:

1. **An owned cancel endpoint.** `backend/app/api/runs.py:1155` — `DELETE /{run_id}`, with a Step-1
   ownership SELECT and a 404-not-403 on a missing row. Its docblock names
   `_cancel_run_internals` as the **shared run-lifecycle cancel/zombie-heal writer**, "reused verbatim
   by the operator Kill path".
2. **A `cancelled` status already in the vocabulary.** `backend/app/api/workflow_runs.py:114`
   describes the status column as `active | paused | cap_paused | completed | failed | cancelled`.

⚠ **The one thing to check FIRST, and do not assume it:** whether that cancel path covers
`workflow_runs` or only chat/agent runs. `runs.py` and `workflow_runs.py` are different modules, and
this seed was planted from a UI observation, not from reading the cancel implementation. If it does
cover workflow runs, this is mostly a button plus a confirm. If it does not, the engine needs a
cooperative cancellation point between phases — a different size of job.

## Why it matters

- **Every governed workflow pauses at least once** (Phase 185/189). A user who decides "no, not this
  one" at a checkpoint can decline the step — but cannot end the run.
- **Phase 190 changes the stakes.** Today the external-action node records and sends nothing, so a
  runaway run is expensive at worst. Once live egress lands, "stop it before the next step sends" is
  a safety control, not a convenience.
- **The 7200 s precedent.** Phase 189's research found the armed checkpoint hung a golden run until
  it died at the 7200-second cap. That was survivable because no human was waiting. The same shape in
  front of a user, with no stop, is not.
- Operators already have a **Kill** in the Control Room (`ActiveRunsSection`). Users do not. A
  capability that exists for staff and not for the person whose run it is, is an odd asymmetry.

## Design questions worth settling before building

- **Stop vs pause.** Is this "abandon this run" (terminal `cancelled`) or "hold it here" (`paused`,
  resumable)? The status vocabulary already admits both, so the UI should not accidentally pick one
  by omission.
- **What happens to work already done?** A run stopped after phase 2 of 3 has real outputs. Does the
  deliverable survive as a partial, or does the run read as discarded? Run-honesty rules apply — a
  stopped run must not read as completed, and must not read as failed either (nothing went wrong).
  This is exactly the `recorded_not_sent` reasoning from D-07: a third outcome deserves its own word.
- **Where does the control live?** The run surface header is the obvious home, which is why this
  wants to be done with `BUG-260808-02` (approval hands off to chat) rather than separately — both
  are "what does the run surface own".
- **Guard level.** Per the graded action-guards rule, is stopping a direct flip, or does it name what
  it is discarding? Probably the former mid-run and the latter once egress exists.

## Suggested routing

Pair with **`BUG-260808-02`** and **`SEED-139`** in one workflow-surface phase — all three are the
same question about what the run surface owns versus chat. Sequencing before Phase 190 is worth
considering on the safety argument above.
