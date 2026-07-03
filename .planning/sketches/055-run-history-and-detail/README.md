---
sketch: 055
name: run-history-and-detail
question: "How does the eval run history read, and how does drilling into per-case side-by-side WITH/WITHOUT outputs + honest verdicts + inline thumbs ratings feel?"
winner: null
tags: [phase-137, panel-01, eval-03, eval-04, run-history, side-by-side, ratings, honest-verdicts, drill-in]
---

# Sketch 055: Run History & Side-by-Side Detail

## Design Question

PANEL-01's core reading surface: the eval run history list and the run detail view
(per-case side-by-side outputs + pass/fail + inline rating controls). All three variants
share ONE data model built from the real wire shapes — five runs that between them
exercise every honest state the backend can produce:

- all-graded pass (3/3, with judge scores + reasons)
- pass with a `not_measured` arm (provider 400 — the case is excluded from the rollup,
  never fabricated)
- a graded FAIL ("the skill added nothing on this case") + a `judge_error` (arms
  completed, the judge call errored — counted as neither pass nor fail)
- an `interrupted` run (backend restart — honest banner + re-run affordance, the 134/135
  lesson)
- a `running` run (live per-arm progress; verdicts only at finalize)

"Your rating" thumbs (EVAL-04) render as a labeled control DISTINCT from the judge's
verdict — two different truths, never blended.

## How to View

open .planning/sketches/055-run-history-and-detail/index.html

## Variants

- **A: Full-replace drill-in** — list ↔ detail swap (005-A); one thing on screen, detail
  gets full width; `‹ Runs` returns.
- **B: Expandable rows** — the row unfolds in place; other runs stay visible; no
  navigation state, but a long detail pushes the list far down.
- **C: Master-detail split** — persistent run rail left, detail right; fastest
  run-to-run comparison; needs real width (assumes shell 053-A or 053-C).

## What to Look For

- **Open the gpt-5.4-mini run** in each variant: the `not_measured` case must read as
  "excluded, not failed" at a glance.
- **Open the gemini run**: a real FAIL with the judge's reason, next to a `judge_error`
  — three different non-pass states that must not blur together.
- **The interrupted run** must never look like a silent failure — banner + re-run.
- **Rating vs verdict:** the thumbs sit inside the WITH-skill arm with a "your rating"
  label — is the separation from the judge chip clear enough?
- **Run-to-run flow:** compare B's flick-between-expanded vs C's rail-click vs A's
  back-and-forth. Which matches how you'd actually triage a regression?

## Build Handover (reuse vs net-new)

- **Reuse:** `GET /skills/{id}/evals/runs` + `GET …/runs/{runId}` (EvalRunReadout —
  every field shown is already served: rollup counts, verdict_state/passed/score/reason,
  judge_model, tokens, rating); the eval_* SSE live progress (133/134); the thumbs PUT
  (134, IDOR-404 hardened); 048 provider logo map.
- **Net-new:** the run-row list anatomy; the case-detail card (side-by-side arms, judge
  block, labeled thumbs); the interrupted re-run affordance wiring.
- **Honesty locks:** rollup text renders passed/measured verbatim + "N not measured"
  when measured < case_count; no mid-run verdicts; not_measured/judge_error never
  counted or colored as fail.
