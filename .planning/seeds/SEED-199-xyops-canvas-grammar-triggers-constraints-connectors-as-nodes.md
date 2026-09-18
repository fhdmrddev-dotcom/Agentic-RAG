---
seed_id: SEED-199
title: "The xyOps canvas grammar — TWO node classes, and triggers / constraints / connectors are NODES rather than dialog fields. The operator's stated visual target, and it lands directly on Phase 206 and on what 204 shipped as modals."
created: 2026-08-24
planted_during: Operator direction, 2026-08-24 — "the visual representation of this workflow is exactly how I imagined it and we tried so hard to change the design especially the canvas into the way how it looks… this is exactly what I am concerned about especially with the connectors"
status: planted
priority: high
surface: Agentic-RAG
source: https://github.com/pixlcore/xyops (BSD-3-Clause) · screenshot `screenshots/687474...776f726b666c6f772d656469742e77656270.webp`
relates_to:
  - Phase 206 (rewritten — MCP Connector Client). ⚠ THE STRONGEST TIE. A connector should be a
    NODE YOU DROP, not a setting inside a form.
  - Phase 204 (SCHED-01/02). Shipped the schedule AND the spend caps as MODAL fields; xyOps makes
    both of them canvas nodes.
  - SEED-146 / SEED-145 — connections as platform assets. This is their CANVAS surface.
  - `frontend/src/components/workflows/PhaseNodeCard.tsx` — one card shape for every phase type.
  - `frontend/src/components/workflows/WorkflowCanvas.tsx` — `nodeTypes` has exactly ONE entry.
  - `frontend/src/components/workflows/connectionState.ts` — four states, but they describe
    connection HEALTH, not WHICH OUTCOME took the edge. Different axis; do not conflate.
  - v3.6 D-14 red line — "7 harness executors at open, 7 at close; the canvas never became a
    second runtime". ⚠ THE BINDING CONSTRAINT ON THIS ENTIRE SEED.
trigger_when: >
  Re-open at Phase 206 (connectors on the canvas) — that is the first phase where the glyph-node
  class earns itself. Or earlier if a canvas/authoring phase is scoped for any other reason, since
  the two-class split is the prerequisite for all of it.

  Mechanical check that the gap is still real, from the repo root:
    grep -c "^const nodeTypes" -A 6 frontend/src/components/workflows/WorkflowCanvas.tsx  # ONE entry today
trigger_paths:
  - "frontend/src/components/workflows/WorkflowCanvas.tsx"
---

# What xyOps does that our canvas does not

**Source is BSD-3-Clause**, so it can be learned from freely. ⚠ **Its canvas is hand-built jQuery +
SVG with NO flow library at all** (no xyflow/reactflow/d3/cytoscape in `package.json`; the frontend
is jQuery 3.7.1 + CodeMirror). That is the useful finding: **the look is not tied to their stack**,
so it is reachable in `@xyflow/react`, which we already ship. Nothing here requires a rewrite.

## ⭐ The grammar, in one line

**TWO node classes, not one.** Big **cards** for work steps, with their config visible on the face.
Small **glyphs** — icon plus a label underneath — for triggers, constraints and connectors. We have
exactly ONE node type registered in `nodeTypes`, which is why our canvas reads flat by comparison
and why every concern that is not a work step has had to become a dialog.

## The seven transferable ideas, ranked by what they unblock

