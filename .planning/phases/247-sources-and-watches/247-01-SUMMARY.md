---
phase: 247-sources-and-watches
plan: 01
status: complete
wave: 1
commits:
  - id: fc5c7fe01
    message: "feat(247-01): Drive & Graph path resolution, WR-04 human label, WR-07 recursive fence"
requirements_met: [WATCH-01, WATCH-02, WATCH-08]
gates_passed:
  - "backend/tests/unit/test_247_source_paths.py: 8/8 passed"
  - "backend/tests/unit/services/sources/test_boundary_fence.py: 20/20 passed"
  - "backend/tests/unit/services/sources/test_238_04_stored_path_is_never_fabricated.py: 7/7 passed"
  - "connectors.py fence: byte-identical (0 lines modified)"
---

# Plan 247-01 Summary: Remote Path Hierarchy & Adapter Provenance

**Delivered:**
1. **Google Drive Adapter Path Resolution (WATCH-01):**
   - Implemented `_resolve_folder_path` in `backend/app/services/sources/adapters/google_drive.py` with in-memory caching (`_FOLDER_PATH_CACHE`) to resolve parent folder hierarchies (e.g. `/Finance/2026`).
   - Populated `SourceFile.path` with full relative path from root, enabling path-based classification rules to match.
   - Populated folder cache in `browse_folder` to reuse breadcrumb metadata without extra network calls.
2. **WR-04 Human-Readable Gmail User Label Display Name:**
   - In `backend/app/services/sources/mail/gmail.py`, implemented `get_label_name(token, label_id)` with `_LABEL_NAME_CACHE`.
   - In `google_drive.py`, resolved user label IDs (e.g. `Label_9`) to human display names (e.g. `Receipts` / `Finance`) so `SourceFile.path` is `/Finance` rather than `/Label_9`.
3. **Microsoft Graph OneDrive / SharePoint Path Parsing (WATCH-02):**
   - Updated `_PATH_PREFIX` and `_folder_path` in `backend/app/services/sources/adapters/microsoft_graph.py` to robustly strip drive root prefixes across personal OneDrive (`/drive/root:`), business drives (`/drives/{id}/root:`), and SharePoint site drives (`/sites/{site}/drives/{drive}/root:`), cleanly unquoting URL entities while returning `None` for opaque items without a root marker (preserving WR-03).
4. **WR-07 Recursive Boundary Fence Glob:**
   - In `backend/tests/unit/services/sources/test_boundary_fence.py`, replaced `package.glob("*.py")` with `package.rglob("*.py")` with explicit exemption for `PROVIDER_HALF_MODULES` (`app/services/sources/mail/gmail.py`), guaranteeing modules under `sources/mail/` cannot escape the architectural fence.
5. **Strict Boundary Fence on `connectors.py`:**
   - `backend/app/api/connectors.py` remains byte-identical with 0 lines modified.
