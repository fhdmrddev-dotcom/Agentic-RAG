---
sketch: 136
name: flow-shape-and-branches
question: "How does the whole graph read — layout direction, skip_to_phase branches, gates, terminal ends, batch fan-out — with no dropped phase and no phantom edge?"
winner: null
tags: [phase-183, canvas-01, canvasmodel, layout, skip-to-phase, branch-edge, fan-out, terminal, sc4-faithfulness, g2-sketch-gate]
---

# Sketch 136: Flow shape & branch edges

## Design Question

Phase 183 SC#1 says edges are *flow + `skip_to_phase` branches*; SC#4 says the projection must render every one of
the **4 canonical seed shapes + the PM pack faithfully — no dropped phase, no phantom edge**. So: which layout
direction reads best, and how do the non-linear edges route without becoming spaghetti?

## How to View

```
open .planning/sketches/136-flow-shape-and-branches/index.html
```

The **definition switcher** across the top is the SC#4 faithfulness harness — 11 definitions, 10 of them real.
Switch variants with the same definition loaded to compare like-for-like.

## Variants

- **A: Vertical spine (top → bottom)** — the exact topology the shipped `PhaseSpineGraph` draws, now on a pannable
  plane. Run order reads as reading order. The on-fail branch arcs down the **left** side.
- **B: Horizontal left → right** — the n8n / Zapier convention, instantly legible to a business user who has seen
  any other builder. Costs: 5-phase maxima run ~1,600px wide, titles truncate sooner, and ragged node heights make
  the edge baselines uneven.
- **C: Vertical spine + branch gutter** — run order stays a clean single column; every non-linear edge is routed
  into a reserved right-hand lane so it can never cross or be confused with the spine.

## What to Look For

1. **Load `Compliance review with escalation` and flip A ⇄ C.** That is the *only* shape where the two diverge —
   A's arc crosses back over the reading column, C's gutter keeps the spine clean.
2. **`literature_review` / `eval_coverage` — the `llm_batch_agents` node.** It renders as **one node**. The ×5
   fan-out is *runtime*, not topology; drawing 5 lanes would be a phantom edge and would disagree with
   `reachability.py`'s adjacency.
3. **The terminal.** Every flow ends in an explicit `○ end` cap, never a dangling edge stub.
4. **Gates on the node, not on the edge.** `citations_required`, `output_file_valid`, `llm_judge_rubric` are
   properties of a *phase*, so they render as node chips. Only `skip_to_phase` becomes an edge.
5. **The 0-phase case** (`Untitled draft`) — 40 of 95 live rows.

## The finding that changes the phase plan

> **`skip_to_phase` appears ZERO times across all 95 live definitions / 119 phases.**
> The only `on_failure` values in production are `fail_run` (×45) and `ask_user` (×2). Migration 065 even *dropped*
> `plan_execute_verify`'s regex gate precisely because its skip target didn't exist.

So the dashed branch edge in the shipped `PhaseSpineGraph` has **never rendered against real data**, and SC#1's
branch-edge acceptance cannot be demonstrated from the existing corpus. Phase 183 needs a **`skip_to_phase`
fixture** — the `branching` entry in this sketch (marked SYNTHETIC in-surface, amber-flagged in the switcher) is
a proposed shape for it: `gather → assess ⇢(on fail) escalate`, skipping `draft`.

## Grounding

10 of the 11 definitions were read live from the local Supabase on 2026-07-25 — the 4 canonical seed shapes
(`research_summarize`, `plan_execute_verify`, `literature_review`, `doc_qa_human`), the 3 PM-pack starters
(`risk-register`, `weekly-status-report`, `compliance-gap-report`), both 5-phase maxima (`eval_coverage`,
`dba-research…`), and the empty draft. Node positions are computed from **measured** DOM heights, never a guessed
constant — a gate-heavy node is taller and must not clip or collide.

## Verification

Rendered and driven in Chrome DevTools at 1440×900 across all 3 variants with the branching + PM-pack +
empty definitions. No page overflow, no console errors. Inline JS passes `node --check`.
