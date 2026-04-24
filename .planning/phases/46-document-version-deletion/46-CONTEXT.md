# Phase 46: Document Version Deletion - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current single-action "Delete document" with a version-aware delete that lets users choose between removing only the current version or the entire document history — including all storage files and database rows.

What's in scope:
- New delete dialog UI with conditional version-choice logic
- Backend API change to support two deletion scopes (single version vs all versions)
- Promote next-latest version when the current version is deleted
- Audit log entry for both delete paths

What's NOT in scope:
- Deleting individual historical versions from the Version History panel (view/restore only)
- Any changes to the upload, ingestion, or restore flows

</domain>

<decisions>
## Implementation Decisions

### Delete Dialog UX

- **D-01:** For documents with **version_number > 1** (multi-version), the delete dialog shows three footer buttons: **Cancel | Delete This Version | Delete All Versions**. No radio buttons — direct two-action pattern.
- **D-02:** "Delete This Version" label should include the version number: e.g. "Delete v3" to make the scope unambiguous.
- **D-03:** For documents with **version_number === 1** (single-version), the dialog auto-simplifies to the existing plain "Delete document?" confirmation with a single destructive button. The version choice is omitted entirely — no redundant options.
- **D-04:** The dialog description text should briefly explain what each scope does: "Promotes v{N-1} as current" for single-version delete, and "Removes entire document history" for all-versions delete.

### API Design

- **D-05:** Add a `scope` query parameter to the existing `DELETE /documents/{id}` endpoint: `?scope=version` (default, current behaviour) vs `?scope=all`. This avoids a new endpoint and keeps the API surface minimal.
- **D-06:** `scope=version` (or no scope param): delete only the targeted document row and its storage file. If the deleted row was `is_latest=True`, promote the next-highest `version_number` sibling as the new `is_latest`. If it was the only version, the document is fully gone.
- **D-07:** `scope=all`: find all sibling rows by `(user_id, filename)`, delete all their storage files, then delete all rows. DB `ON DELETE CASCADE` handles `document_chunks`, `document_tables`, `document_images` automatically — no explicit Python cleanup needed for those tables.

### Version History Panel

- **D-08:** The `VersionHistoryPanel` remains unchanged — "Restore" only for non-latest versions. No delete buttons added in this phase. Individual historical-version delete is deferred.

### Cleanup Mechanics

- **D-09:** DB `ON DELETE CASCADE` is confirmed on `document_chunks`, `document_tables`, and `document_images` (all have `REFERENCES public.documents(id) ON DELETE CASCADE`). Python code only needs to delete `documents` rows and corresponding storage files — chunk/table/image cleanup is automatic.
- **D-10:** Storage file deletion failures are silently swallowed (matches existing pattern at `documents.py:496-498`) — a broken storage delete never blocks the DB delete.
- **D-11:** Audit log entry is written for both delete scopes via existing `write_audit_entry` fire-and-forget `BackgroundTask`. Include `scope` in the metadata.

### Claude's Discretion

- Error state in the dialog: show an inline error message inside the dialog on failure (don't close on error) — consistent with the restore dialog at `DocumentList.tsx:121`.
- Loading state on the active delete button while the request is in flight (spinner, disabled buttons).
- Exact wording of the "Delete All" confirmation description is Claude's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing delete endpoint
- `backend/app/api/documents.py` §477–507 — current `DELETE /documents/{id}` implementation; this is what gets extended with the `scope` param

### Frontend delete dialog
- `frontend/src/components/ingestion/DocumentList.tsx` §370–397 — existing delete Dialog to be upgraded; §87–226 — VersionHistoryPanel (must stay unchanged)

### DB cascade confirmation
- `supabase/migrations/000_full_schema.sql` lines 271, 323, 346 — `ON DELETE CASCADE` on `document_chunks`, `document_tables`, `document_images` respectively

### Pattern references
- `frontend/src/components/ingestion/DocumentList.tsx` §196–223 — restore confirmation dialog pattern (error-in-dialog, loading spinner, cancel/action footer)
- `backend/app/api/documents.py` §374–415 — `restore_document_version` — sibling promotion logic; "delete this version + promote next" reuses the same sibling query pattern
- Phase 45 thread delete (`frontend/src/components/chat/`) — AlertDialog pattern for destructive confirmations (this phase uses shadcn Dialog, not AlertDialog, to stay consistent with the existing document restore dialog)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DocumentList.tsx:229–231` — `deleteTarget` state + Dialog open/close pattern: reuse and extend for version-aware dialog
- `DocumentList.tsx:267–271` — `hasVersions(doc)` helper (`version_number > 1`): use this same check to gate the two-action footer
- `api.ts:deleteDocument()` — existing API call; extend with optional `scope` query param
- `VersionHistoryPanel` — leave unchanged; it already has the sibling-version data that informs the "v{N}" label in the new dialog

### Established Patterns
- All destructive dialogs in the codebase use shadcn `Dialog` (not AlertDialog) — stay consistent
- Error-in-dialog pattern: `setRestoreError` inside the dialog, don't close on failure (line 121)
- Backend: `write_audit_entry` via `BackgroundTasks` — same pattern for delete audit log

### Integration Points
- `useDocuments.ts` hook's `deleteDocument` → `api.ts:deleteDocument()` → `DELETE /documents/{id}` — the hook call site needs the `scope` param threaded through
- `IngestionPage.tsx` calls `DocumentList` with `onDelete` prop — may need updating to pass scope

</code_context>

<specifics>
## Specific Ideas

- Dialog button label for current-version delete should include the version number: "Delete v3" not just "Delete This Version" — makes the scope immediately clear at a glance.
- Description under the title for multi-version dialog: "This document has {N} versions." as a sub-line sets context before the buttons.

</specifics>

<deferred>
## Deferred Ideas

- Delete individual historical versions from within the Version History panel — this is a power-user feature that belongs in a future phase or the Skills Studio milestone. History panel stays restore-only for now.

</deferred>

---

*Phase: 46-document-version-deletion*
*Context gathered: 2026-04-24*
