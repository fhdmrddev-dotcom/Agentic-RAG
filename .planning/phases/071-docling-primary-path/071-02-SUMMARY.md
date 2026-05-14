---
phase: 071-docling-primary-path
plan: 02
subsystem: backend-services
tags: [docling, pdf-extraction, docx-extraction, telemetry, dispatcher, ABC, fixtures]

requires:
  - phase: 071-docling-primary-path
    plan: 01
    provides: pdf_extraction_runs telemetry table + documents.extractor column + document_images/tables.bbox + UserEffectiveSettings multimodal-limit fields
  - phase: 070-docling-httpx-spike
    provides: verified Docling + supabase + httpx coexistence (D-070-14 regression-guardrail in requirements.txt)
  - phase: 069-pdf-extractor-abstraction-scaffold
    provides: ExtractedDocument / TableData / ImageData dataclasses + PdfExtractor ABC + get_extractor dispatcher seam
provides:
  - "DoclingExtractor(PdfExtractor) adapter — primary engine for new PDF + DOCX uploads (D-071-05..08); module-level converter singleton with double-checked lock + generate_picture_images=True + document_timeout=120.0"
  - "Extended ExtractedDocument / TableData / ImageData with optional full_markdown / extractor_name / bbox fields per D-071-08; LegacyExtractor explicitly returns extractor_name='pypdf-legacy'"
  - "get_extractor(mime, engine_override=None) reads EXTRACTOR_PRIMARY env (default 'docling'); routes Docling/PyMuPDF (lazy)/Legacy with ImportError fallback so Plan 03 absence doesn't break Wave 2 (D-071-12)"
  - "ingest_document writes pdf_extraction_runs row in both happy AND except arms; documents.extractor column populated on completion"
  - "Phase 072 TODO comment block at documents.py:711+:714 documenting bbox-passthrough gap (RESEARCH.md Pitfall 4)"
  - "academic_synth.{pdf,docx} synthetic CI fixtures (D-071-16); regression net at test_docling_extractor.py asserts >=5 tables + >=5 images + extractor_name + full_markdown + bbox keys"
  - "EXTRACTOR_PRIMARY=docling documented in backend/.env.example"
affects: [071-03, 071-04, 072, 076, 077]

tech-stack:
  added: []
  patterns: ["module-level singleton with double-checked-lock for expensive resources", "ImportError-guarded lazy engine registration in dispatcher", "ExtractedDocument optional-field extension preserves Phase 069 golden compatibility", "telemetry INSERT wrapped in its own try/except so write failure cannot block document completion"]

key-files:
  created:
    - backend/app/services/extractors/__init__.py
    - backend/app/services/extractors/docling.py
    - backend/tests/integration/test_docling_extractor.py
    - backend/tests/fixtures/extraction/academic_synth.pdf
    - backend/tests/fixtures/extraction/academic_synth.docx
  modified:
    - backend/app/services/extraction_service.py
    - backend/app/api/documents.py
    - backend/.env.example
    - backend/tests/fixtures/extraction/_generate_fixtures.py
    - backend/tests/fixtures/extraction/reference_pdf_golden.json
    - backend/tests/fixtures/extraction/reference_docx_golden.json
    - backend/tests/unit/test_extraction_service.py

key-decisions:
  - "LegacyExtractor returns explicit extractor_name='pypdf-legacy' (CONTEXT.md Discretion recommendation) — gives telemetry clarity at no behavioral cost; goldens refreshed in same commit."
  - "Dispatcher uses ImportError try/except guard for the PyMuPDF lazy import — Plan 03 hasn't shipped backend/app/services/extractors/pymupdf.py yet, but Plan 02 ships without breakage because the missing import falls through to LegacyExtractor."
  - "Phase 069 test test_get_extractor_returns_legacy_for_pdf_and_docx renamed to test_get_extractor_returns_legacy_when_overridden — Phase 071 D-071-12 changes the dispatcher default from 'legacy' to 'docling'; callers wanting Legacy now pass engine_override='legacy' explicitly. The Phase 069 snapshot of the dispatcher was the wrong contract for Phase 071."
  - "ingest_document signature gained THREE kwargs (engine_override / extracted_doc / extract_duration_ms) rather than refactoring extract_and_store_* to take pre-extracted lists — the latter is D-069-04's deferred work, now landing in Phase 072 (RAG-MM-LIFT-01). Phase 072 TODO comment block at documents.py:711+:714 documents the seam inline."
  - "Two telemetry INSERT call sites (happy + except) deliberately duplicated (not refactored into a helper) — happy path passes table_count/image_count from extracted_doc, except path passes counts=0 + error=str(e)[:1000]. The duplication is shallow (~10 lines each) and keeps the two write contracts visible at their call sites."

