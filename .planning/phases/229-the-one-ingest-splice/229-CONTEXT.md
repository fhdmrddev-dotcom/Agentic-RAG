# Phase 229: The One Ingest Splice - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 229 delivers **The One Ingest Splice** (`TRUST-01`). Every document row this product will ever create is minted by one piece of code, ensuring that the same bytes through any ingress door produce the exact same document record in the Library.

This is a **pure refactor** with **no new user-facing capability** and **no database migrations**:
1. Extracts `mint_document_row()` and `splice_document()` into `backend/app/services/ingest_splice.py`.
2. Connects all document producers to the single splice:
   - File upload endpoint (`POST /documents/upload` in `backend/app/api/documents.py`).
   - Connected services file import (`POST /connectors/{id}/import` in `backend/app/api/connectors.py` — fixing D-5 defect 1: `storage_path` column error `PGRST204`).
   - Email attachment extraction cascade (in `backend/app/api/documents.py` — fixing D-5 defect 2: blanket exception swallowing and lack of deduplication).
   - Document reingest (`POST /documents/{id}/reingest`).
3. Uniformly orchestrates all four chunk-write sites (text chunks, table chunks, image chunks, final recount/completion) across every door.
4. Preserves 100% of existing `/upload` behavior (Success Criterion #4: identical version numbers, folders, deduplication outcomes, and metadata extraction).
5. Discharges G-5 on `backend/app/api/documents.py` (73 commits / 30 phases / 2562 lines), updating `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` in the same commit.

</domain>

<decisions>
## Implementation Decisions

### Splice Interface & Execution Layering
- **D-01 (Decoupled Two-Tier Architecture):** Split ingestion into two distinct functions in `backend/app/services/ingest_splice.py`:
  - `mint_document_row(...)`: Fast synchronous database row minting, folder validation, content hashing, deduplication check, version determination, and Postgres `INSERT`.
  - `splice_document(...)`: Background execution pipeline handling Supabase Storage upload, text extraction, sentence chunking, table chunking, image chunking, and final status completion.
- **D-02 (Structured MintResult Contract):** `mint_document_row()` returns a type-safe `MintResult` dataclass:
  - `document: dict`: The newly created or existing document record.
  - `is_duplicate: bool`: `True` if an exact content_hash match in `completed` status and `is_latest=True` was found in the same folder.
  - `storage_path: str`: The canonical `{user_id}/{document_id}/{filename}` path.
  - `version_number: int`: The allocated version number.
  - Callers inspect `is_duplicate` to decide whether to return immediately or schedule background pipeline work.
- **D-03 (Upload Pipeline Migration & Compatibility):** Move the heavy upload pipeline execution into `splice_document()` in `ingest_splice.py`. Maintain a backwards-compatible delegate stub `_upload_pipeline` in `documents.py` so existing tests and external callers remain green.
- **D-04 (Concurrency & Async Handling):** Implement `mint_document_row(...)` as a synchronous core function (matching background worker threads and Supabase-py sync execution), and provide `async_mint_document_row(...)` wrapped in `run_in_threadpool` for FastAPI `async def` endpoints (`/upload`, `/connectors/{id}/import`).

### Deduplication Policy Across Producers
- **D-05 (Connector Parity with Upload):** When `import_connection_file` detects an exact duplicate (`is_duplicate=True`), it returns HTTP 200 with the existing completed document row (exact parity with `/upload`), skipping redundant storage uploads and re-extraction.
- **D-06 (Email Duplicate Attachment Linking):** When an email attachment matches an existing completed document (`is_duplicate=True`), the cascade skips re-uploading and re-extracting, and immediately writes the `document_relationships` record (`rel_type='attached_to'`, `source_doc_id=existing_doc_id`, `target_doc_id=parent_email_id`). This avoids unique-constraint collisions on `documents_dedup_idx` while preserving the complete attachment relationship graph.
- **D-07 (Uniform Folder Scoping):** Deduplication queries are uniformly folder-scoped across all producers: `(user_id, content_hash, folder_id, status='completed', is_latest=True)`, defaulting to `folder_id IS NULL` (root) when omitted.
- **D-08 (Uniform Versioning on Matching Filename):** When a file with an identical filename but different content arrives, `mint_document_row()` queries the highest `version_number` for `(user_id, filename)`, retires previous versions with `is_latest=False`, and mints the new document with `version_number = max + 1` and `is_latest=True`.

### Email Attachment Cascade Isolation & Failure Reporting (SC#3)
- **D-09 (Per-Attachment Isolation):** Process email attachments in an isolated per-attachment `try...except` block within the iteration loop. An extraction or storage failure on attachment 1 logs detailed contextual errors and proceeds to process attachment 2.
- **D-10 (Manifest Error Reporting):** Record attachment outcomes in the parent email's `metadata["attachments"]` manifest (listing `filename`, `status: completed|linked|failed`, `document_id`, `error_message`). Minted child documents that fail during extraction are updated to `status='failed'` with `error_message`.
- **D-11 (BUS-106 Inference Verification):** Author a dedicated integration test (`test_email_identical_attachment_dedup`) verifying that two distinct emails with identical attachments both succeed: the first creates the document, the second links to it via `document_relationships`, and subsequent attachments are never dropped.
- **D-12 (No Orphaned Pending Rows):** If extraction or chunking fails for an attachment, update its document row to `status='failed'` with a sanitized `error_message` rather than leaving it stranded in `status='pending'`.

### Storage Upload Lifecycle & Uniform 4-Site Chunks
- **D-13 (Background Storage Upload):** Upload raw file bytes to Supabase Storage inside `splice_document()` (in the background task), keeping HTTP 201 responses instant. Pass `storage_path=""` during `/reingest` to bypass redundant storage uploads.
- **D-14 (Upload Failure Non-Regression):** If Supabase Storage upload fails inside `splice_document()`, log the warning and continue in-memory text extraction, preserving the exact non-blocking behavior of the `/upload` path (SC#4).
- **D-15 (Connector Import API Contract):** `POST /connectors/{id}/import` returns the full minted document row from `mint_document_row()`, ensuring frontend clients receive consistent document shapes across all upload and import flows.
- **D-16 (Uniform 4-Site Chunk Orchestration):** `splice_document()` orchestrates all 4 chunk operations identically across all document sources:
  1. Text chunking and embedding (`document_chunks` insert).
  2. Table extraction and chunking (`document_tables` and `document_chunks` insert via `multimodal_service`).
  3. Image description extraction and embedding (`document_images` and `document_chunks` insert via `multimodal_service`).
  4. Authoritative live recount from `document_chunks` to update `documents.chunk_count` and mark `status='completed'`.

### Forward-Compatible Tenancy & Access Governance
- **D-17 (Extensible Access & Folder Validation):** `mint_document_row()` accepts optional `org_id: str | None = None` and arbitrary `metadata: dict | None = None`. Folder validation checks owner OR org-shared visibility (`user_id == caller OR is_org_shared == True`), ensuring that the splice never hardcodes single-user assumptions or blocks group-based access control.

### Claude's Discretion
- Internal helper decomposition within `backend/app/services/ingest_splice.py`.
- Exact logging formats and error string sanitization patterns for attachment failures.

### Deferred Ideas (Captured for Future Phases)
- **Centralized User Access & Group-Based Document Sharing (SEED-115 / SEED-210 Update):**
  - Mental Model: Dual-tier storage where each user has private personal storage, and can selectively share individual documents or folders with specific departments/groups (e.g. HR, Engineering, Finance) or the entire organization.
  - Centralized Governance: Central admin/operator console with visibility into all documents across groups and users, audit trails, and share management.
  - Enriched in `.planning/seeds/SEED-115-org-access-roles-departments-greenlists.md` for the v4.x org-RBAC milestone.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scoping, Architecture & Requirements
- `.planning/ROADMAP.md` § Phase 229 — Goals, success criteria (SC#1..SC#4), and failure criteria.
- `.planning/REQUIREMENTS.md` § TRUST-01 — The One Ingest Splice specification.
- `.agent-bus/OPEN.md` (BUS-106) — Pre-planning obligations discharged, PostgREST `PGRST204` confirmation, hot-file numbers, and the 4 chunk-write sites.
- `CLAUDE.md` — Ingest splice invariants, same-commit ledger rule, and hot-file limits.
- `docs/HOT-FILE-LEDGER.md` § `backend/app/api/documents.py` — Ledger entry to discharge in the same commit.

### Access Control & Governance Seeds
- `.planning/seeds/SEED-115-org-access-roles-departments-greenlists.md` — Org access control, departments/groups, and centralized document permissions.
- `.planning/seeds/SEED-210-inbound-permission-and-lifecycle-envelope.md` — Inbound security envelope for connectors and source permissions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/api/documents.py`:
  - `upload_document`: Ingest door 1 (`POST /documents/upload`). Contains dedupe SELECT (:624-640), versioning (:643-668), and DB INSERT (:677-708).
  - `_upload_pipeline`: Background pipeline (:239-300). Contains storage upload and composable extraction.
  - `ingest_document`: Funnel extraction & embedding (:2030-2545). Contains text scrubbing, chunking, embedding, multimodal calls, and email attachment cascade (:2375-2445).
- `backend/app/api/connectors.py`:
  - `import_connection_file`: Ingest door 2 (:1690-1735). Currently contains broken manual insert (:1706-1718).
- `backend/app/services/multimodal_service.py`:
  - `embed_and_store_table_chunks`: Chunk-write site 2 (:435).
  - `extract_and_embed_images`: Chunk-write site 3 (:913).
- `backend/app/services/text_sanitize.py`:
  - `scrub_text`: Strips NUL bytes and invalid Postgres UTF-8 sequences.
- `backend/app/utils/db.py`:
  - `coerce_uid`, `run_in_threadpool`, `aexec`: Supabase threadpool and async query helpers.

### Target Hot Files & G-5 Discharge
- `backend/app/api/documents.py`: 73 commits / 30 phases / 2562 lines. **DISCHARGED** by extracting `mint_document_row` and `splice_document`.
- `backend/app/api/connectors.py`: 27 commits / 11 phases / 1727 lines.
- `backend/app/services/multimodal_service.py`: 17 commits / 9 phases / 1019 lines.

</code_context>
