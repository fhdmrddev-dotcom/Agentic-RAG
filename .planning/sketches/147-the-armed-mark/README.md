---
sketch: 147
name: the-armed-mark
question: "Who owns the canvas card — which shape is real (137-D shipped vs 137-B locked), where do the governance seal and the armed action-risk mark actually fit, and what collides once 185, 188 and 189 have all landed?"
winner: "B"
tags: [phase-185, govern-02, govern-03, action-risk, armed-checkpoint, occupancy-audit, card-shape, 137b-vs-137d, seal-vs-verdict-collision, badge-budget, one-tab-stop, phase-188, phase-189, g2-sketch-gate]
---

# Sketch 147: Who owns the card?

## What this became, and why

It started as "pick a shape for the armed action-risk mark". Two rounds of shapes were rejected, and
the operator then named the real fault:

> *"did you consider that there the ＋ button that I can add steps in between does it conflict with
> this … the icon of the node is to the left side … the designer showed the icon on the top … you are
> not being comprehensive and not aligning on what we already built and what we will build
> collectively."*

That was literally true. **Rounds 1 and 2 were drawn against `themes/canvas-184.css` `body.card-b` — a
sketch-era card — while the shipped `PhaseNodeCard.tsx` renders a different one.** Every geometry claim
in those rounds ("top-right is claimed", "the bottom edge is contested", "left-centre is free") was
reasoning about a card that does not exist in the app.

So round 3 is not a shape hunt. It is an **occupancy audit**: both card shapes, every claimant, and
collisions computed live from the shipped constants.

## How to View

```
open .planning/sketches/147-the-armed-mark/index.html
```

## The two findings this produced

### 1 · The card decision and the card code disagree

| | |
|---|---|
| **Decision** | `canvas-184.css:170-171` — *"The operator moved the locked card from 137-D to 137-B on 2026-07-26."* 137-B = the 3D mark floats **above** a 248px centred card, no per-type colour. |
| **Shipped** | `PhaseNodeCard.tsx:311-313` renders the mark at `absolute left-0 top-1/2` (56px), card inset `ml-6`, padded `pl-10`. 260 × 96. That is **137-D — icon on the LEFT**. |

Nothing in `frontend/src` applies a `card-b` class. And stray 137-B reasoning is already embedded in
shipped docblocks: `PhaseNodeCard.tsx:287` and `WorkflowCanvas.tsx:502-504` both justify a placement
with *"Under 137-B the TOP edge belongs to the floating 3D icon"* — on a component that renders the
icon at LEFT.

**Variant A draws what shipped. Variant B draws what was locked.** Same claimants on both.

### 2 · A collision that is already inside `185-SPEC.md`

Sketch **143-A** placed the governance seal at the card's top-right, and **`185-SPEC.md` Requirement 6
locked that corner as CLAIMED for governance** — but the shipped **VALID-03 verdict mark is already
there** (`PhaseNodeCard.tsx:298`, `-right-2 top-1.5`).

```
verdict {x 246, y 6, 22×22}   ×   seal 143-A {x 228, y 11, 21×21}
                                   →  overlap 3 × 17 px
```

**On both card shapes.** The sketch computes it rather than asserting it — switch cards and watch the
red box stay.

A third collision shows only on 137-D: the **`stepNumber` slot × the icon, 22 × 8px**. That is almost
certainly *why* the slot renders nothing today (`PhaseNodeCard.tsx:181`) and why 137-B moved the number
to top-left. It is a real finding, not a false positive — on the shipped card there is nowhere to put a
step number.

## Controls

| Control | What it shows |
|---|---|
| **A / B tabs** | 137-D (shipped, icon left, 260px) vs 137-B (locked, icon top, 248px) |
| **Load** — Today (184) → +185 → +188 → Everything | Stacks what each phase adds. Watch the collision box appear as governance lands on a card that was already full. |
| **Armed mark** — Detour / Countersign / Waiting card / None | The three meaning-first concepts, each tested against **both** cards |
| **Show zones** | Outlines every zone from the same table the collision checker reads |

## The three armed-mark concepts

All three start from what actually happens — *the run stops, hands out to a person, waits as long as it
takes* — rather than from "a barrier", which is what rounds 1 and 2 both drew and what neither
convinced on. A barrier says *blocked*; it has no person in it.

- **Detour** — the connector visibly leaves the flow and comes back through a point that represents
  you. Arcs **below** the line, so the ＋ (26px at y=28) keeps its place. Unarmed, the line runs
  straight through.
