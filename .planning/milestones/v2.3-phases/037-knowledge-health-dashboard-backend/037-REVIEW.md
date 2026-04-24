---
phase: 037
status: issues_found
files_reviewed: 4
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
---

# Phase 037 Code Review

**Files reviewed:**
- `backend/app/api/knowledge_health.py`
- `backend/tests/test_knowledge_health.py`
- `backend/app/main.py`
- `backend/tests/conftest.py`

**Overall:** No critical bugs or security vulnerabilities. RLS enforcement is correct on all queries. Four warning-level performance and robustness issues, three informational gaps in test coverage.

---

## Findings

### WR-01: `_fetch_never_retrieved` fetches entire audit_log with no time window
**File:** `backend/app/api/knowledge_health.py:95`
**Severity:** warning
**Issue:** The audit_log query in `_fetch_never_retrieved` has no `gte("created_at", ...)` filter. It pulls every `search.query` row ever recorded for the user into Python memory to build `retrieved_set`. For a user with months of search history this can be tens of thousands of rows. The other two audit queries (`_fetch_most_retrieved`, `_fetch_low_confidence`) both scope to `WINDOW_DAYS`. The never-retrieved logic intentionally wants all-time history, but the implementation has no server-side limit and no pagination.
**Fix:** Either accept the all-time scan consciously and add a comment explaining why, or add a server-side `.limit()` cap (e.g. 5000 rows) and document the trade-off. A better long-term approach is an RPC or a `NOT IN (SELECT document_id FROM audit_log WHERE ...)` subquery pushed to Postgres, but that requires a DB migration (Rule 4 territory). For now, add `.limit(5000)` with a comment to prevent runaway memory use.

---

### WR-02: `_fetch_stale` and `_fetch_never_retrieved` apply no server-side LIMIT on documents query
**File:** `backend/app/api/knowledge_health.py:87`, `backend/app/api/knowledge_health.py:201`
**Severity:** warning
**Issue:** Both functions fetch all matching documents from Supabase and then slice/sort in Python. `_fetch_stale` fetches all documents older than the cutoff (potentially the entire library), sorts them by `days_stale` descending, and returns `[:TOP_N]`. `_fetch_never_retrieved` similarly fetches all active documents. For a user with a large document library this is wasteful: if 500 documents are stale, all 500 rows are transferred over the network before Python discards 490 of them.
**Fix:** For `_fetch_stale`, add `.order("created_at", desc=False).limit(TOP_N)` to the Supabase query — oldest documents appear first, and only TOP_N rows are transferred. For `_fetch_never_retrieved`, the set-difference logic makes server-side limiting harder, so add `.limit(500)` as a safety cap and document it. The Python-side `break` at line 119 already limits the result list but does not reduce DB transfer.

---

### WR-03: No exception handling around `.execute()` calls — Supabase errors produce unhandled 500s
**File:** `backend/app/api/knowledge_health.py:36`, `99`, `130`, `204`
**Severity:** warning
**Issue:** All four helper functions call `.execute()` with no try/except. If Supabase is unavailable, returns a non-200 HTTP status, or raises a `PostgrestAPIError`, the exception propagates through FastAPI's default handler. This produces a 500 response whose body may expose internal stack traces or Supabase error messages to the client. Other endpoints in the codebase follow the same pattern, but the `knowledge_health` endpoint makes five separate queries per request, increasing the probability of at least one failing mid-flight. A partial failure (e.g. `_fetch_stale` errors after the first three helpers succeed) returns nothing instead of partial data.
**Fix:** Wrap each helper's `.execute()` call in a try/except and either re-raise as an `HTTPException(status_code=502)` with a safe message, or return an empty list with a logged warning so the other three metrics still reach the client. At minimum, catch at the endpoint level and return a structured error rather than leaking internal details.

---

