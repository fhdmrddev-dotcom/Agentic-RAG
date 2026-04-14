---
phase: 29-document-versioning-ui
plan: 02
subsystem: frontend
tags: [react, typescript, document-versioning, ui, shadcn]

# Dependency graph
requires:
  - phase: 29-01
    provides: GET /documents/{id}/versions and POST /documents/{id}/restore endpoints

provides:
  - version badge (vN chip) on documents with version_number > 1
  - VersionHistoryPanel component with lazy-loaded version list, date, size columns
  - Restore confirmation dialog with non-destructive confirm action
  - Updated DocumentList Props (currentUserId, onRefresh)
  - IngestionPage wired with loadDocuments as onRefresh and user?.id as currentUserId

affects:
  - frontend/src/components/ingestion/DocumentList.tsx (extended)
  - frontend/src/pages/IngestionPage.tsx (new props passed)
  - frontend/src/types/index.ts (Document interface extended)
  - frontend/src/lib/api.ts (two new API functions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useEffect-driven lazy fetch inside VersionHistoryPanel (fetches on expand, not on list load)
    - owner-only Restore button (v.user_id === currentUserId guard)
    - isExpandable = hasMetadata || hasVersions (OR gate preserves existing metadata expand)

key-files:
  created: []
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts
    - frontend/src/components/ingestion/DocumentList.tsx
    - frontend/src/pages/IngestionPage.tsx

key-decisions:
  - "Version badge uses topic pill style (bg-primary/10 text-primary) matching existing MetadataPanel topics — visual consistency"
  - "VersionHistoryPanel fetches on mount (useEffect) so API is only called when user expands, not on every list render"
  - "Restore button variant=ghost (not destructive) — restore is non-destructive per UI-SPEC D-04"
  - "currentUserId threaded from IngestionPage → DocumentList → VersionHistoryPanel to enable owner-only restore"

requirements-completed:
  - VER-03
  - VER-04
  - VER-05

# Metrics
duration: ~15min (includes usage limit interruption and manual commit)
completed: 2026-04-13
---

# Phase 29 Plan 02: Document Versioning UI Frontend Summary

**React frontend — version badge, VersionHistoryPanel, and restore confirmation dialog in DocumentList**

## Performance

- **Completed:** 2026-04-13
- **Tasks:** 2 auto + 1 human-verified checkpoint
- **Files modified:** 4

## Accomplishments

- Extended `Document` interface with `version_number?: number` and `is_latest?: boolean` (optional for pre-migration rows)
- Added `fetchDocumentVersions` and `restoreDocumentVersion` API functions following existing `getAuthHeaders + fetch` pattern
- Added `VersionHistoryPanel` component: lazy-fetches versions on expand, renders table with version, date, size, and owner-only Restore button; current version shows "Current" label
- Added version badge (vN chip with `bg-primary/10 text-primary` topic pill style) inline in filename cell, renders only when `version_number > 1`
- Updated chevron expand trigger from `hasMetadata` to `isExpandable = hasMetadata || hasVersions` — preserves metadata expand for v1 docs
- Added restore confirmation dialog: "Restore version?" / "This version will become active for retrieval. The current version remains in history."
- Updated `IngestionPage.tsx` to pass `onRefresh={loadDocuments}` and `currentUserId={user?.id ?? ""}` to DocumentList
- Human-verified in browser: badge, history panel, restore flow all confirmed working

## Task Commits

1. **Task 1: types + API functions** — `2354bf4`
2. **Task 2: DocumentList + IngestionPage** — `c634190`

## Files Created/Modified

- `frontend/src/types/index.ts` — version_number and is_latest added to Document interface
- `frontend/src/lib/api.ts` — fetchDocumentVersions and restoreDocumentVersion added
- `frontend/src/components/ingestion/DocumentList.tsx` — VersionHistoryPanel, badge, expand gate, restore dialog
- `frontend/src/pages/IngestionPage.tsx` — onRefresh and currentUserId props wired

## Issues Encountered

None. TypeScript compiled cleanly. Human UAT passed.

---
*Phase: 29-document-versioning-ui*
*Completed: 2026-04-13*
