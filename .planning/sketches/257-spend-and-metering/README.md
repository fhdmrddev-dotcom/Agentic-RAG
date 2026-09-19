---
sketch: 257
name: spend-and-metering
question: "How should the /admin/spend view present dollar spend while maintaining radical honesty about unrated models and uncounted token blind spots?"
winner: null
tags: [spend, metering, admin, blind-spots, rate-registry, g-2, m-01, m-07]
---

# Sketch 257: Spend in Dollars, and What It Cannot See

## Design Question

Phase 257 introduces spend in dollars (`METER-01`, `METER-02`, `METER-07`).
The central hazard identified in `ROADMAP.md` is **the Free Lie**:
> *"A spend view that is wire-correct and unreadable has not satisfied METER-07. A model with no rate reads as unrated wherever cost is shown — never as $0.00, never silently omitted from a total."*

How should the `/admin/spend` interface balance:
1. **At-a-glance financial clarity** (total dollar spend per org and per run).
2. **Uncompromising blind spot honesty** (prominent "What This View Cannot See" accounting for unrated models and incomplete `token_coverage` from Phase 256 / SEED-300).
3. **Actionable remediation** (one-click filtering of unpriced runs and in-place rate repricing)?

## Grounded In Shipped Architecture

- **Migration 182**: `workflow_runs.input_tokens`, `output_tokens`, `token_coverage text[]` and partial index `idx_workflow_runs_org_coverage_incomplete`.
- **Migration 183**: `model_rates` table (`model_id`, `provider`, `effective_from`, `input_cost_per_million`, `output_cost_per_million`).
- **Phase 256 decisions**:
  - `D-256-03`: Never sum across `runs` and `workflow_runs`.
  - `D-256-06`: `NULL` = never measured, `0` = measured as zero.
  - `D-256-07`: `token_coverage` records which legs were counted (`[agent, single, batch, emit]`).

## Variants

- **Variant A: Instrument Cockpit (High Density)**
  - Dense overview card grid (Total Spend with asterisk footnote, Total Tokens, Priced Ratio, Blind Spot count).
  - Prominent "What This View Cannot See" amber honesty callout card directly above the table with immediate filter buttons (`[Filter 8 Unrated]`, `[Filter 5 Incomplete]`).
  - High-density data table with `Unrated` and `Incomplete Coverage` chips, tooltips naming missing models/legs, and one-click popover to add rates.

- **Variant B: Deep Inspection (Split-Plane with Formula Trace)**
  - Master-detail split pane.
  - Clicking any run opens an Inspector Drawer showing exact token breakdown, the matching `model_rates` row (`effective_from` timestamp), the exact math formula (`input_tokens × rate_in + output_tokens × rate_out`), and an audit trail of counting legs.

- **Variant C: Rate Registry & Repricing Sub-view**
  - Focuses on the rate management interface (`D-257-11`).
  - Displays all active model rates, effective dates, and past historical rates.
  - Includes the interactive "Reprice Model" dialog allowing operators to add new effective-dated rates (`now()`) with instant before/after price impact preview.

## How to View

```bash
# Open in browser:
start .planning/sketches/257-spend-and-metering/index.html
# or
start .planning/sketches/257-spend-and-metering.html
```

Use the top navigation bar to toggle between Variants A, B, and C, and test the interactive filter pills and modals.
