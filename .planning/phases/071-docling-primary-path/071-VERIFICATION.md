---
phase: 071
slug: docling-primary-path
sc_binding: RAG-DOCLING-01 SC#1 — 20% delta on table + image counts between PDF + DOCX siblings
gate_threshold: 0.20
status: pending
captured: TBD
---

# Phase 071 — Live UAT Verification

**SC#1 binding gate (D-071-15):** Re-ingest the user's `551f03f9-...` reference
thesis PDF + sibling DOCX under Docling primary path; assert
`abs(pdf_count - docx_count) / max(pdf_count, docx_count) <= 0.20` for BOTH
`document_tables` and `document_images` counts. Phase 069 baseline (before
Docling): PDF tables=5 / images=4, DOCX tables=50+ / images=0 — gap of >90% on
both metrics.

## UAT protocol

Per D-071-15:

1. Identify the PDF + DOCX siblings via Supabase Studio
   (`http://127.0.0.1:54323`):

   ```sql
   SELECT id, filename, mime_type, content_hash, status, extractor
   FROM documents
   WHERE id IN ('551f03f9-...PDF_ID', '551f03f9-...DOCX_ID');
   ```

2. Capture BEFORE counts (engine='pypdf-legacy', pre-Docling):

   ```sql
   SELECT
     (SELECT count(*) FROM document_tables WHERE document_id = '<PDF_ID>')  AS pdf_tables,
     (SELECT count(*) FROM document_images WHERE document_id = '<PDF_ID>')  AS pdf_images,
     (SELECT count(*) FROM document_tables WHERE document_id = '<DOCX_ID>') AS docx_tables,
     (SELECT count(*) FROM document_images WHERE document_id = '<DOCX_ID>') AS docx_images;
   ```

3. Trigger `/reextract engine=docling` on both:

   ```bash
   # PDF
   curl -X POST http://localhost:8000/documents/<PDF_ID>/reextract \
     -H "Authorization: Bearer <user-jwt>" \
     -H "Content-Type: application/json" \
     -d '{"engine":"docling"}'

   # DOCX
   curl -X POST http://localhost:8000/documents/<DOCX_ID>/reextract \
     -H "Authorization: Bearer <user-jwt>" \
     -H "Content-Type: application/json" \
     -d '{"engine":"docling"}'
   ```

   OR drive via Chrome MCP through `http://localhost:5173/` + the documents-list
   UI (test login `fhdmrd@gmail.com / 123456`).

4. Wait for both docs to return to `status='completed'` (poll via Studio or the
   UI).

5. Capture AFTER counts via the same SQL as step 2.

6. Compute delta: `abs(pdf - docx) / max(pdf, docx)` for tables AND images.

7. Fill in the table below + flip frontmatter `status` to `green` (pass) or `red`
   (fail).

## Results

### Document IDs

| Side | Document ID | Filename |
| ---- | ----------- | -------- |
| PDF  | TBD         | TBD      |
| DOCX | TBD         | TBD      |

### Before counts (engine='pypdf-legacy', pre-Docling)

| Side | document_tables | document_images |
| ---- | --------------- | --------------- |
| PDF  | TBD             | TBD             |
| DOCX | TBD             | TBD             |

### After counts (engine='docling', post-/reextract)

| Side | document_tables | document_images |
| ---- | --------------- | --------------- |
| PDF  | TBD             | TBD             |
| DOCX | TBD             | TBD             |

### Delta vs threshold

| Metric | PDF | DOCX | Delta = abs(pdf - docx) / max(pdf, docx) | Threshold | Pass? |
| ------ | --- | ---- | ---------------------------------------- | --------- | ----- |
| tables | TBD | TBD  | TBD                                      | 0.20      | TBD   |
| images | TBD | TBD  | TBD                                      | 0.20      | TBD   |

### pdf_extraction_runs telemetry (sanity check)

```sql
SELECT engine, duration_ms, table_count, image_count, error
FROM pdf_extraction_runs
WHERE document_id IN ('<PDF_ID>', '<DOCX_ID>')
ORDER BY started_at DESC LIMIT 4;
```

Expected: two rows per doc — one pre-reextract (`engine='pypdf-legacy'`) and one
post (`engine='docling'`). Both `'docling'` rows should have `error IS NULL`.

| Document | engine | duration_ms | table_count | image_count | error |
| -------- | ------ | ----------- | ----------- | ----------- | ----- |
| PDF      | TBD    | TBD         | TBD         | TBD         | TBD   |
| DOCX     | TBD    | TBD         | TBD         | TBD         | TBD   |

## Verdict

- [ ] tables delta ≤ 20%
- [ ] images delta ≤ 20%
- [ ] both telemetry rows for `engine='docling'` have `error IS NULL`

Phase 071 SC#1 PASSES if all three checks above are GREEN.

## Notes (UAT diary)

(Fill in observations: how long the Docling re-extract took on each doc; any
unexpected error messages; whether the chunk_count changed dramatically; etc.)

TBD — awaiting Task 5 live run.

---

**If delta > 20% on either metric:**

Per CONTEXT.md "Specific Ideas" line 278 — "the phase is NOT closeable —
investigate (PyMuPDF-on-PDF? Docling `pipeline_options` for higher-accuracy mode?)
before declaring done." Capture the actual delta + what you observed (e.g.,
Docling found N tables on the PDF where pdfplumber found M — was it a structural
difference, or did images get mis-classified as tables?). The phase cannot close
on this UAT alone; surface to the team for a follow-on gap-closure phase.
