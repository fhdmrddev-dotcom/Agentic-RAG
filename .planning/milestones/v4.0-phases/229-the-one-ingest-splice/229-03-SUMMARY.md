# Phase 229 Plan 03 Summary: Email Attachment Cascade Splice & Chunk Audit (Wave 3)

## Delivered Objectives
1. **Email Attachment Cascade Splice (`backend/app/api/documents.py`):**
   - Replaced fragile inline insert in `ingest_document` with `mint_document_row(..., on_conflict="link")`.
   - **Failure Isolation (SC#3):** Wrapped each attachment in an isolated `try...except` block. A failure extracting or ingesting attachment 1 updates only child attachment 1 to `status='failed'` and records the error in the parent manifest; it does NOT abort attachment 2.
   - **Unique Index Collision Handling (G-2 & BUS-106):** In the race window where two attachments in the same ingest or across two close emails collide on unique index `documents_dedup_idx`, `mint_document_row` catches Postgres error 23505 and re-queries the row (`status <> 'failed'`). With `on_conflict="link"`, it links the attachment to the email via `document_relationships` rather than failing with 409.
   - **Attachment Manifest Auditability:** Parent email metadata records `metadata['attachments']` containing status (`completed`, `linked`, `failed`, `skipped`), filename, document_id, and any error message.

2. **Chunk Write Sites Audit (G-5):**
   - Audited and confirmed all four chunk-write sites in the pipeline:
     1. Text chunks: `documents.py` (`supabase.table("document_chunks").insert(chunk_rows).execute()`).
     2. Table chunks: `multimodal_service.py:435`.
     3. Image chunks: `multimodal_service.py:913`.
     4. Authoritative recount: `documents.py` (`supabase.table("document_chunks").select("id", count="exact", head=True)` immediately preceding `status='completed'`).

3. **Integration Test Suite (`backend/tests/integration/test_email_attachment_cascade_splice.py`):**
   - Proved SC#3: Corrupt attachment 1 fails extraction without preventing healthy attachment 2 from processing and linking. Manifest records both statuses.
   - Proved G-2: Identical attachment collision across two distinct emails links successfully without failing.
   - Proved G-6: Confirmed reachability of email cascade via `POST /documents/upload` with `message/rfc822`.

## Verification Evidence
- `backend/venv/Scripts/pytest.exe backend/tests/integration/test_email_attachment_cascade_splice.py -v`: 3 passed in 2.53s.
- `backend/venv/Scripts/pytest.exe backend/tests/unit/test_ingest_splice.py backend/tests/integration/test_connector_import_splice.py backend/tests/integration/test_email_attachment_cascade_splice.py backend/tests/unit/test_document_versioning.py -v`: 26 passed in 7.57s.

## Next Steps
Proceed to Wave 4 (Plan 229-04): G-5 hot-file ledger discharge on `backend/app/api/documents.py`, re-deriving exact commit count and line count, updating `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` in the same commit, running all repository gates, and posting verification to the agent bus.
