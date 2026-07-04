---
sketch: 046
name: workflow-soul-object
question: What IS the soul of a workflow, and does it read as the SAME essence across the library card, the run header, and the publish summary?
winner: "A"
tags: [phase-124, wux-01, soul-object, library-card, run-header, publish-summary, glyph-dot-spine, deriveTier, business-requirement, consistency]
---

# Sketch 046 — The Workflow Soul Object

A workflow's *soul* is the five things that make it recognizable in one glance:
its **purpose** (the `business_requirement` — shown nowhere in the product today),
its **needs** (the kickoff inputs), its **phase spine** (a glyph-dot row, type
ribbons stripped), its **tier** (a glyph+WORD chip from `deriveTier()`), and its
**output** (the deliverable, one line). This sketch composes those five parts
three different ways and renders each composition at the three sizes the soul has
to live in.

## Design Question

WUX-01 (SC#1 + SC#2): **What is the soul of a workflow, and does the same essence
survive across the three sizes it must inhabit** — the dense library card, the
medium in-run header, and the large publish summary? The consistency is meant to
feel *structural*: the same shared **soul atoms** — the glyph-dot spine, the tier
chip, the needs row, and the output line — are rendered by one function each and
scale-keyed, so they feed every size and every composition from a single source.
Each size still tunes its own layout, but the identity-carrying atoms can never
drift apart by hand because there is only one of each.

## How to View

Open `C:/Vibe Apps/Agentic RAG/.planning/sketches/046-workflow-soul-object/index.html`
directly in a browser (no build step). Use the bottom-right toolbar to switch the
focused **workflow** (Weekly Status / Competitor Scan / Blog Brainstorm — STRICT /
MIDDLE / LOOSE) and the **viewport** width (1280 / 768 / 375). Switch composition
with the **A / B / C** tabs at the top.

## Variants

- **A — Purpose-led.** The `business_requirement` is the hero at every size (largest
  headline text); spine, tier chip, needs, and output sit quietly beneath. *The "why" leads.*
- **B — Spine-led.** The glyph-dot phase spine is the visual anchor (prominent dots
  with quiet phase-name labels); the requirement drops to a subtitle, the tier chip
  rides inline on the spine, needs + output form a footer. *The "shape of the work" leads.*
- **C — Outcome-led.** The output/deliverable and the tier chip are the hero ("you
  get … 🔒 STRICT" up top); the requirement, needs, and spine are support. *The "what
  you get + how trustworthy" leads.*

## What to Look For

- **(a) Which composition reads best in ~3 seconds at rest** for a domain-expert buyer.
- **(b) Recognition across sizes** — pick a workflow, then scan ①→②→③ and confirm you
  instantly recognize *the same workflow* by the same essence. Switching the toolbar
  workflow should visibly change the tier chip (🔒/◐/○ + WORD), spine length and shape,
  needs, and output *in lockstep* across all three sizes — because every size draws
  those identity atoms from the same shared, scale-keyed renderers.
- **The glyph-dot spine** (the new load-bearing component): no "server"/"agent" type
  ribbons, no phase-index numbers. Glyph-only at card size (names on hover via `title=`),
  names visible at run/publish size. The `llm_emit` ◆ deliverable node is tinted.
- **Honesty / WCAG 1.4.1**: every tier chip and status atom is **glyph + WORD**, never
  colour-alone. The draft workflow honestly reads `○ draft`; the loose tier reads
  `○ LOOSE`. Tone is a *subtle* border accent only — the word + glyph carry the meaning.
- **Tier truth**: `deriveTier()` runs the real logic — primary dial is the strictest
  `llm_emit` `citation_policy` (selected once by `selectEmitPolicy()`), floor gates
  {`output_file_valid`, `structure_check`} refine up, judge always on. Verified:
  EX-1 → STRICT, EX-2 → MIDDLE, EX-3 → LOOSE. The publish tier-line names the *same*
  selected emit policy that produced the band (no last-emit vs strictest-emit drift).

## Build Handover (reuse vs net-new)

| Real component | What this sketch implies |
|---|---|
| `workflows/deriveTier.ts` | **Reuse, extend.** The sketch's `deriveTier()` mirrors the strictest-emit-policy + floor-gate refinement + always-on-judge logic. Factor the emit-policy choice into one `selectEmitPolicy(wf)` helper that both `deriveTier()` *and* any "which policy set the tier" label consume, so a multi-emit workflow's displayed policy can never disagree with the band it produced. Confirm the real fn returns a `{key, glyph, word, desc}`-shaped result the chip can render; today the badge is derived from a free-text tier in some surfaces (see 021) — make `deriveTier` the single source the chip everywhere consumes. |
| `WorkflowsPage` `TierBadge` | **Reuse, restyle.** Becomes the `.tier-chip` (glyph + uppercase WORD + tooltip-desc, neutral border + subtle tone). One chip component, three size props (`s`/`m`/`l`). |
| `WorkflowsPage` `PhaseChain` | **Net-new replacement = the glyph-dot spine.** Today's chain renders type ribbons + truncated names; this strips ribbons + indices to a glyph-dot row with `title=` names at card size. New `PhaseSpine` component with a `scale` prop (`card`/`run`/`pub`); the existing `PT` glyph map (⚙✎🤖⛓☺◆) is the reuse seam. |
| `panel/PhaseTimeline.tsx` + `panel/PhaseCard.tsx` (**G-5 hot files**) | **Reuse for the live spine; net-new soul header above it.** The run header (②) is a *new* strip that sits above the existing meaningful spine the panel already owns — it carries the soul (purpose + tier + glyph-dot stub + the `Phase n / N · running` line). A *draft* (unpublished) workflow can only be test-run, so the strip labels itself `draft · test run` (dimmed) rather than a `Phase n / N` counter — keep the run context honest with the `○ draft` status atom shown just above. Do **not** thread soul state into PhaseCard; compose the header as a sibling. G-5: this is additive, not another edit to the hot timeline internals. |
| `workflows/PublishGauntlet.tsx` | **Reuse, add a soul block on top.** The publish summary (③) prepends the soul block above the existing 8-stage ladder (stages 0…5, judge always-on) — the gauntlet stub here is illustrative; the real ladder + verdict stay as-is. The new bit is the soul header + the `tier-line` that names the *selected* emit policy → band (the same `selectEmitPolicy()` choice that set the tier). |
| `WorkflowBuilderPage.tsx` + `workflows/PhaseSpineGraph.tsx` | **Partial reuse.** The builder's existing read-only vertical spine graph is the authoring view; this sketch's *horizontal* glyph-dot spine is the compact essence view for library/run/publish. Share the `PT` glyph map + emit-node tint; the orientation + density differ. The `business_requirement` field already lives in the builder authoring form — surfacing it as the headline elsewhere is net-new presentation, not a new field. |

**Net-new surfaces:** the horizontal glyph-dot `PhaseSpine`, the soul *header* on the
run surface, the soul *block* atop the publish summary, and the headline rendering of
`business_requirement` (the field exists in the definition but is shown nowhere in the
product today). **Reuse seams:** `deriveTier`, the `PT` glyph map, the existing panel
phase timeline, and the publish gauntlet ladder.
