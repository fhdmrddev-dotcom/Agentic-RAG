---
sketch: 248
name: the-calmer-phase-card
question: "Can the canvas feel calmer without re-opening UAT row U-2 — i.e. is the tension ornament, or is it density?"
winner: null
tags: [canvas, workflow, node-anatomy, density, u-2]
---

# Sketch 248: The Calmer Phase Card

## Design Question

The operator reports the workflow canvas feels **"restricted or tense"** and the nodes feel heavy.
An outside comparison document argued the cause is the linear phase model — that a list cannot
branch, so every node has to carry too much.

**That diagnosis was measured and is wrong about the canvas.** This sketch tests the real question:

> Is the tension **ornament** (removable, free) or **density** (removable, but it costs UAT row U-2)?

## What was measured first — do not re-derive

| Claim | Measured 2026-09-18 |
|---|---|
| "Config is crammed into the node" | ❌ Config already lives in a side panel — `PhaseFormPanel.tsx`, 1,566 lines |
| "Cards are full-width" | ❌ Already 260px fixed box / 248px card |
| "The canvas can only draw one lane" | ❌ `SKIP_LANE_Y: 200` already draws a second lane |
| "Nodes are heavy by accident" | ❌ **Every slot has a recorded owner.** Badge slot 1 is *deliberately empty* (reserved for Phase 188); badges are capped at 2 by a tuple union so a third will not compile; the top-right corner is permanently claimed by the governance seal |

⭐ **So the card is not accidentally heavy — it is heavy by a chain of individually-correct
decisions.** That is the v4.2 milestone's own headline finding, one surface over.

**The measurable cost:** the 62px mark floats at `top: -26px`, which is why the card carries
`padding: 42px 20px 20px`. **The ornament collects 42px of top padding on every card, forever,
whether or not anything is running.**

## ⛔ The load-bearing constraint

`canvasModel.ts:67` states it outright:

> *"`PITCH_X` is chosen so UAT row U-2 passes by construction: the 5-phase maximum spans
> `4 * 320 + 260 = 1,540px`, inside sketch 136-B's measured ~1,600px budget."*

**The density is an accepted criterion, not an accident.** Someone decided five steps must be
visible at once, and 72px card gaps are what that costs. Every variant is therefore shown at
**3 and 5 phases**, with the 1600px budget drawn on the plane, so the trade is visible rather
than asserted.

## How to View

```
start .planning/sketches/248-the-calmer-phase-card/index.html
```

Toggle **3 / 5 phases** in the second bar. Watch where the fifth card lands against the dashed
1600px U-2 ceiling.

## Variants

- **A: As shipped (137-B)** — the control. Card 248 × min 104, padding 42/20/20, mark floating at
  −26px, pitch 320. 5-phase span **1540px**, U-2 passes. Background ≈ 23%.
- **B: More air** — byte-identical card, pitch 400. Calmer, and the 5-phase span becomes **1860px**:
  **U-2 fails by 260px** and the fifth step is off-screen at the budget width. This is the price,
  drawn rather than argued.
- **C: Repay the mark's cost** — the mark *survives* (44px, in a left gutter, vertically centred)
  but stops overflowing upward, so the card stops reserving 42px of empty top padding to clear it.
  Card 236 × min 76, text left-aligned. **Pitch never moves — U-2 still passes** — and the visible
  card gap grows to 84px for free. Vertical footprint drops 130px → 76px.

## What to Look For

1. **Does C actually feel calmer, or just shorter?** If it only reads as "smaller", the tension was
   density and the honest answer is B plus a deliberate U-2 retirement.
2. **The floating quality.** `NodeIconWell` was deleted in the Phase 200 port and you **restored it
   verbatim**, naming the ring around the mark and the card silhouette. C keeps the disc, the tint
   well and the contact shadow — but it sits *in* the card rather than *over* it. **If that float is
   the point, C is wrong.** Deleting the mark is not on the table in any variant.
3. **Left-aligned vs centred text (C vs A/B).** At 236px with a truncating title, does left-aligned
   read as a calm margin or as a cut?
4. **The ghost badge.** Slot 1 is drawn dashed in every variant as a reminder that Phase 188 owns
   it. Judge each face with that slot eventually **full**, not empty.

## Constraints honoured (from `canvas-frame-and-node-anatomy.md`)

- No per-step-type colour on the card — tint is icon-well only; Phase 188 owns the strong colours.
- No third badge, and slot 1 left unfilled.
- No focusable control inside the card — one tab stop per node.
- Nothing takes `overflow: hidden` in the node subtree.
- Horizontal left → right linear spine. No DAG implied, no parallel lanes.
- Not drawn from `themes/canvas-184.css` (that is superseded 137-D).

## Out of scope, deliberately

Branching / named outcomes. That is a separate, unbuilt idea with real consequences for
`INPUT_UNSATISFIED` and the publish gate's golden run — it gets its own seed, and it is explicitly
**not** what makes this canvas feel tense.
