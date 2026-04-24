---
phase: 31-audit-log-settings-ui
plan: "01"
subsystem: backend
tags: [audit, fastapi, csv-export, pagination, tdd]
dependency_graph:
  requires: [Phase 30 audit_log table + write_audit_entry service]
  provides: [GET /audit-logs, GET /audit-logs/export]
  affects: [frontend Settings UI — Plan 02 will consume these endpoints]
tech_stack:
  added: []
  patterns: [Supabase count="exact" for pagination, StreamingResponse with text/csv, lineterminator="\n" for cross-platform CSV]
key_files:
  created:
    - backend/app/api/audit.py
    - backend/tests/test_audit.py
  modified:
    - backend/tests/conftest.py
    - backend/app/main.py
decisions:
  - "/export route placed before "" route in router definition to prevent path shadowing by future /{id} routes"
  - "lineterminator='\\n' used in csv.writer to produce Unix-style line endings — avoids CRLF test assertion failures on Windows"
  - "Export endpoint fetches all matching rows (no pagination) — export is meant to be complete; pagination only on list endpoint"
  - "count_res.count falls back to len(count_res.data) when count is None — defensive for mock compatibility"
metrics:
  duration: "160s"
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_modified: 4
---

# Phase 31 Plan 01: Audit Log Read API Summary

**One-liner:** FastAPI audit read router with paginated list (count="exact") and full CSV export, filtered by user_id + since + action_type, with 7 passing integration tests.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wire conftest builder mock + create test scaffold | dbb3829 | conftest.py, test_audit.py |
| 2 | Create audit router with list and export endpoints | 191fa3d | audit.py, main.py |

## What Was Built

**GET /audit-logs** — paginated list endpoint:
- Query params: `page` (default 1), `page_size` (default 50, max 100), `since` (7d/30d/90d), `action_type`
- Returns: `{"entries": [...], "total": N, "page": 1, "page_size": 50}`
- Two Supabase queries: one count query with `count="exact"`, one data query with `.range(offset, offset+page_size-1)`
- All rows filtered to requesting user via `.eq("user_id", user_id)`

**GET /audit-logs/export** — full CSV export:
- Same filter params as list endpoint
- Returns `text/csv` with `Content-Disposition: attachment; filename=audit-log.csv`
- CSV columns: `timestamp, action_type, details, metadata_json`
- `_format_details()` produces human-readable one-liners for all 8 action types

**Helper functions:**
- `_since_to_dt(since)` — converts 7d/30d/90d to UTC datetime cutoff
- `_apply_filters(query, user_id, since, action_type)` — shared filter chain for both endpoints
- `_format_details(action_type, metadata)` — details column per action type
- `_format_bytes(size)` — human-readable file size (B/KB/MB)

**settings.update details:** Uses `metadata.get("new_settings", {})` and joins keys with ", " — matches Phase 30 audit metadata shape exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSV CRLF line endings caused test assertion failure on Windows**
- **Found during:** Task 2 GREEN verification
- **Issue:** Python's `csv.writer` on Windows defaults to `\r\n` line endings; test split on `\n` left trailing `\r` on `lines[0]`
- **Fix:** Added `lineterminator="\n"` to `csv.writer()` call in `export_audit_logs`
- **Files modified:** `backend/app/api/audit.py`
- **Commit:** 191fa3d (included in Task 2 commit)

## Known Stubs

None — all endpoints return real data from Supabase queries.

## Self-Check: PASSED

- [x] `backend/app/api/audit.py` exists
- [x] `backend/tests/test_audit.py` exists (7 test functions)
- [x] `backend/tests/conftest.py` has `.gte.return_value` and `.range.return_value` wiring
- [x] `backend/app/main.py` has `app.include_router(audit.router)`
- [x] Task 1 commit dbb3829 exists
- [x] Task 2 commit 191fa3d exists
- [x] All 7 tests pass GREEN
