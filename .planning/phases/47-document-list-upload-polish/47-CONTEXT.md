# Phase 47: Document List & Upload Polish - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

> **Phase numbering note:** ROADMAP.md is stale (shows all v2.4 phases as "Not started" and Phase 47 = Document Version Deletion). The authoritative sequence is STATE.md: Phase 47 = Document List & Upload Polish (DOC-04/05/06). Phase 46 = Document Version Deletion was shipped 2026-04-25.

<domain>
## Phase Boundary

Polish document management UX in three areas: (1) make root-folder documents clearly visible with a doc count badge and contextual right-panel header; (2) add a proper 50 MB file size limit with a specific error, completing the DOC-05 error coverage; and (3) confirm root upload clarity is covered by the root context header.

What's in scope:
- Root node doc count badge in FolderTree
- "Root" section header + subtitle in the right panel when Root is selected
- Root empty state copy update + upload hint
- 50 MB backend size validation with specific 422 error message
- No changes to duplicate handling (wording stays "already up to date")

What's NOT in scope:
- Folder count badges or other FolderNode display changes
- Changes to the upload zone beyond what DOC-04 root header provides
- Any changes to DocumentList's version-aware delete dialog (Phase 46 work)
- Upload error redesign beyond surfacing existing + new backend errors

</domain>

<decisions>
## Implementation Decisions

### Root Document Visibility (DOC-04)

- **D-01:** Add a document count badge to the "Root" node in `FolderTree.tsx`. The badge should show the count of documents with `folder_id == null` from the `documents` prop. Style consistent with how other counts are displayed in the app — small, subdued, right-aligned.
- **D-02:** When Root is selected (`selectedFolderId === null`), the right panel should show a "Root" section header with a subtitle "Documents not assigned to a folder". This mirrors the visual context that `FolderBreadcrumb` + `FolderDetail` give for subfolders. Implementation: add a conditional block in `IngestionPage.tsx` that renders when `selectedFolderId === null` (mirroring the `selectedFolderId !== null` block that shows Breadcrumb/Detail).
- **D-03:** Update `DocumentList.tsx` root empty state: change "No documents uploaded yet." to "No root documents yet." and add the upload hint "Upload files above to add them here." below it (currently the hint only shows for non-root folders).

### File Size Limit (DOC-05)

- **D-04:** Add a 50 MB per-file size check in `backend/app/api/documents.py` upload endpoint, immediately after `raw = await file.read()` and before the duplicate/storage logic. If `len(raw) > 50 * 1024 * 1024`, raise `HTTPException(status_code=422, detail="File too large. Maximum size is 50 MB.")`. This matches Supabase Storage's default limit so the backend check fires before storage is attempted.
- **D-05:** No frontend-only size validation needed — the backend check is sufficient. The error message propagates via the existing `err.detail` → `batch.errors` path already implemented in `api.ts` + `DocumentUpload.tsx`.

### Duplicate File Wording (DOC-05)

- **D-06:** No change. "Already up to date" is clear and accurate. Duplicates continue to return 200 OK and display as "X already up to date" — this satisfies the "specific reason" requirement in DOC-05.

### Root Upload UX (DOC-06)

- **D-07:** The DOC-04 "Root" section header (D-02) provides the "you are uploading to Root" context. No additional changes to the upload zone are needed. `DocumentUpload.tsx` already shows "Upload to Root" when `folderName` is null — combined with the new section header this is sufficient.

### Claude's Discretion

- Badge styling on the Root count: pick the most natural count chip pattern from the existing codebase (inspect `FolderNode.tsx` for any existing count patterns; if none, a small `text-xs text-muted-foreground` span is appropriate).
- Exact wording of the Root section subtitle: "Documents not assigned to a folder" is the intent, exact phrasing is Claude's call.
- Whether to pass `documents` as a prop to `FolderTree` or compute the root count at the `IngestionPage` level and pass it as a single number — Claude picks whichever is simpler.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend upload endpoint
- `backend/app/api/documents.py` §130–280 — `upload_document()` endpoint; size check goes immediately after `raw = await file.read()` at §154

### Frontend document list + upload components
- `frontend/src/components/ingestion/DocumentList.tsx` §230–286 — empty state logic; D-03 updates the root empty state at §271–285
- `frontend/src/components/ingestion/DocumentUpload.tsx` — upload zone; "Upload to Root" label already at §92; no changes needed for D-07
- `frontend/src/components/ingestion/FolderTree.tsx` §107–145 — Root node rendering; D-01 badge goes here

### Page-level orchestration
- `frontend/src/pages/IngestionPage.tsx` §12–106 — Right panel conditional rendering; D-02 Root header block added here alongside the existing `selectedFolderId !== null` block (§69–84)

### Existing folder detail pattern (analog for Root header block)
- `frontend/src/pages/IngestionPage.tsx` §69–84 — `FolderBreadcrumb` + `FolderDetail` rendering pattern that D-02 mirrors for root

### Error propagation chain (DOC-05)
- `frontend/src/lib/api.ts` §233–235 — `err.detail` extraction on upload failure; already surfaces backend error messages
- `frontend/src/components/ingestion/DocumentUpload.tsx` §31–40 — `batch.errors` population; already shows error strings as red text

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DocumentList.tsx:239–244` — `filtered` array logic with `folderId == null` for root — no changes needed here; DOC-04 is about presentation around the list, not the filtering itself
- `FolderTree.tsx:107` — `isRootSelected` boolean already computed — reuse to gate badge rendering
- `IngestionPage.tsx:69–84` — `selectedFolderId !== null` block pattern — mirror this for the `selectedFolderId === null` Root header block

### Established Patterns
- Error surfacing: backend 422 `detail` → `api.ts` throws `new Error(err.detail)` → `useDocuments.upload` propagates → `DocumentUpload.tsx` pushes to `batch.errors` → displayed as red text — already fully wired, D-04 just adds a new 422 case
- Empty states in `DocumentList.tsx` use `{folderId == null ? ... : ...}` ternary — D-03 updates the null branch
- FolderTree is stateless regarding documents — currently receives only folders; D-01 either adds a `documentCount` prop or computes it upstream in IngestionPage

### Integration Points
- `IngestionPage.tsx` is the orchestration point for all DOC-04 changes: root header block (D-02) and optional `documentCount` prop threading to FolderTree (D-01)
- `documents.py:154` is the precise insertion point for the size check (D-04) — between `raw = await file.read()` and the duplicate check

</code_context>

<specifics>
## Specific Ideas

- The "Root" section header should feel like a lighter version of `FolderDetail` — just a title + subtitle, no stat cards. FolderDetail renders document count + subfolder count + global badge; the Root header needs none of that.
- Root badge count should reflect `documents.filter(d => d.folder_id == null).length` from the already-loaded documents list — no additional API call.

</specifics>

<deferred>
## Deferred Ideas

- Folder-level document count badges on FolderNode items (per-folder count display) — mentioned implicitly by DOC-04 but not in scope; deferred to future polish phase.
- Frontend file size validation (pre-flight check before API call) — backend check is sufficient for v2.4; frontend validation could be added for better UX in a future pass.

</deferred>

---

*Phase: 47-document-list-upload-polish*
*Context gathered: 2026-04-25*
