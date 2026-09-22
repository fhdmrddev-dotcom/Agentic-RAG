# Phase 257 Plan 04 Summary — Run-Level Cost Affordances & G-4 Verification

**Phase:** 257 — Cost in Dollars, and What It Cannot See  
**Plan:** 257-04  
**Status:** Completed  
**Completed Date:** 2026-09-19  

---

## 1. Objectives Achieved

1. **Run-Level Cost Badge Component (`frontend/src/components/workflow/RunCostBadge.tsx`)**:
   - Implemented `RunCostBadge` rendering run cost with strict blind-spot honesty:
     - When `isRated === false` or `costUsd === null`: Renders amber chip `▲ Unrated` with hover tooltip naming the model (or "Unrated model"). Strictly **never renders `$0.00`** (`D-257-05`).
     - When `tokenCoverage` is incomplete (missing any of the 4 legs: `agent`, `single`, `batch`, `emit`): Renders dollar cost with warning footnote `*` (e.g., `$0.4500*`) and tooltip `"Incomplete token coverage: lower bound"`.
     - When fully rated with complete coverage: Renders monospace dollar amount formatted to 4 decimal places (e.g., `$1.3160`).
   - Authored comprehensive test suite `frontend/src/components/workflow/RunCostBadge.test.tsx` (5/5 passing) validating all badge states, tooltip disclosures, and the strict anti-`$0.00` invariant.

2. **Surgical Mounts in WorkflowRunPage & RunCard**:
   - `frontend/src/pages/WorkflowRunPage.tsx`: Mounted `<RunCostBadge>` in the run header metadata strip alongside duration and token counts. Kept changes surgical to respect hot file stability guidelines (`G-5`).
   - `frontend/src/components/chat/RunCard.tsx`: Mounted `<RunCostBadge>` alongside `RunStatusStrip` as a direct sibling in the title column to preserve existing DOM query selector contracts.
   - Updated frontend types (`WorkflowRunRead` in `frontend/src/lib/api/workflows.ts`, `Message` in `frontend/src/types/index.ts`) to surface `cost_usd`, `is_rated`, and `token_coverage`.
   - Verified that existing regression suites remained 100% green:
     - `WorkflowRunPage.test.tsx`: 173/173 tests passing.
     - `RunCard.test.tsx`: 29/29 tests passing.

3. **Database Column Parity Hardening (`backend/app/db/rates.py`)**:
   - Aligned database queries with live Postgres schema: `model_rates` table uses `model_id` (not `model_name`) and is strictly append-only without `effective_to`.
   - Verified Python and SQL spend parity across 25 token permutations in `tests/unit/test_257_rates_db.py` (6/6 passing).
   - Confirmed admin spend API router in `tests/unit/test_257_admin_spend_api.py` (4/4 passing).

4. **G-4 Lived-Experience Failure Scenario Verification (`backend/tests/uat_257_scenarios.py`)**:
   - Automated and ran all 3 failure scenarios directly against live Supabase Postgres on port 54322:
     - **Scenario 1 (The Free Lie):** Inserted unrated run with model `qwen-2.5-72b` with real tokens. Verified `cost_usd` is `None` (never `$0.00`), `is_rated` is `False`, org total spend excludes unrated usage with disclaimer, and unrated run is correctly flagged.
     - **Scenario 2 (Historical Rewrite):** Inserted run at T0 under rate $2.50 in / $10.00 out ($0.7500). Fast-forwarded to T1 and repriced model to $10.00 in / $50.00 out (4x hike). Re-queried T0 run cost and confirmed it remained **exactly $0.7500** (price-immutable). Inserted T2 run after repricing and verified it priced at the new rate ($3.5000) while T0 stayed immutable at $0.7500.
     - **Scenario 3 (Blind Spot Amnesia):** Seeded workflow run with incomplete token coverage (`['agent', 'single']`). Queried org spend summary and verified `incomplete_coverage_count == 1`. Queried filtered spend runs and verified run is returned under `incomplete_coverage` filter with partial coverage legs.
   - All 3 scenarios PASSED (3/3).

---

## 2. Verification Summary

- **Backend Unit Tests:**
  - `tests/unit/test_257_single_token_conversion_home.py`: 1 passed (AST single-home fence enforced).
  - `tests/unit/test_257_pricing_service.py`: 8 passed.
  - `tests/unit/test_257_rates_db.py`: 6 passed.
  - `tests/unit/test_257_admin_spend_api.py`: 4 passed.
- **Backend UAT Tests (Live Postgres :54322):**
  - `tests/uat_257_scenarios.py`: 3 passed (The Free Lie, Historical Rewrite, Blind Spot Amnesia).
- **Frontend Vitest Suites:**
  - `RunCostBadge.test.tsx`: 5 passed.
  - `AdminSpendPage.test.tsx`: 6 passed.
  - `RunCard.test.tsx`: 29 passed.
  - `WorkflowRunPage.test.tsx`: 173 passed.
- **TypeScript Check (`tsconfig.app.json`):**
  - Zero TypeScript errors across all Phase 257 files.
- **Hot-File Ledger Check:**
  - `node scripts/check-hot-file-ledger.cjs 257` — OK (every watched file has a row).
- **Count Gate Check:**
  - `vitest-count-gate.cjs` — 0 deleted tests across 114+ files (+741 net tests).

---

## 3. Phase 257 Completion

Phase 257 ("Cost in Dollars, and What It Cannot See") is complete across all 4 plans:
- Plan 257-01: Migration 183, pricing service single-home, AST fence, unit tests.
- Plan 257-02: Database layer `rates.py`, Python-SQL parity tests, `admin_spend.py` API.
- Plan 257-03: Spend cockpit, pure SVG charts, honesty disclosure cards, append-only reprice modal.
- Plan 257-04: Run-level cost badge, surgical mounts, and live database G-4 UAT verification.
