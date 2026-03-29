# Phase 2: Document-Folder Integration - Research

**Researched:** 2026-03-21
**Domain:** FastAPI + Supabase document/folder association, schema migration, move operations
**Confidence:** HIGH

## Summary

Phase 2 connects the existing `documents` table to the `folders` table created in Phase 1. It adds two nullable columns (`folder_id`, `full_markdown`) to `documents` via a backward-compatible ALTER TABLE migration, modifies the upload endpoint to accept an optional `folder_id` parameter, stores full extracted markdown during ingestion, and adds new endpoints for moving files and folders.

The implementation is entirely within the existing FastAPI + Supabase stack. No new dependencies are required. All patterns — Pydantic models, Supabase client usage, RLS enforcement via manual `user_id` filtering, background ingest tasks — are already established in the codebase and must be replicated exactly.

The critical design constraint is that the Supabase client runs as service role (bypasses RLS), so ownership checks on related resources (the target folder when uploading or moving) must be enforced explicitly in Python, mirroring the pattern in `folders.py`'s parent validation.

**Primary recommendation:** Deliver in two plans — (1) migration + API changes, (2) integration tests — matching the Phase 1 structure.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOLDER-04 | User can move folders to a different parent folder | New `PATCH /folders/{id}/move` endpoint; validates new parent accessibility; single UPDATE call |
| DOC-01 | User can upload files into a specific folder | Extend `POST /documents/upload` to accept optional `folder_id` form field; validate folder accessibility; persist `folder_id` on the document row |
| DOC-02 | User can move files between folders | New `PATCH /documents/{id}/move` endpoint; validates ownership of document + accessibility of target folder; single UPDATE call |
| DOC-03 | System stores full extracted markdown alongside chunks for each document | `ingest_document` background function stores `text` in `full_markdown` column on the documents row during completion update |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supabase-py | already installed | Supabase client for DB queries and storage | Project standard |
| fastapi | already installed | HTTP endpoints | Project standard |
| pydantic | already installed | Request/response models | Project standard — CLAUDE.md mandates it |

No new packages required. Everything needed is already in `backend/requirements.txt`.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pypdf | already installed | PDF text extraction | Existing `extract_text()` already uses it |
| python-docx | already installed | DOCX text extraction | Existing `extract_text()` already uses it |

### Alternatives Considered

None — the stack is locked by project conventions and all needed capabilities already exist.

## Architecture Patterns

### Recommended Project Structure

Phase 2 touches these existing files only. No new files or directories:

```
backend/
├── supabase/migrations/
│   └── 014_document_folder_integration.sql   # NEW - ALTER TABLE only
├── app/
│   ├── models/
│   │   └── document.py                       # MODIFY - add folder_id field to DocumentResponse
│   └── api/
│       ├── documents.py                      # MODIFY - upload + move endpoints
│       └── folders.py                        # MODIFY - move folder endpoint
└── tests/
    └── integration/
        └── test_documents.py                 # MODIFY - add Phase 2 test cases
        └── test_folders.py                   # MODIFY - add move folder test cases
```

### Pattern 1: Backward-Compatible Schema Migration

**What:** Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` with nullable columns so existing rows get NULL without data loss.

**When to use:** Adding columns to an existing table that has live data.

**Example:**
```sql
-- Migration 014: Document-Folder Integration (Phase 2)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS full_markdown text;

