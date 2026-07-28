---
sketch: 147
name: the-armed-mark
question: "Where does the mark for a step that stops and asks you belong — in the gap between steps, hugging the card, or across the whole canvas?"
winner: null
tags: [phase-185, govern-03, action-risk, armed-checkpoint, armed-default, unguarded-risk, canvas-mark, shape-only, structural-not-pictogram, phase-188, phase-189, g2-sketch-gate]
---

# Sketch 147: The armed mark

## The question, in one line

Some steps do things you cannot take back. Those steps can be made to **stop and ask you first** —
and that has to be visible on the canvas before anything runs. Where does that mark belong?

## Why this sketch exists

`185-SPEC.md` (locked 2026-07-28, commit `4d7ea818`) records this as **the one design question the
142–146 batch left open**. Requirement 8 locks *that* an armed step must be marked, and locks the
budget it may spend; it deliberately does not pick the shape.

Sketch **144** drew two shapes and locked no winner — 145/146 overtook it. Neither survived as drawn,
and both failures are now grounded in the shipped CSS:

| 144 variant | Why it failed |
|---|---|
| **A — a collar on the card's bottom edge** | The collar, the run chip and the per-node editing actions all want that edge. On the shipped card-b that is literally true: `.runchip` sits at `bottom: -13px` and `.acts` at `bottom: -12px` (`canvas-184.css`). |
| **B — a checkpoint badge on the incoming connector** | 30px of mark in a **66px** gap, which is exactly where the eye skips — and its label was wider than the connector it sat on. |

---

# Round 1 — three pictograms, rejected (commit `f7fad019`)

The first pass drew **three different pictures** for three placements: a level-crossing boom on the
connector, a padlock latch on the card's leading edge, a hazard-hatched threshold band across the
canvas.

**Operator verdict, 2026-07-28: the ideas hold, the treatment does not.**

Two things were wrong, and the second is the one worth remembering:

1. **They were pictograms in a system made of structure.** Everything else in this canvas language is
   edges, seals, rails and borders. A railway crossing and a hazard band land in it like clip-art.
2. **The padlock collided with the seal.** The 143-A governance mark is a shield in a circle. Putting a
   padlock on the same card gives **two orthogonal dials two security pictures** — and *must prove it*
   vs *stops and asks you* blurring into one "governed" impression is the single confusion graded
   governance cannot afford.

Kept in git history rather than as a tab, so the file stays readable.

---

# Round 2 — one mark, three placements

The mark is now a **gate bar**, and it is *identical in every variant*:

> **Armed** — the bar is whole. The flow visibly cannot pass.
> **Not armed** — the **same** bar splits in the middle and stands open.

No lock, no stripes, no hazard tape, nothing round, nothing shield-shaped. Because the mark no longer
varies, **the only thing under test is where it belongs** — which is the actual open question.

## How to View

```
open .planning/sketches/147-the-armed-mark/index.html
```

## The variants — three placements of one gate

- **A: In the gap.** The gate stands on the connector going *into* the risky step, so the pause reads
  as what it is — the run stopping *before* the action, not a property the step happens to have. Tall
  rather than wide, so it is not 144-B's chip in a gap. Rides the `edgeTypes.flow` entry
  `WorkflowCanvas.tsx:279` already registers.
- **B: On the card.** The gate hugs the step's leading edge, like a jamb on the door into it.
  Left-centre is the one genuinely free part of the 137-B card: step number owns top-left, the seal
  owns top-right, the 3D mark floats at top-centre, the bottom edge is taken. Smallest change to
  build, and it scales with the card at fit-zoom.
- **C: Across the canvas.** The gate spans full height at the checkpoint; everything to its right is
  past the point of no return. The only placement that reads as a property of the **flow** rather than
  of a card, and the only one you cannot miss at any zoom.

## Settled before drawing

**1. No colour, no word-badge.** Colour is banked for Phase 188's run status; both card badge slots are
committed. Every stroke is white-alpha — which is why the *No colour* switch changes nothing.

**2. Top-right is CLAIMED** by the 143-A seal, and after round 1, **nothing may look like it either**.
The seal is drawn here on purpose: the real test is whether the card still reads once *both* governance
channels are on it.

**3. The checkpoint is a gate ON the risky step, never an extra step** (operator, 144). All three
placements keep the flow at **5 steps**, so "step 4 of 5" keeps meaning what it says.

**4. An unarmed risky step is marked too** — the same gate, standing open (operator, 2026-07-28).
Without that, a step that emails a report with nobody watching looks identical to a step that reads a
file, and 144's surviving finding — *the default must be ARMED-ON* — has nothing to argue against on
screen. **Step 5 is the whole point of the picture.**

## Controls

| Control | What it tests |
|---|---|
| **What's armed** — Email only / Both risky steps / Nothing armed | The armed-vs-unguarded contrast, and what a fully-guarded flow looks like |
| **Run state** — Not running / Running / Needs you / Failed | Whether the gate survives Phase 188's colour landing on the same card. *Needs you* deliberately lands on step 4, where an approval really waits |
| **No colour** | The colour-blind read. Also worth checking on steps 1 and 3, where **both** governance channels are on one card |
| **Click any gate** | Opens / shuts it live, with a toast. Keyboard-accessible, with an `event.repeat` guard (the WR-08-01 lesson) |

## What to Look For

1. **The three-second scan.** Without reading a word — which step stops and asks you? And which one
   *should* but doesn't?
2. **Does "open" read as a state, or as an absence?** A split gate is meant to say *nobody is watching
   this* rather than *nothing here*. If it reads as absence, the mark needs more weight when open.
3. **Two channels, one card.** Look at steps 1 and 3 (seal) then step 4 (gate). Do they read as two
   different questions now that the gate is not lock-shaped?
4. **Truthfulness of placement.** The run actually pauses *between* steps 3 and 4. A puts the mark
   there; B puts it on step 4. Does B's small lie matter, given how much cheaper it is?
5. **Load.** This canvas also gets live run state (188) and connector nodes (189). Which placement
   still has room?

## Build cost — established while drawing, and it should not decide this

- **B** is the smallest change: one element on `PhaseNodeCard`, no edge work, no layout maths.
- **A** and **C** need connector-level work but **not net-new infrastructure**:
  `WorkflowCanvas.tsx:279` already registers an `edgeTypes` entry named `flow`, and `canvasModel.ts:88`
  gives every edge a `data.kind`. The seam exists.

The gap is *small vs moderate*, not *cheap vs expensive*. Pick the one that reads right.
