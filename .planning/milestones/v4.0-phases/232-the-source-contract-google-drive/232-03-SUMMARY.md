# Phase 232 Plan 03: Partial Discharge of connectors.py and Deletion of cloud_storage.py Summary

Partially discharged G-5 hot file `connectors.py` by delegating single-file import and file browsing to `app.services.sources.import_service`, completely retired legacy `backend/app/services/cloud_storage.py`, re-pointed all surviving test suites preventing collection errors, and synced hot-file ledgers in `docs/HOT-FILE-LEDGER.md` and `CLAUDE.md`.

## Key Changes

1. **Import Service Extraction (`backend/app/services/sources/import_service.py`)**:
   - Implemented `browse_connection_files`, `import_single_file`, `fetch_cloud_file`, and `list_cloud_files`.
   - Preserved `TM-232-05` (ingest visibility read exclusively from connection record) and `TM-232-06` (org_id resolved explicitly from active_org).
   - Routed document minting through `async_mint_document_row` (Phase 229 splice) with background `splice_document` scheduling.
   - Dynamic monkeypatching alignment (`from app.services import ingest_splice`).

2. **SourceAdapter & MockSourceAdapter list_files Harmonization**:
   - Added `query: str | None = None` and `page_size: int = 30` to `SourceAdapter.list_files` abstract method and `MockSourceAdapter.list_files` implementation.

3. **Retirement of `cloud_storage.py` and Production Re-pointing**:
   - `backend/app/api/connectors.py`: `list_connection_files` and `import_connection_file` now delegate to `import_service`.
   - `backend/app/services/connectors/service_tools.py`: Google Drive tools (`search_files`, `read_file`) re-pointed to `app.services.sources.adapters.google_drive`.
   - `backend/app/services/google/sheets.py`, `backend/app/services/google/__init__.py`, `backend/app/services/google/_http.py`, `backend/app/security/egress.py`: updated docstrings/references.
   - Deleted `backend/app/services/cloud_storage.py`.

4. **Test Suite Re-pointing & Baseline Preservation**:
   - Re-pointed 6 surviving test files identified in reviewer pre-flight G-1:
     - `backend/tests/unit/test_connector_file_import.py`: re-pointed imports to `app.services.sources.import_service`.
     - `backend/tests/integration/test_chat_connectors_e2e.py`: re-pointed imports to `import_service`.
     - `backend/tests/unit/test_service_tools.py`: re-pointed monkeypatches to `app.services.sources.adapters.google_drive`.
     - `backend/tests/integration/test_connector_import_splice.py`: re-pointed patches to `import_service` and preserved upload fallback behavior.
     - `backend/tests/unit/test_connector_org_scope_and_refusals.py`: re-pointed `_google_error_reason` to `app.services.sources.adapters.google_drive`.
     - `backend/tests/unit/test_google_round1.py`: updated docstring references.
   - Created `backend/tests/unit/services/sources/test_import_service.py` (4 unit tests for delegation and tenant scoping).

5. **Hot-File Ledgers Sync (`docs/HOT-FILE-LEDGER.md` and `CLAUDE.md`)**:
   - `backend/app/api/connectors.py`: updated to `30 / 14 / 1708 L` (net -28 lines discharged from 1736 L to 1708 L).
   - `backend/app/security/egress.py`: added new row (`10 / 3 / 938 L`, G-5 FIRES — EXACTLY AT THRESHOLD).
   - `backend/app/services/connectors/service_tools.py`: updated line count note to 2018 L.
   - Verified `check-claude-md-size.cjs` passes.

## Verification
- Unit suite run (`check-backend-unit-baseline.cjs`): 72 failed, 3567 passed, 0 collection errors (GATE PASSED).
- Touched test suites: 103 passed, 0 failed.
- Claude MD size gate: OK (107,742 chars, headroom 42,258).
