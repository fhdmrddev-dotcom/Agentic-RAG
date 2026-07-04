---
sketch: 047
name: strict-loose-two-doors
question: How do "Describe & run" and "Author & govern" present as two clear doors (keyed off deriveTier) so a LOOSE user moves fast without meeting governance complexity, while a power user still reaches EVERY advanced control one click away — nothing removed, and a high-stakes workflow keeps its governance?
winner: "A"
tags: [phase-124, wux-02, strict-loose, two-doors, describe-and-run, author-and-govern, deriveTier, progressive-disclosure, advanced-controls, judge-always-on]
---

# Sketch 047 — Strict / Loose: Two Doors

A re-skin of the Phase 103 authoring + run surfaces (sketches 018 / 019 / 022) into the
"two doors" framing for Phase 124. Both doors apply to BOTH authoring and running, switched
by a toolbar "context" toggle. Every variant shares the sketch-046 SOUL OBJECT header
(business_requirement purpose · glyph-dot phase spine · derived tier chip · deliverable line)
so authoring and running feel like one unified surface.

## Design Question

WUX-02 (SC#3 + SC#4): can a LOOSE user describe-and-run without ever meeting governance
complexity, while a power user reaches every advanced control exactly **one click** away
(nothing removed), and a STRICT workflow can never be silently downgraded? Which disclosure
model — explicit fork, progressive expander, or tier-adaptive — best balances those three at once?

## How to View

Open `C:/Vibe Apps/Agentic RAG/.planning/sketches/047-strict-loose-two-doors/index.html`
directly in a browser. Use the bottom-right toolbar to switch **context** (Authoring | Running)
and **workflow** (EX-1 STRICT / EX-2 MIDDLE / EX-3 LOOSE). The soul header, spine, tier chip,
and door framing all re-key live. In the "Author & govern" panel, change `citation_policy` or
toggle the floor gates and watch the tier chip recompute via the real `deriveTier()` — the
`llm_judge_rubric` gate is locked on and cannot be switched off.

## Variants

- **A — Explicit fork.** Two big door cards side by side ("Describe & run" vs "Author & govern").
  Click a door to open its content inline below; a persistent "‹ both doors" returns. The describe
  door carries a visible "switch to Author & govern ›" strip so nothing is lost by picking fast.
- **B — Loose-default + expander.** No upfront fork. The surface opens in Describe & run by default;
  a SINGLE "Author & govern ▸" affordance reveals the full advanced controls exactly one click down
  (expands in place). Collapsing returns to calm. The progressive-disclosure model.
- **C — Tier-adaptive.** `deriveTier()` decides which door is foregrounded: a LOOSE workflow (EX-3)
  opens describe-and-run primary with governance a quiet secondary link; a STRICT workflow (EX-1)
  opens with Author & govern foregrounded (citation policy + gate set front-and-centre). Cycle the
  workflow toolbar to watch the surface re-key itself to the stakes.

## What to Look For

- **Nothing removed.** In every variant, both A's describe door and B's loose mode and C's
  foregrounded-loose surface carry a one-click path to every advanced control. Confirm you can
  always reach citation policy / gates / per-phase scope / model.
- **Exactly one click in loose mode** (B's expander, C's secondary link, A's switch strip) — advanced
  is demoted, never deleted.
- **The honesty demo.** In any govern panel: flip `citation_policy` strict→draft and the tier falls
  STRICT→MIDDLE (floor gates still on); turn off `output_file_valid` + `structure_check` and it falls
  MIDDLE→LOOSE. The chip is always glyph + WORD (🔒 STRICT / ◐ MIDDLE / ○ LOOSE), never colour-alone.
- **Judge is a hard wall.** `llm_judge_rubric` renders LOCKED/always-on in every tier — a strict
  workflow can never be silently downgraded by hiding governance behind the loose door.
- **The soul header is shared & consistent** across all three variants and both contexts —
  and it carries **all five soul parts in one always-visible read**: the `business_requirement`
  purpose line, the glyph-dot phase spine, the derived tier chip, a compact **needs** strip
  (kickoff inputs, at header scale) beneath the purpose, and the deliverable/output line. The
  describe door's larger soul-preview mini repeats needs + delivers at full scale for kickoff,
  but the header alone already tells you what the workflow needs to run.
- **Context reframe.** Toggle Authoring↔Running: the doors reframe (describe & draft vs author the
  definition → describe & run vs inspect the governed run + its gates) on the same surface.

## Build Handover (reuse vs net-new)

| Surface in this sketch | Real component | Reuse / net-new |
|---|---|---|
| Soul header (purpose + needs + spine + tier + output — all 5 parts) | NET-NEW `WorkflowSoulHeader` (see sketch 046) — composes existing pieces | NET-NEW composition; the `business_requirement` **purpose** line is shown NOWHERE in the product today (headline new field). The header carries a compact **needs** strip (kickoff inputs at header scale) so all 5 soul parts are present in the always-visible read, not only in the describe-door preview mini |
| Tier chip (glyph + WORD + tooltip) | `WorkflowsPage` **TierBadge** + `workflows/deriveTier.ts` | REUSE — `TIERS` is the single source of truth; the chip must not drift from `deriveTier()` |
| Glyph-dot phase spine (compact, header) | NET-NEW `PhaseSpineGlyphs` (strip type ribbons + index numbers from today's `PhaseChain`) | NET-NEW lightweight read — the existing `WorkflowsPage` PhaseChain glyph set is the source mapping |
| Read-only vertical phase spine (govern door) | `workflows/PhaseSpineGraph.tsx` + `WorkflowBuilderPage.tsx` | REUSE — sketch 019-D's read-only vertical spine |
| Right-side form panel + advanced controls | `panel/PhaseTimeline.tsx` + `panel/PhaseCard.tsx` (**G-5 hot files** — audit before touch) | REUSE the 400px push/split form-panel shell; the `citation_policy` picker + gate chips already exist in the builder dial |
| `deriveTier()` live recompute on policy/gate change | `workflows/deriveTier.ts` | REUSE verbatim — this sketch ports the exact logic to JS; the React build calls the canonical fn |
| Judge-always-on lock | `workflows/PublishGauntlet.tsx` (judge hard-wall) + the gate set | REUSE the locked-judge invariant; the gate chip just renders it non-removable |
| Two-door framing / disclosure shell (A/B/C) | NET-NEW — a small `WorkflowDoorSwitch` wrapping the existing Builder + a describe box | NET-NEW; the describe box descends from sketch 018-A's `business_requirement` hero |
| Context toggle (Authoring ↔ Running) | Maps to the three-homes IA: Builder (authoring) vs Chat-thread run surface (sketch 022-A) | REUSE the existing surfaces; the doors are a presentation layer over both |

**Net-new wire flags:** the `business_requirement` purpose line (new field surfaced), the
glyph-dot compact spine (new lightweight read), and the two-door disclosure shell. Everything
governance-bearing (`deriveTier`, `TIERS`, the gate set, the locked judge, the read-only spine,
the 400px form panel) is REUSE — the doors must never re-derive the tier or fork the gate logic.
