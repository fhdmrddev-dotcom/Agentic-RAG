---
phase: 071
slug: docling-primary-path
sc_binding: RAG-DOCLING-01 SC#1 — 20% delta on table + image counts between PDF + DOCX siblings
gate_threshold: 0.20
status: red
captured: 2026-05-14
carry_forward_phase: 071.1
---

# Phase 071 — Live UAT Verification

**Verdict: SC#1 RED.** The binding-gate UAT exposed two real defects in the
extraction stack on this specific thesis PDF that prevent the Docling pass
from completing under the v2.6 schema. Both have minimal inline fixes (commit
`9116c2b`) AND a remaining blocker that needs Phase 071.1 to clear. SC#1
itself stays RED until 071.1 lands and the UAT can be re-run.

The other 4 SCs (#2 lineage column + backfill, #3 `/reextract` route + 4
tests, #4 `pdf_extraction_runs` table + RLS, #5 Q-v2.6-04 lock) are GREEN
(see `071-SUMMARY.md`).

---

## Document IDs (actual, not 551f03f9-...)

The `551f03f9-...` reference in CONTEXT.md was illustrative — the real thesis
pair lives under different IDs in the user's local DB:

| Side | Document ID                            | Filename                            |
| ---- | -------------------------------------- | ----------------------------------- |
| PDF  | `23cc112a-92c2-440f-83c9-13aa8bf3d53d` | Fahed Mrad Chapters 1 to 4.pdf      |
| DOCX | `911225a6-9029-4465-a4bf-dc64da83839b` | Fahed Mrad Chapters 1 to 4.docx     |

Same content_hash family (PDF + DOCX of the same source). Pre-test
`extractor='pypdf-legacy'` (backfill from migration 040), `status='completed'`.

## Before counts (engine='pypdf-legacy', pre-Docling)

| Side | document_tables | document_images |
| ---- | --------------- | --------------- |
| PDF  | 4               | 2               |
| DOCX | 39              | 0               |

**Pre-UAT delta:**
- tables: `abs(4 − 39) / max(4, 39)` = 35/39 ≈ **89.7 %**
- images: `abs(2 − 0) / max(2, 0)` = 2/2 = **100 %**

Confirms the CONTEXT.md baseline (~5/4 vs 50+/0 gap that the phase exists to
close).

## After counts (engine='docling', post-/reextract)

| Side | document_tables | document_images |
| ---- | --------------- | --------------- |
| PDF  | not captured    | not captured    |
| DOCX | not captured    | not captured    |

`/reextract` was never able to complete on either sibling — see "Notes" below.
The PDF row stayed in `status='pending'` with `tables=0 / images=0 / chunks=0`
after Plan 04's reset cascade ran; the DOCX was never attempted because the
PDF call wedged the only worker.

## Delta vs threshold

| Metric | PDF | DOCX | Delta = abs(pdf − docx) / max(pdf, docx) | Threshold | Pass? |
| ------ | --- | ---- | ---------------------------------------- | --------- | ----- |
| tables | n/a | n/a  | not captured (Docling stalled)           | 0.20      | RED   |
| images | n/a | n/a  | not captured (Docling stalled)           | 0.20      | RED   |

## pdf_extraction_runs telemetry (sanity check)

| Document | engine | duration_ms | table_count | image_count | error                               |
| -------- | ------ | ----------- | ----------- | ----------- | ----------------------------------- |
| PDF      | docling | not written | n/a        | n/a         | telemetry writes at end of extract — never reached |
| DOCX     | n/a    | n/a         | n/a         | n/a         | call never attempted                |

The telemetry table works (`pdf_extraction_runs` exists + RLS verified — Plan
01 SC#4 GREEN), but no rows were written during this UAT because both
`/reextract` calls hit the route-shape + Docling stall defects before reaching
the writer.

## Verdict

- [ ] tables delta ≤ 20% — **RED** (not captured)
- [ ] images delta ≤ 20% — **RED** (not captured)
- [ ] both `engine='docling'` telemetry rows have `error IS NULL` — **RED** (not written)

**Phase 071 SC#1 does NOT pass.** Closed RED; remediation scope is 071.1.

## Notes (UAT diary)

Three findings, in chronological order. Each is a real defect; the first two
have minimal inline fixes (commit `9116c2b`); the third needs Phase 071.1.

**Finding 1 — Synchronous extract blocks single uvicorn worker (route shape).**
The first `/reextract` cycle on the thesis PDF showed `/healthz` go
unresponsive for 6+ minutes while Docling ran. Root cause: `extractor.extract(raw, mime)`
runs synchronously inside an `async def` handler, blocking the event loop for
the full extract duration. Violates CLAUDE.md decision D-v2.5-01 (no blocking
I/O in async handlers — wrap with `run_in_threadpool`). Inherited from the
existing `/reingest` pattern, which never tripped this because `pypdf-legacy`
is fast. **Inline fix (commit `9116c2b`):** wrapped both `extractor.extract()`
and `extract_text()` with `starlette.concurrency.run_in_threadpool`. Backend
now stays responsive while extract runs — verified via `curl /docs` returning
200 in ~200 ms during in-flight extract.

**Finding 2 — Docling RapidOCR raises std::bad_alloc on the thesis.**
Backend logs after the first UAT attempt:
```
[INFO] [RapidOCR] base.py:22: Using engine_name: torch
[INFO] [RapidOCR] device_config.py:57: Using CPU device
Loading weights: 100%|████████████| 770/770 [00:00<00:00, 2486.52it/s]
Stage preprocess failed for run 1, pages [26]: std::bad_alloc
Stage preprocess failed for run 1, pages [27]: std::bad_alloc
Stage preprocess failed for run 1, pages [28]: std::bad_alloc
Stage preprocess failed for run 1, pages [29]: std::bad_alloc
Stage preprocess failed for run 1, pages [30]: std::bad_alloc
Stage preprocess failed for run 1, pages [31]: std::bad_alloc
```
RapidOCR's image preprocess pipeline raised a C++-level `std::bad_alloc` on
pages 26–31, which crashed the worker (uncatchable from Python). Most
ingested PDFs (theses, papers, reports) have a text layer already; OCR is
wasted work AND the OOM source. **Inline fix (commit `9116c2b`):** set
`opts.do_ocr = False` by default in `DoclingExtractor`. RapidOCR no longer
loads. Phase 072 / Skill Studio milestone will add a user-tunable `do_ocr`
flag for scanned-PDF support.

**Finding 3 — Docling table/layout stage stalls on this thesis (BLOCKER).**
After both inline fixes landed (commit `9116c2b`) and the backend was
restarted: re-triggered `/reextract` on the PDF. Backend stayed responsive
(event-loop fix works). But the worker thread wedged inside Docling's
processing pipeline for 4+ minutes — process at 418 MB working set, CPU flat
at 11.8 s aggregate (i.e., not actively computing), no stderr progress, no
202 response, no `pdf_extraction_runs` row written. Closest analog: Docling
2.93's TableFormer or layout-prediction model hangs on some specific page in
this thesis. Could be a memory pressure issue under Windows + 32-bit-page
PDFs, a model singleton race in the threadpool wrapper, or a Docling-internal
deadlock.

**Worker state mid-stall:**
```
PID 41012  CPU 11.79s  Working set 418 MB  Threads 25
(unchanged across 3 minutes of "extract in-flight")
```
For comparison, an actively-computing Docling pass on the same machine shows
~50 % CPU steady-state. This worker had effectively 0 % CPU mid-stall — it
was awaiting something (likely a stuck native call or a missed wakeup).

`opts.document_timeout = 120.0` was set in `DoclingExtractor._get_converter()`
per T-071-02-03 mitigation, but it did NOT trip during this run (no exception
surfaced, no 422 from the route's `except Exception` arm). The timeout may
require explicit `pipeline_options.document_timeout` enforcement at the
converter-call level, not just on the singleton.

**Coverage of pre-UAT contract:** the `/reextract` route DID run far enough to
execute the reset cascade — chunks/tables/images for the PDF were deleted and
status set to `pending`. That step works. The defect is downstream, inside
the synchronous-but-threadpool-wrapped extract step.

---

## Remediation scope (carries forward to Phase 071.1)

Phase 071.1 must close SC#1 before Phase 071's RAG-DOCLING-01 requirement
fully validates. Suggested scope (lift to ROADMAP.md):

1. **Comprehensive `run_in_threadpool` wrapping in `/reextract`.** Beyond
   the `extractor.extract()` call, the route does several synchronous
   `supabase-py` operations inside the async handler — `select`, `delete`
   ×3, `update`, AND `supabase.storage.from_(...).download(file_path)`.
   Per CLAUDE.md D-v2.5-01 all of these should be `run_in_threadpool`-wrapped.
   Plan 04 only fixed the extract call.

2. **Docling pipeline tuning for thesis-sized PDFs.**
   - Verify `document_timeout=120.0` is actually enforced at the per-call
     level (not just on the singleton constructor). May need to pass via
     `convert(..., timeout=...)` or via `PdfPipelineOptions.document_timeout`
     at each invocation.
   - Add an `EXTRACTOR_DOCLING_DISABLE_TABLE_STRUCTURE` env var that, when
     set, configures `PdfPipelineOptions.do_table_structure = False`. Lets
     operators fall back to "pdfium-only" mode on PDFs that wedge in the
     TableFormer.
   - Add a `pipeline_options.images_scale` env-tunable knob (currently
     hardcoded `2.0`) — lower values reduce memory pressure on big PDFs.

3. **PyMuPDF subprocess fallback for thesis-class PDFs.** The Phase 071 Plan
   03 AGPL fence is in place. Use it: when Docling exceeds N seconds or
   raises, the `/reextract` route should fall back to `PyMuPDFExtractor` for
   the same document. This is the SC#3 "per-document fallback engine"
   guarantee that's currently un-exercised under load.

4. **Friendly-fixture UAT first.** Before retrying SC#1 against the thesis
   pair, validate the route end-to-end on a smaller fixture (e.g., a 10-page
   academic paper PDF + sibling DOCX). Captures whether the issue is
   thesis-specific or applies to all real-world PDFs.

5. **SC#1 retry on the thesis pair** (`23cc112a` PDF + `911225a6` DOCX) after
   1–4 land. Re-fill this VERIFICATION.md with actual AFTER counts and flip
   `status: red` → `status: green` once the 20 % delta clears.

6. **Cleanup of PDF row state.** The thesis PDF (`23cc112a-...`) is currently
   in `status='pending'` with `chunks=0 / tables=0 / images=0` (Plan 04's
   reset cascade ran but the extract step failed). Phase 071.1's UAT should
   re-trigger `/reextract` on it; that path is idempotent (re-runs the
   delete + reset before scheduling a new ingest).

Trigger: open the next phase as `071.1 — Docling Primary Path Gap Closure`,
add to ROADMAP.md after Phase 071's checkbox flips to `[x]`.
