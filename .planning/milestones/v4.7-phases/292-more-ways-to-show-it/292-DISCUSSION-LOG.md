# Phase 292 Discussion Log

**Date:** 2026-10-24
**Mode:** autonomous. The operator ran `/gsd:discuss-phase 292` with "continue by yourself end to
end until you finish this phase". No questions were put to the operator; each area below took the
recommended default. The set and the four visual choices were already made by the operator at the
G-2 sketch earlier the same day.

For human reference only. Downstream agents read `292-CONTEXT.md`.

## Areas

| Area | Options considered | Selected | Why |
|---|---|---|---|
| The closed set | sketch default (diagram, comparison, timeline) ± steps | diagram · comparison · timeline | Operator winner at the sketch; steps out |
| Data shape | reuse `columns`/`rows` + an encoding · typed fields per type | typed fields per type (D-03) | Tabular rows lose node kinds and cell verdicts; the sketch contracts are typed |
| Per-element source | none · model-written · server-resolved handle | server-resolved handle, optional (D-07) | Sketch rule: the model never writes a source |
| Re-encode by reference | extend to new types · tabular only | tabular only (D-08) | Avoids a new conversion matrix; deferred with a trigger |
| Tool surface | new tool per type · extend `show_artifact` | extend `show_artifact` (D-09) | SC#4: tool count 30 |
| Migration | none · widen CHECKs | widen CHECKs, migration 213 (D-12) | `component` CHECK and `label` regex name the three literally |
| Rendering | sketch 2A/2B, 3A/3B, 4A/4B | 2A · 3A · 4A (D-16..18) | Operator winners |
| Layout dependency | Mermaid / dagre · our own | our own layered layout (D-16, D-19) | No new dependency; no model SVG |
| SC#10 board | per type × provider (24 runs) · one turn per provider asking for all three | one multi-type turn per row, 8 rows (D-26) | Covers the multi-tool axis at a third of the cost |

## Seeds

- `node scripts/check-seeds-register.cjs --phase 292` matched 0 (no PLAN.md files yet).
- **SEED-337** is named in the ROADMAP flags and its prose trigger fires on this phase. Folded
  (direction A); direction B stays out.

## Deferred

See `292-CONTEXT.md` `<deferred>`.
