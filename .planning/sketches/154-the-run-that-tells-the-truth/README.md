---
sketch: 154
name: the-run-that-tells-the-truth
question: "How does the canvas read when it cannot just say done — failed, reloaded, cancelled, capped, or in a state it does not recognise?"
winner: "A"
tags: [phase-188, runviz-02, run-honesty, total-function, reconcile-on-fetch, fail-open, closed-taxonomy, cap-paused, retrying-not-durable, tier-ladder, g2-sketch-gate]
---

# Sketch 154: The run that tells the truth

## Design Question

**How does the canvas read when it cannot just say "done"?**

- **SC#3** — node state is a total function over the FULL event set: it never shows "done" on a
  `gate_failed` / `run_failed`, and success is never inferred from the *absence* of an event.
- **SC#4** — the run view reconciles on fetch at every reconnect; Realtime is a hint, not truth (D-v2.5-03).

## How to View

```
open .planning/sketches/154-the-run-that-tells-the-truth/index.html
```

Cycle the six scenarios: `Gate failed at step 5` · `↻ Reload mid-run` · `Cancelled at step 3` ·
`Failed — reason unknown` · `Parked by the step cap` · `☠ Today (the fail-open)`.

## Scope Fence — read this before judging the variants

All three variants draw run state with the **card border only**. Choosing the state *channel* (ring /
step number / lane) is **sketch 153's** entire question, and settling it here by accident would answer
153 without anyone picking it. 154 tests the layer above: **the reason, the verdict, and who says it.**

## Variants

- **A: Every node states its own truth** — each terminal step carries its reason inside the card; the
  run band shrinks to a single line.
- **B: The run says it once, nodes stay quiet** — one honest run-level notice carries the whole verdict
  plus a provenance line; nodes carry state and nothing more.
- **C: Mark the node, the run explains** — the node gets a mark on its left edge so you can see *which*
  step, and the band carries the sentence so you can read *what happened*.

## ★ Winner: A — every node states its own truth

**Operator, 2026-08-05.** The reason lives **on the step it belongs to**. The run band shrinks to a
single line, and each terminal step says what happened to it in its own card.

**Why A over the alternatives:** a run-level banner (B) is one sentence about a five-step spine — it
tells you *something* failed and makes you hunt for *which*. C splits the two halves across two places.
A keeps the fact and its location as one object, which is the same principle 145-A settled for the
review moment: **decision and evidence are one object.** The consistency is not incidental — both
surfaces belong to the same run.

**The cost A carries, recorded rather than discovered later:** A is **the first thing to actually spend
the card's free vertical space.** Read alongside 153-A, the pair is coherent — *the ring says which
state, the card says why* — but the card body now has the subtitle (which Phase 187 gave to the ⌥
technical reveal), the reason block, and `technicalLine` still notionally free, all competing for the
same column. **Plan the card body as one budget, not three independent slots.**

**A does not soften any of the four honesty decisions** the sketch forces regardless of variant — the
`?? "done"` fallback, `retrying`'s durability, `cap_paused`'s missing word, and "never started" ≠
"skipped". Those are the phase's real content; the variant only decides where the sentence is printed.

## What to Look For

1. **The `☠ Today (the fail-open)` scenario is the real bug, drawn as it would look.** A green
   "All 5 steps complete" over a step that returned a status the client has never seen.
2. **`↻ Reload mid-run` is a split screen** — before and after the reconcile, side by side. Nothing
   failed. `retrying` simply has no database representation, so a reconnect cannot bring it back.
3. **`Parked by the step cap`** — nothing in the product says this today.
4. **Where the failure sits.** In the gate scenario the failed step is the *last* one, furthest right
   on a left-to-right spine. Whatever wins has to survive the failure being off-screen — test at 1040px.
5. **Loudness.** Cancelled is dim, capped is amber, failed is red — the 129-C ladder, where loudness is
   earned by severity. Does the deliberate stop feel over-framed in any variant?

## Measured Facts Behind It

Read from the tree on 2026-08-04.

| Fact | Source | Consequence |
|---|---|---|
| `DB_PHASE_STATUS[r.status] ?? "done"` | `StreamsProvider.tsx:3337` | Fallback for an unrecognised status is **success**. Unreachable today (all 5 DB values mapped), but chosen wrong. Same shape as the gauntlet's `findIndex → -1`. |
| Client union has `retrying`; `workflow_phases_status_check` does not (`pending｜active｜completed｜failed｜skipped`) | `types/index.ts:1013` · `full-schema.sql:1932` | **`retrying` cannot survive a reload.** SC#4 lands on it. |
| `workflow_runs.status` includes `cap_paused` and `paused` | `full-schema.sql:1962` | A capped run is neither running nor finished, and no surface has a word for it. `POST /runs/{id}/continue` is a real route. |
| `TERMINAL_RUN_STATUSES = {completed, failed, cancelled, timed_out}` | `PhaseTimeline.tsx` | `timed_out` is **not** a valid `workflow_runs.status` — it can never occur. Dead code. |
| `workflow_runs` has no `started_at` / `completed_at` | `full-schema.sql:1947-1962` | Every clock is labelled with its real anchor (`claimed_at`), because an unlabelled clock meaning "since queued" is a lie the moment a run waits. |

## Decisions This Sketch Forces Into the Plan

1. **The `?? "done"` fallback must become an explicit unknown.** One word, and it is the mechanical
   embodiment of SC#3 rather than a promise about it.
2. **`retrying` needs a resolution, not a render.** Either the run view stops claiming it, or the
   attempt count becomes durable. Drawing it and losing it silently is the one outcome SC#4 forbids.
3. **`cap_paused` needs a word.** It is a shipped state with a shipped continue route and no vocabulary.
4. **"Never started" is not "skipped."** The shipped union has one value for both, and the cancelled
   scenario shows why that reads wrong — a step the workflow deliberately jumped over and a step that
   never got its turn are different facts.

## Glyph Audit (icon-convention §4)

**Corrected 2026-08-05** on a second audit pass, which found `PhaseCard.tsx:67-79`'s shipped
`STATUS_META` map — the developer view already carries a glyph + real text for every phase status, and
this sketch had invented marks alongside it. Both invented marks were replaced with the shipped ones.

| Was | Now | Source |
|---|---|---|
| `▲` for a failure notice | `✕` | `STATUS_META.failed` — and `VERDICT_MARK.error` uses the same mark for the same news |
| `!` for C's node-level problem mark | `✕` | as above |

**Inherited:** `⛨` (`PhaseNodeCard.tsx:440`) · `✕` (`STATUS_META.failed` / `VERDICT_MARK.error`) ·
`↻` (`STATUS_META.retrying`) · `✓` (`STATUS_META.done`) · `⊘` (sketch 129-C's shipped stopped/cancelled
marker, `references/run-state-honesty.md` tier 1).

**Net-new, flagged as a proposal:** `‖` for `cap_paused` — the one mark here with nothing to inherit,
because **`cap_paused` has no vocabulary anywhere in the product**. That absence is itself finding 3 above.

Note the `✓` in the `☠ Today (the fail-open)` scenario is the shipped done-glyph deliberately shown
telling a lie — it is drawn to be rejected, not proposed. No phase-type glyph is used as a category icon.
