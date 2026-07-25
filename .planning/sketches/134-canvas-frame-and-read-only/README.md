---
sketch: 134
name: canvas-frame-and-read-only
question: "What does the canvas plane feel like at rest vs. under touch, where does it enter the app, and how does 'view only' read as deliberate rather than broken?"
winner: null
tags: [phase-183, canvas-01, xyflow, read-only, canvas-frame, entry-door, chrome-reveal, empty-state, g2-sketch-gate]
---

# Sketch 134: Canvas frame & read-only honesty

> **Superseded look, standing findings (2026-07-25).** Operator review found variants A and C here too similar to
> tell apart, and the whole batch too technical and visually basic — it drew flat text glyphs instead of the shared
> 3D `PHASE_GLYPHS` marks the icon convention requires. **Sketch 137** is the visual redo. What survives from this
> sketch is its *structural* content: the canvas frame inventory and the live-data findings below.

## Design Question

Phase 183 is the first time a real graph library (`@xyflow/react` v12) lands in the app. React Flow brings its
own visual conventions — dot grid, minimap, zoom pills, connection handles. **How much of that vocabulary
should the canvas wear, where does the canvas enter the app, and how does read-only read as a deliberate mode
rather than a broken editor?**

## How to View

```
open .planning/sketches/134-canvas-frame-and-read-only/index.html
```

Drag the background to pan. Scroll to zoom. Try dragging a **node** — nothing happens, by design.

## Variants

- **A: In-Builder view toggle · quiet plane** — the canvas is a second *view* of the Builder's existing graph
  column (`[≣ Spine] [⬡ Canvas]`), inside the same `minmax(0,1fr) 400px` grid. Flat plane, no grid; the zoom
  cluster only appears on hover. Read-only is stated exactly as the shipped `PhaseSpineGraph` states it — the
  `👁 View only` badge plus the verbatim `READ_ONLY_LEGEND` line.
- **B: Full-bleed canvas page · full chrome** — the canvas is its own page reached from the Workflows library.
  Permanent dot grid, docked control cluster, always-on minimap, visible connection handles. Read-only is told
  by a **disengaged lock** and dimmed handles: the affordances exist but are switched off.
- **C: Quiet-until-touched · mode-not-defect** — same additive in-Builder door as A, but the plane behaves like
  a real canvas. Grid sits at 3.5% at rest and lifts to 13% while you pan/zoom, then settles. Controls fade in
  on interaction, out at rest. Minimap appears **only** when the graph outgrows the viewport. Read-only is told
  by a **cursor contract** (plane pans, nodes don't move) plus one honest footer strip.

## What to Look For

1. **The 2-node problem.** The modal live definition has **2 phases**. On a 1400px plane that's two small cards
   in a lot of nothing. Which variant makes that feel intentional rather than empty?
2. **The empty state.** **40 of the 95 live definitions have zero phases.** Flip to `0 phases` in every variant —
   B's always-on grid + minimap + controls around an empty plane reads as a broken tool; A and C degrade quieter.
3. **Does read-only feel deliberate?** B says it with a lock (a *restriction*). C says it with a cursor contract —
   the plane is alive, the nodes are fixed (a *mode*). A mostly says it in copy.
4. **Additivity.** Phase 181 locked `"off"` ⇒ byte-identical. A and C are a toggle inside a page that already
   exists; B is a new page + a new route + a new nav path — more surface to gate.

## Grounding

Every definition in the sketch was read live from the local Supabase on 2026-07-25
(95 `workflow_definitions`, 119 phases). `risk-register` is the PM-pack starter; `eval_coverage` is the
5-phase maximum; the empty draft is the single most common row in the table.

## Verification

Rendered and driven in Chrome DevTools at 1440×900 across all 3 variants × 3 definitions (9 combinations) —
no page overflow, no console errors, node/title/status all bind correctly. Inline JS passes `node --check`.
