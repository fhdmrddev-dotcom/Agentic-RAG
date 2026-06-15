# Phase 111 — Deferred Items (out-of-scope discoveries)

Items found during execution that are NOT caused by the current task's changes.
Logged per the executor scope-boundary rule; NOT fixed in this plan.

## Plan 03

- **`backend/tests/unit/test_lifespan.py` — 3 pre-existing failures** (NOT net-new).
  `test_pg_pool_closes_before_supabase`, `test_pg_pool_close_timeout_falls_back_to_terminate`,
  `test_supabase_aclose_after_pg_pool` all FAIL with a `TypeError` at the **base** commit
  (verified by running against the unmodified base `app/main.py` via `git stash`). The Plan 03
  `metadata_fields` router mount is purely additive and does not touch the lifespan close-order
  logic these tests exercise. Out of scope for META-01; candidate for a future lifespan-test
  refresh (likely an AsyncMock/await-shape drift, same class as the 075.4 FK-violation cluster).
