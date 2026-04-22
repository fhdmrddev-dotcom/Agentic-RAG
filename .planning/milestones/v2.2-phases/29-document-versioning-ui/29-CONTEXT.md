# Phase 29: Document Versioning — UI - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface version state in the document library UI. Three deliverables:
1. Version badge on multi-version documents in the document list (VER-03)
2. Expandable version history row showing all versions with date and size (VER-04)
3. Restore action that makes a historical version the active one (VER-05)

No new ingestion logic. All data comes from `version_number` and `is_latest` fields added to the `documents` table in Phase 28. Old chunks are already retained in the DB with `is_latest=False` — restore is a flag-flip, not a re-ingest.

</domain>

<decisions>
## Implementation Decisions

### Document List Filtering — D-01
Filter the `GET /documents` list endpoint to return only `is_latest=True` rows. Old versions are hidden from the default view and fetched on demand via a new `GET /documents/{id}/versions` endpoint that returns all sibling versions (same filename, same user, ordered by version_number desc).

**Why:** Showing all version rows in the main list creates clutter and breaks the existing folder-scoped filtering. Only the active version belongs in the main list; version history is accessed on expand.

### Version Badge — D-02
Badge appears inline next to the filename in the existing filename column — not a new column. Small chip: `vN` text in `text-xs` weight, `bg-primary/10 text-primary` styling (matches the topic pill style already used in MetadataPanel). Only rendered when `version_number > 1`; v1 documents show no badge.

**Why:** Consistent with existing chip style. Adding a new column wastes horizontal space for the majority of documents that will be v1. Inline keeps it discoverable without being dominant.

### History Panel UX — D-03
Extend the existing expand/collapse chevron row pattern in `DocumentList.tsx`. The toggle button is shown whenever `version_number > 1` (currently shown only when metadata exists). Expanding a versioned document reveals a version history sub-row — a compact table listing all versions: version number, upload date, file size, and a restore button per row. If the document also has metadata, both the metadata panel and the version history panel are rendered in separate `<tr>` rows when expanded (metadata first, versions below).

**Why:** Reusing the existing expand pattern keeps the interaction model consistent — users already know how to expand rows. A modal would feel heavier for what is essentially a list of 2–4 rows.

### Restore Action — D-04
**Backend:** New endpoint `POST /documents/{id}/restore` that:
1. Looks up the target document row (validates ownership)
2. Finds all sibling documents (same `filename`, same `user_id`, same `folder_id`)
3. Sets `is_latest=False` on all siblings
4. Sets `is_latest=True` on the target document row
5. Returns the updated target document row

No re-ingestion — chunks for the target version are already in the DB and become active for retrieval once `is_latest` flips.

**Frontend:** Clicking "Restore" on a historical version shows a lightweight confirmation dialog: "Restore v{N}? This version will become active for retrieval. The current version remains in history." Two buttons: Cancel / Restore. On confirm, call the endpoint, then refresh the document list. No optimistic update — wait for the round-trip so the badge and list reflect the actual DB state.

**Why:** Flag-flip is correct because Phase 28 explicitly retained old chunks. Confirmation dialog is necessary because restore changes what the AI retrieves — users need to understand the consequence. No optimistic update avoids showing inconsistent state if the request fails.

### Claude's Discretion
- Loading state during restore: spinner on the Restore button (disable it while request is in-flight)
- Error handling: toast notification on restore failure using the existing pattern in the app
- Version history row styling: same `bg-muted/30 border-t` pattern as MetadataPanel for visual consistency
- The `Document` TypeScript interface should be extended with `version_number?: number` and `is_latest?: boolean` — both optional for backward compatibility

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing UI components
- `frontend/src/components/ingestion/DocumentList.tsx` — the component being modified; contains the expand/collapse row pattern, MetadataPanel, and delete dialog
- `frontend/src/components/ingestion/DocumentStatusBadge.tsx` — badge component pattern to follow for version badge styling
- `frontend/src/types/index.ts` — Document and Citation interfaces; needs `version_number` and `is_latest` additions

### Backend
- `backend/app/api/documents.py` — existing list and delete endpoints; new restore endpoint goes here
- Phase 28 SUMMARY: `.planning/phases/28-document-versioning-schema-ingestion/28-02-SUMMARY.md` — confirms `version_number` and `is_latest` fields in DB, and that old chunks are retained

### Phase requirements
- `.planning/REQUIREMENTS.md` — VER-03, VER-04, VER-05 definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DocumentList.tsx` expand/collapse toggle (`expanded: Set<string>`, `toggle(id)`) — extend this for version history; same state mechanism works
- `MetadataPanel` inline `<tr>` pattern — version history panel follows the same `colSpan={7} p-0` row pattern
- Topic pill style in MetadataPanel (`bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs`) — reuse for version badge
- Delete confirmation dialog in DocumentList — clone this pattern for the restore confirmation dialog
- `formatBytes()` utility in DocumentList — reuse for file size in version history rows

### Established Patterns
- shadcn Dialog for confirmations (already imported in DocumentList for delete)
- `Button` with `variant="ghost" size="sm"` for row actions (existing delete button)
- `text-muted-foreground` for secondary info in table cells

### Integration Points
- `frontend/src/lib/api.ts` — add `fetchDocumentVersions(id)` and `restoreDocumentVersion(id)` calls
- `backend/app/api/documents.py` — add `GET /{id}/versions` and `POST /{id}/restore` routes
- The `GET /documents` list query must add `.eq("is_latest", True)` filter (currently returns all rows)

</code_context>

<specifics>
## Specific Ideas

User delegated all decisions to Claude — no specific references or "I want it like X" moments.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 29-document-versioning-ui*
*Context gathered: 2026-04-12*
