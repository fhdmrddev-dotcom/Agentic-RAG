---
phase: 247-sources-and-watches
plan: 02
status: complete
wave: 1
commits:
  - id: pending
    message: "feat(247-02): watch missing_since lifecycle and connection is_enabled health verdict"
requirements_met: [WATCH-03, WATCH-05]
gates_passed:
  - "backend/tests/unit/test_247_watch_missing_lifecycle.py: 6/6 passed"
  - "backend/tests/unit/services/test_watch_service.py: 6/6 passed"
  - "backend/tests/unit/db/test_watches_db.py: 18/18 passed"
  - "backend/tests/unit/api/test_sources_watches_api.py: 10/10 passed"
  - "connectors.py fence: byte-identical (0 lines modified)"
---

# Plan 247-02 Summary: Watch Loop missing_since Lifecycle & Connection Health Verdict

**Delivered:**
1. **`missing_since` Timestamp Lifecycle in Watch Service & DB (WATCH-05):**
   - In `backend/app/db/watches.py`, updated `update_item_state` and `bulk_update_item_states` with `clear_missing_since: bool = False`. When transitioning to `present` (or when `clear_missing_since=True`), `missing_since` is reset to `NULL`. When transitioning to `missing`, the exact UTC timestamp is recorded via `missing_since = COALESCE($3, now())`.
   - In `backend/app/services/watch_service.py`:
     - Disappearance loop (under complete listing): writes `missing_since=datetime.now(timezone.utc)` when items vanish at the remote source.
     - Restore loop: passes `clear_missing_since=True` when previously missing files reappear.
     - Preserves H-5 invariant: incomplete listings suppress missing transitions completely.
2. **Immediate Connection `is_enabled` Health Diagnostics (WATCH-03):**
   - In `backend/app/api/sources.py` (`GET /sources/health`), queried `is_enabled` and `updated_at` directly from `connector_connections` alongside watch statuses.
   - If a connection is switched off (`is_enabled == False`), its watches are immediately classified as stopped with cause `connection_disabled`, `hard=True`, and `stopped_since=conn.updated_at` without waiting for asynchronous background sync runs.
3. **Strict Boundary Fence on `connectors.py`:**
   - `backend/app/api/connectors.py` remains byte-identical with 0 lines modified.
4. **Comprehensive Test Coverage:**
   - `backend/tests/unit/test_247_watch_missing_lifecycle.py` verifies missing timestamp creation, clearing on reappearance, H-5 incomplete listing protection, disabled connection health verdict, and the `connectors.py` fence.