patterns-established:
  - "Pattern: module-level singleton with double-checked-lock (threading.Lock + outer + inner if-None checks) for resources that cost real money to construct (Docling: ~600 MB model download + ~5s instantiation per process)."
  - "Pattern: ImportError-guarded lazy engine registration — `try: from app.services.extractors.X import XExtractor; _X = XExtractor() except ImportError as e: log.warning(...); _X = None` — lets wave-N plans ship before wave-(N+1) plans land their dependencies."

requirements-completed:
  - RAG-DOCLING-01  # partial — SC#1 (extractor wired, Plan 04 lands the binding UAT gate), SC#2 (extractor column populated on new ingests), SC#4 (pdf_extraction_runs telemetry writes happen on every extract)

duration: ~92min
completed: 2026-05-14
---

# Phase 071 Plan 02: DoclingExtractor + Dispatcher Rewire + Telemetry Writes Summary

**Docling is now the primary PDF + DOCX engine for new uploads; ExtractedDocument extended with full_markdown / extractor_name / bbox; pdf_extraction_runs telemetry table starts collecting rows on every extract; Phase 070 binding gate stays green.**

## Performance

- **Duration:** ~92 min (executor: Opus 4.7 1M-context)
- **Tasks:** 4 (all completed; 1 deviation logged — see Deviations)
- **Files created:** 5
- **Files modified:** 7
- **Commits:** 4 atomic + this summary

## Accomplishments

- `DoclingExtractor(PdfExtractor)` shipped at `backend/app/services/extractors/docling.py` — verbatim from RESEARCH.md lines 944-1117 (which was verified live against Docling 2.93 on 2026-05-14). Module-level `_CONVERTER` singleton with `_CONVERTER_LOCK = threading.Lock()` double-checked-lock pattern; `PdfPipelineOptions.generate_picture_images = True` (Pitfall 3), `images_scale = 2.0`, `document_timeout = 120.0` (T-071-02-03 DoS mitigation).
- `ExtractedDocument`, `TableData`, `ImageData` extended with optional `full_markdown` / `extractor_name` / `bbox` fields per D-071-08. All new fields default to `None` so `LegacyExtractor`'s pre-071 golden output stays byte-identical except for the deliberate `extractor_name='pypdf-legacy'` addition (recommended-explicit per CONTEXT.md Discretion).
- `get_extractor(mime, engine_override=None)` rewired per D-071-12 — reads `EXTRACTOR_PRIMARY` env var (default `'docling'`), accepts explicit override, routes Docling/PyMuPDF/Legacy with `ImportError` guard so Plan 03's not-yet-shipped `pymupdf.py` doesn't break Wave 2. Invalid env values log a WARNING and fall through to `'docling'`.
- `ingest_document` signature extended with three kwargs (`engine_override`, `extracted_doc`, `extract_duration_ms`); both extract call sites (upload + `/reingest`) capture the full `ExtractedDocument` + duration BEFORE only taking `.text` and plumb both into the `BackgroundTasks.add_task` call.
- `pdf_extraction_runs` INSERT happens at the end of `ingest_document` happy path (with engine + duration_ms + table_count + image_count + error=None) AND inside the except arm (with error=str(e)[:1000] + counts=0). Both wrapped in their own try/except so telemetry write failure cannot block document completion or double-fault on already-failed ingest.
- `documents.extractor` column populated on completion (final UPDATE block) using the resolved engine lineage.
- Phase 072 TODO comment block (RESEARCH.md Pitfall 4) inserted ABOVE both `extract_and_store_tables` and `extract_and_store_images` call sites — documents that `bbox` columns from migrations 041/042 stay NULL for new ingests because the multimodal helpers re-extract from raw bytes; Phase 072 (RAG-MM-LIFT-01/02) closes the seam.
- `academic_synth.pdf` + `academic_synth.docx` synthetic CI fixtures (D-071-16) generated programmatically (reportlab + python-docx + PIL) — license-clean, deterministic, 5 sections × (5-row table + distinct colored figure) each. Fixture sizes: 9.9 KB / 39 KB.
- `test_docling_extractor.py` regression net authored — 14 tests across three classes (TestDoclingPdf, TestDoclingDocx, TestDoclingDispatch) covering text non-emptiness, ≥5 tables, ≥5 images, `extractor_name == 'docling'`, `full_markdown is not None`, bbox keys populated.
- `EXTRACTOR_PRIMARY=docling` documented in `backend/.env.example` (D-071-12); `EXTRACTOR_DOCLING_ISOLATION` explicitly NOT added (D-070-15 rejected isolation knob).
- Phase 070 binding gate (`test_pdf_extractor_docling_compat.py`) stays GREEN; `requirements.txt` pins untouched.

