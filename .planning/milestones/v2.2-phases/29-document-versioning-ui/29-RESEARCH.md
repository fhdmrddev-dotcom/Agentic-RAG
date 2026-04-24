# Phase 29: Document Versioning — UI - Research

**Researched:** 2026-04-13
**Domain:** React/TypeScript UI extension + FastAPI endpoint additions
**Confidence:** HIGH

## Summary

Phase 29 is a well-bounded extension to existing code. The backend schema (version_number, is_latest) and storage of old chunks are already complete from Phase 28. This phase adds three things: (1) a `is_latest=True` filter to the list endpoint, (2) two new backend routes (GET versions, POST restore), and (3) UI changes confined entirely to `DocumentList.tsx` plus additions to `api.ts` and `types/index.ts`.

All required patterns — expand/collapse rows, chip-style badges, shadcn Dialog confirmations, toast notifications, loading state on buttons — are already established in the codebase. There is nothing to research for ecosystem fit; the entire implementation follows direct analogues already present in the same file or adjacent components.

The only non-trivial decision surfaces are the backend sibling-lookup logic for restore (scope by `filename + user_id`, not `folder_id`) and the is_latest filter placement in the list endpoint (must apply to both own_docs and global_docs queries).

**Primary recommendation:** Implement in two sequential plans: Plan 01 adds the backend routes and list filter; Plan 02 adds the frontend UI changes (badge, history panel, restore dialog, api.ts additions).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Document List Filtering:**
Filter the `GET /documents` list endpoint to return only `is_latest=True` rows. Old versions are hidden from the default view and fetched on demand via a new `GET /documents/{id}/versions` endpoint that returns all sibling versions (same filename, same user, ordered by version_number desc).

**D-02 — Version Badge:**
Badge appears inline next to the filename in the existing filename column — not a new column. Small chip: `vN` text in `text-xs` weight, `bg-primary/10 text-primary` styling (matches topic pill style). Only rendered when `version_number > 1`; v1 documents show no badge.

**D-03 — History Panel UX:**
Extend the existing expand/collapse chevron row pattern in `DocumentList.tsx`. The toggle button is shown whenever `version_number > 1`. Expanding a versioned document reveals a version history sub-row — a compact table listing all versions: version number, upload date, file size, and a restore button per row. If the document also has metadata, both panels render in separate `<tr>` rows (metadata first, versions below).

**D-04 — Restore Action:**

Backend: `POST /documents/{id}/restore` that:
1. Looks up the target document row (validates ownership)
2. Finds all sibling documents (same `filename`, same `user_id`, same `folder_id`)
3. Sets `is_latest=False` on all siblings
4. Sets `is_latest=True` on the target document row
5. Returns the updated target document row

Frontend: Clicking "Restore" shows a confirmation dialog: "Restore v{N}? This version will become active for retrieval. The current version remains in history." Two buttons: Cancel / Restore. On confirm, call the endpoint, then refresh the document list. No optimistic update — wait for the round-trip.

### Claude's Discretion

- Loading state during restore: spinner on the Restore button (disable while in-flight)
- Error handling: toast notification on restore failure using the existing pattern in the app
- Version history row styling: same `bg-muted/30 border-t` pattern as MetadataPanel for visual consistency
- The `Document` TypeScript interface should be extended with `version_number?: number` and `is_latest?: boolean` — both optional for backward compatibility

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VER-03 | User can see a version badge (e.g. "v3") on documents that have been updated in the document library | version_number field already in DocumentResponse (Phase 28); badge pattern established in MetadataPanel topic pills |
| VER-04 | User can expand a document row to view its full version history (version number, upload date, file size) | New GET /{id}/versions backend endpoint; expand/collapse pattern already in DocumentList.tsx; formatBytes utility already present |
| VER-05 | User can restore an older version as the active version | New POST /{id}/restore backend endpoint; flag-flip only (chunks already in DB from Phase 28); confirmation dialog pattern established in delete flow |
</phase_requirements>

---

## Standard Stack

### Core (no new packages required)
| Library | Version | Purpose | Already In Use |
|---------|---------|---------|----------------|
| React + TypeScript | 18.x | UI component extension | Yes — entire frontend |
| shadcn/ui Dialog | current | Restore confirmation dialog | Yes — delete dialog uses it |
| shadcn/ui Button | current | Restore button with loading state | Yes — delete, toggle-global buttons |
| FastAPI | current | New backend routes | Yes — entire backend |
| supabase-py | current | DB queries for versions/restore | Yes — entire backend |
| Pydantic | current | Response model (uses DocumentResponse) | Yes — all endpoints |

