# Phase 229 — Cross-Plan Seam Audit

Every file on the path between what one plan writes and another reads is mechanically traced below, with its data flow, direction, readers, and verification mechanism.

---

## Mechanical Field Derivation

For every field that Phase 229 moves, normalizes, or touches across the ingestion boundary:

| Field Name | Source / Producer | Splice Normalization (`ingest_splice.py`) | Consumer(s) | Guarded Failure Mode |
|---|---|---|---|---|
| `file_path` | Replaces invalid `storage_path` in `connectors.py:1713` and manual paths in `documents.py:681` | `storage_path = f"{user_id}/{document_id}/{filename}"` assigned to `doc_data["file_path"]` | PostgREST `documents` INSERT, storage downloader, reextract | Resolves `PGRST204` column rejection on `connectors.py` (SC#1) |
| `content_hash` | Previously only computed in `documents.py:620` (`upload_document`); omitted in `connectors.py` | `hashlib.sha256(raw).hexdigest()` computed in `mint_document_row` | `documents.content_hash`, `documents_dedup_idx` partial index | Enables connector & attachment deduplication (SC#2, SC#3) |
| `folder_id` | Provided via query/body in `/upload`; omitted in `connectors.py` | Validates owner/org-shared visibility, defaults `None` (root) | `documents.folder_id`, `documents_dedup_idx` scoping | Prevents unauthorized folder injection; ensures folder-scoped deduplication |
| `version_number` | Previously queried in `documents.py:648`; omitted in `connectors.py`; hardcoded 1 in email cascade | Queries max `version_number` on `(user_id, filename)`, assigns `max + 1` | `documents.version_number`, Library UI | Unifies version history across all ingress doors (SC#2, SC#4) |
| `is_latest` | Previously updated in `documents.py:661`; omitted in `connectors.py`; hardcoded True in email cascade | Updates prior versions to `False` on filename match; mints new version with `True` | `documents.is_latest`, retrieval filters, Library UI | Retires stale versions from retrieval queries across all doors |
| `status` & `ingestion_step` | Mints with `'pending'`; progresses through `'processing'` to `'completed'` or `'failed'` | Initialized to `'pending'` in `mint_document_row`, updated to `'completed'` or `'failed'` in `splice_document` | Supabase Realtime, frontend badges, Library UI | Prevents orphaned `'pending'` rows on extraction errors (SC#3) |
| `metadata["attachments"]` | Email cascade previously logged warnings and swallowed attachment outcomes | Structured manifest (`[{filename, status, doc_id, error}]`) written to parent email `metadata` | Parent email document record, Library inspection | Eliminates silent attachment failure; provides auditability without schema migration (SC#3) |
| `chunk_count` | 4 chunk-write sites (text, table, image, recount) | `splice_document()` coordinates text chunking, multimodal calls, and authoritative recount | `documents.chunk_count`, Library UI | Guarantees chunk count reflects all text, table, and image chunks uniformly |

---

## Seam 1: Plan 229-01 (Wave 1) → Plans 229-02, 229-03, 229-04

| Component | Detail |
|---|---|
| **What 229-01 writes** | `backend/app/services/ingest_splice.py` (`MintResult`, `mint_document_row`, `async_mint_document_row`, `splice_document`), `backend/tests/unit/test_ingest_splice.py`. |
| **What 229-02..04 read** | `async_mint_document_row` and `splice_document` consumed by `documents.py` (upload route, `_upload_pipeline` stub, reingest route) and `connectors.py` (import route). `mint_document_row` consumed synchronously by email attachment cascade in `documents.py`. |
| **Files on the path in between** | 1. `backend/app/services/ingest_splice.py` (core service module).<br>2. `backend/app/api/documents.py` (FastAPI router).<br>3. `backend/app/api/connectors.py` (FastAPI router).<br>4. `backend/app/utils/db.py` (`run_in_threadpool`, `aexec`).<br>5. Supabase Postgres `documents` table. |
| **Failure mode guarded against** | Inconsistent document schemas between producers; `PGRST204` schema mismatch on connector import; event-loop blocking on async endpoints; unique-constraint race collisions (`23505`). |
| **Verification mechanism** | `pytest backend/tests/unit/test_ingest_splice.py -v`. Exit code 0 required. |

---

## Seam 2: Plan 229-02 (Wave 2) → Plan 229-04 (Wave 4)

| Component | Detail |
|---|---|
| **What 229-02 writes** | `backend/app/api/documents.py` (`upload_document` and `_upload_pipeline` refactored to delegate to splice), `backend/app/api/connectors.py` (`import_connection_file` refactored to call `async_mint_document_row` and `splice_document`), `backend/tests/integration/test_connector_import_splice.py`. |
| **What 229-04 reads** | Line count and commit metrics for `documents.py` G-5 discharge; mechanical test suite execution. |
| **Files on the path in between** | 1. `backend/app/api/documents.py` (upload endpoint).<br>2. `backend/app/api/connectors.py` (connector import endpoint).<br>3. `backend/app/services/ingest_splice.py` (splice service).<br>4. `backend/tests/integration/test_connector_import_splice.py` (integration test suite). |
| **Failure mode guarded against** | Drift between `/upload` and connector import contracts; regression in `/upload` deduplication or version incrementing (SC#4); failure of connector import on live PostgREST (SC#1). |
| **Verification mechanism** | `pytest backend/tests/integration/test_connector_import_splice.py -v`. Exit code 0 required. |

---

## Seam 3: Plan 229-03 (Wave 3) → Plan 229-04 (Wave 4)

| Component | Detail |
|---|---|
| **What 229-03 writes** | `backend/app/api/documents.py` (email attachment cascade refactored to per-attachment isolated `try...except`, calling `mint_document_row`, linking duplicate attachments in `document_relationships`, storing `metadata["attachments"]` manifest, marking failures `status='failed'`), `backend/app/services/multimodal_service.py` (audited on chunk path), `backend/tests/integration/test_email_attachment_cascade_splice.py`. |
| **What 229-04 reads** | Final line count reduction for `documents.py` G-5 discharge; mechanical test baseline. |
| **Files on the path in between** | 1. `backend/app/api/documents.py` (ingest_document and attachment cascade).<br>2. `backend/app/services/email_extraction_service.py` (attachment parsing).<br>3. `backend/app/services/multimodal_service.py` (table and image chunk writes).<br>4. Supabase Postgres `document_relationships` and `document_chunks` tables. |
| **Failure mode guarded against** | Blanket exception swallowing where failure on attachment 1 aborts attachment 2 (D-5 defect 2 / SC#3); unique-violation collisions when two emails carry identical attachments (Claude's BUS-106 inference); orphaned `pending` rows; desynchronized `chunk_count`. |
| **Verification mechanism** | `pytest backend/tests/integration/test_email_attachment_cascade_splice.py -v`. Exit code 0 required. |

---

## Seam 4: Plan 229-04 (Wave 4) → Reviewer Pre-Flight / Verification

| Component | Detail |
|---|---|
| **What 229-04 writes** | `CLAUDE.md` (hot-file ledger updated for `documents.py`), `docs/HOT-FILE-LEDGER.md` (detailed narrative updated in the SAME COMMIT), `229-SEAM-AUDIT.md`. |
| **What reviewer (Claude) reads** | Re-derived gate baselines (`check-backend-unit-baseline.cjs` <= 71), TypeScript (66 errors), deploy drift (0 drift), CLAUDE.md size (< 120k), same-commit hot-file ledger discharge. |
| **Files on the path in between** | 1. `CLAUDE.md` (project rules & hot-file ledger).<br>2. `docs/HOT-FILE-LEDGER.md` (architectural ledger history).<br>3. `backend/app/api/documents.py` (discharged hot file).<br>4. `scripts/check-backend-unit-baseline.cjs` (pytest unit gate).<br>5. `scripts/check-deploy-drift.sh` (deploy drift gate). |
| **Failure mode guarded against** | Hot-file ledger drift (updating `CLAUDE.md` without `docs/HOT-FILE-LEDGER.md` in same commit); backend test regression; typescript compilation failures. |
| **Verification mechanism** | All mechanical gate scripts: `check-backend-unit-baseline.cjs`, `check-deploy-drift.sh`, `check-claude-md-size.cjs`, and `tsc`. |

---
*Authored: 2026-09-05 | Builder: Gemini | Phase 229: The One Ingest Splice*
