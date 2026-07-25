---
sketch: 137
name: agentic-canvas-look
question: "What should the canvas actually LOOK like — modern, 3D, alive and agentic, while staying calm and non-technical?"
winner: "D"
tags: [phase-183, canvas-01, visual-direction, 3d-icons, icon-convention, energy-language, plain-language, connectors-preview, g2-sketch-gate]
---

# Sketch 137: How the canvas should look

> **Winner: D — Synthesis** (operator, 2026-07-25). B's floating 3D icon + frosted depth, C's left-aligned
> readability, per-step-type colour reduced to a tint behind the icon so the strong colours stay free for run
> status. This is the canvas visual language Phases 183–188 build on.

## Why this sketch exists

Sketches 134–136 answered *structure* (frame, node contents, flow shape) but were drawn as plain wireframes with
text characters (`⚙ ✎ 🤖`) standing in for icons. Operator review, 2026-07-25: variants read as near-identical,
too technical, too messy, and **"very basic with no 3D effects or innovative design… does not look very agentic."**

Two things were wrong:

1. **The icon convention was not followed.** The project's rule (Phase 127, `references/icon-convention.md`) is that
   phase-type icons come from the shared 3D `PHASE_GLYPHS` map — the `fluent-emoji` set bundled by
   `frontend/src/lib/phaseGlyph.tsx`. Text glyphs are the *old* flat set that 127 explicitly replaced.
2. **The variants weren't dramatically different.** First-round variants are supposed to be different worlds, not
   different opacities.

This sketch locks what the operator did choose — **the horizontal left→right flow from 136-B** — and explores three
genuinely different visual worlds on top of it.

## How to View

```
open .planning/sketches/137-agentic-canvas-look/index.html
```

Four controls across the top: **Workflow** (which flow is on screen) · **Feel** (Calm ⇄ Alive) ·
**Team icon** (the icon decision below) · **Plain language ⇄ ⌥ Technical names**. Click any step to select it and
see the energy travel into it.

## Variants

- **A: Energy Flow** — deep lit panels on a living connector; the 3D icon sits in a recessed well; light travels
  the line only when something is running. This is the energy language **already shipped** in the publish gauntlet
  and the live step-flow (Phase 127 / sketches 051 + 052), extended onto the canvas.
- **B: Glass Depth** — frosted translucent panels with real elevation, and the 3D icon **floating above** the card
  with its own contact shadow: depth you can see, not a drawn effect. The quietest of the three.
- **C: Soft Blocks** — big friendly tiles, each kind of step with its own gentle colour wash. The most approachable
  and least technical-feeling; colour does the sorting so the words don't have to.
- **D: Synthesis (added 2026-07-25 after operator review)** — B's floating 3D icon and frosted depth on C's
  left-aligned layout, with per-step-type colour reduced to a **tint behind the icon** instead of a whole coloured
  tile. See "The colour-budget argument" below — this is the variant with a reason, not just a preference.

## What all three fix from 134–136

- **Real 3D icons**, extracted verbatim from the installed `@iconify-json/fluent-emoji` package —
  the same source `phaseGlyph.tsx` bundles. Reusable by later sketches via `themes/phase-icons-3d.js`.
- **Plain language by default.** "Search the knowledge base", not `llm_agent · retrieve`. The technical names live
  behind the ⌥ toggle (the shipped v3.3 two-audience pattern).
- **One title, one line, at most two badges.** No tool chips, no gate identifiers, no `phase_index` on the face.
- **Grounding said in words**, not jargon: "Must cite its sources" / "Every cell cited" — not `citations_required`.
- **Connectors previewed** (`With connectors`) using the same verified 3D set, ghosted and labelled, so the look is
  designed for Phases 189–190 now rather than bolted on later.

## The icon decision you asked for help with

Five of the six shared phase marks read well on Deep Midnight. One does not.

| Phase type | Mark | Measured average luminance (0–255) |
|---|---|---|
| `programmatic` | `gear` | 173.7 |
| `llm_single` | `memo` | 166.3 |
| `llm_agent` | `robot` | 134.9 |
| `llm_human_input` | `raised-hand` | 184.9 |
| `llm_emit` | `package` | 147.3 |
| **`llm_batch_agents`** | **`busts-in-silhouette`** | **34.5 ← the outlier** |

It is a dark silhouette on a dark canvas — roughly 4× dimmer than the rest of the set. Two fixes, and they are
**not** the same size of decision:

- **In scope for 183 — lighten the icon well.** Applied in all three variants (and a soft light disc behind the
  floating icon in B). Canvas-local styling; touches nothing already shipped. This alone makes it legible.
- **Cross-cutting — swap the shared slug.** Toggle **Team icon → Brighter** to compare `handshake` (luminance 182.6).
  `PHASE_GLYPHS` is deliberately shared, so this same mark also appears on the workflows-page card, the run and
  publish soul headers, the gauntlet stages and the live step cards. Changing it is one clean additive map swap —
  but it changes five shipped surfaces, so it is **its own decision, not Phase 183's to make quietly.**