- **Countersign** — a ruled sign-off line at the foot of the card, like the bottom of a contract.
  Armed = an empty rule waiting. Unarmed = a dashed rule reading *runs unsigned*.
- **Waiting card** — a second card edge peeking out from behind: the decision that will come forward
  when the run reaches here. Previews the 145 review moment instead of describing it.

## Hard constraints, all from shipped code

| Constraint | Source |
|---|---|
| A **third badge is a typecheck error** | `BadgeSlot2Tuple`, `PhaseNodeCard.tsx:117-118` |
| **No focusable control may live in the card** — one tab stop per node, asserted in `WorkflowCanvas.test.tsx:231-238`. This is *why* the ✕ and ＋ sit on the lane. | `PhaseNodeCard.tsx:37-48` |
| The **＋ owns the gap centre**: 26px at `INSERT_Y = LANE_Y + EDGE_ANCHOR_Y = 28`, in a `GAP = PITCH_X − NODE_WIDTH = 60`px span | `WorkflowCanvas.tsx:314-327, 575` |
| The **✕** is `REMOVE_SIZE 24`, on the lane, tied to its card's offset | `WorkflowCanvas.tsx:439-449` |
| `status` (Phase 188 run state), `stepNumber` and `technicalLine` are **declared, unrendered slots** — future claimants | `PhaseNodeCard.tsx:141-149, 164-167, 181-184` |

**Consequence for the armed mark:** if it is something you can click, it **cannot live on the card at
all**. Either it is a non-interactive mark (and arming happens in the side panel, where the grounding
dial already goes per sketch 142-B), or it lives on the lane like ✕ and ＋.

## RESOLVED 2026-07-29

**Winner: B — 137-B is the card.** Fewer collisions, and the operator confirmed the icon belongs on top.
Three decisions locked:

1. **137-B is the target.** `frontend/src` still renders 137-D, so the code owes a card-geometry change
   that moves the icon, the verdict mark and the step number together. **Its own task** — `185-SPEC.md`
   now lists it out-of-scope for Phase 185.
2. **The verdict mark moves to `-left-2 top-1.5`; the seal keeps top-right.** The reason is lifetime, not
   taste: the seal is a *permanent* property of the step, verified at all four run states in 143-A; a
   verdict only exists when the server has returned a problem. **The permanent mark keeps the corner, the
   transient one moves.** Residual: the moved verdict grazes the `stepNumber` slot by 2×16px, and that
   slot renders nothing (D-183-07). If it is ever brought to the face, move it to `left:16` and it clears.
3. **The icon clearance is widened.** `padding-top` 34 → **42**, `NODE_MIN_HEIGHT` 96 → **104**, so the
   visible 52px mark clears the title by **11px** instead of 3. The operator spotted the tightness on
   screen; the audit confirmed it was real (3px) *and* that the sketch had drawn it worse (2px overlap,
   from text at y=30 instead of 34 and a 54px mark instead of 52).

Result on 137-B: **zero collisions between rendered marks.**

## Still open after this sketch

**Only one thing: where the armed action-risk mark goes.** The card question and the seal/verdict
question are both resolved above.

But the constraint that decides it is now known, and it invalidates all three of my earlier attempts:
**a clickable armed mark cannot live on the card at all.** One tab stop per node
(`PhaseNodeCard.tsx:37-48`, asserted in `WorkflowCanvas.test.tsx:231-238`) is what forces the ✕ and ＋
onto the lane, and it forces this too. So the remaining choice is:

- a **non-interactive mark** on the card, with arming done in the side panel — where sketch 142-B
  already puts the grounding dial, which keeps both governance controls in one place; **or**
- a **control on the lane**, alongside the ✕ and ＋ — which puts arming where the other per-step
  actions already are, at the cost of a third lane affordance.

The three meaning-first concepts (detour / countersign / waiting card) remain drawn and switchable in
the sketch, but each needs re-reading against whichever of those two homes wins.

## Rejected rounds, kept in git

- **Round 1** (`f7fad019`) — three pictograms: a level-crossing boom, a padlock latch, a hazard-hatched
  band. *The ideas hold, the treatment does not* — pictograms in a system made of structure, and the
  padlock collided with the shield seal.
- **Round 2** (`853bf94b`) — one gate bar in three placements. Structural, but still a **barrier**, and
  drawn on the wrong card. Placement B landed exactly on the shipped left icon.
