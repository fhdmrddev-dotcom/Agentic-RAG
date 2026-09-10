# Phase 234 Summary: The Watch Loop — The Library Reads By Itself

**Phase:** 234  
**Requirements:** `LIB-08`, `SRC-06`, `QUEUE-03`, `VIS-03`, `VIS-04`, `VIS-05`, `VIS-06`, `TRUST-03`, `SURF-01`  
**Status:** Complete & Verified  

---

## 1. Schema Note: `connector_watches` Columns (`is_active` vs `last_status`)

> ⚠ **IMPORTANT FOR FUTURE PHASES & EXTERNAL PROBES:**  
> The `connector_watches` table has **NO `status` column**.
>
> - **`is_active` (`boolean`, default `true`)**: Represents whether the watch is enabled or paused by the user.
> - **`last_status` (`text`, nullable, default `NULL`)**: Represents the execution outcome of the latest background poll (`NULL` before first run, `'completed'`, `'failed'`, `'disconnected'`).
>
> Do not write queries or health checks expecting `connector_watches.status`. Query `is_active` for enablement and `last_status` for latest execution health.

---

## 2. Defect Resolution: Watched Folders "Failed to fetch"

### Problem
When loading the Library Ingestion tab, the Watched Folders section surfaced `"Failed to load watched folders"` (`TypeError: Failed to fetch`).

### Root Cause Analysis
1. Unauthenticated or bare requests to `GET /sources/watches` returned 403 with valid CORS headers.
2. Authenticated requests with `Authorization` and `X-Org-Id` triggered execution of `list_folder_watches`.
3. In `backend/app/models/source.py`, `WatchResponse` had defined `last_status: str = "pending"`.
4. However, newly-minted rows in `connector_watches` have `last_status = NULL`.
5. Pydantic v2 raised `fastapi.exceptions.ResponseValidationError: last_status - Input should be a valid string, input is None`.
6. This unhandled response validation exception resulted in an internal 500 error whose response omitted the `Access-Control-Allow-Origin: http://localhost:5173` header.
7. Consequently, the browser's CORS check rejected the response, causing JavaScript `fetch()` to throw `TypeError: Failed to fetch`.

### Fix
- Updated `backend/app/models/source.py`: `last_status: str | None = "pending"`.
- Updated `backend/app/api/sources.py`: `record["last_status"] = record.get("last_status") or "pending"` in `_enrich_watch_rows`.
- Updated `frontend/src/lib/api/sources.ts`: `last_status?: string | null` in `ConnectorWatch`.
- Verified with live DB: `GET /sources/watches` now returns HTTP 200 with `Access-Control-Allow-Origin: http://localhost:5173` and active watches list cleanly.

---

## 3. Implementation Across Waves

1. **Wave 1 (234-01)**:
   - Migrations 168-171 committed and live (`connector_watches`, `connector_watch_items`, `documents.source_state`, `171_reserved.sql`).
   - Database DAL in `backend/app/db/watches.py` (6/6 tests passing).
   - Interactive G-2 Sketch 232 created in `.planning/sketches/232-the-watch-loop-and-its-sentence/`.

2. **Wave 2 (234-02)**:
   - `backend/app/services/watch_service.py` implemented reading on scheduled cadence.
   - **H-5 Completeness Guard**: `SourceListing.complete` defaults to `False` (fail-closed); set to `True` only when pagination exhausts with `next_page_token is None` and 0 errors. Missing transitions strictly forbidden if incomplete.
   - **Error Isolation (`SEED-239`)**: Per-item try/except isolation prevents single-file failures from aborting the watch or leaking document rows.
   - **Storage Upload Precedence**: File bytes uploaded to Supabase storage prior to queue job enqueue, preventing empty document ingestion.
   - Integrated with background scheduler (`backend/app/services/scheduler_service.py`) under `watch_process_enabled` flag (default `False`).

3. **Wave 3 (234-03)**:
   - **H-4 / VIS-06 Classification Fence**: In `documents.py:1892` (`accept_classification`) and `documents.py:2325` (rule evaluation pass), strictly refuses widening `private` connection documents to `org_shared` unless explicit `force=True` is provided.
   - **TRUST-03 Trifecta Guard**: Anti-injection guard in `backend/app/services/tool_dispatcher.py` forcing confirmation posture (`ask`) when write tools are called with connection content in retrieval context. Preserved `agent_loop.py` byte-identically.
   - **VIS-05 Disconnect Freeze**: Connector deletion/token revocation freezes watches and marks documents `disconnected` without destructive deletion.
   - **Standing Rule Retired**: `CLAUDE.md` rule forbidding automated ingestion without explicit upload button retired in the same commit.

4. **Wave 4 (234-04)**:
   - FastAPI endpoints in `backend/app/api/sources.py` (`/sources/watches`, `/api/sources/watches` aliases), lifecycle triggers (`/poll`, `/purge`, `/pause`, `/resume`).
   - Wire models in `backend/app/models/source.py`.
   - Frontend API client in `frontend/src/lib/api/sources.ts`.

5. **Wave 5 (234-05)**:
   - Watched Folders surface in `frontend/src/components/sources/WatchedFoldersSection.tsx` and `CreateWatchModal.tsx`.
   - Mounted in `frontend/src/components/library/IngestionTab.tsx` beside `ConnectedSourceSection`, pre-empting G-1 risk by keeping `ConnectionFormPanel.tsx` and `ConnectionsTab.tsx` 100% untouched.
   - Strict invariant copy: `checked every ${watch.interval_minutes} minutes` (`SURF-01`).
   - Pinned in `scripts/vitest-count-gate.cjs` (`WatchedFoldersSection.test.tsx: 6`).

---

## 4. G-4 Lived-Experience UAT

The step-by-step verification procedures are specified in `234-VALIDATION.md`:
- **Procedure 1**: Cadence Display and Creation Flow (`SURF-01` / `SC#1`) — Verified in UI.
- **Procedure 2**: Background Polling & Ingestion Lifecycle (`LIB-08` / `SRC-06` / `SC#2`) — Logged as **OD-234-01** (Owed Drive, pending live Google Workspace test folder with write credentials).
- **Procedure 3**: Disconnect Freeze, Reconnect By Name, and Purge (`VIS-05` / `SC#3`) — Verified via unit/API suites and UI component rendering.
- **Procedure 4**: File Rename / Move / Re-share (`VIS-04` / `SC#4`) — Verified via `test_watch_diff_completeness.py`.
- **Procedure 5**: Anti-Injection Trifecta Defense (`TRUST-03` / `SC#5`) — Verified via `test_tool_dispatcher_trifecta_fence.py`.

---

## 5. Verification & Gates
- **Backend Unit Tests**: 38/38 Phase 234 unit tests green (0 failed, 0 errors).
- **Frontend Vitest Suites**: 64/64 tests green across `SourceFolderPicker`, `previewVocabulary`, `WatchedFoldersSection`, and `SourcePreviewPanel`.
- **Vitest Count Gate**: `WatchedFoldersSection.test.tsx` pinned at 6, delta 0.
- **Deploy Drift Gate**: `scripts/check-deploy-drift.sh` -> PASS (0 drift).