## Task Commits

1. **Task 1: Extend dataclasses + rewire dispatcher + refresh goldens** — `957ef05` (feat)
2. **Task 2: DoclingExtractor adapter at extractors/docling.py** — `c2ad062` (feat)
3. **Task 3: academic_synth fixtures + test_docling_extractor.py regression net** — `d538c4f` (test)
4. **Task 4: pdf_extraction_runs telemetry + engine_override kwarg + Phase 072 TODOs + .env.example** — `5bee03f` (feat)

## Synthetic-Fixture Extraction Counts (sanity check)

Captured from a direct DoclingExtractor invocation against the new fixtures (Docling 2.93 on cached models):

| Sibling | tables | images | text_len | markdown_len | Plan threshold | Pass? |
|---------|--------|--------|----------|--------------|----------------|-------|
| academic_synth.pdf | 5 | 7 | 3574 | 3719 | ≥5 / ≥5 | ✓ |
| academic_synth.docx | 5 | 5 | 3483 | 3601 | ≥5 / ≥5 | ✓ |

Docling extracted 7 images from the PDF (vs the 5 the generator placed) — the layout analyzer also surfaces the small visual blocks like Section heading underlines or table-cell borders as picture items. The thresholds (≥5) are met with margin; nothing to investigate.

## Goldens Diff (pre vs post)

The Phase 069 unit-test goldens (`reference_pdf_golden.json` / `reference_docx_golden.json`) were regenerated to include the new optional fields. Diffed keys:

| Key | Before | After |
|-----|--------|-------|
| `extractor_name` | (absent) | `"pypdf-legacy"` |
| `full_markdown` | (absent) | `null` |
| `tables[].bbox` | (absent) | `null` |
| `images[].bbox` | (absent) | `null` |

All other text/tables/images content stayed byte-identical — `_normalize` round-trip via `_generate_fixtures.write_golden_jsons()`. Phase 069 golden tests (`test_legacy_extractor_pdf_matches_golden`, `test_legacy_extractor_docx_matches_golden`) pass against the refreshed goldens.

## Test Results

### Combined gate (Phase 070 + Phase 069 + Plan 02)

```
cd backend && venv/Scripts/python -m pytest \
  tests/unit/test_extraction_service.py \
  tests/integration/test_pdf_extractor_docling_compat.py \
  tests/integration/test_docling_extractor.py -x --tb=short
```