**No new dependencies.** This phase adds no packages.

### Reusable Assets Already Present

| Asset | File | Reuse In This Phase |
|-------|------|---------------------|
| `expanded: Set<string>` + `toggle(id)` state | DocumentList.tsx L147,161 | Extend to show version history panel |
| MetadataPanel `<tr colSpan={7}>` pattern | DocumentList.tsx L241-246 | VersionHistoryPanel same pattern |
| Topic pill CSS `bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs` | DocumentList.tsx L129 | Version badge chip |
| Delete confirmation Dialog | DocumentList.tsx L253-281 | Clone for restore confirmation |
| `formatBytes()` utility | DocumentList.tsx L22-25 | File size in version history rows |
| `Button variant="ghost" size="sm"` | DocumentList.tsx L230-236 | Restore button per version row |
| `getAuthHeaders()` / `getAuthToken()` | api.ts L11-26 | New API functions |
| `_make_builder()` / `_make_supabase()` | test_document_versioning.py L43-71 | Same mock pattern for new endpoint tests |

---

## Architecture Patterns

### Recommended Task Split

**Plan 01 — Backend:**
1. Add `is_latest=True` filter to `list_documents` (both own_docs and global_docs queries)
2. Add `GET /documents/{document_id}/versions` route
3. Add `POST /documents/{document_id}/restore` route
4. Unit tests for new routes

**Plan 02 — Frontend:**
1. Extend `Document` interface with `version_number?: number` and `is_latest?: boolean`
2. Add `fetchDocumentVersions(id)` and `restoreDocumentVersion(id)` to `api.ts`
3. Modify `DocumentList.tsx`: version badge, expand trigger, VersionHistoryPanel, restore dialog

### Pattern 1: Expand Trigger Logic

Currently the chevron toggle shows only when `hasMetadata(doc)`. Phase 29 requires it also when `version_number > 1`. The trigger condition becomes:

```typescript
// Source: DocumentList.tsx analysis
const hasVersions = (doc: Document) => (doc.version_number ?? 1) > 1
const isExpandable = (doc: Document) => hasMetadata(doc) || hasVersions(doc)
```

The toggle button renders when `isExpandable(doc)`. The aria-label should reflect what will expand (e.g. "Expand details").

### Pattern 2: Multi-Panel Expansion

When a row is expanded and it has both metadata and versions, two `<tr>` rows are rendered. Metadata first, version history below. Each is an independent `<tr colSpan={7} className="p-0">`:

```typescript
// Source: DocumentList.tsx L240-246 — existing MetadataPanel pattern
{hasMetadata(doc) && expanded.has(doc.id) && (
  <tr><td colSpan={7} className="p-0"><MetadataPanel metadata={doc.metadata!} /></td></tr>
)}
{hasVersions(doc) && expanded.has(doc.id) && (
  <tr><td colSpan={7} className="p-0"><VersionHistoryPanel documentId={doc.id} currentVersionNumber={doc.version_number ?? 1} /></td></tr>
)}
```

### Pattern 3: VersionHistoryPanel Data Fetching

The panel fetches on first render (or on expand). Use a `useState` + `useEffect` pattern with a loading flag — same as other inline fetch patterns in the codebase. Fetch `GET /documents/{id}/versions` from `api.ts`.

```typescript
function VersionHistoryPanel({ documentId, currentVersionNumber, onRestored }: { documentId: string, currentVersionNumber: number, onRestored: () => void }) {
  const [versions, setVersions] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetchDocumentVersions(documentId).then(setVersions).finally(() => setLoading(false))
  }, [documentId])
  // render compact table rows
}
```

### Pattern 4: Restore Backend Logic

The restore endpoint must scope sibling lookup by `filename + user_id`. The `folder_id` is intentionally included per D-04 (same folder constraint on siblings). Logic:

```python
# POST /documents/{document_id}/restore
# 1. Fetch target row, validate user_id ownership
# 2. Find siblings: .eq("user_id", ...).eq("filename", ...).eq("folder_id", ...)
#    NOTE: folder_id may be NULL — use .is_("folder_id", "null") when folder_id is None
# 3. .update({"is_latest": False}) on all siblings
# 4. .update({"is_latest": True}) on target
# 5. Return updated target row
```

