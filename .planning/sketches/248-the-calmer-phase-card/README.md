---
sketch: 248
name: the-calmer-phase-card
question: "Can the canvas feel calmer without re-opening UAT row U-2 — i.e. is the tension ornament, or is it density?"
winner: null   # C was picked, then measured VOID. Live candidates: C2, C3.
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
| "Nodes are heavy by accident" | ⚠ **PARTLY REFUTED — see the correction below.** Badges are capped at 2 by a tuple union (true) and the top-right corner is permanently the governance seal (true). But ~~"slot 1 is deliberately empty, reserved for Phase 188"~~ is **FALSE — 188 shipped**, and *"every slot has a recorded owner"* was quoted from the findings file as a conclusion **instead of being tested**. The struck text is kept because believing it is what produced a void variant |

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

## ⛔ CORRECTION 2026-09-18 — C WAS PICKED, THEN MEASURED VOID

The operator picked **C** on the numbers (130px → 76px, a 41% cut) and then asked the right question:
*"C relocates the mark. It does not appear to remove anything. Did the accretion audit actually happen?"*

**It had not.** The audit was run in response, and it refuted the brief this sketch was built from:

1. **There is no ornament to remove at rest.** `NodeRunOverlay`'s docblock: *"A card with no reading is
   still completely still."* `NodeCornerMarks` early-returns `null` when not grounded. **The tension at
   rest is geometry, not accumulation** — the "ornament accretion" diagnosis was wrong.
2. **Badge slot 1 is NOT reserved — Phase 188 SHIPPED.** `PhaseNode.tsx:352` passes
   `status={run?.reading}`. The findings file's *"reserved for 188, do not fill"* is **stale prose**.
   The sketch now defaults to the **Running** state for exactly this reason.
3. ⛔ **C breaks the shipped run ring.** `NodeRunOverlay` is `left-1/2 top-[-31px] h-[72px] w-[72px]`, and
   its own comment derives that from the mark: *"well is 62px at top-[-26px], this is 72px, and
   (72 − 62) / 2 = 5"*. **The ring is concentric with the overhang.** C moves the mark to a left gutter,
   so the ring detaches and floats above an empty card top.

⭐ **The surviving insight is real:** 42px of top padding is rent paid for the overhang. But the overhang
is load-bearing for run status, so the height must come from elsewhere — which is C2 and C3.

**C is kept in the sketch, marked ✗ VOID, rather than deleted. The failure is the finding.**

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

- **C2: Trim below the line** — mark, ring, seal and verdict **byte-identical**; `min-height` 104 → 84 and
  bottom padding 20 → 12. Footprint 130 → **110px (−15%)**. Pitch unchanged, U-2 passes. The structurally
  safe floor: it touches nothing above the card's top edge.
- **C3: Scale mark and ring together** — mark 62 → 52 at −22, ring 72 → 62 at −27, so the overlay's own
  5px clearance derivation is **reproduced exactly**. Plus C2's trim. Footprint 130 → **98px (−25%)**.
  The float survives; it just gets smaller. ⛔ This edits two module-private `RING_*` constants, so it is
  a real code change in a G-5 file — cheap, not free.

## What to Look For

1. ⛔ **Look at C2 and C3 ALONE first, before comparing to A.** Side-by-side against what you already
   know biases toward the familiar, and the shipped face wins that comparison whether or not it
   deserves to.
2. **Then ask the narrower question: is it the disc, the tint and the shadow you wanted back — or the
   OVERHANG specifically?** C2 keeps all four unchanged. C3 keeps all four and shrinks them. If the
   answer is "the disc", both work. If it is genuinely "the overhang at 62px", only C2 qualifies.
3. **Is 15% (C2) or 25% (C3) enough?** C promised 41% and could not pay for it. If neither reads as
   calmer, the honest answer is **B plus a deliberate, recorded U-2 retirement** — ⛔ reached only
   after C2 and C3 are rejected on their merits, never as a way around the harder judgement.
4. **Judge every face in the RUNNING state, which is now the default.** Slot 1 is live today
   (`PhaseNode.tsx:352`), and the ring only exists when a run does. ⚠ A face that looks calm at rest
   and crowded mid-run is a face you will be redoing in two milestones.
5. **The vertical axis is the only one that pays.** B buys 80px of pitch per gap and breaks U-2 by
   260px; a compromise that stays under 1600 leaves ~15px per gap, which nobody perceives.
   **Horizontal is the wrong axis** — that is settled by arithmetic, not taste.

## Constraints honoured (from `canvas-frame-and-node-anatomy.md`)

- No per-step-type colour on the card — tint is icon-well only; Phase 188 owns the strong colours.
- No third badge. ⚠ ~~slot 1 left unfilled~~ — **corrected: 188 shipped and slot 1 is live**, so it is drawn FULL.
- No focusable control inside the card — one tab stop per node.
- Nothing takes `overflow: hidden` in the node subtree.
- Horizontal left → right linear spine. No DAG implied, no parallel lanes.
- Not drawn from `themes/canvas-184.css` (that is superseded 137-D).

## Out of scope, deliberately

Branching / named outcomes. That is a separate, unbuilt idea with real consequences for
`INPUT_UNSATISFIED` and the publish gate's golden run — it gets its own seed, and it is explicitly
**not** what makes this canvas feel tense.
