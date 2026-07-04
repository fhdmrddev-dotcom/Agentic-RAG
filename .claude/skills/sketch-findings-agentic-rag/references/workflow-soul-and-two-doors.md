# Workflow Soul Object & Strict↔Loose Two Doors (Phase 124)

## Design Decisions

**046 — The workflow "soul" = a 5-atom essence, PURPOSE-LED, rendered the same at 3
scales (winner: A).**
The soul = **purpose** (`business_requirement` — surfaced nowhere in the product
before this) · **needs** (kickoff `inputs`) · a **glyph-dot phase spine** (the shared
phase-type glyphs ONLY — type ribbons + phase-index numbers STRIPPED; phase names are
quiet labels/`title=`) · **ONE tier chip** from `deriveTier()` (glyph + WORD, never
colour-alone) · an **output/deliverable line**. Purpose leads at every size;
spine/tier/needs/output sit quietly beneath. The SAME shared, scale-keyed soul atoms
feed the **library card → run header → publish summary** so a user recognizes the
workflow by the same essence in all three (WUX-01). A draft's run strip honestly
reads `draft · test run` (no fake `Phase n/N`). Shipped as `<WorkflowSoul scale=
"card|run|pub">`; reuse seams: `deriveTier`/`TIERS`, the `PHASE_GLYPHS` map,
additive-sibling placement above `PhaseTimeline` (G-5 — never thread soul into
PhaseCard internals).

**047 — Strict↔loose = an EXPLICIT two-door fork (winner: A).**
Two big door cards side by side — **"Describe & run"** (loose: a describe box + the
soul preview + one CTA) vs **"Author & govern"** (strict: the full Builder —
read-only vertical phase-spine graph + 400px right-side form panel + ALL advanced
controls). Pick a door → it opens inline; a persistent **"‹ both doors"** returns;
the describe door carries a visible **"switch to Author & govern ›"** strip so
**nothing is lost by picking fast** (advanced is exactly one click away, never
removed). Keyed off `deriveTier`: the govern-door controls (`citation_policy` picker
· gate chips · per-phase `folder_scope` · per-phase model) **recompute the tier
LIVE**, and `llm_judge_rubric` is **LOCKED always-on** so a STRICT workflow can never
be silently downgraded (WUX-02). The 046 soul header (all 5 atoms) renders across
both Authoring and Running contexts. Rejected: B loose-default + one-click expander,
C tier-adaptive (deriveTier foregrounds the door choice).

## Key Patterns

- Soul header atoms are ONE component with a `scale` prop — never three hand-rolled
  copies that drift.
- Tier chip = glyph + word (🔒 STRICT / ◐ MIDDLE / ○ LOOSE) derived from the REAL
  gate set via `deriveTier()` — a badge that cannot drift from the data.
- Live tier recompute: any govern-door control change re-runs `deriveTier` and the
  chip updates in place — governance is *felt*, not documented.

## What to Avoid

- Surfacing phase-type ribbons/index numbers in the soul (noise — the glyph dots +
  quiet labels carry it).
- Invented strictness labels ("level 1/2/3", "compliance mode") — the tier derives
  from real enums + gates only.
- A hidden or user-off-able judge on any tier (`llm_judge_rubric` is locked on).
- Making the loose door a dead end — the strict door must be reachable FROM it with
  work preserved.
- Threading soul rendering into `PhaseCard`/`PhaseTimeline` internals (G-5 hot files
  shared with the live harness).

## Origin

Synthesized from sketches: 046, 047 (Phase 124, 2026-06-26; refined via adversarial
design-fidelity workflow `wf_638fc39a-c58`).
Source files: sources/046-workflow-soul-object/, sources/047-strict-loose-two-doors/
