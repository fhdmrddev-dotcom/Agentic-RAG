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

## What to avoid

- Hand-drawing or approximating a provider logo in production (the sketch
  placeholders were the warning, not the pattern).
- Re-declaring the phase-type glyph map per component (drift `soulData` forbids).
- Shipping an icon name without verifying it exists in the set (the empty-icon trap).
- Different marks for the same provider/concept across surfaces.

## Origin

Phase 127 (sketches 051 + 052) + operator direction 2026-06-27. Provider-logo seam:
Phase 128 / sketch 048 (`providerLogo.tsx`, `@lobehub/icons`). Phase-type map:
`soulData.ts` `PHASE_GLYPHS` (Phase 124 / sketch 046). Future Settings home: SEED-095.
