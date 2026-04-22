# Phase 28: Document Versioning — Schema & Ingestion - Research

**Researched:** 2026-04-12
**Domain:** PostgreSQL schema design, document ingestion pipeline (FastAPI + Supabase), pgvector RPC modification, citation enrichment
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VER-01 | Uploading a file with the same filename as an existing document creates a new version rather than being rejected as a duplicate | Upload endpoint currently deletes+replaces on same-filename; needs version row creation instead |
| VER-02 | Old document chunks are immediately excluded from all retrieval and search after a new version finishes ingesting | RPCs filter by document_id; adding `is_latest` flag to documents table and filtering RPCs is the clean path |
| VER-06 | Answers citing a versioned document include the version number in the citation (e.g. "Report.pdf (v2)") | `_enrich_with_filenames` in retrieval_service.py must pull `version_number` from documents; citation dicts and SSE payload must carry it; CitationCard.tsx must render it |
</phase_requirements>

---

## Summary

Phase 28 introduces document versioning at the schema and ingestion layer. The current codebase treats same-filename re-upload as "stale document replacement" — it deletes the old document row (and its chunks, via CASCADE) and creates a fresh one. This must change to a versioning model: each upload of the same filename creates a new `documents` row with an incremented `version_number`, the new row becomes `is_latest = true`, the previous row's `is_latest` flips to `false`, and all old chunks remain in storage but are excluded from retrieval by an RPC-level filter.

Three components are touched: (1) a SQL migration that adds `version_number` and `is_latest` to `documents` and updates the two RPC functions to filter out non-latest chunks; (2) the upload endpoint and ingest background task in `documents.py` to create version records instead of deleting stale ones; (3) `retrieval_service.py`'s `_enrich_with_filenames` to carry `version_number` in enriched results so citations can show "Report.pdf (v2)", and the `CitationCard.tsx` to render it.

The success criteria for VER-06 (version number in citation cards) requires a data path from the database through the RPCs, through `_enrich_with_filenames`, into the SSE `citations` event, through the frontend `Citation` type, and into `CitationCard.tsx`. Each link in that chain needs a small targeted change.

**Primary recommendation:** Implement versioning as `(version_number integer, is_latest boolean)` on the `documents` table. Use `is_latest` as the RPC filter rather than a separate `document_versions` table — this keeps RPC changes minimal and avoids foreign-key complexity while Phase 29 adds the UI to browse history.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supabase-py | already installed | Postgres DDL via migration SQL files + Python client | Project standard |
| FastAPI + BackgroundTasks | already installed | Upload endpoint + async ingest task | Project standard |
| pgvector | already installed | Vector similarity search via RPC | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Pydantic | already installed | `DocumentResponse` model — adding `version_number`, `is_latest` fields | Whenever the API response shape changes |
| React + TypeScript | already installed | `Citation` type + `CitationCard.tsx` for VER-06 display | Frontend changes for citation version label |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `is_latest` flag on `documents` | Separate `document_versions` table | Separate table is cleaner for Phase 29 history browsing but requires a JOIN in RPCs; `is_latest` flag keeps RPC changes minimal and Phase 29 can expose versions with a simple `is_latest = false` query on the same table |
| RPC-level `is_latest` filter | Application-level post-filter | RPC filtering is correct; application-level would return stale chunks to Python then discard, wasting network and compute |

**Installation:** No new packages required — all changes are SQL migrations + Python/TypeScript edits.

---

## Architecture Patterns

### Current Upload Flow (must change for VER-01)

```
upload_document()
  → hash file (content_hash)
  → dedup check: same hash + same folder → return existing (200 OK)     [keep]
  → stale check: same filename + different hash → DELETE old, re-ingest  [CHANGE]
  → insert new documents row                                              [add version_number]
  → background: ingest_document()                                        [add is_latest flip]
```

### New Upload Flow After Phase 28

```
upload_document()
  → hash file (content_hash)
  → dedup check: same hash + same folder + is_latest=true → return existing (200 OK)  [adjusted filter]
  → version check: same filename → resolve next version_number, mark old is_latest=false  [NEW]
  → insert new documents row with version_number=N, is_latest=true
  → background: ingest_document() unchanged (chunks insert as before)
```

### Recommended Project Structure (no new files needed)

