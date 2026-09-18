---
seed_id: SEED-180
title: A thread should be continuable indefinitely — past the 3-continue cap and past context-window exhaustion, via compaction rather than a dead end
created: 2026-08-18
planted_during: Operator live testing during the Phase 197 sketch session
status: planted
priority: high
relates_to:
  - BUG-260818-01 — Resume replays the original prompt instead of continuing. The narrow, already-broken half.
  - BUG-260818-03 — the Continue affordance did not surface at the iteration cap. The other half.
  - The shipped continuation path — `POST /runs/{id}/continue` (`backend/app/api/runs.py:708`),
    capped at 3 per run (`threads.py:1008`).
  - `backend/app/services/context_window.py` — the existing trim/pin machinery a compaction design
    would build on rather than replace.
trigger_when: >
  Plan it when the chat run-lifecycle phase is scoped — it should carry BUG-260818-01/02/03 with it,
  because they are the same control in the same moment. Raise to a requirement if a second user
  reports a long task that could not be finished.

  The seed is discharged when a user can carry ONE task to completion without being forced to start
  a new message, in both of the two dead ends below.
surface: Agentic-RAG
---

# SEED-180 — continue as many times as needed

## The operator's words

> *"if this is exhausted the context window we should also do come back of the conversation so we
> can continue as many times as we need"*

…and, on the iteration cap:

> *"we have the ability to say that the iteration was exhausted, continue, so it continues from the
> last iteration that it stopped from … we have to ensure the correct information displayed as well
> as managing the context of the thread to be comprehensive."*

## The two dead ends this seed is about

**Dead end 1 — the continue allowance runs out.** The iteration cap is **15**
(`agent_loop.py:1287`); a `cap_paused` run can be continued, but only **3 times**
(`threads.py:1008`, `_MAX_CONTINUES_PER_RUN = 3`). After that the card says: *"Reached the Continue
limit — this run is stopped. Start a new message to keep going."* For a genuinely long task,
"start a new message" means **the dropped tool calls are abandoned** and the model re-derives
context from the transcript.

**Dead end 2 — the context window fills.** Today the thread trims/pins to fit
(`context_window.py`, the `PIN_BUDGET_FRACTION` + trim-marker machinery). Trimming is honest but it
is **lossy and silent-ish**; there is no *compaction* step that summarises what was dropped into a
durable carry-forward the next turn can rely on. A long thread therefore degrades rather than
continuing cleanly.

## Why this is `high` and not `medium`

The product's core claim is an **AI colleague that does real work**. The two caps above are exactly
where real work dies: a long, multi-tool, document-grounded task is precisely the shape that hits
15 iterations and a full window. Every other quality in the product is upstream of the task actually
finishing.

## What a design must decide

1. **Is the 3-continue cap a safety rail or a budget rail?** If safety (runaway loops), then raising
   it is wrong and the answer is compaction plus a fresh bounded run. If budget, it belongs in
   Settings as a knob, not as a constant in `threads.py`. ⚠ **Decide this before touching the
   number** — the two answers lead to opposite designs.
2. **Compaction, and who writes the summary.** A provider call to summarise dropped turns is itself
   cost, latency and a place to be wrong. Whether the summary is model-written or mechanically
   derived (tool results, files produced, decisions taken) is the central design question.
   ⚠ Whatever is chosen, the **project floor applies: never invent a reason or a fact client-side**,
   and a compacted thread must be able to say *what it dropped*.
3. **Honesty at the seam.** The user must be able to tell *"this thread was compacted"* from *"this
   thread is complete"*. A silent compaction is the same class of defect as `BUG-260818-01`'s silent
   replay.
4. **Cross-provider.** Context windows differ per model and `MODEL_CAPABILITIES` already knows them
   (⚠ and `SEED-172`/the LM Studio note records that the *loaded* context can be far smaller than
   the advertised one). Compaction thresholds must read the registry, never a constant.
5. **Does continuation survive a reload?** `SEED-178` measured that the open thread does not survive
   F5 at all. A continue-forever design that only works inside one live session solves half the
   problem.

## Related, and deliberately not merged

`BUG-260818-01` (Resume replays the prompt), `BUG-260818-02` (Resume drops the model) and
`BUG-260818-03` (the Continue card did not surface) are **defects in what already exists** and
should be fixable without this seed. **This seed is the ambition beyond them.** Fixing the three
does not discharge it; shipping this does not excuse leaving them.