## The agent icon (operator, 2026-07-25: robot reads as generic)

`robot` is the default mark for `llm_agent` — the most-used step type — and the operator's objection is fair: it is
the single most recycled icon in AI products. Four alternatives are live in the **Agent icon** control, all verified
present in the set and measured for legibility on Deep Midnight:

| Option | Luminance | Read |
|---|---|---|
| **🧭 `compass`** ★ **CHOSEN** (operator, 2026-07-25) | 157.4 | An agent works out *how* to get there instead of following a fixed script — exactly what separates `llm_agent` from `llm_single`. An object, consistent with gear / memo / package. Genuinely uncommon in AI UIs. |
| 📡 `satellite-antenna` | 176.4 | Reaching out and gathering. Brightest and most abstract. |
| 🧠 `brain` | 169.2 | Reads as thinking, but it is the second-most recycled AI icon after the robot. |
| 🤖 `robot` | 134.9 | Today's mark. |

**Deliberately not offered:** `sparkles` / `sparkle` (luminance ~187) — the most overused AI icon in the industry,
which fails the operator's own criterion harder than the robot does; and `bullseye`, already taken by the Phase 127
publish-gauntlet Goal stage.

**Same caveat as the team icon:** `PHASE_GLYPHS` is shared, so changing `llm_agent` also changes the mark on the
workflows-page card, the run and publish soul headers, the gauntlet stages and the live step cards. It is one clean
additive map swap, but it is a **cross-cutting** change — worth doing deliberately rather than as a side effect of
Phase 183.

## The colour-budget argument (why D exists)

Operator leaned to B but liked C. There is a concrete tie-breaker, and the **Live status** control makes it visible.

**Phase 188 paints live run state onto these same nodes** — running / done / waiting-for-you / failed. That needs
strong, unambiguous colour. C has already spent its colour on *step type*: a `llm_human_input` tile is amber
whether it is waiting for you or not, and a `llm_agent` tile is indigo whether it is running or not. When status
colour lands on top, the two meanings collide — and the run view is the surface where a wrong colour reading is
most expensive (research Pitfall 4: a dishonest "done" is worse than a raw log).

**D keeps type-colour as a small tint behind the icon**, leaving the card neutral. Flip **Live status → Mid-run /
Needs you / Failed** and compare C against D: in D the status reads instantly because nothing else is competing
for it.

So the recommendation is **D**: it keeps what you liked about B (the floating 3D icon, the depth, the calm), takes
C's readability (left-aligned, warm, scannable), and does not mortgage the colour Phase 188 needs.

## Defect found and fixed during review (2026-07-25)

Operator: *"calm and alive — when I click it I do not see a difference; I don't know if there is something broken."*
It was broken, not a misunderstanding. Motion was attached **only** to the currently-selected node and its incoming
edge, and several actions (switching workflow, switching Live status) reset the selection to none — so the toggle
frequently had nothing to animate and Calm and Alive rendered identically.

Fixed by making the state **ambient rather than selection-dependent**:

- The backdrop drifts continuously in Alive and is completely still in Calm.
- The **running** step breathes and pulses on its own, with no click — and the light travels the edge *into it*,
  following the run rather than the cursor.
- `render()` now guarantees something is always demonstrating the toggle.
- The control is relabelled **Motion — Calm (still) / Alive (breathing)**, and the footer names what is moving.

Verified by measuring computed animation state: **Alive = 4–5 running animations, Calm = exactly 0**, in every
scenario including the one that used to fail (immediately after a workflow switch).

**Design implication for the build:** motion must key off *run state*, never off selection. A step that is running
looks running whether or not anyone clicked it — which is also the honest behaviour (research Pitfall 4).

## What to Look For

1. **Which world feels right** — lit depth (A), floating glass (B), or friendly colour (C).
2. **Calm vs Alive.** Flip the Feel toggle. Phase 127's finding was that energised is the loved default with a calm
   anchor kept available; does that hold on a canvas you sit and read?
3. **The 2-step vs 5-step flow.** Two steps is the most common real workflow; five is the deepest that exists.
4. **The connectors preview** — do email / ticket steps look like they belong, or like guests?
5. **C's colour budget.** C spends colour on *step type*, which leaves less headroom for *run status* (running /
   passed / failed) when Phase 188 paints live state onto these same nodes.

## Grounding

Every workflow shown is real, read live from the local Supabase on 2026-07-25 — `risk-register` (the PM-pack
starter) and `eval_coverage` (the only 5-phase definition, covering all five phase types). The connector steps are
the sole invented content and are labelled as a forward preview in-surface.

## Verification

Rendered and driven in Chrome DevTools at 1440×900 across all 3 variants × 3 workflows × both icon options.
All 3D icons render (gradient ids are namespaced per instance, so repeated marks don't collide). No page overflow,
no console errors. Inline JS passes `node --check`.
