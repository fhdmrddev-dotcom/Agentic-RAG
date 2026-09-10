# Phase 229 Verification: The One Ingest Splice

- **Phase:** 229 — The One Ingest Splice
- **Requirement:** `TRUST-01`
- **Verdict:** ✅ **PASS**
- **Date:** 2026-09-05
- **Builder:** Gemini
- **Reviewer:** Claude (Pre-flight in `229-PREFLIGHT.md` / BUS-107)

---

## 1. Executive Summary

Phase 229 ("The One Ingest Splice") refactors document row minting, deduplication, and ingestion dispatch into a single unified service module: `backend/app/services/ingest_splice.py`.

Prior to this phase, canonical row creation and deduplication logic lived exclusively in the `POST /documents/upload` HTTP handler (`documents.py:547`), leaving secondary ingestion doors fragmented and fragile:
- Secondary door 1 (`POST /connectors/connections/{id}/files/{file_id}/import`) attempted to insert a nonexistent column (`storage_path`), crashing with PostgREST error `PGRST204` and never completing an import (`SC#1`).
- Secondary door 2 (the email attachment cascade in `documents.py:2200`) inserted rows with unisolated exception swallowing, dropping remaining attachments upon any failure, and colliding on unique index `documents_dedup_idx` when duplicate attachments were encountered (`SC#3`).

Phase 229 successfully extracted `mint_document_row()`, `async_mint_document_row()`, and `splice_document()` into `ingest_splice.py`, spliced all three doors (`/upload`, `connectors.py`, email attachment cascade), resolved all preflight gaps (G-1 through G-7), discharged G-5 on hot-file `documents.py`, and verified all repository mechanical gates.

---

## 2. Success Criteria Verification

| Criterion | Requirement | Verdict | Evidence |
|---|---|---|---|
| **SC#1** | Cloud file import succeeds and appears in Library (fixes `PGRST204` error) | ✅ **PASS** | `backend/tests/integration/test_connector_import_splice.py::test_connector_import_sc1_mints_row_and_resolves_pgrst204` proves `storage_path` is omitted, canonical `file_path`, `content_hash`, `version_number=1` are inserted, and `splice_document()` is dispatched. |
| **SC#2** | Cloud file import matches Library representation of `/upload` (parity in dedupe & versioning) | ✅ **PASS** | `backend/tests/integration/test_connector_import_splice.py::test_connector_import_sc2_upload_parity_and_deduplication` proves exact duplicate match returns existing record with HTTP 200 and dispatches no duplicate background work. |
| **SC#3** | Email attachment cascade isolates failures and records manifest in metadata | ✅ **PASS** | `backend/tests/integration/test_email_attachment_cascade_splice.py::test_sc3_email_attachments_isolated_and_manifest_recorded` proves corrupt attachment 1 failure does not abort healthy attachment 2, and parent email metadata captures `metadata['attachments']` manifest with per-attachment statuses. |
| **SC#4** | Upload path observable behavior is strictly preserved (no regression) | ✅ **PASS** | `backend/tests/integration/test_connector_import_splice.py::test_sc4_upload_path_behaviour_preserved` and `backend/tests/unit/test_document_versioning.py` (10/10 passing) prove HTTP 200 on duplicate, HTTP 201 on new version, with previous version marked `is_latest=False`. |

---

## 3. Resolution of Preflight Findings (229-PREFLIGHT.md)

1. **⛔ G-1 (Org-shared folder widening deleted):**
   - In accordance with preflight ruling, the proposed `is_org_shared` bypass was completely excised from Phase 229.
   - Folder access check in `mint_document_row` strictly preserves `user_id != caller -> 403` byte-for-byte.
   - Org-shared folder writes are deferred to Phase 231 (`folder_is_org_shared(uuid)` recursive ancestor walk).
   - Threat model `TM-229-01` updated accordingly.

