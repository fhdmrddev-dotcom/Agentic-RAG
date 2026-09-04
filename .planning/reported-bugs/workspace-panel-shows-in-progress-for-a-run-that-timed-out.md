---
id: BUG-260902-01
title: A todo abandoned mid-run stays `in_progress` FOREVER — 25 threads affected, mostly behind runs that COMPLETED normally
reported: 2026-09-02
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/panel, frontend/chat, run-honesty]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-128, SEED-240]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: e4cdec972
  date: 2026-09-02
---

# BUG-260902-01: a finished run leaves the panel claiming it is still working

## What we observed

Thread **"generate weekly report"**, opened at `e4cdec972` with the workspace panel open.

**The chat column says the run is over:**

- `Run · 3 steps` — `google/gemma-4-26b-a4b` — `7m 23s`
- a collapsed row reading **`timed out`**
- a line beneath it: *"Agent reached time limit"*

**The workspace panel, at the same moment, says it is still going:**

- `TODOS  0/1`
- `⊙ Search knowledge base for report data` — **`IN PROGRESS`**

The run is terminal. The panel's only todo is still `IN PROGRESS`, and the counter still reads
`0/1`. Nothing on the panel reflects that the run ended, and nothing says the todo will never
complete.

## Why it matters

⚠ **This is a run-honesty defect, not a cosmetic one.** The panel is the surface that answers
*"what is the agent doing right now"*, and here it answers *"searching your knowledge base"*
about a process that stopped seven minutes ago. A person reading the panel alone — which is
exactly what the panel is for — waits for something that will never happen.

It is the same family as the recorded rule that **Realtime is a hint, not a source of truth**
(decision `D-v2.5-03`): the panel appears to be driven by live events and to have **no
reconcile-on-terminal-state**, so a run that dies rather than finishing leaves its last
optimistic state on screen forever. The chat column reconciles; the panel does not.

⚠ **A reload does not obviously fix it either** — the todo row is server-backed, so if the
stored todo was never marked terminal, the staleness is in the DATA, not just the view. Which of
the two it is has NOT been determined and is the first thing to establish.

## ⭐ MEASURED AFTER FILING — the staleness is IN THE DATABASE, and it is not a timeout case

Driven against the live DB rather than left as a question, because the cheap client-side patch
and the correct server-side fix are different work and one query separates them.

**1 · The stale state is PERSISTED, not a view artifact.** `todos` for this thread:

| status | content | updated_at |
|---|---|---|
| **`in_progress`** | `Search knowledge base for report data` | **2026-08-31 22:07** |
| **`in_progress`** | `Search knowledge base for weekly report content…` | 2026-08-18 04:48 |
| `pending` | `Determine report period and identify template` | 2026-08-18 04:48 |
| `pending` | `Fill template and generate .docx weekly report` | 2026-08-18 04:48 |

The panel is rendering the row correctly. **The row is wrong.** A reload will not fix it.

⚠ **2 · IT IS NOT SPECIFIC TO `timed out`, WHICH IS WHY THE ORIGINAL TITLE UNDERSTATES IT.**
Across the whole database:

- **25 threads** carry an `in_progress` todo (25 such rows in total).
- The runs on those threads are **`completed` 34 · `cancelled` 5 · `timed_out` 2**.
- **Not one of them is running.**

So the majority sit behind runs that finished **normally**. The hypothesis in the section this
replaces — *"probably a normal completion closes its todos correctly, or it would have been
noticed"* — **is false, and it was wrong for the usual reason: nobody looked.** A todo left
mid-flight is invisible unless you reopen an old thread, which is exactly what nobody does.

**3 · The mechanism is therefore NOT "terminal runs fail to reconcile".** There is no
reconciliation at all: `todos.status` is written by the agent's own `write_todos` calls and by
nothing else, so whenever a run stops — for any reason — between marking a todo `in_progress`
and marking it `completed`, that row stays `in_progress` forever.

## What a fix has to decide (not decided here)

- **Who closes a todo the agent abandoned?** A run-lifecycle hook is the obvious home, but a
  todo is not owned by a run — it is owned by a thread, and a thread can have many runs.
- ⚠ **What it should SAY.** Flipping abandoned todos to `completed` would be a lie; flipping them
  to `pending` erases that work was attempted. Neither is honest. There is probably a missing
  state — *abandoned* / *not finished* — and inventing it is a design decision, not a patch.
- **The 25 existing rows** are already wrong and would need a backfill under whatever rule is
  chosen.
