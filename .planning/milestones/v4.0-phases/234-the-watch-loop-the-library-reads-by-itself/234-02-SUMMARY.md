# Phase 234 Plan 02 Summary: Watch Service Engine & Completeness Guard

**Execution Wave:** 2  
**Status:** Complete  
**Requirements Addressed:** LIB-08, SRC-06, QUEUE-03, VIS-03, VIS-04  

---

## 1. Key Accomplishments

1. **SourceListing Contract Abstraction (`base.py`)**:
   - Defined `SourceListing(files: list[SourceFile], complete: bool = False, error: str | None = None)` in `backend/app/services/sources/base.py`.
   - Structural assertion: Defaults to `False` (fails closed). Only set to `True` when pagination loop terminates with `next_page_token is None` and 0 unhandled exceptions occurred.

2. **WatchService Engine (`watch_service.py`)**:
   - Created `backend/app/services/watch_service.py` with:
     - `tick()`: Claims due watches using `claim_due_watches` (`FOR UPDATE SKIP LOCKED`, `QUEUE-03`).
     - `SEED-239` Error Isolation: Every watch sync is wrapped in an isolated `try...except` boundary. A failing watch updates its `last_error` and releases as `failed`, never halting other watches.
     - Paged listing loop over `adapter.list_files(conn, folder_id)` building `SourceListing`.
     - Diff Engine:
       - **New files**: Fetches file bytes via `adapter.read_file(conn, item.id)`, calls `async_mint_document_row` (keyword-only signature). If duplicate (`mint_res.is_duplicate=True`), links item into watch tracking and skips byte upload and job enqueue. If new content, uploads bytes to Supabase storage (`supabase.storage.from_("documents").upload`) and enqueues `insert_ingestion_job`.
       - **Modified files**: Mints new version with new bytes and enqueues ingestion job.
       - **Renamed / Moved files (SC#4)**: Recognizes matching `external_id` with changed name/path_hint; updates `connector_watch_items.name` and updates `documents.filename` without creating duplicate rows or re-ingesting.
       - **Missing files (H-5 / SRC-06)**: If `listing.complete is not True`, missing state transitions are strictly suppressed (stopping Onyx #1161 silent deletion). If `listing.complete is True`, transitions item to `state='missing'`, updates document `source_state='missing_at_source'`, and retains document row in DB (`VIS-03`).
       - **Unauthorized files (VIS-04)**: On 403 / permission error from external source, transitions items to `state='unauthorized'` and document `source_state='unauthorized_at_source'`.

3. **Config & Lifespan Wiring**:
   - Added `watch_process_enabled: bool = False`, `watch_poll_interval_seconds: int = 60`, `watch_lease_seconds: int = 600` to `backend/app/config.py`.
   - Wired `WatchService` into `backend/app/main.py` lifespan (starts when `watch_process_enabled=True`, clean shutdown on stop).

4. **Deploy Artifact Synchronization**:
   - Updated `backend/.env.example` and `deploy/onebox.env.example` with `WATCH_PROCESS_ENABLED=false` and `WATCH_POLL_INTERVAL_SECONDS=60`.
   - Added environment mapping in `docker-compose.prod.yml`.
   - Documented `WATCH_PROCESS_ENABLED` in `docs/OPERATOR.md`.
   - `bash scripts/check-deploy-drift.sh` passes with **0 drift (PASS)**.

5. **Unit Testing & Verification**:
   - `backend/tests/unit/services/test_watch_service.py`: 4/4 passing (new file mint + upload + enqueue, duplicate handling, rename SC#4, SEED-239 error isolation).
   - `backend/tests/unit/services/test_watch_diff_completeness.py`: 4/4 passing (H-5 completeness guard, VIS-03 deletion retention, re-appearance restoration, VIS-04 unauthorized).
   - Combined Wave 1 and Wave 2 tests: **14/14 passing in 0.73s** (0 failed, 0 errors).