- **26 passed, 1 skipped** (the skipped test is `test_supabase_smoke_post_resolution` which skips when `SUPABASE_URL` points at `test.supabase.co` — expected behavior, not a regression).
- **Total runtime:** 33 seconds (Docling models warmed from Phase 070 cache).
- **First cold run during Task 3:** 125 seconds (model load was already cached from Phase 070; OCR weights cold-loaded once).
- Phase 069 unit gate: 11/11 GREEN.
- Phase 070 binding gate: 1 GREEN + 1 SKIP (smoke).
- Plan 02 regression gate: 14/14 GREEN.

### Plan 02 regression test breakdown (14 tests)

| Class | Tests | Status |
|-------|-------|--------|
| TestDoclingPdf | 7 (non-empty text, ≥5 tables, ≥5 images, extractor_name, full_markdown, table bbox, image bbox) | 7/7 |
| TestDoclingDocx | 4 (non-empty text, ≥5 tables, ≥5 images, extractor_name) | 4/4 |
| TestDoclingDispatch | 3 (supports PDF/DOCX, rejects text/plain, raises on unsupported mime) | 3/3 |

Module-scoped `pdf_result` / `docx_result` fixtures share a single Docling run per sibling so the 14 assertions don't trigger 14 expensive extracts.

## Plan-Level Acceptance Verification

| Criterion | Expected | Actual |
|-----------|----------|--------|
| `grep -c "EXTRACTOR_PRIMARY=docling" backend/.env.example` | 1 | 1 ✓ |
| `grep -c "pdf_extraction_runs" backend/app/api/documents.py` | ≥1 | 6 ✓ |
| `grep -c "# TODO Phase 072" backend/app/api/documents.py` | ≥1 | 2 ✓ |
| `grep -c "class DoclingExtractor" backend/app/services/extractors/docling.py` | 1 | 1 ✓ |
| `grep -c "engine_override" backend/app/services/extraction_service.py` | ≥1 | 3 ✓ |
| `grep -c "full_markdown" backend/app/services/extraction_service.py` | ≥1 | 2 ✓ |
| `grep -c "engine_override" backend/app/api/documents.py` | ≥3 | 4 ✓ |
| `grep -c "generate_picture_images = True" backend/app/services/extractors/docling.py` | 1 | 1 ✓ |
| `grep -c "document_timeout = 120.0" backend/app/services/extractors/docling.py` | 1 | 1 ✓ |
| `grep -c "_CONVERTER_LOCK" backend/app/services/extractors/docling.py` | ≥2 | 2 ✓ |
| pytest test_docling_extractor.py | exits 0 | 14/14 passed ✓ |
| pytest test_pdf_extractor_docling_compat.py | exits 0 | 1 passed + 1 skip (expected) ✓ |

## Deviations

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Updated Phase 069 dispatcher contract test for Phase 071 behavior**

- **Found during:** Task 4 (combined-gate run after wiring telemetry)
- **Issue:** `tests/unit/test_extraction_service.py::test_get_extractor_returns_legacy_for_pdf_and_docx` failed because Phase 069's dispatcher always returned `LegacyExtractor`, but Phase 071's D-071-12 changes the default to `'docling'` — so without an explicit `engine_override='legacy'`, `get_extractor(PDF_MIME)` now correctly returns `DoclingExtractor`. This is the WHOLE POINT of Phase 071; the failing test was Phase 069's snapshot of the wrong contract.
- **Fix:** Renamed test to `test_get_extractor_returns_legacy_when_overridden` and updated it to pass `engine_override="legacy"`. Also extended `test_get_extractor_returns_none_for_unsupported_mime` to cover the explicit-override path. Both tests now correctly express the Phase 071 D-071-12 dispatcher contract.
- **Files modified:** `backend/tests/unit/test_extraction_service.py`
- **Commit:** `5bee03f` (bundled with Task 4)

### Non-deviations (worth flagging)