| # | Idea | Where it lands here |
|---|---|---|
| 1 | **Triggers are NODES** — `Schedule (Disabled)`, `Schedule Jul 9 2026`, `On-Demand Manual Run`, `Plugin Watch For File` | Phase 204 shipped scheduling as a MODAL. A disabled schedule is still VISIBLE on their canvas; a modal hides it entirely |
| 2 | **Constraints are attachable NODES** — `Max Run Time 10 min`, `Max Log Size 2 GB`, `Max Memory 500 MB`, `Max CPU 100%`, joined by DOTTED edges | SCHED-02's spend caps, which we shipped as two dialog fields. Theirs attach to a SPECIFIC step, not only to the whole run |
| 3 | **Connectors are glyph nodes** — `Send Email`, `Web Hook Discord`, `Create Ticket`, hanging off edge outcomes | ⭐ The operator's stated concern, and the shape Phase 206 should target |
| 4 | **Config on the card face** — `CATEGORY / PLUGIN / TARGETS / TAGS` in a 2-col grid, plus a script-source preview and inline checkboxes | Ours shows name + subtitle + ≤2 badges; everything else needs `PhaseFormPanel`. Theirs is readable without opening anything |
| 5 | **The EDGE carries the branch semantic** — `On Success` ✓ green, `On Error` ! red, `On Critical` purple, `On Continue` | ⚠ NOT the same axis as `connectionState.ts`, which describes connection HEALTH. This is WHICH OUTCOME took the path |
| 6 | **Solid vs dotted is a second edge meaning** — solid = flow, dotted = constraint attachment | We have one edge meaning today |
| 7 | **Contextual selection toolbar** — `1 ITEM SELECTED` + Edit / **Test** / Duplicate / Detach / Delete | ⚠ **Test a SINGLE node** is the interesting one — we can only run a whole workflow |

## ⚠ TWO CONSTRAINTS THAT BIND ANY IMPLEMENTATION

### 1. The D-14 red line — new node classes must add NO executors

v3.6 held *"7 harness executors at open, 7 at close; the canvas never became a second runtime"*
across all 13 phases. **A `Send Email` glyph must resolve to the existing `external_action` phase.**
A `Max Run Time` glyph must resolve to the budget SCHED-02 already reads from
`workflow_runs.metadata`. A `Schedule` glyph must resolve to a `workflow_schedules` row.

**Rendering and metadata only.** The moment a glyph node needs its own executor, this seed has
failed and should be re-scoped rather than pushed through.

### 2. Our card is deliberately FULL — so this is a second class, not a bigger card

- `PhaseNodeCard` enforces a **max-2 badge budget as a TYPECHECK ERROR**; a third badge does not
  compile. 189 spent the last slot.
- `PhaseFormPanel.test.tsx` pins that panel's hook count at an **ABSOLUTE ZERO** — which already
  forced two extractions (`FieldGuidance.tsx` at 199-06, `StepCardSection.tsx` at 200-04) rather
  than being re-baselined.
- `PhaseNodeCard.test.tsx` carries **three `CARD_HTML_BASELINE` byte-captures**, and the 2026-08-20
  revert proved they hold against an un-retyped capture.

So "put the config on the card face" is not an increment to the existing card. **The honest move is
a SECOND node class**, which is what xyOps actually does and is why their canvas stays readable.

⚠ **AND THE CARD SILHOUETTE IS SETTLED.** The operator saw both faces on 2026-08-20 and chose 137-B
(248px, `rounded-[22px]`, centred, frosted, the 62px mark floating above the top edge). **This seed
must not re-open that.** It adds a second class beside it; it does not restyle the first.

⚠ **The three geometry constants move as a SET or the connectors detach**:
`RUN_MODE_NODE_MIN_HEIGHT`, `CANVAS_LAYOUT.NODE_MIN_HEIGHT`, `EDGE_ANCHOR_Y`. A glyph class with a
different height must either reuse the anchor maths or declare its own — silently inheriting the
card's will land the edges in the wrong place.

## The cheapest honest first slice

**Do it AT Phase 206, on connectors, and on nothing else.** One new glyph node class carrying the
three connector verbs, attached to edge outcomes. That is the smallest thing that proves the
two-class grammar, and it is a phase we are running anyway.

If the glyph class works there, triggers (idea 1) and constraints (idea 2) become re-presentations
of data Phase 204 ALREADY persists — `workflow_schedules` rows and `workflow_runs.metadata` caps —
so they are canvas work with no backend behind them. That ordering is what keeps this out of
"redesign the canvas" territory.

## What NOT to take

- **Their information density.** The xyOps card shows six fields, a script preview and two
  checkboxes. Our audience is not a sysadmin, and 199's whole direction was removing text.
- **`Detach`.** It belongs to their node-reuse model, which we do not have.
- **Per-node `Test`** is genuinely attractive but is a RUNTIME capability, not a canvas one — it
  would need an executor entry point and therefore collides with D-14. Capture separately if wanted.
