---
sketch: 138
name: growing-the-flow
question: "How do you add, move and delete a step — and how much wiring freedom is right for a canvas the linear harness engine has to run?"
winner: "C — Hybrid: spine + free nudge, in its C-local form (browser-persisted, ZERO migration)"
tags: [phase-184, canvas-02, editing-model, insert-between, reorder, free-wire, workflow-layouts, migration-114, open-05, d-14, g2-sketch-gate]
---

# Sketch 138: Growing the flow

> **Winner: C — Hybrid spine + free nudge, in its "C-local" form** (operator, 2026-07-26).
> Order stays the spine and cannot be rewired; the nudge is kept as a **per-user browser preference,
> not a `workflow_layouts` row**. That is **A's data model + C's interaction + ZERO migration**.
> **OPEN-05 resolves to: no migration in Phase 184. Slot 114 stays RESERVED, not spent.**

## Design Question

The core action the operator named at intake is **grow a flow step-by-step**. So: what does *adding a
step* look like, what does *moving* one mean, and — the load-bearing half — **how much wiring freedom
should the canvas offer at all?**

This is the sketch that decides two things the rest of Phase 184 inherits:

- whether the roadmap's red line **D-14** ("the canvas is a projection of a LINEAR spine, never a
  second runtime") is a *design conclusion* or just an assumption nobody tested, and
- **OPEN-05 / migration 114** — whether the nullable `workflow_layouts` side table is needed at all.

## How to View

```
open .planning/sketches/138-growing-the-flow/index.html
```

Three controls: **Workflow** (2 steps · 5 steps · empty) · **Motion** · **⌥ Technical names**, plus a
**"Show what gets saved"** rail on the right that renders the actual `definition.phases[]` fragment —
and, in B and C, the extra table that would have to exist.

## Variants

- **A: Spine — insert between.** Hover the line between two steps; a `＋` appears exactly where the new
  step will land. Drag a card sideways to reorder, `✕` to remove and the line re-stitches. Positions are
  computed at render, never stored. **Zero migration.**
- **B: Free-wire canvas.** Palette on the left, place a node anywhere, drag handle-to-handle to connect.
  Every position becomes persisted state (`workflow_layouts`, migration 114) and you can draw shapes the
  engine will not run.
- **C: Hybrid — spine + free nudge.** Order stays the spine and cannot be rewired, but you may nudge a
  card off the lane for readability and that offset is remembered as a cosmetic hint. "Tidy up" resets.

## The rule all three are really arguing about

The shipped projection draws a sequential edge to the phase whose `phase_index` is **exactly +1, found
by lookup** — `canvasModel.ts:258`, mirroring `reachability.py:164` line for line. Two consequences the
sketch makes visible:

1. **A gap draws no bridging edge.** `phase_index [0, 1, 3]` does not render `1 → 3`; phase 3 is honestly
   left orphaned, which is exactly what the server's linter says about it.
2. **Therefore "insert a step" is not cosmetic.** In A it renumbers everything downstream — the toast
   names how many moved — and that is *why* a hole can never be hand-authored on a spine.

## What to Look For

1. **Where the `＋` is.** In A the affordance is *on the line*, so the question "where does this go?" is
   answered before you pick anything. In B you pick first and place second, and the new node arrives
   connected to nothing.
2. **Delete a middle step in each variant.** A re-stitches and renumbers. B silently severs two
   connections and leaves an `orphan_phase` — the footer counts it.
3. **Wire two edges out of one node in B.** The engine has no `depends_on` and runs `phase_index` order,
   so the second edge is a picture of something that will never happen. The canvas can only tell you
   afterwards.
4. **Press "Auto-arrange" in B.** If a machine can always lay the graph out, the stored positions were
   never load-bearing — which is the whole argument for A.
5. **The empty workflow.** 40 of the 95 real definitions have zero phases. Watch what each variant offers
   as a first move.
6. **The right rail, in every variant.** It is the same `definition.phases[]` either way. The difference
   is entirely in what has to be stored *beside* it.

## Grounding

Both workflows are real, read from the local Supabase on 2026-07-25 (same corpus as sketch 137):
`risk-register` (the PM-pack starter, the modal 2-step shape) and `eval_coverage` (the only 5-phase
definition in the system, covering all five step types). Node visuals are the locked canvas language via `themes/canvas-184.css` and the 3D marks in `themes/phase-icons-3d.js` — never text glyphs.

Schema facts checked against the live DB: `workflow_definitions` has columns
`id · slug · version · name · description · status · definition · created_by · is_system_global · org_id ·
created_at · updated_at · skill_snapshots`. There is **no layout column**, and `WorkflowDefinition` is
`extra="forbid"` at the Pydantic layer — so positions genuinely cannot ride along in the JSONB. B is
therefore honestly costed at a new table rather than a free field; C, in the chosen C-local form, is
costed at nothing at all (see the decision below).

## Competitor evidence (from the milestone-kickoff crawl, `.planning/research/deep-dive/`)

**Glean** — the strongest enterprise competitor — scopes drag-and-drop to *reordering steps*, not free
wiring. **Beam** redesigned its builder in July 2026 *toward* sidebar config, and its own docs rate the
blank-canvas path "intermediate-to-advanced." **n8n**'s free DAG has a documented complexity cliff:
20–30 nodes before non-technical teammates lose the thread. Variant B is the n8n bet; A is the Glean bet.

## Verification

Driven in Chrome DevTools at 1440×900 across all three variants: insert-with-renumber, delete-with-
re-stitch, reorder, free-node drag, drag-to-connect (including the two-outgoing-edges case), delete-with-
severed-wires, auto-arrange, nudge + tidy, and the empty state. No console errors; inline JS passes
`node --check`; no page overflow.


## Decision (operator, 2026-07-26) — and why it is not quite C as sketched

C was picked for forward flexibility. The advisory concern was that C-as-sketched pays a real price for
a feature with near-zero present value: at the live scale (**2 steps modal, 5 max, across all 95
definitions**) there is nothing a vertical nudge disambiguates, while the table costs a migration, a
second store that can go stale against the definition, and — most importantly — it *manufactures* the
exact case **Phase 186 / CONCUR-01** has to defend against ("a cosmetic drag never mints a version").
Under a computed layout that requirement is true by construction; under a persisted one it becomes a
live code path. It also raises an unanswered question on org-shared workflows: if one editor nudges,
does the other see it?

**Resolution — "C-local":** keep the interaction, move the storage. `dy` is a **view preference**, held
per-user in the browser, never sent to the server.

| | C as sketched | **C-local (chosen)** |
|---|---|---|
| Migration | 114 spent | **none** — 114 stays reserved |
| Sync burden | a second store vs the definition | none |
| Stale row on a deleted step | possible | not representable |
| Shared-workflow question | unanswered | not raised |
| CONCUR-01 | a code path to defend | true by construction |
| Free placement later | table already there | **one migration, when earned** |

**The written promotion trigger** (so the door is provably open, not just claimed): promote `dy` into
`workflow_layouts` — nullable, cosmetic-only, keyed by `phase_slug`, slot 114 — when *either* a nudge
must survive across devices, *or* a layout is deliberately shared between editors. Neither is true today.