CREATE INDEX IF NOT EXISTS documents_folder_id_idx ON public.documents(folder_id);
```

Key points:
- `ON DELETE SET NULL` is correct: deleting a folder should orphan its documents to root (NULL), not cascade-delete the documents themselves. This is a deliberate design choice for user safety.
- No new RLS policies needed — existing documents RLS (`user_id` based) already covers these columns.
- `full_markdown` stores the raw extracted text (the same `text` variable already computed in `ingest_document`). No transformation needed.

### Pattern 2: Upload Endpoint Extension

**What:** Add optional `folder_id` as a `Form(None)` parameter alongside the existing `file: UploadFile`. Validate folder accessibility if provided. Persist `folder_id` on the document row.

**When to use:** Associating a file with a folder at upload time (DOC-01).

**Example:**
```python
from fastapi import Form

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    response: Response,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    folder_id: str | None = Form(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Validate folder_id if provided
    if folder_id:
        folder = (
            supabase.table("folders")
            .select("id")
            .eq("id", folder_id)
            .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
            .maybe_single()
            .execute()
        )
        if not folder.data:
            raise HTTPException(status_code=404, detail="Folder not found")

    doc_data = {
        ...,
        "folder_id": folder_id,  # None = root level
    }
```

**Critical:** `folder_id` must be a `Form()` parameter, not a query param or JSON body field, because the upload endpoint uses `multipart/form-data`. You cannot mix a JSON body with `UploadFile`.

### Pattern 3: Move Endpoints

**What:** `PATCH /documents/{id}/move` and `PATCH /folders/{id}/move` accept a target `folder_id` (or `null` for root) and update the parent association.

**When to use:** Moving files (DOC-02) and folders (FOLDER-04).

**Example — move document:**
```python
class DocumentMoveRequest(BaseModel):
    folder_id: UUID | None  # None = move to root

@router.patch("/{document_id}/move", response_model=DocumentResponse)
async def move_document(
    document_id: str,
    body: DocumentMoveRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # 1. Verify document ownership
    doc = (
        supabase.table("documents")
        .select("id")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # 2. Validate target folder accessibility (if not moving to root)
    if body.folder_id:
        folder = (
            supabase.table("folders")
            .select("id")
            .eq("id", str(body.folder_id))
            .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
            .maybe_single()
            .execute()
        )
        if not folder.data:
            raise HTTPException(status_code=404, detail="Folder not found")

    # 3. Perform move
    result = (
        supabase.table("documents")
        .update({"folder_id": str(body.folder_id) if body.folder_id else None})
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    return result.data[0]
```

**Example — move folder (FOLDER-04):**
```python
class FolderMoveRequest(BaseModel):
    parent_id: UUID | None  # None = move to root

@router.patch("/{folder_id}/move", response_model=FolderResponse)
async def move_folder(
    folder_id: str,
    body: FolderMoveRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # 1. Validate new parent accessibility (if not moving to root)
    if body.parent_id:
        parent = (
            supabase.table("folders")
            .select("id")
            .eq("id", str(body.parent_id))
            .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
            .maybe_single()
            .execute()
        )
        if not parent.data:
            raise HTTPException(status_code=404, detail="Parent folder not found")

    # 2. Perform move (ownership enforced via user_id filter)
    result = (
        supabase.table("folders")
        .update({"parent_id": str(body.parent_id) if body.parent_id else None})
        .eq("id", folder_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Folder not found")
    return result.data[0]
```

### Pattern 4: Storing full_markdown in ingest_document

**What:** The `ingest_document` background function already has the full extracted `text` string. Add `full_markdown` to the completion update.

**When to use:** DOC-03 requires every ingested document to have its full markdown stored.

**Example (modification to existing `ingest_document`):**
```python
supabase.table("documents").update({
    "status": "completed",
    "chunk_count": len(chunks),
    "metadata": metadata_dict,
    "full_markdown": text,          # ADD THIS LINE
}).eq("id", document_id).execute()
```

The `text` variable is already in scope in `ingest_document`. No restructuring needed.

### Pattern 5: Pydantic Model Extension

**What:** Add `folder_id` to `DocumentResponse` so the API returns the association.

**Example:**
```python
class DocumentResponse(BaseModel):
    id: UUID
    user_id: UUID
    folder_id: UUID | None = None   # ADD THIS
    filename: str
    file_path: str
    file_size: int
    mime_type: str
    status: Literal["pending", "processing", "completed", "failed"]
    error_message: str | None
    chunk_count: int | None
    content_hash: str | None
    metadata: DocumentMetadata | None = None
    created_at: datetime
    updated_at: datetime
    # NOTE: full_markdown intentionally omitted from response model
    # It can be large (entire document text). Phase 6 read tool retrieves it.
```

`full_markdown` is NOT included in `DocumentResponse`. It's too large to return on every list/upload call. The Phase 6 read tool will fetch it specifically.

### Anti-Patterns to Avoid

- **Mixing JSON body and UploadFile:** Cannot use a Pydantic model as the request body when the endpoint already has `file: UploadFile`. FastAPI requires `Form()` fields for multipart endpoints. Use `folder_id: str | None = Form(None)` not a nested model.
- **Cascade deleting documents on folder delete:** The FK must be `ON DELETE SET NULL`, not `ON DELETE CASCADE`. Deleting a folder should not destroy its documents — they become root-level.
- **Returning full_markdown in DocumentResponse:** The field can be megabytes of text. Including it in list/upload responses would bloat every API call. Keep it out of the response model; retrieve it only on explicit read.
- **Skipping ownership check on move target folder:** The service role client bypasses RLS. Always validate that the target `folder_id` is accessible to the current user (owned OR global) before allowing a move.
- **Storing folder_id on duplicate document check:** The existing deduplication logic (same hash + completed = return existing) may return a document with a different `folder_id`. The planner should decide whether to update `folder_id` on dedup hit or just return as-is. Research recommends: return as-is (same behavior as existing code) and document this as a known edge case.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recursive folder subtree move | Custom recursive Python tree traversal | Single DB UPDATE with `.eq("id", folder_id)` | Supabase adjacency list: moving a folder changes only `parent_id` on that one row; all descendants retain their `parent_id` references which remain correct automatically |
| Ownership check logic | Custom middleware or decorator | Inline `.eq("user_id", current_user["id"])` filter (existing pattern) | Matches every other endpoint in the codebase; consistent and simple |
| Full text storage | Chunked storage + reconstruction | Store raw `text` string in `full_markdown` column | The `text` variable is already computed; direct storage is O(1); reconstruction from chunks is lossy and complex |

**Key insight:** Moving a folder in an adjacency list is a single-row update. There is no need to recursively update descendants — each child's `parent_id` still points to the same folder ID, which is now at a new position in the tree.

## Common Pitfalls

### Pitfall 1: Form vs. JSON for folder_id on upload

**What goes wrong:** Developer adds `folder_id` as a Pydantic model field in the request body. FastAPI raises a validation error because the upload endpoint uses `multipart/form-data` (required for `UploadFile`), and you cannot mix JSON body with multipart.

**Why it happens:** FastAPI's `UploadFile` forces the content-type to `multipart/form-data`. Any additional fields must be declared as `Form()` parameters, not Pydantic models.

**How to avoid:** Declare `folder_id: str | None = Form(None)` as a separate function parameter alongside `file: UploadFile = File(...)`.

**Warning signs:** `422 Unprocessable Entity` on upload even with a valid file; error message mentions "field required" for non-file fields.

### Pitfall 2: ON DELETE CASCADE vs. ON DELETE SET NULL on folder_id FK

**What goes wrong:** Using `ON DELETE CASCADE` means deleting a folder deletes all its documents. Users lose data silently.

**Why it happens:** Cascade is the default mental model for child records, but documents are not "owned" by folders — they just belong to them.

**How to avoid:** Use `ON DELETE SET NULL` in the migration. Documents become root-level (NULL folder_id) when their folder is deleted.

**Warning signs:** Test that deletes a folder and then queries documents — if documents are gone, the FK is CASCADE not SET NULL.

### Pitfall 3: conftest mock_builder and or_() chain breakage

**What goes wrong:** Tests for move endpoints that call `.or_()` on the Supabase builder chain fail with unexpected behavior because the default conftest `_builder` mock does not wire `.or_()` back to `_builder`.

**Why it happens:** `MagicMock` auto-creates `.or_()` but returns a fresh MagicMock, not `_builder`. This breaks the fluent chain for subsequent `.eq()`, `.maybe_single()`, `.execute()` calls. This is documented as a known pattern in `STATE.md`: "or_() breaks MagicMock chain by default — restore with mock_builder.or_.return_value = mock_builder in tests needing it."

**How to avoid:** In any test that exercises an endpoint with `.or_()`, add `mock_builder.or_.return_value = mock_builder` before the request, then configure `mock_builder.execute.side_effect` with a list of results.

**Warning signs:** Test returns unexpected 404 for a valid folder; `mock_builder.execute.call_count` is 0 or lower than expected.

### Pitfall 4: Duplicate document dedup and folder_id

**What goes wrong:** User uploads a file they already uploaded, but this time targets a specific folder. The dedup logic returns the original document (without the new `folder_id`). The user's intent — placing the file in folder X — is silently ignored.

**Why it happens:** The existing dedup check returns early before the new `folder_id` is applied.

**How to avoid:** The dedup behavior is acceptable for v1 (keep it simple, match existing pattern). Document this as a known edge case — do not change the dedup logic in this phase. The test plan should not test dedup + folder together (it's out of scope for Phase 2 requirements).

### Pitfall 5: test_documents.py _doc_row helper missing folder_id

**What goes wrong:** Existing tests for `GET /documents` fail because `_doc_row()` does not include `folder_id` and Pydantic raises a validation error when deserializing the response.

**Why it happens:** After adding `folder_id` to `DocumentResponse`, every test that exercises the documents endpoints must return rows that include `folder_id` (even if `None`).

**How to avoid:** Update `_doc_row()` in `test_documents.py` to include `"folder_id": None`. Also update `full_markdown` if it's added to any query result.

## Code Examples

### Migration SQL Pattern (from existing migrations)

```sql
-- Migration 014: Document-Folder Integration (Phase 2)
-- Adds folder_id (nullable FK) and full_markdown (nullable text) to documents.
-- Backward-compatible: existing rows get NULL for both columns.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS full_markdown text;

CREATE INDEX IF NOT EXISTS documents_folder_id_idx ON public.documents(folder_id);
```

Note: Migration 013 is the folders table (Phase 1). Next number is 014.

### Multipart Form Field Pattern

```python
# Correct: folder_id as Form field alongside UploadFile
from fastapi import Form

async def upload_document(
    file: UploadFile = File(...),
    folder_id: str | None = Form(None),
    ...
):
```

### ingest_document full_markdown update (minimal change)

```python
# In the existing completion update block (line ~209 in documents.py):
supabase.table("documents").update({
    "status": "completed",
    "chunk_count": len(chunks),
    "metadata": metadata_dict,
    "full_markdown": text,       # text is already in scope
}).eq("id", document_id).execute()
```

### Test helper pattern for or_() endpoints

```python
def test_move_document_to_valid_folder(self, client, auth_headers, mock_builder):
    mock_builder.or_.return_value = mock_builder  # fix or_() chain
    doc_result = _make_result(_doc_row())
    folder_result = _make_result(_folder_row())
    update_result = _make_result([_doc_row(folder_id=FOLDER_ID)])
    mock_builder.execute.side_effect = [doc_result, folder_result, update_result]

    response = client.patch(
        f"/documents/{DOC_ID}/move",
        headers=auth_headers,
        json={"folder_id": FOLDER_ID},
    )
    assert response.status_code == 200
    assert response.json()["folder_id"] == FOLDER_ID
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (confirmed — `pytest.ini` present, 145 tests collected) |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && ./venv/Scripts/python -m pytest tests/integration/test_documents.py tests/integration/test_folders.py -x -v` |
| Full suite command | `cd backend && ./venv/Scripts/python -m pytest tests/ -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | Upload with valid folder_id stores correct association | integration | `pytest tests/integration/test_documents.py::TestUploadDocument -x` | Partially — test file exists but needs new test cases |
| DOC-01 | Upload with invalid folder_id returns 404 | integration | `pytest tests/integration/test_documents.py::TestUploadDocument -x` | No — Wave 0 gap |
| DOC-02 | Move document to valid folder returns 200 with updated folder_id | integration | `pytest tests/integration/test_documents.py::TestMoveDocument -x` | No — Wave 0 gap |
| DOC-02 | Move document to invalid folder returns 404 | integration | `pytest tests/integration/test_documents.py::TestMoveDocument -x` | No — Wave 0 gap |
| DOC-02 | Move document not owned by user returns 404 | integration | `pytest tests/integration/test_documents.py::TestMoveDocument -x` | No — Wave 0 gap |
| DOC-02 | Move document to root (folder_id=null) returns 200 | integration | `pytest tests/integration/test_documents.py::TestMoveDocument -x` | No — Wave 0 gap |
| DOC-03 | Completed document row has full_markdown populated | integration | `pytest tests/integration/test_documents.py -x` | No — Wave 0 gap |
| FOLDER-04 | Move folder to valid parent returns 200 with updated parent_id | integration | `pytest tests/integration/test_folders.py::TestMoveFolder -x` | No — Wave 0 gap |
| FOLDER-04 | Move folder to invalid parent returns 404 | integration | `pytest tests/integration/test_folders.py::TestMoveFolder -x` | No — Wave 0 gap |
| FOLDER-04 | Move folder not owned by user returns 404 | integration | `pytest tests/integration/test_folders.py::TestMoveFolder -x` | No — Wave 0 gap |
| FOLDER-04 | Move folder to root (parent_id=null) returns 200 | integration | `pytest tests/integration/test_folders.py::TestMoveFolder -x` | No — Wave 0 gap |

### Sampling Rate

- **Per task commit:** `cd backend && ./venv/Scripts/python -m pytest tests/integration/ -x -q`
- **Per wave merge:** `cd backend && ./venv/Scripts/python -m pytest tests/ -x`
- **Phase gate:** Full suite green before marking Phase 2 complete

### Wave 0 Gaps

- [ ] `TestMoveDocument` class in `tests/integration/test_documents.py` — covers DOC-02
- [ ] `TestMoveFolder` class in `tests/integration/test_folders.py` — covers FOLDER-04
- [ ] New upload test cases for `folder_id` behavior in `TestUploadDocument`
- [ ] Update `_doc_row()` in `test_documents.py` to include `folder_id: None` (prevents Pydantic validation failures after DocumentResponse is extended)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Documents at root only (no folder_id) | Documents have nullable folder_id (NULL = root) | Phase 2 migration | Fully backward-compatible; existing data unaffected |
| Chunks only stored (no full text) | Full markdown + chunks stored | Phase 2 ingest change | Enables grep/read tools in Phases 5-6 |

**Deprecated/outdated:**

None in this phase. No existing patterns are replaced.

## Open Questions

1. **Duplicate document dedup behavior with folder_id**
   - What we know: If the same file is uploaded twice with different `folder_id`, the existing dedup logic returns the first document unchanged.
   - What's unclear: Should the second upload silently update the `folder_id` on the existing record, or return the original as-is?
   - Recommendation: Return as-is (match existing behavior, simplest change). Note this as a known v1 limitation. Do not add complexity to the dedup path in Phase 2.

2. **full_markdown column size in Supabase**
   - What we know: PostgreSQL `text` type has no practical size limit. Large documents (e.g., 500-page PDFs) could produce hundreds of KB of text per row.
   - What's unclear: Whether the Supabase project has any row size or storage limits that would be hit in practice.
   - Recommendation: Proceed with `text` column — this is the correct PostgreSQL type. The risk is only relevant at very large scale, which is out of scope for v1.

## Sources

### Primary (HIGH confidence)

- Direct codebase reading — `backend/app/api/documents.py` (upload endpoint, ingest_document function)
- Direct codebase reading — `backend/app/api/folders.py` (folder CRUD, ownership pattern, `or_()` usage)
- Direct codebase reading — `backend/supabase/migrations/002_module2_byo_retrieval.sql` (documents table schema)
- Direct codebase reading — `backend/supabase/migrations/013_folders.sql` (folders table, Phase 1 output)
- Direct codebase reading — `backend/tests/conftest.py` (mock infrastructure, known `or_()` pitfall)
- Direct codebase reading — `backend/app/models/document.py` (DocumentResponse shape)
- `STATE.md` decisions — confirms `full_markdown` design decision and `or_()` mock pitfall

### Secondary (MEDIUM confidence)

- FastAPI documentation pattern: `Form()` required for multipart endpoints with `UploadFile` — well-established FastAPI constraint, consistent with project's existing upload endpoint structure
- PostgreSQL adjacency list move semantics — single-row UPDATE, no recursive traversal needed — standard database pattern

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependencies; all existing
- Architecture: HIGH — patterns directly observed in Phase 1 code
- Pitfalls: HIGH — `or_()` mock issue explicitly documented in STATE.md; Form/JSON conflict is a well-known FastAPI constraint; ON DELETE behavior verified against SQL spec
- Migration: HIGH — pattern directly matches existing migration files

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable stack, no fast-moving dependencies)