### WR-04: `test_stale_applies_days_param` does not verify the cutoff value passed to `.lt()`
**File:** `backend/tests/test_knowledge_health.py:171`
**Severity:** warning
**Issue:** The test verifies that `mock_builder.lt` was called (`.assert_called()`) but does not inspect the argument. A regression where `stale_days` is accepted as a query param but silently ignored (e.g. always using the default `90`) would pass this test. Similarly `test_stale_default_90_days` only checks that `.lt` was called, not that the cutoff string corresponds to 90 days ago.
**Fix:** Use `mock_builder.lt.assert_called_once_with("created_at", ...)` and verify the second argument is approximately the expected ISO timestamp. A helper that parses the cutoff string and checks it is within a few seconds of `datetime.now(UTC) - timedelta(days=N)` would make the assertion robust without being brittle about exact string formatting.

---

### IR-01: No test for `confidence_avg_similarity` row-level fallback path
**File:** `backend/tests/test_knowledge_health.py:133`
**Severity:** info
**Issue:** `_fetch_low_confidence` falls back to `row.get("confidence_avg_similarity")` when a `source_refs` entry has no `avg_similarity` key (line 148). This fallback is only exercised indirectly by `test_low_confidence_filters_below_threshold` because the existing test data always provides `avg_similarity` in each source_ref. The fallback path goes untested — a regression that breaks it (e.g. `score = None` instead of `row_similarity`) would not be caught.
**Fix:** Add a test case where one `source_refs` entry omits `avg_similarity` and verify the document is still included/excluded based on the row-level `confidence_avg_similarity` fallback.

---

### IR-02: RLS assertion in `test_rls_user_id_filter_applied` is under-constrained
**File:** `backend/tests/test_knowledge_health.py:189`
**Severity:** info
**Issue:** The test asserts `len(user_id_calls) >= 4`. There are actually 5 distinct `.execute()` calls in the all-empty path (audit_log for most_retrieved, documents for never_retrieved, audit_log for never_retrieved, messages for low_confidence, documents for stale), each requiring a `user_id` eq filter — so the minimum should be 5. The current threshold of 4 would still pass even if one query was missing the `user_id` filter, providing a false sense of security for the RLS check.
**Fix:** Change `>= 4` to `>= 5` to match the actual query count. Optionally enumerate the expected eq calls explicitly: `mock_builder.eq.assert_any_call("user_id", mock_user_data["id"])` combined with a count check against the full call list.

---

### IR-03: `_fetch_never_retrieved` early-exit `break` fires after append, limiting to TOP_N correctly but confusingly
**File:** `backend/app/api/knowledge_health.py:119`
**Severity:** info
**Issue:** The `break` at line 119 executes after `results.append(...)`, so the list grows to exactly `TOP_N` before stopping. This is logically correct. However, the loop continues iterating through `docs_res.data` until `TOP_N` is reached, meaning up to the full document list is scanned in the worst case (e.g. if the last TOP_N eligible documents are at the end of the list). If the never-retrieved documents are evenly distributed, this is fine; if they are sparse, the full document list is scanned in Python regardless.
**Fix:** No correctness fix needed. Consider moving the guard before the append for clarity: `if len(results) >= TOP_N: break` placed before `results.append(...)`. This is a minor readability issue only.

---

## Summary

| ID    | Severity | Area                          | File                         |
|-------|----------|-------------------------------|------------------------------|
| WR-01 | warning  | Unbounded audit_log fetch     | knowledge_health.py:95       |
| WR-02 | warning  | No server-side LIMIT on docs  | knowledge_health.py:87, 201  |
| WR-03 | warning  | No exception handling on .execute() | knowledge_health.py:36  |
| WR-04 | warning  | Stale test doesn't verify cutoff | test_knowledge_health.py:171 |
| IR-01 | info     | Fallback path untested        | test_knowledge_health.py:133 |
| IR-02 | info     | RLS assertion threshold off   | test_knowledge_health.py:189 |
| IR-03 | info     | Break placement confusing     | knowledge_health.py:119      |

**RLS enforcement:** All four helper functions correctly apply `.eq("user_id", user_id)` to every Supabase query. No RLS bypass risk found.

**Security:** No injection vulnerabilities. The `stale_days` parameter is validated with `ge=1, le=3650`. `user_id` is derived from the authenticated JWT via `get_current_user` dependency — not from request body or query params.

**Router registration:** `knowledge_health.router` is correctly included in `main.py` with the `/knowledge-health` prefix.
