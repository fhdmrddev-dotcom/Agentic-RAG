# Phase 232: The Source Contract + Google Drive — Context

**Gathered:** 2026-09-05  
**Status:** Locked & Ready for Planning  
**Role:** Builder: Gemini · Reviewer: Claude  

<domain>
## Phase Boundary

Phase 232 delivers **The Source Contract + Google Drive** (`SRC-01`, `SRC-02`).
A person browses a connected Google Drive from inside the product and picks a folder — over one `browse / list / read / check` contract that every subsequent source family (Phase 238 Microsoft Graph, Phase 239 MCP files, Phase 240 Mail) implements as a thin adapter. Adding a source family in this product is data and registration, never a new ingestion path.

### Core Deliverables:
1. **The Source Contract (`backend/app/services/sources/base.py`)**:
   - Explicit `SourceAdapter` protocol/abstract class defining:
     - `browse(connection, path_or_folder_id, page_token) -> BrowsePage`: Navigates folder hierarchy for human interactive picking.
     - `list_files(connection, folder_id, recursive, page_token) -> FilePage`: Enumerates files within a folder for sync/preview passes.
     - `read_file(connection, file_id) -> tuple[str, bytes, str]`: Reads raw file bytes and metadata through `send_pinned_http("drive_read", ...)`.
     - `check(connection) -> SourceHealth`: Validates credentials, scopes, and connectivity.
   - Uniform data transfer objects (`SourceNode`, `SourceFile`, `BrowsePage`, `FilePage`, `SourceHealth`).
   - Strict abstraction fence: zero provider specifics (Drive corpora/tokens, Graph drive/site IDs, MCP tool names) leak above `adapters/`.

2. **Google Drive Source Adapter (`backend/app/services/sources/adapters/google_drive.py`)**:
   - Complete implementation of the source contract for Google Drive.
   - **Shared Drives Support (`SRC-02`)**: Drives and proves `supportsAllDrives=true`, `includeItemsFromAllDrives=true`, and querying `https://www.googleapis.com/drive/v3/drives` alongside `My Drive`.
   - Native Google Docs/Sheets export to PDF, preserving the safe enum-only error reporting (`_google_error_reason`).

3. **Fake/Mock Source Adapter & Conformance Suite (`SRC-01`)**:
   - `MockSourceAdapter` (`backend/app/services/sources/adapters/mock_source.py`): In-tree source family with canned hierarchy, pagination, and file bytes.
   - Conformance test suite (`backend/tests/unit/services/sources/test_source_adapter_conformance.py`): Parametrized test suite verifying contract invariants across both `GoogleDriveSourceAdapter` and `MockSourceAdapter`.
   - CI check / lint guard asserting zero `provider ==` or `service_id ==` branching above `services/sources/adapters/`.

4. **`cloud_storage.py` Complete Retirement**:
   - Replaced at all four measured consumers:
     - `backend/app/api/connectors.py:1646`: `list_cloud_files` -> delegates to `SourceRegistry.get(conn).browse(...)`.
     - `backend/app/api/connectors.py:1680`: `fetch_cloud_file` -> delegates to `SourceRegistry.get(conn).read_file(...)`.
     - `backend/app/services/connectors/service_tools.py:1689, 1722`: updated to invoke the source contract instead of reaching into private `cloud_storage._` functions.
     - `backend/app/services/google/sheets.py` & `backend/app/security/egress.py`: references and docstrings updated.
   - `backend/app/services/cloud_storage.py` deleted.

5. **`connectors.py` Partial Discharge (G-5)**:
   - File-import and browsing logic moved out of `connectors.py` into `backend/app/services/sources/import_service.py`.
   - Existing single-file import endpoint (`POST /connections/{connection_id}/files/{file_id}/import`) re-pointed to use `SourceRegistry` and `async_mint_document_row`.

