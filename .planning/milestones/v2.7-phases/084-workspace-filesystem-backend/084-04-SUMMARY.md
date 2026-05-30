---
phase: 084-workspace-filesystem-backend
plan: 04
type: execute
status: complete
completed: 2026-05-28
---

## Phase 084 Plan 04: Workspace REST API Summary

**4 cold-path GET endpoints under /threads/{thread_id}/workspace -- list, content (inline or 60s signed URL), versions, diff. _verify_thread_ownership uses 404-not-403 to prevent existence leak. Router registered in main.py.**

## Dependency Graph

requires: [084-02]
provides:
  - "GET /threads/{thread_id}/workspace/files (with optional prefix filter)"
  - "GET /threads/{thread_id}/workspace/files/{file_id}/content (inline text or signed bucket URL)"
  - "GET /threads/{thread_id}/workspace/files/{file_id}/versions"
  - "GET /threads/{thread_id}/workspace/files/{file_id}/diff?from=N&to=M"
  - "_verify_thread_ownership helper enforced before any data query"
affects: [087]

## Tech Tracking

tech-stack:
  added: []
  patterns:
    - "Cold-path REST reads via supabase-py + aexec (RLS at DB level; FK-chain policies do the heavy lifting)"
    - "Signed-URL pattern for bucket content: 60s TTL via run_in_threadpool wrapping the sync create_signed_url call"
    - "404 not 403 for unauthorized thread access (D-062-12 -- prevents existence-leak)"
    - "Sequential-version diff fast path -- prefer persisted delta_from_prev JSONB over recompute"

key-files:
  created:
    - backend/app/api/workspace.py
  modified:
    - backend/app/main.py

key-decisions:
  - "Used flexible signed-URL key extraction (`signedURL` / `signed_url` / `signedUrl` / `data.signedUrl`) rather than assuming one shape -- supabase-py versions have shipped different keys for the same response"
  - "Extracted _decode_inline_content helper -- handles both bytes (asyncpg path) and base64-encoded str (supabase-py path) since supabase-py returns bytea columns as base64 strings"
  - "Diff endpoint reuses workspace_service.compute_diff to keep diff semantics identical between the agent tool surface and the REST surface"

requirements-completed: [WS-02, WS-03, WS-04, WS-06]

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-28
- **Completed:** 2026-05-28

## Accomplishments

- Created `backend/app/api/workspace.py` (~290 LOC) with 4 GET endpoints + `_verify_thread_ownership` helper + `_decode_inline_content` helper
- Registered router in main.py (import + include_router) -- workspace routes live on app boot
- All 4 endpoints verified mounted via `from app.main import app; ... 'workspace' in r.path`

## Task Commits

1. **Task 1: Create workspace REST API router** -- `5201911` (feat)
2. **Task 2: Register workspace router in main.py** -- `953c13f` (feat)

## Files Created/Modified

- `backend/app/api/workspace.py` - New: 4 GET endpoints + 2 helpers + auth/RLS pattern matching sandbox_outputs.py (294 lines)
- `backend/app/main.py` - Modified: added `workspace` to api imports tuple + `app.include_router(workspace.router)` between sandbox_outputs and admin

## Decisions Made

- **Signed-URL key resilience:** supabase-py has shipped at least 4 different key names for the signed URL field across versions. Extracted defensive code that tries all observed keys (`signedURL`, `signed_url`, `signedUrl`, `data.signedUrl`) before returning None. This guards against silent version drift -- a hard-coded key would let the response succeed with a null URL.
- **_decode_inline_content helper:** Unified base64 decoding into one function used by both /content and /diff endpoints. Handles both `bytes` (in case supabase-py changes its response format) and base64 `str` paths.
- **404-not-403 across the surface:** All four endpoints return 404 for "thread doesn't belong to user" AND "file doesn't exist." This matches D-062-12 (existence-leak prevention) and aligns with the sandbox_outputs.py pattern.
- **Diff fast path mirrors the service layer:** When asking for v(n-1)->v(n), we check `delta_from_prev` first. Non-sequential diffs decode both versions and recompute via the same `compute_diff` function the service uses -- guaranteeing tool and REST diff outputs are byte-identical.

## Deviations from Plan

None on functional behavior. Two refinements:
1. Removed the dynamic `import base64` from inside `get_workspace_file_content` -- it's now imported once at module top.
2. Extracted `_decode_inline_content` rather than duplicating the base64 try/except in two endpoints.

## Auto-Fixed Issues

None.

## Issues Encountered

None -- both tasks applied cleanly.

## User Setup Required

None. Endpoints are live after the next backend reload.

## Next Phase Readiness

- Phase 087 (Panel UI) can consume all 4 endpoints for cold loads. The signed-URL pattern means binary previews (images, PDFs) work without proxying through the backend.
- Cross-provider UAT for the agent tool surface (Plan 03) is the bigger risk -- this REST surface is provider-agnostic.
- Manual curl test from a logged-in browser session can verify the endpoints work end-to-end before Phase 087 starts. The verifier should include curl examples in VERIFICATION.md.
