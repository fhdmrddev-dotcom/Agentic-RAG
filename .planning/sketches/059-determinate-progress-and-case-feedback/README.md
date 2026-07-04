---
sketch: 059
name: determinate-progress-and-case-feedback
question: "How does a RUNNING eval row read with determinate progress (units = cases × 2 arms + judge), per-arm wall-clock duration, and where does the judge's never-blocking case_feedback land in the run detail?"
winner: "A"
tags: [phase-137.1, eval-05, determinate-progress, per-arm-duration, case-feedback, run-row, 055-b-extension]
---

# Sketch 059: Determinate Progress & Case Feedback

## Design Question

Three EVAL-05 sub-features share the single-run row and its expanded detail (they apply
identically to every arm of a 058 matrix):

1. **Determinate progress (EVAL-05c)** — per-arm events already stream
   (`eval_case_started` per case+variant + heartbeats); the unit math is frontend-side:
   3 cases × 2 arms + 1 judge step = 7 units. How does the running row show it?
2. **Per-arm wall-clock duration (EVAL-05e)** — net-new capture; shown live as each arm
   lands (⏱ in the checklist) AND on every finished arm card next to tokens.
3. **Judge `case_feedback` (EVAL-05d)** — the judge's per-case critique of weak or
   non-discriminating cases. ADVISORY, never blocking — it must read as feedback on the
   CASE, never as part of the verdict. Placement is the bounded discretion item this
   sketch resolves.

The finished exemplar exercises the honesty set: a mixed 2/3 run, judge reasons per arm,
case 2 flagged "hard to anchor" + case 3 flagged "non-discriminating" (both arms pass).

## How to View

open .planning/sketches/059-determinate-progress-and-case-feedback/index.html

**▶ Start a run** launches the live row in all three variants (watch the same run in
each tab); the checklist reveals each arm's duration as it completes; **⏩ Finish now**
returns to rest. The finished run is expanded by default.

## Variants

- **A: Thin unit bar + inline feedback** — the running row carries a thin determinate
  bar + `case 2/3 · with arm · 4/7 · 57%`; `case_feedback` renders INLINE under the
  flagged case header as a violet dashed-border "◇ Judge on this case" block (always
  visible).
- **B: Segmented pips + weak-case tag** — progress renders as 3 pip-pairs (one per
  case) + a distinct ⚖ judge pip (054-B stepper echo); `case_feedback` hides behind a
  violet "◇ weak case ▾" tag on the case header (details-on-demand, 051-A raw-on-demand
  echo).
- **C: Quiet % + run-level digest** — the row header stays calm (mono `4/7 units · 57%`,
  no bar); the rich per-arm checklist carries the live detail; `case_feedback` collects
  into ONE "◇ Case quality" digest block at the end of the run detail.

All variants share the same expanded live checklist (per-arm ✓/●/queued + durations) —
that surface is settled; the ROW treatment + feedback PLACEMENT are what differ.

## What to Look For

- **Glanceability vs calm:** A's bar is readable from across the room; B's pips encode
  case/arm structure (you can SEE "case 2's without-arm is running"); C keeps the row
  quietest but makes you expand for detail. Which matches the Studio's 052-A
  "quiet-idle / alive-active" discipline?
- **The judge pip (B):** does giving the judge step its own distinct unit read honestly,
  or over-structure a 2-second step?
- **case_feedback placement:** inline (A) is unmissable but adds height to every flagged
  case; tag (B) is calm but hideable; digest (C) reads all feedback in one place but
  detaches it from the case cards. It must NEVER read as a verdict — check it stays
  visually distinct from the PASS/FAIL chips in all three.
- **Per-arm durations:** live checklist (⏱ appears as arms land) + finished arm cards
  (⏱ next to tokens). Does duration read as metadata, not verdict?

## Build Handover (reuse vs net-new)

- **Reuse:** `eval_case_started` per case+variant + heartbeats (133/134 SSE — unit math
  is pure frontend); the RunCaseDetail arm-card anatomy (verdict chip / judge reason /
  tokens / labeled "your rating" thumbs — all shipped); the 055-B expandable row.
- **Net-new:** duration capture per arm (backend — the phase's `eval_results` migration
  column); `case_feedback` on the judge schema + its `eval_results`/`eval_runs` storage
  (migration); the determinate-progress row treatment; whether the judge step is one
  unit (this sketch renders it as one — confirm at plan).
- **Honesty locks:** no mid-run verdicts (checklist shows ✓ completion, never pass/fail);
  `case_feedback` is advisory — violet (info) vocabulary, never amber/red, never in the
  rollup math; the elapsed timer derives from a stable start-ts (the 095 never-vanishes
  lesson).