```
supabase/migrations/
└── 025_document_versioning.sql   # Add version_number + is_latest; update RPCs

backend/app/api/
└── documents.py                  # Modify upload_document() — version logic replaces stale delete

backend/app/models/
└── document.py                   # Add version_number + is_latest to DocumentResponse

backend/app/services/
└── retrieval_service.py          # _enrich_with_filenames: fetch version_number from documents

frontend/src/types/
└── index.ts                      # Add version_number?: number to Citation + Document types

frontend/src/components/chat/
└── CitationCard.tsx              # Render "(v{N})" label when version_number > 1
```

### Pattern 1: is_latest Flag as Retrieval Filter

**What:** Documents table gains `version_number integer NOT NULL DEFAULT 1` and `is_latest boolean NOT NULL DEFAULT true`. RPCs `match_document_chunks` and `keyword_search_chunks` add `AND d.is_latest = true` to their WHERE clause. This immediately excludes all old-version chunks from retrieval without deleting them (they remain for Phase 29's history view).

**When to use:** The is_latest flag approach is correct here because the RPCs join `document_chunks` to `documents` (via `d.id = dc.document_id`) and already filter on `d.metadata`, `d.folder_id`, and `d.user_id`. Adding `d.is_latest = true` is one extra predicate on an already-joined table.

**Example:**
```sql
-- Migration 025 fragment: updated RPC WHERE clause
WHERE dc.user_id = match_user_id
  AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  AND d.is_latest = true                    -- NEW: exclude stale version chunks
  AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
  AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
```

### Pattern 2: Version Record Creation in Upload Endpoint

**What:** When same-filename upload arrives, instead of deleting the old row, set `is_latest = false` on all previous versions (scoped to user + filename) and insert a new row with `version_number = max_previous + 1`.

**When to use:** In `upload_document()` in `documents.py`, replacing the current "stale" branch (lines 198–212).

**Example:**
```python
# Fetch existing versions of this filename (any content hash)
existing_versions = (
    supabase.table("documents")
    .select("id, version_number, is_latest")
    .eq("user_id", current_user["id"])
    .eq("filename", file.filename)
    .order("version_number", desc=True)
    .limit(1)
    .execute()
)
if existing_versions.data:
    latest = existing_versions.data[0]
    next_version = latest["version_number"] + 1
    # Retire all previous versions from retrieval
    supabase.table("documents").update({"is_latest": False}).eq("user_id", current_user["id"]).eq("filename", file.filename).execute()
else:
    next_version = 1

# Insert new row with version tracking
doc_data = {
    ...,  # existing fields
    "version_number": next_version,
    "is_latest": True,
}
```

**Critical note:** The folder_id scope matters for deduplication (existing behaviour), but versioning should be filename-scoped across folders for the same user (a user uploading v2 of "Report.pdf" into a different folder should still get v2, not v1 again). This matches VER-01's phrasing ("same filename") without folder qualification. Verify this interpretation with the product intent before committing.

### Pattern 3: version_number Propagation for VER-06

**What:** `_enrich_with_filenames` in `retrieval_service.py` currently fetches `id, filename, metadata` from documents. Adding `version_number` to the SELECT allows it to include version info in enriched results. The citation dict gains a `version_number` field. The SSE `citations` event carries it. The frontend `Citation` type adds `version_number?: number`. `CitationCard.tsx` renders `(v{N})` suffix when `version_number > 1`.

**When to use:** Only render the version label when `version_number > 1` — documents on their first version have no suffix, keeping the UI uncluttered.

**Example (retrieval_service.py):**
```python
docs_result = supabase.table("documents").select("id, filename, metadata, version_number").in_("id", doc_ids).execute()
doc_map = {doc["id"]: doc for doc in (docs_result.data or [])}
# In the loop:
entry = {
    ...
    "version_number": doc.get("version_number", 1),
}
```

**Example (CitationCard.tsx):**
```tsx
const versionLabel = citation.version_number && citation.version_number > 1
  ? ` (v${citation.version_number})`
  : ""

<span className="truncate">{citation.filename}{versionLabel}</span>
```

### Anti-Patterns to Avoid

- **Deleting old chunks on version bump:** Old chunks must be retained for Phase 29 (history + restore). Deletion would make restore impossible. Use `is_latest` filtering instead.
- **Storing version_number only on chunks (not on documents):** Phase 29 needs to query version history at the document level. The flag must live on `documents`.
- **Folder-scoping the is_latest update:** When retiring old versions, update ALL rows for (user_id, filename) regardless of folder — a file moved between folders should not escape the version chain. However, this edge case can be noted as a known limitation if the simpler per-folder approach is chosen; document it explicitly.
- **Forgetting to drop-and-recreate RPCs:** As established in migration 023, PostgreSQL requires DROP before CREATE OR REPLACE when the return type changes. The `is_latest` filter does NOT change the return type, so CREATE OR REPLACE is safe this time. Still, include an explicit DROP to be safe if `p_folder_ids` signature drift causes issues.
- **Not adjusting the dedup check:** The exact-hash dedup check currently does not filter by `is_latest`. After the migration, an exact-hash match should only skip re-ingest if the matching row `is_latest = true`. An exact duplicate of an old retired version should still ingest as a new version. Add `.eq("is_latest", True)` to the dedup query.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excluding old chunks from retrieval | Custom post-filter in Python | `is_latest = true` WHERE clause in the existing RPCs | DB-level filtering is correct and doesn't waste bandwidth |
| Version counter | Application-level sequence tracking | `MAX(version_number) + 1` query on existing rows | Atomic and correct; no race condition if uploads are sequential per user/filename |
| Cascading chunk retirement | Updating chunk rows | `is_latest` on documents; RPCs join documents | Chunks don't need a version column — the join handles it |

**Key insight:** All retrieval goes through two RPCs (`match_document_chunks`, `keyword_search_chunks`). Patching those two functions with a single `AND d.is_latest = true` predicate is the smallest possible change that satisfies VER-02 globally — it covers vector, keyword, hybrid, and reranked paths simultaneously.

---

## Common Pitfalls

### Pitfall 1: Dedup Check Returns Stale Version
**What goes wrong:** The exact-hash dedup check (current lines 181–195 of `documents.py`) finds a completed row with matching `content_hash` but the row is `is_latest = false` (it was retired by a later upload). The endpoint returns 200 with the old row, never creating the expected new latest version.
**Why it happens:** The dedup query doesn't filter by `is_latest`.
**How to avoid:** Add `.eq("is_latest", True)` to the dedup query.
**Warning signs:** Re-uploading an older version of a file returns the old document row instead of creating a new version.

### Pitfall 2: Old Chunks Remain Visible Until Background Task Completes
**What goes wrong:** Between the moment the new document row is inserted (with `is_latest = true`) and when `ingest_document` finishes inserting the new chunks, there is a window where BOTH the old and new versions are `is_latest = true` (because the flip to `false` happens on the old rows at insert time, but the new chunks don't exist yet). Actually, this is fine — the old chunks already have `is_latest = false` on their document row after the flip. The risk is the opposite: if the code flips `is_latest = false` on old rows BEFORE the new document row is inserted, a brief window exists with zero latest versions.
**Why it happens:** Race between the flip and the insert.
**How to avoid:** Insert the new document row FIRST (with `is_latest = true`), THEN flip old rows to `is_latest = false`. Never the reverse.
**Warning signs:** A search during ingestion returns no results for that filename.

### Pitfall 3: folder_id Scope of the is_latest Update
**What goes wrong:** The UPDATE that flips `is_latest = false` is scoped to `(user_id, filename, folder_id)`. A user who moved the previous version to a different folder before re-uploading gets two `is_latest = true` rows.
**Why it happens:** Folder-scoped update misses the moved document.
**How to avoid:** Flip `is_latest = false` on ALL rows matching `(user_id, filename)` regardless of folder. If strict per-folder versioning is desired (design decision), document it explicitly and adjust the dedup check accordingly.
**Warning signs:** Two rows with the same filename both return `is_latest = true`.

### Pitfall 4: DocumentResponse Shape Breaks Existing Consumers
**What goes wrong:** Adding `version_number` and `is_latest` to `DocumentResponse` as required fields causes validation errors on existing DB rows that predate the migration (they have NULL in those columns if the migration uses `ADD COLUMN` without a default, or the wrong default).
**Why it happens:** Migration adds columns with DEFAULT but Python model requires non-None.
**How to avoid:** Use `DEFAULT 1` for `version_number` and `DEFAULT true` for `is_latest` in the migration SQL, and mark both as `int = 1` / `bool = True` with defaults in the Pydantic model, or `int | None = None` if backward compat is preferred.
**Warning signs:** 422 or 500 errors on GET /documents after migration.

### Pitfall 5: resolve_document_id Returns a Stale Version
**What goes wrong:** `resolve_document_id` in `retrieval_service.py` does an `ilike` query on `documents` without filtering `is_latest = true`. When the agent calls `analyze_document` on a filename that has multiple versions, it may receive the old version's ID.
**Why it happens:** The function predates versioning; no `is_latest` filter.
**How to avoid:** Add `.eq("is_latest", True)` to both queries inside `resolve_document_id`.
**Warning signs:** `analyze_document` returns content from an outdated version of a file.

---

## Code Examples

Verified from codebase inspection:

### Current Stale Branch (lines 198–212 of documents.py — to be replaced)
```python
# Current code: DELETES stale document
stale = (
    supabase.table("documents")
    .select("id, file_path")
    .eq("user_id", current_user["id"])
    .eq("filename", file.filename)
    .neq("content_hash", content_hash)
    .limit(1)
    .execute()
)
if stale.data:
    try:
        supabase.storage.from_("documents").remove([stale.data[0]["file_path"]])
    except Exception:
        pass
    supabase.table("documents").delete().eq("id", stale.data[0]["id"]).execute()
```

### Replacement: Version Creation Branch
```python
# New code: creates new version instead of deleting
existing = (
    supabase.table("documents")
    .select("id, version_number")
    .eq("user_id", current_user["id"])
    .eq("filename", file.filename)
    .order("version_number", desc=True)
    .limit(1)
    .execute()
)
if existing.data:
    next_version = existing.data[0]["version_number"] + 1
    # Retire all previous versions from retrieval
    (
        supabase.table("documents")
        .update({"is_latest": False})
        .eq("user_id", current_user["id"])
        .eq("filename", file.filename)
        .execute()
    )
else:
    next_version = 1
```

### Migration SQL Pattern (migration 025)
```sql
-- Add versioning columns to documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_latest boolean NOT NULL DEFAULT true;

-- Index for efficient latest-version lookups
CREATE INDEX IF NOT EXISTS documents_latest_idx
  ON public.documents (user_id, filename, is_latest)
  WHERE is_latest = true;

-- Update match_document_chunks to exclude stale chunks
DROP FUNCTION IF EXISTS public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[]);
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector,
  match_user_id   uuid,
  match_count     integer DEFAULT 5,
  match_threshold float   DEFAULT 0.3,
  metadata_filter jsonb   DEFAULT NULL,
  p_folder_ids    uuid[]  DEFAULT NULL
)
RETURNS TABLE (id uuid, document_id uuid, content text, chunk_index integer, similarity float)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### _enrich_with_filenames update (retrieval_service.py)
```python
# Change:
docs_result = supabase.table("documents").select("id, filename, metadata").in_("id", doc_ids).execute()
# To:
docs_result = supabase.table("documents").select("id, filename, metadata, version_number").in_("id", doc_ids).execute()

# In the enrichment loop, add:
entry["version_number"] = doc.get("version_number", 1)
```

### CitationCard.tsx version label
```tsx
// In CitationCard.tsx, replace:
<span className="truncate">{citation.filename}</span>
// With:
<span className="truncate">
  {citation.filename}
  {citation.version_number && citation.version_number > 1
    ? ` (v${citation.version_number})`
    : ""}
</span>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Same-filename re-upload deletes old document + chunks | Creates new version row, retires old via `is_latest` | Phase 28 | Old chunks remain in DB for Phase 29 history; retrieval unaffected |
| Citations show filename only | Citations show "filename (vN)" when N > 1 | Phase 28 | Users see provenance of the specific version referenced |

**Deprecated/outdated:**
- The "stale" branch in `upload_document` (lines 198–212) — replaced entirely by the version creation branch.

---

## Open Questions

1. **Folder scope of version chain**
   - What we know: Current dedup check IS folder-scoped (`.eq("folder_id", folder_id)` / `.is_("folder_id", "null")`). The stale check is NOT folder-scoped (any folder).
   - What's unclear: Should versioning be per-user-per-filename (global) or per-user-per-filename-per-folder? The requirement says "same filename" without folder qualification.
   - Recommendation: Implement as per-user-per-filename (not folder-scoped), matching the requirement text. A user uploading "Report.pdf" into /Finance after previously uploading to /HR gets version 2. Document this decision explicitly in the plan.

2. **What happens to old document Storage files?**
   - What we know: The current stale branch deletes the Storage file. Under versioning, old Storage files must be retained (Phase 29 restore needs them).
   - What's unclear: Storage costs if files accumulate indefinitely.
   - Recommendation: Keep old Storage files; Phase 29 or a future cleanup phase can implement retention policy. Document this as a known accumulation risk.

3. **VER-06 for analyze_document citations**
   - What we know: `analyze_document` citations set `chunk_index: None, is_full_doc: True`. Version info comes from the document lookup in `fetch_full_document`.
   - What's unclear: `fetch_full_document` currently returns `{document_id, filename, metadata, content}` but not `version_number`.
   - Recommendation: Add `version_number` to `fetch_full_document` return dict and to the `retrieved_citations` dict built at threads.py line 761. Same pattern as VER-06 for chunk citations.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 28 involves only SQL migrations, Python backend edits, and TypeScript frontend edits. No new external services, CLIs, or runtime dependencies.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest 9.0.2 |
| Backend config | `backend/pytest.ini` or `backend/pyproject.toml` |
| Frontend framework | vitest 4.1.0 |
| Backend quick run | `cd backend && source venv/Scripts/activate && pytest tests/unit/ -x -q` |
| Frontend quick run | `cd frontend && npm test` |
| Full suite | Backend + frontend quick runs in sequence |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-01 | Re-upload same filename creates new version (not rejected/deleted) | unit | `pytest tests/unit/test_document_versioning.py -x -q` | ❌ Wave 0 |
| VER-01 | Dedup check skips stale version rows (is_latest=false not returned as duplicate) | unit | `pytest tests/unit/test_document_versioning.py::test_dedup_ignores_stale_version -x -q` | ❌ Wave 0 |
| VER-02 | Stale chunks excluded from vector search RPC | manual-only (requires live Supabase) | n/a — SQL migration tested via integration | manual |
| VER-02 | Stale chunks excluded from keyword search RPC | manual-only (requires live Supabase) | n/a — SQL migration tested via integration | manual |
| VER-06 | `_enrich_with_filenames` includes version_number in result dict | unit | `pytest tests/unit/test_retrieval_service.py -x -q` | ✅ (extend existing) |
| VER-06 | CitationCard renders "(v2)" when version_number=2 | unit | `cd frontend && npm test -- CitationCard` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_document_versioning.py -x -q`
- **Per wave merge:** `pytest tests/unit/ -x -q && cd ../frontend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_document_versioning.py` — covers VER-01 upload logic (version creation, dedup adjustment, is_latest flip)
- [ ] Extend `backend/tests/unit/test_retrieval_service.py` — covers VER-06 version_number in enriched results
- [ ] Extend `frontend/src/__tests__/components/CitationCard.test.tsx` — covers VER-06 "(v2)" label rendering

---

## Project Constraints (from CLAUDE.md)

- **No LangChain, no LangGraph** — raw SDK calls only. Not applicable here (no new LLM calls).
- **Pydantic for structured outputs** — `DocumentResponse` model in `document.py` must be updated with `version_number` and `is_latest` fields using Pydantic.
- **All tables need Row-Level Security** — no new tables in this phase; existing `documents` RLS already covers the new columns. Verify the existing SELECT/INSERT/UPDATE/DELETE policies still hold.
- **Stream chat responses via SSE** — citation enrichment with version_number flows through the existing SSE `citations` event. No new event types needed.
- **Python backend must use a venv virtual environment** — all backend commands run inside `backend/venv`.
- **No admin UI** — version management (listing, restoring) is deferred to Phase 29. Phase 28 is backend-only except for the citation card label.

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `backend/app/api/documents.py` — upload flow, dedup/stale logic
- Codebase inspection: `backend/app/services/retrieval_service.py` — `_enrich_with_filenames`, `_vector_search`, `_keyword_search` RPC calls
- Codebase inspection: `supabase/migrations/023_rpc_chunk_index.sql` — RPC DROP/CREATE pattern, WHERE clause structure
- Codebase inspection: `backend/app/models/document.py` — `DocumentResponse` Pydantic model
- Codebase inspection: `frontend/src/types/index.ts` — `Citation` and `Document` interfaces
- Codebase inspection: `frontend/src/components/chat/CitationCard.tsx` — current filename rendering
- Codebase inspection: `backend/app/api/threads.py` — citation accumulation at lines 729–743, SSE emission at 1194–1204

### Secondary (MEDIUM confidence)
- PostgreSQL docs (known behaviour): Partial indexes (`WHERE is_latest = true`) are efficient for boolean filters on large tables
- pgvector usage pattern: SECURITY DEFINER RPCs bypass RLS; adding `d.is_latest = true` to the JOIN is the correct place for version filtering

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture: HIGH — based on direct codebase reading; all integration points identified
- Pitfalls: HIGH — derived from code analysis of current dedup/stale logic and known PostgreSQL RPC constraints

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable stack, no fast-moving dependencies)