2. **⛔ G-2 (Unique index 23505 race collision handled via `on_conflict="link"`):**
   - Added parameter `on_conflict: Literal["raise", "link"] = "raise"` to `mint_document_row`.
   - On Postgres error `23505` (`documents_dedup_idx`), when `on_conflict == "link"`, `mint_document_row` catches the exception and re-queries the row (`status <> 'failed'`), returning `MintResult(is_duplicate=True, document=existing)`.
   - Email cascade passes `on_conflict="link"`, inserting the `document_relationships` `attached_to` link and recording `"status": "linked"` in the manifest without raising 409 or dropping the attachment.
   - Verified by `test_bus106_identical_attachment_collision_linked`.

3. **G-3 (Status & ingestion_step progression sequence pinned):**
   - Document progression sequence is maintained identically: `pending` -> `extracting` -> `metadata` -> `completed` (or `failed`).

4. **G-4 (`created_at` and `updated_at` clock source preserved):**
   - Omitted `created_at` and `updated_at` from `doc_data` payload in `mint_document_row()`, preserving Postgres defaults as the authoritative timestamp source.

5. **G-5 (Chunk write sites audit):**
   - Verified all 4 chunk write sites:
     1. Text chunks: `documents.py` (`supabase.table("document_chunks").insert(chunk_rows).execute()`).
     2. Table chunks: `multimodal_service.py:435`.
     3. Image chunks: `multimodal_service.py:913`.
     4. Authoritative recount: `documents.py` (`select("id", count="exact", head=True)` prior to `status='completed'`).

6. **G-6 (Reachability route verified):**
   - Confirmed email entry point via `POST /documents/upload` with MIME type `message/rfc822`, verified by `test_email_reachability_route_post_upload`.

7. **G-7 (Live dynamic re-derivation of documents.py G-5 triple):**
   - Measured `75 commits / 32 phases / 2408 lines` (net reduction of 127 lines).
   - Updated `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` in the exact same commit (`ba3010ffc`).

---

## 4. G-5 Hot-File Ledger Discharge

- **File:** `backend/app/api/documents.py`
- **Re-derived Triple:** `75 commits / 32 phases / 2408 L` (-127 lines from 2535 L).
- **Same-Commit Sync:** Both `CLAUDE.md` line 584 and `docs/HOT-FILE-LEDGER.md` line 2437 updated in commit `ba3010ffc`.
- **Disposition Cell Length:** 147 characters (well under the 200 character cap in `scripts/check-claude-md-size.cjs`).
- **CLAUDE.md Size Check:** 107,413 characters (under 120,000 warn budget; 42,587 characters headroom).

---

## 5. Mechanical Gate Re-Derivation Summary

| Gate | Requirement | Measured Result | Verdict |
|---|---|---|---|
| **Backend Unit Baseline** | `failed <= 71`, `errors == 0` | **70 failed, 3508 passed, 0 errors** (155.55s) | ✅ **PASS** |
| **Frontend TypeScript** | `tsc -p tsconfig.app.json --noEmit` <= 66 errors | **66 errors** (0 new errors introduced) | ✅ **PASS** |
| **Deploy Drift Gate** | `bash scripts/check-deploy-drift.sh` == 0 drift | **0 drift** (all 4 checks passed) | ✅ **PASS** |
| **CLAUDE.md Budget Gate** | `node scripts/check-claude-md-size.cjs` < 120,000 chars | **107,413 chars** (headroom: 42,587) | ✅ **PASS** |
| **Phase 229 Unit & Integration Suites** | 100% pass | **26 passed, 0 failed** (7.57s) | ✅ **PASS** |

---

## 6. Test Suites Summary

1. `backend/tests/unit/test_ingest_splice.py`: 10 passed
2. `backend/tests/integration/test_connector_import_splice.py`: 3 passed
3. `backend/tests/integration/test_email_attachment_cascade_splice.py`: 3 passed
4. `backend/tests/unit/test_document_versioning.py`: 10 passed
**Total:** 26 passed, 0 failed, 0 skipped.

---

## 7. Conclusion

Phase 229 ("The One Ingest Splice") is **COMPLETE**. All requirements under `TRUST-01` are satisfied, all pre-flight findings are closed, hot-file `documents.py` is discharged, and all mechanical gates are green. Ready for Claude post-phase review.
