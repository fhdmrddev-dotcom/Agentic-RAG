---
phase: 46-document-version-deletion
plan: 01
subsystem: api
tags: [fastapi, supabase, documents, deletion, versioning, audit]

# Dependency graph
requires:
  - phase: 45-document-versions
    provides: "documents table with version_number, is_latest, folder_id columns; restore_document_version sibling query pattern"
provides:
  - "DELETE /documents/{id}?scope=version — targeted row + storage delete with is_latest promotion"
  - "DELETE /documents/{id}?scope=all — bulk sibling delete (all versions of a document)"
  - "scope query param with FastAPI pattern validation (422 for invalid values)"
  - "Audit log entries include scope field in metadata"
affects:
  - 46-02
  - frontend-document-list

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "scope query param dispatching with FastAPI Query(pattern=...) for enum-like validation"
    - "Sibling query by (user_id, filename, folder_id) with NULL-safe folder_id filter"
    - "is_latest promotion: sort siblings desc by version_number, promote siblings[0]"
    - "Storage failures silently swallowed in both delete paths"

key-files:
  created: []
  modified:
    - backend/app/api/documents.py

key-decisions:
  - "Used .maybe_single() instead of .single() for ownership check — safer 404 handling, matches restore_document_version pattern"
  - "scope=all bulk delete uses .in_('id', sibling_ids) — single DB round-trip instead of N deletes"
  - "Audit log written after both paths, includes scope in metadata for audit trail clarity"
  - "Storage delete in scope=all iterates per-sibling rather than batching — simpler, safe for small version counts"

patterns-established:
  - "scope param pattern: Query(default='version', pattern='^(version|all)$') — reusable for future scoped operations"
  - "Sibling query NULL-safe pattern: .is_('folder_id', 'null') vs .eq('folder_id', folder_id)"

requirements-completed:
  - DOC-01
  - DOC-02
  - DOC-03

# Metrics
duration: 12min
completed: 2026-04-25
---

# Phase 46 Plan 01: Document Version Deletion — Backend Summary

**DELETE /documents/{id} extended with scope=version (targeted + is_latest promotion) and scope=all (bulk sibling delete) using FastAPI Query pattern validation**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-25T00:00:00Z
- **Completed:** 2026-04-25T00:12:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added `scope` query param (`version` | `all`) to `DELETE /documents/{id}` with FastAPI pattern validation — invalid values return 422
- `scope=version`: deletes targeted row and storage file; if `is_latest=True`, promotes next-highest `version_number` sibling
- `scope=all`: queries all sibling rows by `(user_id, filename, folder_id)`, bulk-deletes storage files (failures silently swallowed), bulk-deletes all DB rows in one `.in_()` call
- Both paths write audit log with `scope` in metadata; ON DELETE CASCADE handles chunks/tables/images automatically
- Threat model mitigations T-46-01 through T-46-06 all satisfied (user_id filter on every query, pattern validation, 404 for missing docs)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Query import and scope param to delete_document endpoint** - `b1d676b` (feat)
2. **Task 2: Implement scope=version and scope=all deletion branches** - `6ad3630` (feat)

## Files Created/Modified
- `backend/app/api/documents.py` - Extended `delete_document` with `scope` query param and two-branch deletion logic

## Decisions Made
- Used `.maybe_single()` instead of `.single()` for ownership check — `.single()` raises an exception when no row found rather than returning `None`, which conflicts with the `if not doc_resp.data` guard pattern used in restore_document_version
- `scope=all` bulk delete uses `.in_("id", sibling_ids)` for a single DB round-trip
- Audit log entry written after both paths with `scope` in metadata for audit trail clarity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Worktree filesystem isolation: initial edits were applied to the main repo working directory instead of the worktree. Resolved by copying the modified file to the worktree and reverting the main repo change before committing. No code was lost.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend `delete_document` endpoint fully extended; ready for Phase 46-02 frontend integration
- Frontend needs: `deleteDocument(id, scope?)` in `api.ts`, `deleteDoc(id, scope?)` in `useDocuments.ts`, upgraded delete Dialog in `DocumentList.tsx`
- No blockers

## Self-Check

- [x] `backend/app/api/documents.py` modified with scope param and two-branch logic
- [x] Commit `b1d676b` exists (Task 1)
- [x] Commit `6ad3630` exists (Task 2)
- [x] All 6 structural assertions pass (Query import, scope param, scope=all branch, is_latest promotion, scope in audit, user_id in sibling queries)
- [x] Python syntax valid, module imports without error

## Self-Check: PASSED

---
*Phase: 46-document-version-deletion*
*Completed: 2026-04-25*
