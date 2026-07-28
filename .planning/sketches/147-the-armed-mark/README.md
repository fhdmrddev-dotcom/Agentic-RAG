---
sketch: 147
name: the-armed-mark
question: "What shape marks a step that stops and asks you first — loud enough to read as 'the run stops here', without colour, without a badge, and without touching the claimed top-right seal or the contested bottom edge?"
winner: null
tags: [phase-185, govern-03, action-risk, armed-checkpoint, armed-default, unguarded-risk, canvas-mark, shape-only, phase-188, phase-189, g2-sketch-gate]
---

# Sketch 147: The armed mark

## The question, in one line

Some steps do things you cannot take back. Those steps can be made to **stop and ask you first** —
and that has to be visible on the canvas before anything runs. What shape says it?

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

So all three variants here are **tall, structural, or off-card**, and none of them touches the bottom
edge.

## Settled before drawing

**1. The mark may spend no colour and no word-badge.** Colour is banked for Phase 188's run status;
both card badge slots are committed. Every stroke in this sketch is white-alpha — which is why the
*No colour* switch changes nothing.

**2. Top-right is CLAIMED** by the 143-A governance seal and may never be reused, moved or dimmed. All
three variants leave it alone. The seal is drawn here on purpose: the real test of an action-risk mark
is not whether it works alone, but whether the card still reads once **both** governance channels are
on it.

**3. The checkpoint is a gate ON the risky step, never an extra step** (operator, 144). All three
variants keep the flow at **5 steps**, so "step 4 of 5" keeps meaning what it says.

**4. An unarmed risky step is marked too** — same shape, unlatched (operator, 2026-07-28). Without
that, a step that emails a report with nobody watching looks identical to a step that reads a file,
and sketch 144's surviving finding — *the default must be ARMED-ON* — has nothing to argue against on
screen. **Step 5 is the whole point of the picture.**

## How to View

```
open .planning/sketches/147-the-armed-mark/index.html
```

## The variants

- **A: The barrier.** A level-crossing boom drops across the line going *into* the risky step. Armed,
  the boom is down and the flow visibly cannot continue; unguarded, the same posts stand with the boom
  raised. Tall rather than wide, so it is not 144-B's chip-in-a-gap. Rides the `edgeTypes.flow` entry
  `WorkflowCanvas.tsx:279` already registers.
- **B: The latch.** A clasp on the card's leading edge — closed when armed, sprung open when not.
  Left-centre is the one genuinely free part of the 137-B card: step number owns top-left, the seal
  owns top-right, the 3D mark floats at top-centre, the bottom edge is taken. Cheapest to build — pure
  `PhaseNodeCard`, no edge work.
- **C: The threshold.** A hatched band spanning the whole canvas at the checkpoint; everything to its
  right is past the point of no return. The only variant that reads as a property of the **flow**
  rather than of a card, and the only one you cannot possibly miss.

## Controls

| Control | What it tests |
|---|---|
| **What's armed** — Email only / Both risky steps / Nothing armed | The armed-vs-unguarded contrast, and what a fully-guarded flow looks like |
| **Run state** — Not running / Running / Needs you / Failed | Whether the mark survives Phase 188's colour landing on the same card. *Needs you* deliberately lands on step 4, where an approval really waits |
| **No colour** | The colour-blind read. Also worth checking on steps 1 and 3, where **both** governance channels are on one card |
| **Click any mark** | Arms / disarms that step live, with a toast. Keyboard-accessible, with an `event.repeat` guard (the WR-08-01 lesson) |

## What to Look For

1. **The three-second scan.** Without reading a word — which step stops and asks you? And which one
   *should* but doesn't?
2. **Does the unarmed state read as a state, or as an absence?** A raised boom, a sprung clasp and a
   dashed band are three quite different answers to "nobody is watching this".
3. **Two channels on one card.** Look at steps 1 and 3 with the governance seal lit, then at step 4
   with the armed mark. Do they read as *two different questions* — must-prove-it vs stops-and-asks-you
   — or do they blur into one "governed" impression? This is the risk in variant B specifically: a
   second lock-shaped mark next to the seal.
4. **Load.** This canvas will also carry live run state (188) and connector nodes (189). Which variant
   still has room?

## The build cost, for what it's worth

- **B** is cheapest by a distance — one pseudo-element on `PhaseNodeCard`, no custom edge, no layout
  maths, and it scales down with the card at fit-zoom.
- **A** and **C** both need edge/canvas work, but *not* net-new infrastructure: `WorkflowCanvas.tsx:279`
  already registers an `edgeTypes` entry named `flow`, and `canvasModel.ts:88` gives every edge a
  `data.kind`. The seam exists.
