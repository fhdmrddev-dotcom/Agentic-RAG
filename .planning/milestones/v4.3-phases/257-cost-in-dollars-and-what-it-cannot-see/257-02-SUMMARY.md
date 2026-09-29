# Phase 257 Plan 02 Summary — Database Rate Aggregation & Operator Spend API

**Phase:** 257 — Cost in Dollars, and What It Cannot See  
**Plan:** 257-02  
**Status:** Completed  
**Completed Date:** 2026-09-19  

---

## 1. Objectives Achieved

1. **Database Rate Query & Aggregation Layer (`backend/app/db/rates.py`)**:
   - `get_rate_for_model`: Effective-dated rate lookup supporting model name, optional provider, and optional org_id with fallback to NULL values.
   - `reprice_model`: Append-only insertion into `model_rates` with `effective_from = now()`, preserving historical price immutability for past runs (`D-257-03`).
   - `get_org_spend_summary`: High-performance aggregation using parameterized SQL:
     - `total_spend_usd`: Sums spend over rated runs only (`D-257-06`).
     - `unrated_runs_count`: Explicit count of runs excluded from total spend.
     - `incomplete_coverage_count`: Uses partial index `idx_workflow_runs_org_coverage_incomplete` without full table scan (`D-257-07`).
     - `daily_spend`: 14-day time series with per-day spend and unrated count.
     - `model_breakdown`: Per-model spend, token volume, and rating status.
   - `get_spend_runs`: Paginated attributable runs joined with effective rates and `workflow_runs.token_coverage`.

2. **Python-SQL Parity & DB Verification (`backend/tests/unit/test_257_rates_db.py`)**:
   - Tested mock pool query structure and parameter bindings for all functions.
   - Verified 25 permutations of token counts and rate sheets comparing PostgreSQL SQL formula against Python `compute_token_cost_usd` cent-for-cent to 4 decimal places (`D-257-15`).
   - All 6 tests passed in 0.40s.

3. **Admin Spend Sub-Router (`backend/app/api/admin_spend.py`)**:
   - Extracted spend endpoints to dedicated sub-router to avoid bloating G-5 hot file `backend/app/api/admin.py`.
   - `GET /summary`: Returns org spend summary and blind spot counts.
   - `GET /runs`: Returns paginated attributable runs with `is_rated`, `cost_usd`, and `token_coverage`.
   - `GET /rates`: Returns registered rates.
   - `POST /rates`: Protected endpoint for repricing models with `operator_audit_floor`.

4. **G-5 Router Mounting (`backend/app/api/admin.py`)**:
   - Cleanly mounted with `router.include_router(spend_router, prefix="/spend", tags=["admin-spend"])`.
   - Inherits `dependencies=[Depends(require_operator)]` router-level default-deny gate.
   - Hot-file ledger check passed (`node scripts/check-hot-file-ledger.cjs 257`).

5. **API Test Suite (`backend/tests/unit/test_257_admin_spend_api.py`)**:
   - Verified non-operator access receives byte-identical 404.
   - Verified response structures, unrated models rendering `None` instead of `$0.00`, and input validation on repricing.
   - All 4 tests passed in 5.46s.

6. **Single-Home AST Fence**:
   - Confirmed `test_257_single_token_conversion_home.py` passes cleanly across the new database and API files.

---

## 2. Verification Summary

- `pytest tests/unit/test_257_rates_db.py`: 6 passed.
- `pytest tests/unit/test_257_admin_spend_api.py`: 4 passed.
- `pytest tests/unit/test_257_single_token_conversion_home.py`: 1 passed.
- `node scripts/check-hot-file-ledger.cjs 257`: OK (301 rows tracked).

---

## 3. Next Steps

Proceed directly to **Plan 257-03**:
- Implement frontend spend types and client (`frontend/src/types/spend.ts`, `frontend/src/api/spend.ts`).
- Author UI components (`DailySpendChart.tsx`, `SpendDonutChart.tsx`, `BlindSpotsCard.tsx`, `RepriceModal.tsx`, `AdminSpendPage.tsx`).
- Mount route in `frontend/src/App.tsx`.