**NULL folder_id handling is a pitfall** — see Pitfall 2 below.

### Pattern 5: List Filter Placement

The `list_documents` endpoint has two query paths (own_docs and global_docs). The `is_latest=True` filter must be added to both:

```python
# Own documents — add .eq("is_latest", True)
own_result = (
    supabase.table("documents")
    .select("*")
    .eq("user_id", current_user["id"])
    .eq("is_latest", True)        # ADD THIS
    .execute()
)

# Global docs — add .eq("is_latest", True)
global_result = (
    supabase.table("documents")
    .select("*")
    .in_("folder_id", global_folder_ids)
    .eq("is_latest", True)        # ADD THIS
    .execute()
)
```

### Anti-Patterns to Avoid

- **Modal for version history:** D-03 explicitly chose inline expand. Do not use a Dialog/Sheet for version history.
- **Optimistic update on restore:** D-04 explicitly required waiting for round-trip. Do not flip the badge/list before the API responds.
- **Re-ingestion on restore:** VER-05 requirement note says "restore from stored file or re-upload" but D-04 confirms flag-flip only — chunks are already in DB from Phase 28.
- **New column for version badge:** D-02 requires inline in filename cell, not a new table column.
- **Filtering only own_docs in list endpoint:** The global_docs query path also needs the `is_latest=True` filter.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialog | Custom modal from scratch | shadcn Dialog (already imported in DocumentList) | Delete dialog is identical in structure — clone it |
| Byte formatting | Custom formatter | `formatBytes()` utility already in DocumentList | Already handles B/KB/MB |
| Auth headers for new API calls | Custom auth logic | `getAuthHeaders()` in api.ts | Consistent with all other API functions |
| Toast on error | Custom error display | Existing toast pattern in the app | Project pattern — don't deviate |
| Spinner/loading state | Custom CSS animation | `DocumentStatusBadge` uses `animate-spin rounded-full border border-current border-t-transparent` | Reuse same Tailwind classes on Restore button |

---

## Common Pitfalls

### Pitfall 1: Expand Trigger Condition Regression

**What goes wrong:** Modifying the chevron toggle condition to `hasVersions` accidentally removes it for docs that have metadata but no versions (v1 docs).

**Why it happens:** Replacing `hasMetadata(doc)` with `hasVersions(doc)` instead of using `||`.

**How to avoid:** Condition is `hasMetadata(doc) || hasVersions(doc)`. Both must remain.

**Warning sign:** v1 documents with metadata no longer show the expand chevron.

### Pitfall 2: NULL folder_id in Sibling Query

**What goes wrong:** Using `.eq("folder_id", None)` when searching for siblings of a root-level document returns zero results in Supabase (SQL `= NULL` is always false).

**Why it happens:** SQL NULL equality requires `IS NULL`, not `= NULL`. Supabase `.eq("folder_id", None)` generates `= null` in the query, not `IS NULL`.

**How to avoid:** Check folder_id value before constructing the query:
```python
if folder_id is None:
    siblings_query = siblings_query.is_("folder_id", "null")
else:
    siblings_query = siblings_query.eq("folder_id", folder_id)
```

This pattern is already established in the upload endpoint (dedup_query uses `.is_("folder_id", "null")`).

**Warning sign:** Restoring a root-level document does not retire the current version; the old `is_latest=True` row remains.

### Pitfall 3: List Filter Missing from Global Docs Path

**What goes wrong:** Adding `is_latest=True` filter to `own_result` query but forgetting the `global_docs` query path. Old versions of documents in globally-visible folders still appear in the list.

**Why it happens:** The `list_documents` endpoint has two Supabase queries. Easy to add to one and miss the other.

**How to avoid:** Add the filter to both query branches. Test with a document in a global folder.

### Pitfall 4: Version History Panel Fetches on Every Re-render

**What goes wrong:** Fetching versions inside a `useEffect` with no dependency array, or with `documentId` triggering refetch on every parent re-render.

**Why it happens:** React lifecycle misuse; parent state updates (e.g., expanded set changes) cause child re-renders.

**How to avoid:** `useEffect(() => { fetch... }, [documentId])` — dependency array with only `documentId`. Since `documentId` is stable, this fires once on mount.

### Pitfall 5: Restore Without Ownership Validation

