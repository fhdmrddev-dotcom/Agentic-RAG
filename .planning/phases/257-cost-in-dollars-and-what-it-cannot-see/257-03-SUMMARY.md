# Phase 257 Plan 03 Summary — Operator Spend Cockpit, SVG Charts & Honesty Card

**Phase:** 257 — Cost in Dollars, and What It Cannot See  
**Plan:** 257-03  
**Status:** Completed  
**Completed Date:** 2026-09-19  

---

## 1. Objectives Achieved

1. **Frontend Data Contracts & API Client (`frontend/src/types/spend.ts`, `frontend/src/api/spend.ts`)**:
   - Authored TypeScript definitions for `SpendSummaryData`, `SpendRunItem`, `ModelRateItem`, `ModelSpendShare`, and filters (`TimeRangeFilter`, `CoverageFilter`).
   - Implemented typed API functions `getSpendSummary`, `getSpendRuns`, `getModelRates`, and `repriceModel` calling `/admin/spend/...` endpoints with auth headers.
   - Enforced nullable cost semantics (`costUsd: number | null`) to prevent unrated runs from ever being represented as `$0.00`.

2. **Custom Pure SVG Visualizations (No bloated charting dependencies)**:
   - `DailySpendChart.tsx`: 14-day attributable spend bar chart with hover tooltips, date labels, and overlaid unrated volume warning indicators.
   - `SpendDonutChart.tsx`: Per-model market share donut ring with hover slices, center total spend readout, and explicit unrated exclusion note.

3. **Honesty Summary & Append-Only Rate Modal**:
   - `BlindSpotsCard.tsx`: "What This View Cannot See" card prominently displaying rated vs unrated percentages, unrated run count, incomplete token coverage count (legs missing among `agent`, `single`, `batch`, `emit`), and residual disclosure (`SEED-300`). Includes quick-filter action buttons.
   - `RepriceModal.tsx`: Append-only model repricing modal with clear disclaimer that repricing strictly applies to future runs and never alters historical run costs.

4. **Operator Spend Cockpit (`frontend/src/pages/admin/AdminSpendPage.tsx`)**:
   - KPI cards for Total Org Spend, Tokens Counted (with in/out ratio), Pricing Coverage Ratio, and Blind Spots Count.
   - Time range filter pills (`Today`, `7D`, `30D`, `All Time`) and Coverage filter pills (`All Runs`, `Fully Rated`, `Has Unrated`, `Partial Coverage`).
   - Attributable Runs Ledger table displaying run name, model, provider, tokens, timestamp, coverage pills, and cost.
   - Strictly enforces invariant `D-257-05`: Unrated runs display `▲ Unrated` with hover tooltip naming the unrated model, and NEVER display `$0.00`.
   - Rate Registry tab displaying active model rates and allowing new rates to be registered.
   - Integrated `alive` cancellation guard in `useEffect` to avoid race conditions.

5. **App Shell Routing & Navigation**:
   - `frontend/src/App.tsx`: Mounted `/admin/spend` path routing to `<AdminSpendPage onBack={() => window.history.back()} />`.
   - `frontend/src/components/layout/ChatLayout.tsx`: Mounted `<AdminSpendPage onBack={() => onNavigate("control-room")} />` under `activeView === "admin-spend"`.

6. **Comprehensive Vitest Suite (`frontend/src/pages/admin/AdminSpendPage.test.tsx`)**:
   - 6/6 tests passing:
     1. Renders cockpit title and KPI metrics with unrated asterisk disclaimer.
     2. Renders unrated runs with '▲ Unrated' badge and strictly NEVER renders `$0.00`.
     3. Updates spend runs list when coverage filter pills are clicked.
     4. Renders the 'What This View Cannot See' honesty card with quick filter actions.
     5. Switches to Active Rate Registry tab and displays registered rates.
     6. Opens Reprice Model modal with strict append-only disclaimer.

---

## 2. Verification Summary

- `npx vitest run src/pages/admin/AdminSpendPage.test.tsx`: 6 passed (6/6).
- Checked hot file ledger: `ChatLayout.tsx` and `App.tsx` properly preserved.

---

## 3. Next Steps

Proceed to **Plan 257-04** (Run-Level Cost Affordances & G-4 Verification):
- Implement `frontend/src/components/chat/RunCostBadge.tsx` displaying run cost with `▲ Unrated` and `Incomplete Coverage` badges.
- Mount `RunCostBadge` in `frontend/src/pages/WorkflowRunPage.tsx` and `frontend/src/components/chat/RunCard.tsx`.
- Author and execute `backend/tests/uat_257_scenarios.py` verifying the 3 G-4 scenarios against live Postgres:
  1. *The Free Lie:* Run with unrated model displays `▲ Unrated`, not `$0.00`.
  2. *Historical Rewrite:* Adding a new rate does not alter past run cost totals.
  3. *Blind Spot Amnesia:* Unrated and partial coverage runs are clearly accounted for in blind-spot metrics.
