---
seed_id: SEED-288
title: A finished job still reads "Not ticked" — nothing reconciles the todo list against what the run actually did
created: 2026-09-16
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching the todos panel, the run finalizer, or run-state honesty. ⛔ ALSO fires on the next milestone scoping — the operator raised this directly on 2026-09-16 and it is a product defect they can see, not a register item.
trigger_paths: ["backend/app/services/todos_service.py", "backend/app/services/run_producer.py", "frontend/src/components/panel/todoRunHonesty.ts", "frontend/src/components/panel/TodosSection.tsx", "**/agent_loop.py"]
trigger_surfaces: ["chat", "panel", "agent-loop"]
migration_note:
relates_to: [".planning/reported-bugs/BUG-260913-02", ".planning/reported-bugs/BUG-260902-01", "SEED-105", "250", "252"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-288: A finished job still reads "Not ticked"

## The finding

The agent writes its own todo list during a run (`write_todos`) and is expected to tick items as it
goes. **Nothing checks that it did.** When the agent completes the work but never calls
`write_todos` again to close the items, the rows stay `pending` / `in_progress` forever.

`reconcile_open_todos_on_run_end` (`backend/app/services/todos_service.py:117`, called from
`backend/app/services/run_producer.py:202`) is the only thing that runs at a clean run end, and its
docstring is explicit about what it does NOT do:

> *"It NEVER flips `status` to completed (honesty guardrail — an open item is never silently
> auto-completed)."*

So the surface reports the agent's **bookkeeping**, never the **work**. `deriveTodoDisplayStatus`
(`frontend/src/components/panel/todoRunHonesty.ts`) returns `not_ticked` for every open item once a
run is not live — with no idea whether the item was actually done.

## Why it matters

⭐ **This is the THIRD report of the same defect, and the first two were answered by changing the
WORDS rather than the behaviour.**

| | Report | What shipped |
|---|---|---|
| 1 | `BUG-260902-01` — a run ended seven minutes ago and its todo still read `IN PROGRESS`, spinner still bouncing | Phase 138 appended `(run ended — not completed)` |
| 2 | `BUG-260913-02` — *"the job finished perfectly and the row read `Translate document (run ended — not completed)`. The surface adjudicated work it cannot see."* | Phase 250 softened the words to `Not ticked` |
| 3 | **Operator, 2026-09-16** — *"if the task is actually completed it should be ticked anyway, so this is misleading the user."* | **nothing yet — this seed** |

⛔ **A softer overclaim is still an overclaim.** `Not ticked` beside a finished job misleads in
exactly the way `(run ended — not completed)` did; it just apologises more politely. The operator
reported the identical complaint against the replacement word, which is the evidence that the word
was never the defect.

## What is directed, and how it differs from the thing rejected twice

⚠ **This is NOT the auto-complete rejected on 2026-06-26 and again at Phase 250's scoping under
Phase 138's `D-01`.** That rejection was of a **silent status flip on a clean run end** — ticking an
item *because the run ended*, with no evidence.

⭐ **What the operator directed is the opposite: a FINAL RECONCILIATION PASS.** At a clean run end,
read the run's own transcript and tool calls, tick what the agent **demonstrably did**, and leave
genuinely-unfinished items open. **Evidence-bearing, not blind.** `D-01`'s honesty guardrail is
satisfied by that, not broken by it — the guardrail forbids claiming without evidence, and this
supplies the evidence.

Operator's words: *"it should do a final round to check — if the agent finished then it should be
ticked; otherwise the only way is to show that this task was actually not completed."*

## The honest limit, which survives the change

⛔ **A run that CRASHED, was STOPPED or TIMED OUT never reaches a final pass**, so its open items
still cannot be adjudicated. **`Not ticked` stays for exactly that case — where it is TRUE.** The
existing gate already distinguishes these: `run_producer.py:197-200` fires the reconciler only on a
terminal status in `_RUN_STATUS_TO_TERMINAL_TYPE` that is not `cap_paused` and has no live sibling.

## When to surface

Any phase touching `todos_service.py`, `run_producer.py`'s finalizer, `todoRunHonesty.ts` or
`TodosSection.tsx` — **and at the next milestone scoping regardless**, because the operator raised
it directly and can see it in the product.

## Scope estimate

**Medium.** One extra model call at run end (cheap model, transcript + todo list in, ticks out),
one new code path in the finalizer, and a decision about what happens when the final pass is itself
uncertain. ⛔ It is a **new capability**, so it is a PHASE — not a wording tweak and not a
gap-closure round (G-7).

⚠ **Two things to measure before planning, not after:** (1) how often this actually happens — Phase
250 measured **78 open todos across 26 threads, 53 unmarked**, but never asked how many of those 53
were *genuinely done*; (2) whether the final pass can be trusted, since an agent that forgot to tick
its list is the same agent being asked to audit it.

## Breadcrumbs

- Operator direction, in session, 2026-09-16 — recorded on `BUS-248`'s answer.
- `backend/app/services/todos_service.py:117-193` — the reconciler and its `D-01` guardrail comment.
- `backend/app/services/run_producer.py:150-213` — the clean-end gate, three clauses, each with its
  own recorded reason.
- `frontend/src/components/panel/todoRunHonesty.ts` — `deriveTodoDisplayStatus`, and the docblock
  that names `BUG-260913-02` as this phase's own motivation.
- `.planning/phases/250-run-honesty-the-residue/250-MEASUREMENT.md` — the 78 / 26 / 53 census.
