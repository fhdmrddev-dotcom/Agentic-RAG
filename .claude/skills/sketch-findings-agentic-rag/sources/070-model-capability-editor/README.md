---
sketch: 070
name: model-capability-editor
question: "How does an operator read + edit the model registry, and how does `enabled` legibly couple to what users can pick (the SEED-116 two-layer pattern)?"
winner: "A"
tags: [control-room, model-registry, phase-149, instrument-table, inline-edit, two-layer]
---

# Sketch 070: Model Capability Editor

The body of the Control Room "Model Registry" tab (Phase 149, MODEL-01). The band + tab are already
designed (RDD 51/56) and rendered here as STATIC context — this sketch is only the tab body.

## Design Question
How does an operator read and edit the registry (per-model capabilities over the real
`model_capabilities_overrides` columns) — and how does the `enabled` flag visibly couple to "what users
can pick," per the resolved SEED-116 two-layer pattern (operator allowed-set + lock → user preference)?

## How to View
open .planning/sketches/070-model-capability-editor/index.html

## Variants
- **A · Instrument table + inline edit** — provider-grouped collapsible sections; rows over the real
  columns (context / max-out / native-tools / timeout / enabled); numeric cells are click-to-edit inline
  (112/FolderNode pattern); the 068-A governance-roster lineage. *Path of least resistance.*
- **B · List + right-side detail panel** — scannable master list, click a model → a 400px push/split
  form editor (027-A shell). Comfortable one-at-a-time editing, less dense.
- **C · Capability card grid** — each model a card with labeled facts + toggles (065-A control-card lineage).
  Most visual, weakest for cross-model comparison.

## What to Look For
- **The `enabled` → "Users see" coupling** — the derived `✓ in picker / ✕ hidden` chip (the two-layer
  pattern made visible) and the **🔓/🔒 lock** (operator pins org default / disallows user override).
- **Override vs inherited honesty** — `OVR` (your edit, stored) reads distinct from `DEF` (inherited from
  the built-in registry, dim + italic); every override has a "Reset".
- **Real columns only** (mig 053): `context_window_tokens · max_output_tokens · native_tools ·
  llm_call_timeout_seconds · enabled`. ("deprecated" is shown as a `?` tag — flagged as a SCHEMA QUESTION;
  no `deprecated` column exists today.)
- **Consistency rails** — ✎ receipt flash on every write (`model.capability.set` → the 062-A ledger),
  plain-first labels with `⌥ Technical names` revealing raw field names, `⟳ Run discovery` → Sketch 071.
- Density (A) vs focus (B) vs glanceability (C) — which fits a registry of 40+ models across 8 providers?

## Consistency notes
Reuses: op-band + rec-marker (061-B/062-A), band tabs (RDD 56), instrument table + graded-guard feel
(068-A), inline-edit (112/RDD 21), provider-logo placeholders (RDD 48 — real `@lobehub` in build),
picker-footer discipline (024-A). New: the `enabled→picker` coupling chip + the per-model lock affordance
(the two-layer pattern's operator half).