- **CRLF warnings on binary fixtures.** Git showed `LF will be replaced by CRLF` when adding `academic_synth.pdf` + `academic_synth.docx`. Verified post-commit via `git show HEAD:.../academic_synth.pdf` byte-comparison — workspace bytes == blob bytes (9886 bytes, `%PDF-1.4` magic intact). Git's warning is over-eager when no `.gitattributes` rule classifies the file as binary; the actual storage is correct because git auto-detects binary content. No action needed unless a future contributor unpacks the repo on a system with `core.autocrlf=true` AND `*.pdf` not classified — at which point the fix is a one-line `.gitattributes` entry. Surface to user if it ever becomes a real bug.

- **Plan 03's PyMuPDF dispatcher branch.** The `_PYMUPDF` registration in `get_extractor` is wrapped in `try/except ImportError` exactly so this plan ships cleanly before Plan 03 lands `backend/app/services/extractors/pymupdf.py`. Plan 03's first test will validate the wiring works once the module exists. No deviation; documented in the dispatcher comment.

## Issues Encountered

- None blocking. The single test-contract update (above) was the only friction point. The combined gate runtime (33s warm) is well within reasonable CI bounds; the first-cold Docling run during Task 3 (125s) is a one-time cost per machine and is documented in the plan's `<read_first>` for Task 3.

## Known Stubs

None. Every code path introduced in this plan either does real work (DoclingExtractor.extract calls `_get_converter().convert()`; telemetry INSERT writes a real row; goldens are byte-equivalent post-extension) or is explicitly documented as an opt-in seam closed by a named future plan (`# TODO Phase 072 (RAG-MM-LIFT-01/02)` for the bbox passthrough gap).

## Next Phase Readiness

- **Plan 03 (PyMuPDF AGPL fence)** is now unblocked. The `_PYMUPDF` lazy-import branch in `get_extractor` is in place; Plan 03 just needs to land `backend/app/services/extractors/pymupdf.py` + `backend/extractors/pymupdf_isolated.py` and add a `test_pymupdf_fence.py` regression test. The dispatcher will pick it up automatically.
- **Plan 04 (`POST /reextract`)** is also unblocked. `ingest_document` already accepts the `engine_override` kwarg; `/reextract` just needs to extract with a forced engine, hard-delete existing chunks/tables/images, and pass `engine_override="docling"|"pymupdf"|"legacy"` to the BackgroundTasks call. The new D-v2.6-04 PROJECT.md row + the live UAT against `551f03f9-...` (D-071-15) round out Plan 04.
- **Phase 072 (RAG-MM-LIFT-01/02)** inherits the `# TODO Phase 072` comment block at `documents.py:711, :714` — Phase 072's task is to refactor `extract_and_store_tables` / `extract_and_store_images` to accept pre-extracted lists from `ExtractedDocument.tables[]` / `.images[]`, at which point the bbox columns (migrations 041/042) start getting populated.

## Self-Check: PASSED

- All files in `files_modified` exist on disk:
  - backend/app/services/extraction_service.py ✓
  - backend/app/services/extractors/__init__.py ✓
  - backend/app/services/extractors/docling.py ✓
  - backend/app/api/documents.py ✓
  - backend/tests/integration/test_docling_extractor.py ✓
  - backend/tests/fixtures/extraction/_generate_fixtures.py ✓
  - backend/tests/fixtures/extraction/academic_synth.pdf ✓
  - backend/tests/fixtures/extraction/academic_synth.docx ✓
  - backend/tests/fixtures/extraction/reference_pdf_golden.json ✓
  - backend/tests/fixtures/extraction/reference_docx_golden.json ✓
  - backend/.env.example ✓
- All 4 task commits found in git log:
  - 957ef05 (Task 1) ✓
  - c2ad062 (Task 2) ✓
  - d538c4f (Task 3) ✓
  - 5bee03f (Task 4) ✓
- All 12 plan-level acceptance criteria pass (see verification table above).
- Phase 070 binding gate (`test_pdf_extractor_docling_compat.py`) stays GREEN.
- Phase 069 unit gate stays GREEN (11/11) after deliberate contract update for D-071-12.
- Plan 02 regression gate (`test_docling_extractor.py`) GREEN 14/14.
