# Phase 257 Plan 01 Summary — Model Rates Migration, Pricing Service & AST Fence

**Phase:** 257 — Cost in Dollars, and What It Cannot See  
**Plan:** 257-01  
**Status:** Completed  
**Completed Date:** 2026-09-19  

---

## 1. Objectives Achieved

1. **Database Registry (`METER-01`)**:
   - Created [supabase/migrations/183_model_rates.sql](file:///c:/Vibe%20Apps/Agentic%20RAG/supabase/migrations/183_model_rates.sql) with table `model_rates`:
     - Columns: `id`, `model_name`, `provider`, `input_cost_per_million`, `output_cost_per_million`, `effective_from`, `effective_to`, `org_id`, `created_at`.
     - Compound index: `model_rates_lookup_idx` on `(model_name, effective_from, effective_to)`.
     - RLS: enabled with SELECT/INSERT/UPDATE/DELETE policies referencing `public.org_members` (following Migration 104 conventions).
     - Seeded standard 2026 reference rates for 5 flagship models (`gpt-4o`, `gpt-4o-mini`, `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `text-embedding-3-small`).
   - Applied Migration 183 to local Postgres on port 54322.
   - Regenerated [supabase/full-schema.sql](file:///c:/Vibe%20Apps/Agentic%20RAG/supabase/full-schema.sql) (+114 lines) and verified parity with `node scripts/check-schema-acl-parity.cjs` (133/133 mirrored).

2. **Single-Home Pricing Engine (`METER-02`)**:
   - Authored [backend/app/services/pricing_service.py](file:///c:/Vibe%20Apps/Agentic%20RAG/backend/app/services/pricing_service.py):
     - Classes: `ModelRate`, `CostResult`.
     - Function: `compute_token_cost_usd(model_name, prompt_tokens, completion_tokens, as_of, rates)`.
     - Core guarantee: Unrated models return `CostResult(cost_usd=None, is_rated=False, ...)` which formats strictly as `"Unrated"`, NEVER `$0.00` or `0.0`.
     - High precision arithmetic: uses `Decimal` rounded to 4 decimal places with `ROUND_HALF_UP`.
   - Authored unit test suite [backend/tests/unit/test_257_pricing_service.py](file:///c:/Vibe%20Apps/Agentic%20RAG/backend/tests/unit/test_257_pricing_service.py) with 8 tests covering: unrated model behavior, effective-date interval matching, decimal precision, zero-token calls, missing completion tokens, and boundary edge cases. All passed.

3. **AST Fence Enforcement (`METER-02`)**:
   - Authored [backend/tests/unit/test_257_single_token_conversion_home.py](file:///c:/Vibe%20Apps/Agentic%20RAG/backend/tests/unit/test_257_single_token_conversion_home.py):
     - Traverses entire `backend/app/` tree (handling UTF-8 BOM encoding safely).
     - Forbids any external function definitions with names like `*token*cost*`, `*calculate*cost*`, `*compute*cost*` outside of `pricing_service.py`.
     - Forbids ad-hoc inline divisions by `1_000_000` combined with token/rate variables.
   - Executed RED drive: planted rogue conversion in `_plant_duplicate_pricing.py`, confirmed test fails non-zero (`AssertionError`), removed file, confirmed test passes GREEN.

---

## 2. Verification Summary

- `pytest tests/unit/test_257_pricing_service.py`: 8 passed in 0.38s.
- `pytest tests/unit/test_257_single_token_conversion_home.py`: 1 passed (RED drive confirmed).
- `node scripts/check-schema-acl-parity.cjs`: OK (133/133 mirrored).
- `node scripts/check-hot-file-ledger.cjs 257`: OK (all watched files tracked).

---

## 3. Next Steps

Proceed directly to **Plan 257-02**:
- Implement DB access layer in `backend/app/db/rates.py`.
- Implement admin spend sub-router `backend/app/api/admin_spend.py` and mount in `backend/app/api/admin.py`.
- Verify database parity with Python pricing service and admin endpoint contracts.