**What goes wrong:** The restore endpoint updates `is_latest` flags without verifying the requesting user owns the target document.

**Why it happens:** Forgetting to `.eq("user_id", current_user["id"])` on the document lookup.

**How to avoid:** First query must include both `id` and `user_id` filters, raising 404 if not found (same pattern as delete_document). Do not use the document_id alone.

### Pitfall 6: DocumentResponse Model Missing version_number/is_latest

**Confirmed NOT a problem:** `DocumentResponse` in `backend/app/models/document.py` already includes `version_number: int = 1` and `is_latest: bool = True` (added in Phase 28). New endpoints returning `DocumentResponse` will include these fields automatically.

### Pitfall 7: TypeScript Document Interface Already Missing These Fields

**Confirmed:** The `Document` interface in `frontend/src/types/index.ts` does NOT yet include `version_number` or `is_latest`. These must be added as optional fields (`version_number?: number` and `is_latest?: boolean`) per D-04 (Claude's Discretion).

---

## Code Examples

Verified patterns from existing codebase:

### Version Badge (inline chip next to filename)
```typescript
// Source: DocumentList.tsx L222 — filename cell, L129 — topic pill style
<td className="px-4 py-3 font-medium max-w-xs truncate">
  <span className="flex items-center gap-1.5">
    {doc.filename}
    {(doc.version_number ?? 1) > 1 && (
      <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">
        v{doc.version_number}
      </span>
    )}
  </span>
</td>
```

### NULL folder_id guard in restore endpoint
```python
# Source: documents.py L192-193 — dedup_query uses same pattern
if folder_id is None:
    siblings_query = siblings_query.is_("folder_id", "null")
else:
    siblings_query = siblings_query.eq("folder_id", folder_id)
```

### Restore button with in-flight spinner (Tailwind)
```typescript
// Source: DocumentStatusBadge.tsx L21-23 — animate-spin pattern
<Button
  variant="ghost"
  size="sm"
  disabled={restoring}
  onClick={() => setRestoreTarget(version)}
>
  {restoring ? (
    <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
  ) : "Restore"}
</Button>
```

### GET /documents/{id}/versions endpoint structure
```python
@router.get("/{document_id}/versions", response_model=list[DocumentResponse])
async def list_document_versions(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # First verify the document exists and user has access
    doc = supabase.table("documents").select("filename, user_id, folder_id") \
        .eq("id", document_id).eq("user_id", current_user["id"]) \
        .maybe_single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
    # Fetch all sibling versions ordered newest first
    result = supabase.table("documents").select("*") \
        .eq("user_id", current_user["id"]) \
        .eq("filename", doc.data["filename"]) \
        .order("version_number", desc=True) \
        .execute()
    return result.data or []
```

### POST /documents/{id}/restore endpoint structure
```python
@router.post("/{document_id}/restore", response_model=DocumentResponse)
async def restore_document_version(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # 1. Validate ownership
    doc = supabase.table("documents").select("*") \
        .eq("id", document_id).eq("user_id", current_user["id"]) \
        .maybe_single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
    target = doc.data
    folder_id = target["folder_id"]
    # 2. Retire all siblings
    siblings_q = supabase.table("documents").update({"is_latest": False}) \
        .eq("user_id", current_user["id"]).eq("filename", target["filename"])
    if folder_id is None:
        siblings_q = siblings_q.is_("folder_id", "null")
    else:
        siblings_q = siblings_q.eq("folder_id", folder_id)
    siblings_q.execute()
    # 3. Promote target
    result = supabase.table("documents").update({"is_latest": True}) \
        .eq("id", document_id).execute()
    return result.data[0]
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code/config-only changes. No new external tools, services, runtimes, or CLI utilities are required beyond the existing project stack.

---

## Validation Architecture

`workflow.nyquist_validation` key is absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (backend) |
| Config file | `backend/pytest.ini` or `pyproject.toml` (existing) |
| Quick run command | `cd backend && python -m pytest tests/unit/test_document_versioning.py -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -x -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-03 | Version badge rendered when version_number > 1 | Frontend component (manual visual) | manual — visual in browser | N/A |
| VER-03 | GET /documents returns only is_latest=True rows | unit | `pytest tests/unit/test_document_versioning.py -x -q -k "list"` | ❌ Wave 0 — add test |
| VER-04 | GET /documents/{id}/versions returns all versions ordered desc | unit | `pytest tests/unit/test_document_versioning.py -x -q -k "versions"` | ❌ Wave 0 — add test |
| VER-05 | POST /documents/{id}/restore flips is_latest correctly | unit | `pytest tests/unit/test_document_versioning.py -x -q -k "restore"` | ❌ Wave 0 — add test |
| VER-05 | Restore with NULL folder_id uses IS NULL filter | unit | `pytest tests/unit/test_document_versioning.py -x -q -k "restore_null_folder"` | ❌ Wave 0 — add test |
| VER-05 | Restore by non-owner returns 404 | unit | `pytest tests/unit/test_document_versioning.py -x -q -k "restore_unauthorized"` | ❌ Wave 0 — add test |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/unit/test_document_versioning.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

New test cases to add to `backend/tests/unit/test_document_versioning.py` (file exists — append to existing class or add new class):
- [ ] `test_list_documents_filters_is_latest` — GET /documents returns only is_latest=True rows
- [ ] `test_list_document_versions_returns_all` — GET /{id}/versions returns all versions
- [ ] `test_restore_promotes_target` — POST /{id}/restore sets is_latest=True on target
- [ ] `test_restore_retires_siblings` — POST /{id}/restore sets is_latest=False on siblings
- [ ] `test_restore_null_folder_uses_is_null` — sibling query uses IS NULL not = NULL for root docs
- [ ] `test_restore_unauthorized_returns_404` — non-owner gets 404

---

## Project Constraints (from CLAUDE.md)

All directives from CLAUDE.md that apply to this phase:

| Directive | Impact on This Phase |
|-----------|---------------------|
| No LangChain, no LangGraph — raw SDK calls only | Not applicable (no LLM calls in this phase) |
| Python backend must use `venv` virtual environment | Run `pytest` from within venv |
| Use Pydantic for structured LLM outputs | DocumentResponse already uses Pydantic; new endpoints return it |
| All tables need Row-Level Security | No new tables in this phase; existing `documents` RLS covers new queries |
| Stream chat responses via SSE | Not applicable |
| Use Supabase Realtime for ingestion status | Not applicable |
| Save plans to `.agent/plans/` folder | Planning convention — planner must follow |
| Each task must include at least one validation test | Unit tests required for each new endpoint |

---

## Open Questions

1. **Restore action scope for global folder documents**
   - What we know: Restore validates `user_id` ownership, so a user can only restore documents they own. Documents in globally-visible folders belong to the folder owner, not the viewer.
   - What's unclear: Should a viewer of a global folder see the restore button at all? The CONTEXT.md does not address this.
   - Recommendation: Safe default — render restore button only when `doc.user_id === currentUserId`. The API will return 404 for non-owned documents anyway, making this a UX-only guard. Planner should add this condition to the VersionHistoryPanel.

2. **VersionHistoryPanel refresh after restore**
   - What we know: D-04 says "refresh the document list" after restore. The document list is fetched via `listDocuments()` from the parent component.
   - What's unclear: The VersionHistoryPanel is a child component. How does it trigger a parent list refresh?
   - Recommendation: Pass an `onRestored` callback prop from DocumentList to VersionHistoryPanel. On successful restore, call `onRestored()` which triggers `fetchDocuments()` in the parent. This is the same pattern used for `onDelete` in DocumentList.

---

## Sources

### Primary (HIGH confidence)
- Direct file reads of: `frontend/src/components/ingestion/DocumentList.tsx`, `frontend/src/types/index.ts`, `frontend/src/lib/api.ts`, `backend/app/api/documents.py`, `backend/app/models/document.py`, `frontend/src/components/ingestion/DocumentStatusBadge.tsx`
- Phase 28 summary confirming DB schema and retained chunks: `.planning/phases/28-document-versioning-schema-ingestion/28-02-SUMMARY.md`
- Requirements definitions: `.planning/REQUIREMENTS.md`
- User decisions: `.planning/phases/29-document-versioning-ui/29-CONTEXT.md`

### Secondary (MEDIUM confidence)
- None — all findings are from direct codebase inspection

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries already used in project
- Architecture patterns: HIGH — all patterns derived from reading actual code in the files being modified
- Pitfalls: HIGH — NULL folder_id pitfall verified by reading existing upload endpoint code; all other pitfalls derived from direct code analysis
- Test requirements: HIGH — test file structure verified by reading existing test_document_versioning.py

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable dependencies; no fast-moving libraries involved)
