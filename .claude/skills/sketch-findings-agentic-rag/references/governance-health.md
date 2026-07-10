# Document Governance Health (Phase 119)

## Design Decisions

**038 + 040 — Governance Health = its OWN top-level surface, a card-grid of
HealthPanel-per-signal (winners: both A, hardened by judge panel `wf_a961f729-247`).**
Phase 119's read-only view gets its own `NAV_ITEMS`/`ActiveView` route (shield glyph,
peer to Library Health) — three signal cards (broken relationships / unclassified /
low-confidence metadata) over a 3-tile KPI strip, riding the shipped `HealthPanel` /
`HealthDocumentRow` / `HealthEmptyState` anatomy 1:1. The "Retrieval|Governance tab of
Library Health" form was **rejected** as the exact bolted-on shape SC#1 forbids.
Grafts adopted: a **posture-hero + collapse-to-clear** form for the all-healthy state
(neutralizes a cluttered six-block all-clear); any health-score number must be
honestly computable or it's cut. The Documents rail stays a pure finding instrument
(Folders + Views + Automation as three peer NavRow groups); **governance is never an
in-rail entry** (would force an inconsistent IA + a standing false-alarm). Forbidden
combo: a top-level governance home AND an in-rail entry (two contradictory paths).
Collapsible group headers in the rail are the documented density FALLBACK — promote
only when real folder-tree depth becomes the dominant pain.

**039 — Signal row = inline per-signal verb buttons (winner: A + C's mask-gated
expand graft; B route-to-panel = documented strong alternative).**
`Open links` / `Classify` / `Re-extract` + a quiet `Open doc` — **the verb IS the
diagnosis** (fastest lived triage). An expand-for-provenance caret inherits the 117
no-access/missing mask (an un-gated provenance line naming a target title = latent
leak — rejected). Honesty is load-bearing:

- Low-confidence metadata renders the **Phase-112 `ConfidenceChip`** (per-field
  extraction score, italic+dim+⚠), NEVER a retrieval-similarity %.
- **Classify never silently moves** (opens the 036 accept flow).
- The governance page **writes nothing** — verbs navigate to the canonical
  112/117/118 edit surfaces, never reimplement three drift-prone mutation paths.
- The count **must re-fetch as rows resolve** ("no list-level mutations" ≠ "no
  list-level re-fetch") — else the count silently lies.

## Key Patterns

- Signal card = `HealthPanel` shell + count + top-N `HealthDocumentRow`s + per-row
  verb buttons; all-healthy = one posture hero, not six empty blocks.
- Fix loop = governance row → canonical edit surface → return → row resolves via
  re-fetch (the 117 re-fetch-not-optimistic beat).

## What to Avoid

- Bolting governance onto the Library Health dashboard (SC#1 hard line).
- An in-rail governance entry, or any rail growth for governance.
- Retrieval-similarity styled as metadata confidence (two different systems).
- Mutations on the aggregation page; optimistic row removal.
- Provenance expands that leak inaccessible-target titles.

## Origin

Synthesized from sketches: 038, 039, 040 (Phase 119, 2026-06-21; judge panel
`wf_a961f729-247`).
Source files: sources/038-governance-health-surface/, sources/039-signal-row-and-fix-action/,
sources/040-documents-sidebar-composition/
