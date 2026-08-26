---
seed_id: SEED-203
title: "A golden run whose deliverable REFUSES the work still passes the judge hard-wall at 100 — and the recorded-not-sent receipt is what derails it. Two defects in one observation: the judge cannot tell a non-answer from an answer, and a body written for a HUMAN is fed to the next phase as MODEL INPUT."
created: 2026-08-25
planted_during: Phase 206.3 independent verification — found by driving a REAL publish and then reading the golden run's phases out of Postgres, not by reading code
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - Phase 103 (the 8-stage publish gauntlet and its judge hard-wall) — the wall this passed
  - Phase 206.3 (a workflow that reaches outside can be published) — the phase that made this shape REACHABLE at all
  - D-16 (the golden-run gate — "the send is skipped, the record is NOT")
  - D-04 / Phase 185 (the action-risk checkpoint) — NOT weakened here; this is downstream of it
  - Phase 209 (a step says what it actually does) — same family: the product describing itself accurately
trigger_when:
  - Any work on the publish gauntlet's judge stage, its rubric, or the hard-wall's pass condition
  - Any work on `accumulated_outputs` — what one phase hands the next
  - Any change to `_external_action_body` / `_external_action_mcp_body`, the recorded-not-sent receipt text
  - The first report of a PUBLISHED workflow that does not do what its business requirement says
---

# SEED-203 — a golden run can refuse the work and still publish at 100

## What was observed, verbatim

Phase 206.3's verification re-drove a real publish in Chromium. The workflow published. Its
`business_requirement` was *"Provide a comprehensive overview of React repository architecture"* and its
phase-1 prompt asked for **JSX, component lifecycle, virtual DOM and hooks**.

The deliverable it published on was this (`workflow_phases`, run `1f9d3654-f8b2-4cef-929b-c28027b665c8`,
phase 1 `final-report`, `status=completed`):

> *"That message looks like a system log, not a question or command.*
> *To confirm: **no MCP tool was called, no wiki structure was retrieved, and nothing left the workflow.**
> So there's nothing for me to act on beyond acknowledging it.*
> *If you meant to ask for help with something — like React architecture, JSX, hooks, etc. — just send your
> request and I'll be happy to explain."*

The judge's verdict on that, from `harness_audit`:

```json
{"overall_passed": true, "overall_score": 100,
 "summary": "The request is effectively an acknowledgment and invitation for a follow-up.
             The evaluation passes because the response context does not require substantive
             task execution.", "failure": null}
```

**Nothing about React architecture was produced, and the gauntlet scored it 100.**

## The two defects, kept separate because they have different fixes

### (a) The judge scored a non-answer as an answer

The hard-wall exists to stop a workflow being published that does not do its job. Here it did the
opposite: it *reasoned itself into* passing, concluding that "the response context does not require
substantive task execution" — a judgement about the CONVERSATION, when the thing it was asked to grade is
whether the run met the **business requirement**. The requirement was available and was not consulted.

⚠ **This is not fixed by making the judge stricter in general.** The failure is that it graded the wrong
question. The rubric needs the business requirement as the yardstick, and needs *"the deliverable declines
to do the work"* to be an expressible verdict rather than a 100.

### (b) A receipt written for a HUMAN is fed to the next phase as MODEL INPUT

This is the more interesting half, and it is **newly reachable because of Phase 206.3**.

D-16 makes a golden run RECORD the external action and not send it. The record is deliberately worded for
a person reading a receipt:

> *"NOT SENT — recorded only. … No external MCP tool was invoked. Nothing left this workflow. This is a
> record of an intention, not a receipt."*

That text then lands in `accumulated_outputs` and becomes the next phase's context. The next phase read it
exactly as written — as a **system log** — and correctly concluded there was nothing to act on. The model
was not wrong. **The seam is that one string is serving two audiences with opposite needs**, and the
golden run is the only place where the human-facing wording is the ONLY thing the next phase receives.

⚠ **Do NOT fix this by softening the receipt.** The receipt's honesty is Phase 185 / D-16 governance
vocabulary and losing it would be a regression wearing a copy improvement's clothes — the same trap
Phase 209's scope names. The fix is that the golden run hands the next phase something that says *this
step was simulated for a publish check*, distinctly from what it shows a person.

## How we'd know a fix went wrong

- The judge is made stricter across the board and real workflows start failing to publish. The defect is
  the **yardstick**, not the threshold.
- The recorded-not-sent text is reworded to keep the next model happy. That trades a run-quality bug for a
  governance one.
- The golden run starts SENDING to make the downstream phase happy. That is `D-189-DEF-04` verbatim and
  D-16 exists to prevent it.

## Caveats, stated so this is not over-read

- **Model variance is real and is part of the picture.** Three earlier drives of the same workflow on
  2026-08-25 produced genuine React explanations and judge summaries like *"comprehensive, technically
  sound, and well-structured."* This is not a deterministic failure.
- **That is the point, not a reason to discount it.** A hard-wall that passes a non-answer *sometimes* is
  a hard-wall you cannot rely on, and the variance is what makes it invisible: the failing case looks
  exactly like the passing one in every gate, every audit row and every status column.
- This is **not** a Phase 206.3 defect. 206.3 was scoped to make an MCP-shaped publish possible and it
  did, verified 6/6. It is recorded here because 206.3's verification is what made the shape reachable
  often enough to be seen.
