# Icon Convention (Agentic RAG) — cross-cutting

The single rule: **an icon for the same concept is byte-identical everywhere.** A
provider shows the same mark in chat, in a workflow run, in a scoreboard, and in
Settings; a phase type shows the same glyph on the library card, the run soul
header, the publish soul, and the live step card. Consistency IS the convention.

Adopted Phase 127 (Running Design Decision 43; operator "use the icons everywhere
to be consistent, especially providers and models", 2026-06-27).

## 1. Provider / model icons → ONE source: `@lobehub/icons`

Every surface that shows a provider or model renders the SAME `@lobehub/icons`
mark for that provider — never hand-drawn, never approximated, never per-surface.

- **Source of truth:** the installed `@lobehub/icons` package (added Phase 128 /
  sketch 048). Phase 128 shipped a shared `providerLogo.tsx` helper — that one
  `provider → logo` map is the seam; reuse it, don't re-map per component.
- **Coverage = the full native roster + gateway:** OpenAI · Claude/Anthropic ·
  Gemini/Google · DeepSeek · Kimi/Moonshot · GLM/Zhipu · MiniMax · OpenRouter.
  (`feedback_cross_provider_full_native_roster` — not just the SC#10 big-4.)
- **Surfaces that must use it:** the chat tool-card header (Phase 128), the
  workflow-run "engine" chip on the active step (sketch 052), the publish-test
  engine chips (sketch 051), the cross-provider scoreboard, and — future — the
  Settings provider/model management surface (SEED-095).
- **Mockup caveat:** sketches 051/052 use the real Iconify `logos:` marks where
  they exist (DeepSeek/Claude/Gemini) and FLAGGED placeholders for the ones
  Iconify lacks (Kimi/GLM/MiniMax). Those placeholders are NOT shipped art — the
  build always uses `@lobehub/icons`.

## 2. Phase-type icons → ONE source: the shared `PHASE_GLYPHS` map

The 6 workflow phase types (`programmatic` · `llm_single` · `llm_agent` ·
`llm_batch_agents` · `llm_human_input` · `llm_emit`) draw from the single shared
`PHASE_GLYPHS` map in `frontend/src/components/workflows/soulData.ts` — the drift
that module already forbids (it was extracted verbatim so the soul card/run/pub
sizes can never disagree).

- Phase 127 upgrades these from the flat unicode glyphs ⚙ ✎ 🤖 ⛓ ☺ ◆ to a 3D set.
- **It is ONE additive map swap.** Changing `PHASE_GLYPHS` propagates to the
  workflows-page card, the run soul header, the publish soul, the 127 gauntlet
  stages, and the 127 live step cards at once — so 127's 3D screens never sit under
  a flat-glyph soul header (consistency, not contradiction).

## 3. Decorative / status icons → verify the slug or bundle the SVG

The 3D `fluent-emoji` set (gauntlet stages, verdict glyphs, etc.) is loaded by name.
**Verify every slug resolves in the chosen set, or bundle the SVG as an asset** —
and always keep a fallback.

- The trap, found live (Phase 127): `fluent-emoji:direct-hit` (the 🎯 "Goal" stage)
  **does not exist** in the set and rendered EMPTY. Fixed to `fluent-emoji:bullseye`
  after verifying against the Iconify API (`api.iconify.design/<set>.json?icons=…`).
- For a build that ships an icon set: confirm presence at build time (or bundle the
  exact SVGs) so no production icon can render empty.

## 4. The CANVAS glyph vocabulary — read this before drawing any canvas mark

Added 2026-08-01 (MANIFEST decision 64) after an icon audit of sketches 148-151 caught **four
drifts, every one an invention where a shipped value already existed**. The failure mode
generalises: **a sketch that invents a glyph teaches the wrong vocabulary to whoever builds from
it.** So the shipped marks are written down here, with their source lines.

| Mark | Means | Source of truth |
|---|---|---|
| `⛨` | governance — the "Must prove it" seal | `NodeCornerMarks.tsx:266`; `GOVERNANCE_SEAL_LABEL` at `components/workflows/definitionOps.ts:466`. The SAME shield as the Control Room's operator-only mark — **one authority mark, two surfaces**. ⚠ Re-measured 2026-08-07 (Phase 188.2). This row read `PhaseNodeCard.tsx:440` and was **already stale by 213 lines before 188.2 moved anything** — the glyph's true home on the pre-cut tree was `PhaseNodeCard.tsx:653` (`:440` is a comment about `ringDash`), and `GOVERNANCE_SEAL_LABEL` was never in a root-level `definitionOps.ts`. 188.2-05 then moved the seal into `NodeCornerMarks.tsx`. So this is a correction of a wrong pointer, not merely a move-update. The card itself now names the glyph only in prose (`PhaseNodeCard.tsx:20`, a where-it-went pointer) |
| `🔒` | locked / one-way | `GovernanceSection.tsx:280`, `WorkflowDoorSwitch.tsx:159` |
| `⤳` | the on-fail (`skip_to_phase`) branch | `PhaseNode.tsx:238`, `PhaseSpineGraph.tsx:201` |
| `＋` / `✕` | add / remove — **on the lane, never the card** | `PlaneEditingLayer.tsx:186` (`＋`), `:234` (`✕`); their `data-testid`s are `canvas-insert-{index}` (`:150`) and `canvas-remove-{slug}` (`:194`). ⚠ Re-measured 2026-08-07 (Phase 188.2). This row read `WorkflowCanvas.tsx:637, :680`, stale **twice over**: on the pre-188.1 tree the render sites were `WorkflowCanvas.tsx:641` and `:684` (off by 4 even then), and **188.1 moved both into `PlaneEditingLayer.tsx`** — the exact two elements 188.2-02 edited to close `BUG-260806-01`. Not to be confused with `WorkflowCanvas.tsx:1141`, which is the empty-state *"Add the first step"* invitation, a different control on a different surface |
| `↶` / `↷` | undo / redo | `CanvasToolbar.tsx:192`, `:209` |
| `◆` | a publish-gauntlet stage | `PublishGauntlet.tsx:967` |
| phase-type marks | the **7** workflow phase types | the ONE shared 3D map — §2 above. ⚠ **CORRECTED 2026-08-19 (Phase 200-06, checklist X-15): this cell read `6` and had been stale since Phase 189 added `external_action`.** The map is **TOTAL** over the seven shipped types — `programmatic` · `llm_single` · `llm_agent` · `llm_batch_agents` · `llm_human_input` · `llm_emit` · `external_action` (`soulData.ts:57-65`, seven keys; `phase_types.py`'s `PHASE_TYPE_REGISTRY_ENTRIES`, the same seven; `models/harness.py`'s discriminated union, the same seven). ⚠ **There is NO eighth and NO missing `llm_judge_rubric` glyph** — that is a `ValidatorSpec.kind`, i.e. a GATE ATTACHED TO A PHASE. It has no node, so it needs no glyph, and `200-CHECKLIST.md` §0.2 X-2 records the claim as REFUTED BY MEASUREMENT. **No plan may open work against it.** |
| connection-state marks (stroke weight · dash) | **PROPOSAL, 200-06** — the four connection states `at rest` · `selected` · `hovered` · `not taken` | `connectionState.ts` (`CONNECTION_STATE_DELTA`, `CONNECTION_STATE_WORD`); rendered by `WorkflowCanvas.tsx`'s legend strip and by `FlowEdge.tsx`'s `data-connection-state`. ⚠ **FLAGGED AS A PROPOSAL rather than passed off as shipped vocabulary**, per *"Net-new marks must be FLAGGED as proposals"* below. It is not a glyph at all: the carrier is **stroke weight and dash**, never a hue and never a character — which is why it composes with every mark already in this table instead of competing for the card's spent budget. Transcribed from `screens/builder-canvas.html`'s own legend strip |

### The word-badge carries NO glyph

The shipped `waitsForYou` `BadgeSlot` (`PhaseNode.tsx`) has a **label and no `glyph`**, tone
`primary`. `PhaseNodeCard`'s own docblock states the rule: *the WORD carries the meaning; tone is
decoration.* Adding an emoji there spends visual budget the design deliberately withholds.

### There is NO category-icon vocabulary — do not invent one

The worst of the four drifts: sketch 151 gave each starter workflow **one phase-type glyph as a
category icon**. That misuses the shared map — `icon3d('llm_agent')` means *"this STEP is an agent
step"*, not *"this WORKFLOW is about risk"*. Finding **#36** already settled how a whole workflow is
identified: **its glyph-dot PHASE SPINE**, at every size. Starters now render their spine on both
the chip and the picker row.

*Honest side effect worth keeping:* spines are wider than a single glyph, so the chips wrap to two
lines — which **strengthens** the density argument against inline chips rather than hiding it. A
correction that makes a trade-off more visible is the right correction.

### Net-new marks must be FLAGGED as proposals

Sketch 150-C proposes `✦` (AI-drafted) and `✓` (reviewed). These are **not existing
vocabulary**. They are retained in the sketch and labelled as proposals in its README — never
passed off as shipped marks — and `✦` additionally sits on the verdict mark's coordinates, so it
owes a placement before it could ship.

### The audit that closes the loop

After fixing, `⛨` was the only glyph literal across all four sketches. **Run that check**: a
sketch touching the canvas should be greppable for glyph literals, and every one should trace to a
row in the table above or be explicitly flagged as a proposal.

## What to avoid

- Hand-drawing or approximating a provider logo in production (the sketch
  placeholders were the warning, not the pattern).
- Re-declaring the phase-type glyph map per component (drift `soulData` forbids).
- Shipping an icon name without verifying it exists in the set (the empty-icon trap).
- Different marks for the same provider/concept across surfaces.
- **Inventing a canvas mark when a shipped one exists** — check §4 before drawing.
- **Putting a glyph on a word-badge** whose shipped slot has none.
- **Using a phase-type glyph as a category icon** — a workflow is its spine (#36).

## Origin

Phase 127 (sketches 051 + 052) + operator direction 2026-06-27. §4 canvas vocabulary: sketches
148-151 icon audit + operator directive 2026-08-01 (MANIFEST decision 64). Provider-logo seam:
Phase 128 / sketch 048 (`providerLogo.tsx`, `@lobehub/icons`). Phase-type map:
`soulData.ts` `PHASE_GLYPHS` (Phase 124 / sketch 046). Future Settings home: SEED-095.
