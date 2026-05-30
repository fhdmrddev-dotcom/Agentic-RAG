---
phase: 084-workspace-filesystem-backend
plan: 02
type: execute
status: complete
completed: 2026-05-28
---

## Phase 084 Plan 02: DB Layer + Pydantic Models + Workspace Service Summary

**Workspace backend logic layer landed -- asyncpg helpers, response models, and a single workspace_service.py that hides hybrid storage routing (inline bytea <= 256KB / bucket > 256KB), enforces 10MB hard cap, 100-file soft warning, 8192-char read cap, path validation, and structured difflib diffing.**

## Dependency Graph

requires: [084-01]
provides:
  - "backend/app/db/workspace.py: 13 asyncpg helpers for workspace_files + workspace_file_versions"
  - "backend/app/models/workspace.py: 4 Pydantic response models (File, Version, Diff, FileDetail)"
  - "backend/app/services/workspace_service.py: write_file, read_file, list_files, delete_file, get_diff, get_versions"
affects: [084-03, 084-04]

## Tech Tracking

tech-stack:
  added: []
  patterns:
    - "Hybrid storage routing in service layer -- callers pass bytes, service decides inline vs bucket transparently"
    - "Path validation with strip + start-anchor + char-allowlist regex + '..' / '//' / length guards"
    - "difflib.unified_diff for text diff with 500-line truncation guard + additions/deletions stats"
    - "Storage upload then DB write order -- pitfall guard (D-05): file_id from UPSERT first, then upload to user-prefixed bucket path, then update content_storage_path"
    - "Bucket object cleanup on delete is best-effort -- DB CASCADE is the source of truth"

key-files:
  created:
    - backend/app/db/workspace.py
    - backend/app/models/workspace.py
    - backend/app/services/workspace_service.py
  modified: []

key-decisions:
  - "Single-file service per CONTEXT.md (Claude's discretion) -- 479 LOC encapsulates write/read/list/delete/diff/versions + path validation + binary MIME guard + delta computation. No premature splitting."
  - "FileNotFoundError_ class name (trailing underscore) avoids shadowing builtins.FileNotFoundError while keeping the workspace-specific exception in the WorkspaceError hierarchy."
  - "validate_path applies .strip() first, then validates -- whitespace-padded paths get normalized rather than rejected (matches user expectation for tool-call paths)."
  - "Sequential-version diff fast path: if asking for v(n-1) -> v(n) and delta_from_prev is populated, return persisted JSONB delta instead of recomputing. Non-sequential diffs always recompute from full content."

requirements-completed: [WS-01, WS-02, WS-03, WS-04, WS-05]

## Performance

- **Duration:** ~12 min (inline execution, no subagent)
- **Started:** 2026-05-28
- **Completed:** 2026-05-28

## Accomplishments

- Created `backend/app/db/workspace.py` (188 lines) with 13 asyncpg helpers (UPSERT, INSERT, COUNT, SELECT by path/id, list with prefix, delete with returning, version content fetch, version listing, storage path collection)
- Created `backend/app/models/workspace.py` (37 lines) with 4 Pydantic response models
- Created `backend/app/services/workspace_service.py` (479 lines) with full business logic
- Smoke-tested validate_path against 8 attack vectors (empty / no-slash / `..` / `//` / backslash / >500 chars / tab / semicolons) -- all 7 truly-invalid inputs rejected; whitespace padding normalized via .strip() (intentional)
- All three files import cleanly under the backend venv

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DB layer and Pydantic models** -- `85c17e4` (feat)
2. **Task 2: Create workspace service with hybrid storage, versioning, and diffing** -- `1bebbda` (feat)

## Files Created/Modified

- `backend/app/db/workspace.py` - New: asyncpg helpers following db/runs.py pattern (positional params, pool as first arg, dict return)
- `backend/app/models/workspace.py` - New: Pydantic response models matching models/document.py pattern
- `backend/app/services/workspace_service.py` - New: hybrid-storage business logic (10MB cap, 256KB inline threshold, 100-file soft limit, 8192-char read cap, difflib diff)

## Decisions Made

- **Single-file service vs split:** Plan called for one workspace_service.py and CONTEXT.md left it to Claude. Chose single file because the helpers (`_get_file_content`, `_get_version_content_bytes`, `_read_from_storage`, `_compute_delta_from_prev`) are all tightly coupled to the public surface and splitting would create three trivially-small modules with circular-feeling imports. If the file grows past ~700 LOC in future phases, revisit.
- **content_storage_path UPDATE after upload:** write_file does the DB UPSERT first to get `file_id`, then uploads to `{user_id}/{thread_id}/{file_id}/v{version}` in the bucket, then runs a second UPDATE to populate `content_storage_path`. This costs one extra round-trip but lets us namespace bucket objects by file_id without a pre-generated UUID.
- **Sequential-diff fast path:** When asking for the delta from v(n-1) to v(n), we trust the persisted `delta_from_prev` JSONB column. For non-sequential diffs (e.g. v1 to v5), we always recompute from full content -- avoids stitching deltas which is error-prone.

## Deviations from Plan

None on implementation. One minor naming choice: `FileNotFoundError_` (trailing underscore) to avoid colliding with `builtins.FileNotFoundError`. Plan didn't specify; this matches typical Python convention.

## Auto-Fixed Issues

None.

## Issues Encountered

None -- both tasks applied cleanly.

## User Setup Required

None.

## Next Phase Readiness

- workspace_service is ready to be consumed by Plan 03 (tool handlers via tool_dispatcher) and Plan 04 (REST API endpoints)
- All public functions accept `pool` and `supabase` (where needed) as explicit parameters -- no global state
- Path validation is the trust boundary: every public function calls `validate_path(path)` before any DB or storage access
- WorkspaceError exception hierarchy lets callers distinguish PathValidationError / FileTooLargeError / FileNotFoundError_ for tool-handler error messages
- Plans 03 and 04 can be executed in parallel in Wave 3 (no file overlap)