6. **Frontend Source Folder Browser (`SRC-02`)**:
   - Tree navigation component presenting **two virtual root nodes**:
     - `"My Drive"`
     - `"Shared Drives"` (lists user's accessible shared drives, expanding into their folder hierarchies).
   - Allows expanding folders, paging through children, and selecting a target folder to work with.
   - Test/dev environment gating for mock source visibility (via `VITE_ENABLE_MOCK_SOURCES` / dev mode).

7. **Database Schema & Migrations**:
   - **ZERO migrations**: Per SEED-146 and operator ratification, no schema change on `connector_connections`. Inbound folder selections and source configs are stored in `connector_connections.config` JSONB.

</domain>

<decisions>
## Implementation Decisions

### 1. Drive Folder Tree UX (D-232-01)
- The folder picker presents two top-level virtual root nodes:
  - **"My Drive"** (`root` folder ID in Drive API).
  - **"Shared Drives"** (queries `/drives` endpoint, rendering each accessible Shared Drive as an expandable node whose root is the drive's ID).
- Children load lazily via `browse(connection, folder_id, page_token)`.
- Clicking a folder selects it as the target sync/work folder, emitting `{ folder_id, folder_name, drive_id, drive_name }`.

### 2. Zero Migrations & Connection Persistence (D-232-02)
- Reaffirmed: Migration count remains zero (`none expected`).
- Existing rows with `service_id='google'`, `capability=NULL`, and `mcp_server_url=NULL` are valid under migration 127's `connector_connections_shape_is_not_ambiguous` constraint.
- Folder selection is persisted in `connector_connections.config` as:
  ```json
  {
    "source_folder_id": "...",
    "source_folder_name": "...",
    "source_drive_id": null,
    "source_drive_name": null
  }
  ```
- Any future inbound capability typing is purely in TypeScript/Python union models without DB schema mutation.

### 3. Mock/Fake Source Family Registration & Gating (D-232-03)
- `MockSourceAdapter` is registered in `SourceRegistry` under `service_id="mock_source"`.
- It serves canned folder trees, pagination tokens, and standard text/pdf files in memory.
- In the frontend source picker, the mock adapter is visible only when `import.meta.env.DEV` is true or `features.mock_sources_enabled` is active, satisfying `SRC-01` criterion 4 without cluttering production.

### 4. Source Contract Interface (`browse / list / read / check`) (D-232-04)
- Located in `backend/app/services/sources/base.py`.
- **`browse(conn, folder_id=None, page_token=None)`**: Returns `BrowsePage(items=[SourceNode], next_page_token=...)` where `SourceNode` has `(id, name, kind, drive_id, has_children)`. Used for interactive folder navigation.
- **`list_files(conn, folder_id, recursive=False, page_token=None)`**: Returns `FilePage(files=[SourceFile], next_page_token=...)` where `SourceFile` has `(id, name, mime_type, size, modified_at, drive_id)`. Used for preview and batch ingestion.
- **`read_file(conn, file_id)`**: Returns `(filename, content_bytes, mime_type)` via egress `drive_read`.
- **`check(conn)`**: Verifies token freshness and permissions, returning `SourceHealth(ok=bool, error=str|None)`.

### 5. Google Drive Shared Drives API Enforcement (D-232-05)
- Every Google Drive API call (`files.list`, `files.get`, `files.export`) includes:
  - `supportsAllDrives=true`
  - `includeItemsFromAllDrives=true`
- Shared drives listing calls `GET https://www.googleapis.com/drive/v3/drives?pageSize=100`.
- Folder queries use `q="mimeType = 'application/vnd.google-apps.folder' and '{parent_id}' in parents and trashed = false"`.
- Egress key `drive_read` covers all calls to `*.googleapis.com` HTTPS.

### 6. Retirement of `cloud_storage.py` & Refactoring `connectors.py` (D-232-06)
- New package `backend/app/services/sources/`:
  - `base.py`: Protocol, models, registry.
  - `adapters/google_drive.py`: Google Drive implementation.
  - `adapters/mock_source.py`: In-memory test implementation.
  - `import_service.py`: Extracted single-file import and browse handlers.
- `connectors.py`:
  - `list_connection_files` and `import_connection_file` delegate directly to `import_service.py`.
  - Ledger row updated to note partial discharge (moving cloud storage logic to `services/sources/`).
- `cloud_storage.py` deleted.
- Consumers (`service_tools.py`, `sheets.py`, `egress.py`) cleanly re-pointed.

### 7. Conformance Suite & Architectural Boundary Guard (D-232-07)
- `tests/unit/services/sources/test_source_adapter_conformance.py` tests both `GoogleDriveSourceAdapter` (with mocked egress) and `MockSourceAdapter`.
- `tests/unit/services/sources/test_boundary_fence.py` scans `backend/app/api/` and `backend/app/services/` (excluding `sources/adapters/`) to ensure no `service_id == 'google'` or `provider == 'google'` branches exist for cloud storage operations.

</decisions>

<verification_criteria>
## Verification Checklist (How We Prove Phase 232)

1. **SRC-01 (Unified Contract & Fake Adapter)**:
   - Conformance suite passes identically for `GoogleDriveSourceAdapter` and `MockSourceAdapter`.
   - Boundary guard test proves no provider branching above `adapters/`.
   - Single-file import through `POST /connections/{connection_id}/files/{file_id}/import` passes and correctly mints via `async_mint_document_row`.

2. **SRC-02 (Drive & Shared Drives Browsing)**:
   - Live / driven test demonstrating `supportsAllDrives=true` and `/drives` pagination.
   - Folder tree component renders My Drive and Shared Drives with interactive drill-down.

3. **G-5 & Code Hygiene**:
   - `cloud_storage.py` completely deleted with 0 lingering imports.
   - `connectors.py` line count reduced; ledger updated with partial discharge.
   - `tsc -p tsconfig.app.json` at or below 66 baseline.
   - Backend unit tests at baseline (zero new failures).

</verification_criteria>
