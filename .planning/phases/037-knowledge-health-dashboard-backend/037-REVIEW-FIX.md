---
phase: 037
status: all_fixed
findings_in_scope: 4
fixed: 4
skipped: 0
iteration: 1
---

# Phase 037 Review Fix Report

All four warning-severity findings were fixed atomically. All 7 tests pass after changes.

---

## WR-01 — Unbounded audit_log fetch in `_fetch_never_retrieved`

**Status:** Fixed

**Commit:** `bd9d6c2`

**Change:** Added `.limit(5000)` to the `audit_log` query in `_fetch_never_retrieved`. A comment above the query explains the all-time intent (no date window so documents are only surfaced as "never retrieved" if they have truly never appeared in any search) and documents the safety cap rationale and the long-term Postgres subquery direction (Rule 4 boundary).

**File:** `backend/app/api/knowledge_health.py` (~line 95)

---

## WR-02 — No server-side LIMIT on documents queries

**Status:** Fixed

**Commit:** `75a6801`

**Changes:**

- `_fetch_stale`: Added `.order("created_at", desc=False).limit(TOP_N)` to the Supabase query so the DB returns only the TOP_N oldest documents directly. Removed the Python-side `.sort()` and `[:TOP_N]` slice since ordering and limiting is now done at the DB level.
- `_fetch_never_retrieved` (documents query): Added `.limit(500)` with a comment explaining that the set-difference logic makes a tighter server-side filter impractical without a Postgres subquery (Rule 4), and the cap prevents transferring an unbounded document list over the network.

**File:** `backend/app/api/knowledge_health.py` (~lines 87, 201)

---

## WR-03 — No exception handling around `.execute()` calls

**Status:** Fixed

**Commit:** `f62f951`

**Change:** Added `HTTPException` to the FastAPI import. Wrapped the entire `knowledge_health_summary` endpoint body in a `try/except Exception` block that re-raises as `HTTPException(status_code=502, detail="Health metrics temporarily unavailable")`. This keeps helpers simple (no per-helper try/except) and ensures Supabase errors (network failures, `PostgrestAPIError`, etc.) return a safe 502 response instead of leaking internal stack traces.

**File:** `backend/app/api/knowledge_health.py` (endpoint function)

---

## WR-04 — Stale tests don't verify the cutoff value passed to `.lt()`

**Status:** Fixed

**Commit:** `19f5176`

**Changes:**

- Added `_approx_cutoff(days)` helper at module level that returns `datetime.now(timezone.utc) - timedelta(days=days)`.
- Added `from datetime import datetime, timedelta, timezone` import.
- Replaced `mock_builder.lt.assert_called()` in both `test_stale_applies_days_param` (180 days) and `test_stale_default_90_days` (90 days) with assertions that:
  1. Confirm `.lt()` was actually called.
  2. Assert the first positional argument is `"created_at"`.
  3. Parse the second positional argument as an ISO datetime.
  4. Assert the parsed cutoff is within 5 seconds of the expected value from `_approx_cutoff(N)`.

A regression where `stale_days` is silently ignored will now cause both tests to fail.

**File:** `backend/tests/test_knowledge_health.py`

---

## Verification

```
7 passed, 1 warning in 0.17s
```

All 7 tests pass with no regressions.
