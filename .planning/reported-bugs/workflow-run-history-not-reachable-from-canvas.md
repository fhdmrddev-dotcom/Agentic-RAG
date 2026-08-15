---
id: BUG-260815-03
title: A workflow run's history is visible in chat but unreachable from the canvas after reopening the thread
reported: 2026-08-15
surface: Agentic-RAG
severity: major
status: open
affected_areas: [workflow/run-surface, workflow/canvas, frontend/chat]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 1dc4d509
  date: 2026-08-15
---

# BUG-260815-03: Run history is reachable from chat but not from the canvas

## What the operator saw

> "the history for the workflows appears in the chat area but not in the canvas. Actually if I
> close this and open it in the thread, there is no possibility to see it again in the history of
> canvas."

Observed after the Phase 193.1 end-to-end run (run `d8331add`, workflow
`northwind-qbr-q3-2026-f0f9033f`).

## What this appears to be

⚠ **Not root-caused yet — recorded as an operator observation with the investigation named, rather
than guessed at.** The symptom is that a completed run's history has **one home (the chat thread)
and no second home (the canvas)**, so re-entering the workflow from the canvas side gives no way
back to what happened.

The likely shape, to be confirmed rather than assumed:

- The run surface was designed in Phase 094/103 with a deliberate split — **the panel owns the
  meaningful phase spine, chat carries a thin run receipt**. That split is a recorded design
  decision, not an accident.
- The gap is what happens **after** the thread is closed and reopened *from the canvas*: the
  receipt lives on the chat messages, and the canvas has no equivalent entry point into
  `workflow_runs` / `workflow_phases` for that definition.

**Where to start:** `workflow_runs` is keyed by `thread_id` **and** `definition_id`
(both columns exist), so the data to list "runs of this workflow" is already there. This is
plausibly a missing read + surface rather than a missing record. **Verify before planning** —
this project's standing lesson is that an unmeasured claim in a plan is expensive.

## Why it matters

A run produces a real artifact — in this case a filled client-facing document. **If the only route
back to it is remembering which chat thread you were in, the artifact is effectively
write-only.** The workflow is the durable object; the thread is incidental to it.

## Related operator observation, same session

See `BUG-260815-02`: the same author could not find the workflow itself after publishing. **Both
are "the product did something and gave me no way back to it."** They should be considered
together, because a canvas-side run history is also a natural answer to *"which workflow was that
again?"*

## Routing note

Sits closest to **194 / RUN-01** and **195 / RUN-02, RUN-03**, which are already the run-surface
phases. ⚠ **Do not fold into a library fix** — this is the run surface, not the library.
