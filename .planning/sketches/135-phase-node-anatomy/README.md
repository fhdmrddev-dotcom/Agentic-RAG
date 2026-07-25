---
sketch: 135
name: phase-node-anatomy
question: "What IS a canvas node — simple at a glance, yet carrying grounding state, tools, gates and templates, with room for connectors later?"
winner: null
tags: [phase-183, canvas-01, phasenode, node-anatomy, grounding-slot, technical-names, forward-slots, g5-hot-file, g2-sketch-gate]
---

# Sketch 135: Phase node anatomy

> **Superseded look, standing findings (2026-07-25).** Operator review found variants A and C here too similar to
> tell apart, and the whole batch too technical and visually basic — it drew flat text glyphs instead of the shared
> 3D `PHASE_GLYPHS` marks the icon convention requires. **Sketch 137** is the visual redo. What survives from this
> sketch is its *structural* content: the node contents inventory and the live-data findings below.

## Design Question

`PhaseNode.tsx` is a **G-5 hot file touched by Phase 183 (read-only), 184 (editable + config) and 185 (graded
governance dials)** — the roadmap explicitly calls for refactor-before-3rd-touch *proactively*. So: what is a
node, such that it reads in 3 seconds at rest, carries the grounding / tool / gate / template signals a business
user needs to trust the flow, and has a designed home for what 184, 185 and 189 will add?

## How to View

```
open .planning/sketches/135-phase-node-anatomy/index.html
```

Toggle **⌥ Technical names** to flip between business language and the real `phase_type` / slug / tool ids.
Click any node to select it (in C, selection is what reveals the full detail). Click `+N more` on the 10-tool node.

## Variants

- **A: Compact chip** — identical to the shipped `PhaseSpineGraph` node: glyph + title + type chip. Everything
  else lives in the (Phase 184) inspector.
- **B: Rich card** — every signal on the node face: grounding pill, tool chips, gate chips, template chip.
  Nothing needs a click.
- **C: Two-tier (quiet → blooms)** — at rest: glyph, plain title, one essence line, and the grounding rail.
  Selected: the node *blooms* to the full pill set + provenance. This is the shipped **095 tool-card language**
  (running decision #8 — finished steps fold to essence, the active one blooms) applied to a canvas node.

## What to Look For

Each variant renders **the same 14 real phases** in four bands:

1. **The six phase types, as they actually appear.** Note the title problem — only **10 of 119** live phases carry
   a real `phase.name`, so the *fallback* title (`AI agent step · retrieve`) is the dominant case, not the edge case.
2. **Stress cases.** A **10-tool** phase (the widest in the DB), the one phase with a human name, the only
   non-`fail_run` gate disposition in production (`freshness → ask_user`, 2 of 47), and a `citation_policy: flag`
   emit that produces a document with **no** citation gate.
3. **The grounding spectrum.** A KB-retrieval node is **grounded** — it must not invent. An agent step is **open** —
   it must suit any business case. Both are legitimate. Phase 185 turns this into a dial; 183 only has to make the
   two states visually distinct *today*, read from `citation_policy` + the `citations_required` gate, which already
   exist in the data.
4. **Forward slots.** Ghosted connector / integration nodes (Phases 189–190) — present so we can check the node
   model has room before `PhaseNode.tsx` is written, rather than bolting a foreign shape on later.

Then read the verdict block at the bottom of each variant — it names what that anatomy *costs*.

## Grounding

All 14 phases read live from the local Supabase on 2026-07-25 (95 `workflow_definitions` / 119 phases).
`ground` is **derived, never invented**: `strict` = `citation_policy: strict` or a `citations_required` gate;
`flag` = `citation_policy: flag`; `open` = neither.

## Accessibility note

The grounding rail is a colour. Per the house rule (never colour alone — WCAG 1.4.1) the essence line carries a
`⛨` / `◐` glyph beside it so the state survives a colour-blind read **at rest**, not only when selected.

## Verification

Rendered in Chrome DevTools at 1440×900, all 3 variants × both technical-name states, selection + `+N more`
overflow driven live. No console errors. Inline JS passes `node --check`.
