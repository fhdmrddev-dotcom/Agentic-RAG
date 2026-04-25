---
phase: 46-document-version-deletion
plan: "02"
subsystem: ui
tags: [react, typescript, dialog, delete, versioning, optimistic-update]

# Dependency graph
requires:
  - phase: 46-document-version-deletion
    provides: backend delete endpoint with scope param (Plan 01)
provides:
  - "Version-aware delete dialog with Cancel | Delete vN | Delete All Versions for multi-version docs"
  - "Extended deleteDocument API client function with optional scope param"
  - "Extended deleteDoc hook with optimistic all-version removal when scope=all"
affects: [ingestion-page, document-list, useDocuments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "error-in-dialog: dialog stays open on failure, inline error message shown"
    - "scope-aware optimistic update: scope=all removes all filename siblings from local state"
    - "active-scope spinner: spinner tracks which button triggered the in-flight request"

key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useDocuments.ts
    - frontend/src/components/ingestion/DocumentList.tsx

key-decisions:
  - "onDelete prop signature updated to (id: string, scope?: 'version' | 'all') — backward-compatible optional param"
  - "documents added to useCallback dependency array for scope=all filename lookup"
  - "VersionHistoryPanel (lines 87-226) left unchanged per D-08 — no delete buttons added there"
  - "activeScope tracks which button triggered delete so only that button shows spinner"
  - "Dialog onOpenChange clears deleteError and activeScope to prevent stale state on reopen"

patterns-established:
  - "error-in-dialog pattern: catch sets error state, does NOT close dialog — consistent with restore dialog"
  - "handleDelete async pattern: setDeleting/setActiveScope before await, clear in finally block"
  - "conditional footer: hasVersions() gates 3-button vs 1-button layout using same helper already in scope"

requirements-completed:
  - DOC-01
  - DOC-02
  - DOC-03

# Metrics
duration: 15min
completed: 2026-04-25
---

# Phase 46 Plan 02: Frontend Delete Dialog Upgrade Summary

**Version-aware delete dialog with 3-button footer (Cancel | Delete vN | Delete All Versions) for multi-version docs; api.ts and useDocuments.ts extended with optional scope param**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-25T04:20:00Z
- **Completed:** 2026-04-25T04:35:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `api.ts deleteDocument` extended with optional `scope?: "version" | "all"` param that appends `?scope={scope}` to the DELETE URL when provided
- `useDocuments.ts deleteDoc` updated with scope param; `scope=all` optimistically removes all filename siblings from local state
- `DocumentList.tsx` delete dialog upgraded to version-aware: multi-version docs get Cancel | Delete vN | Delete All Versions; single-version docs keep original Cancel | Delete
- Loading spinner tracks active scope — only the clicked button shows spinner, other buttons are disabled
- Error-in-dialog pattern: failure shows inline error message without closing dialog

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend api.ts deleteDocument and useDocuments.ts deleteDoc with scope param** - `f359258` (feat)
2. **Task 2: Upgrade delete Dialog in DocumentList.tsx to version-aware 3-button footer** - `1ddeb22` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/lib/api.ts` - deleteDocument extended with optional scope param and URL conditional
- `frontend/src/hooks/useDocuments.ts` - deleteDoc interface and callback updated; scope=all removes all filename siblings
- `frontend/src/components/ingestion/DocumentList.tsx` - version-aware dialog with 3-button footer, handleDelete async function, deleting/deleteError/activeScope state

## Decisions Made
- `documents` added to `useCallback` dependency array for `deleteDoc` — required because the `scope=all` branch reads `documents` to find the filename for filtering
- `activeScope` state tracks which delete action is in-flight so only the active button renders a spinner (other buttons remain visible but disabled)
- Dialog `onOpenChange` clears `deleteError` and `activeScope` alongside `deleteTarget` to prevent stale error messages and scoped state on reopen

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Worktree does not have its own `node_modules` — used the main repo's `tsc` binary (`frontend/node_modules/.bin/tsc`) with the worktree's `tsconfig.json` path for type checking. TypeScript compiled with zero errors after both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Frontend delete flow is ready to call the backend `scope` param introduced in Plan 01
- `IngestionPage.tsx` passes `onDelete={deleteDoc}` — no change needed there (optional param is backward-compatible)
- When Plan 01 backend is deployed, scope=version and scope=all paths are fully wired end-to-end

---
*Phase: 46-document-version-deletion*
*Completed: 2026-04-25*
