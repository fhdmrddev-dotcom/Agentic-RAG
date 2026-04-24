---
plan: 038-01
phase: 038-knowledge-health-dashboard-frontend
status: complete
completed: 2026-04-18
---

# Summary: 038-01 — Backend Reingest Endpoint

## What Was Built

Added `POST /documents/{document_id}/reingest` to `backend/app/api/documents.py`. The endpoint:
- Verifies document ownership via `user_id` filter
- Confirms `is_latest=True` (only the current version can be re-queued)
- Sets `status='pending'` to trigger the existing background ingestion poller
- Returns the updated `DocumentResponse`
- Raises `404` if document not found (both ownership check and post-update)

Also created `backend/tests/test_reingest.py` with 3 skipped test stubs documenting the three behaviors to verify once a test Supabase instance is available.

## Key Files

- `backend/app/api/documents.py` — new `reingest_document` function inserted after `restore_document_version` (~line 418)
- `backend/tests/test_reingest.py` — 3 skipped pytest stubs

## Verification

- Route registration: `python -c "from app.api.documents import router; ..."` → OK
- Tests: `pytest tests/test_reingest.py -v` → 3 skipped, 0 errors

## Self-Check: PASSED
