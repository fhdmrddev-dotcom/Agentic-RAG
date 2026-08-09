---
id: SEED-139
title: Workflow-run threads are indistinguishable from chats — 27% of the thread list has no type, because the only marker is a liveness pointer that clears on completion
status: open
planted: 2026-08-06
planted_by: Phase 188.1 operator UAT (2026-08-06) — operator noticed the folder chip on run threads and asked whether chat still carries workflow runs at all
surface: Agentic-RAG
severity: warning
category: product / thread taxonomy + chat-list information design
priority: high
scope: Small-Medium (list query + shared type + row treatment; NO migration required)
affected_areas: [chat-list, threads, workflow-runs, information-architecture, terminology]
related_seeds: [SEED-136, SEED-123]
re_open_trigger: >
  Re-open when ANY of these is true: (1) any phase proposes touching the thread-list row,
  its folder chip, or the thread-list query — do the type question FIRST, do not restyle a
  row that cannot say what it is; (2) a business user (not the operator) is asked to find a
  past chat in an account that has run workflows, and picks a run thread by mistake; (3) the
  run:chat ratio passes ~1:2 on any real account (it is 193:518 = 1:2.7 on the operator's
  account as of 2026-08-06, and rises with every run); (4) any phase adds a THIRD thread
  provenance beyond chat / workflow-run / eval — the absence of a type field becomes a
  three-way ambiguity rather than a two-way one; (5) the "launching a workflow redirects
  into Chat" behaviour is revisited (see project_workflow_runs_leak_into_chat).
---

# SEED-139 — the chat list cannot say what a thread is

## The observation (operator, 2026-08-06, during 188.1's operator UAT)

> "in the chat panel I see unfiled and folder icon sometimes, if we will still show
> workflows runs also in the chat, we should be able to know each chat type or are we
> discarding the workflows completely from chat?"

The question is the finding. The operator — who built this system — could not tell from the
chat list whether workflow runs still belong there. If the author cannot infer the rule, the
list is not expressing one.

## Measured, not assumed (local DB, 2026-08-06)

| Fact | Value |
|---|---|
| Total threads | **711** |
| Threads that are workflow runs (`workflow_runs.thread_id` distinct) | **193 (27%)** |
| Run threads currently distinguishable in any way | **3** |
| Threads flagged `is_eval` | 218 |

Workflow runs are not a side-channel. They are **more than a quarter of the thread list**,
and launching a workflow redirects the user *into* Chat, so the list is where they land.

## Why the distinction is missing — the column exists but means something else

`threads.active_workflow_run_id` looks like the answer and is not. It is a **liveness
pointer**, cleared when the run reaches a terminal state:

| Run status | Threads | Still carrying `active_workflow_run_id` |
|---|---|---|
| active | 3 | **3** |
| completed | 166 | **0** |
| failed | 28 | **0** |

So the marker exists for the minutes a run executes and then vanishes permanently.
**190 of 193 run threads are indistinguishable from a chat the user typed.**

The frontend `Thread` type carries neither `active_workflow_run_id` nor `is_eval`, so the
list has no type information to render even during the window when the data exists.

Downstream symptom the operator actually saw: every row shows a folder chip
("Unfiled" + folder icon), so a run thread advertises a filing action that is not
meaningful for it.

## Why this is cheap — derive, do not migrate

Two facts make this smaller than it looks:

1. **`workflow_runs.thread_id` is durable.** All 193 rows persist regardless of run status.
   A `LEFT JOIN` on the thread-list query marks every run thread — including the 190 already
   finished — **retroactively, with no schema change and no backfill**.
2. **The pattern already ships.** `threads.is_eval` is exactly this: a durable provenance
   flag, set on 218 threads. There is precedent for a typed thread; workflow-run is the
   provenance that was never given one.

A `threads.origin` / `source` column is the alternative, and is the better long-term shape if
a third provenance ever appears (see re-open trigger 4) — but it is not needed to close the
observation, and a migration should not gate a fix the join already affords.

## What is NOT being proposed

**Do not hide run threads from chat.** The run surface deliberately links back to the thread
("Open the chat thread" — the D-188-13 seam), and the thread is where the developer timeline
and a failure's free-form detail live. Removing run threads from the list would break the one
route to that detail. The ask is that the list **say what each row is**, not that it show
fewer rows.

## Why it was not fixed at discovery

Found during Phase 188.1, a refactor phase whose charter is explicit: it delivers **no new
user-facing capability**. This is new user-facing surface (a row learns a type and a visual
treatment), so building it there would have been the "closure round smuggles in a feature"
pattern that **G-7** exists to stop.

It also wants a **sketch first under G-2**: "what does a run row look like next to a chat
row, and what happens to its folder chip" is a visual-language question, not an
implementation detail. The engine facts above are settled; the treatment is not.

## Suggested shape when it is picked up

1. `/gsd:sketch` the two row states side by side — chat row vs run row — and the folder-chip
   suppression, before any code.
2. Thread-list query gains the `LEFT JOIN`; `Thread` gains a discriminated type.
3. Row renders the type; the folder affordance is suppressed (or reworded) for run threads.
4. Consider folding `is_eval` into the same discriminant rather than leaving two parallel
   provenance mechanisms — decide this at sketch time, not after.
