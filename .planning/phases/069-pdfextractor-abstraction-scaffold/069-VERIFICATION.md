---
phase: 069-pdfextractor-abstraction-scaffold
verified: 2026-05-13T00:00:00Z
status: human_needed
must_haves_verified: 6/7
score: 6/7
re_verification: false
human_verification:
  - test: "Upload a real PDF (ideally the thesis PDF referenced in prior phases) via the app at http://localhost:5173/. After ingestion completes, compare documents.full_markdown length, document_tables row count, and document_images row count against a pre-Phase-069 baseline (or verify the table/image counts match expectations for the document)."
    expected: "Same text output, same table count, and same image count (0 images is the correct pre-existing baseline for PDF images in this test environment) as the pipeline produced before Phase 069."
    why_human: "The golden-fixture binding gate proves byte-equivalence for synthetic fixtures. A real thesis PDF exercises code paths (larger pypdf page counts, pdfplumber table detection on multi-column layouts) that the 2-page synthetic reference.pdf does not. SC#2's binding promise ('zero observable behavior change') is fully provable only against real-world ingest traffic. Cannot automate without a running stack and a live database."
---

# Phase 069: PdfExtractor Abstraction Scaffold — Verification Report

**Phase Goal:** Document ingestion flows through a `PdfExtractor` abstract base class so swapping extractors becomes a 1-line config change, with zero observable behavior change in this phase.
**Verified:** 2026-05-13
**Status:** human_needed
**Re-verification:** No — initial verification.

---

## Success Criteria Audit

| SC# | Status | Evidence | Notes |
|-----|--------|----------|-------|
| SC#1 — `PdfExtractor` ABC + `LegacyExtractor` concrete in `extraction_service.py` | VERIFIED | `class PdfExtractor(ABC)` at line 63; `class LegacyExtractor(PdfExtractor)` at line 85; `extract()` + `supports()` abstract methods at lines 72/76; three frozen `@dataclass` types confirmed; `get_extractor()` dispatcher at line 175; 184 LOC file (above 120-line minimum). All module-level heavy imports absent — pypdf/docx imported lazily inside method bodies only (confirmed: no top-level `import pypdf` or `from pypdf` present). | Full contract matches D-069-03 verbatim. |
| SC#2 — `documents.py` ingest path calls the abstraction; Phase 32.5 chunking reads `ExtractedDocument.text` unchanged | VERIFIED | Upload path: `from app.services.extraction_service import get_extractor` + `get_extractor(mime_type)` call at line 227/230. Re-ingest path: same pattern at line 457/461. Both with `extract_text()` fallback for non-PDF/DOCX MIMEs. Old `PdfReader`/`DocxDocument` top-level imports confirmed absent. `extract_and_store_tables(raw, mime_type, document_id, user_id, supabase)` call site at line 711 preserved byte-identical. `ingestion_step` badge sequence (`extracting_tables` L710, `extracting_images` L713) preserved. | SC#2 automated gate requires human UI test — see human_verification below. |
| SC#3 — `query_tables` tool unchanged; `document_tables` schema additive only | VERIFIED | `git diff ed18332..HEAD -- backend/app/services/multimodal_service.py` produces zero output — file is byte-identical to the base commit. `extract_and_store_tables(raw, mime_type, document_id, user_id, supabase)` signature unchanged. No migrations created (zero files under `supabase/migrations/` from this phase). | multimodal_service.py is completely untouched. |
| SC#4 — Q-v2.6-06 documented as D-PRD-07 appendix in `DECISIONS.md` before phase ships | VERIFIED | `### Appendix — Q-v2.6-06 closure: PyMuPDF AGPL fallback license posture (Phase 069)` at DECISIONS.md line 599. All five required facts present: AGPL-3.0 (L611), D-PRD-03 closed-core constraint (L615), subprocess fence mechanism (L620), dev/personal-use posture (L627), commercial-redistribution paths (a)+(b) (L633-641). Re-trigger conditions documented (L652-660). Phase 071 scope for fence implementation explicitly deferred. Appendix positioned inside D-PRD-07 scope (after line 502 header; before D-PRD-08 at line 664). | Documentation-only — no `pymupdf` dep added, no PyMuPDFExtractor skeleton created. |

---

## Plan Must-Haves Audit

### Plan 01 Must-Have Truths (7 truths)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| T1 | `PdfExtractor` ABC defined with `supports(mime) -> bool` + `extract(raw, mime) -> ExtractedDocument` abstract methods | VERIFIED | Lines 63–82 of `extraction_service.py` — exact method signatures present, both decorated `@abstractmethod`. `PdfExtractor.__abstractmethods__ == frozenset({'supports', 'extract'})` confirmed by plan acceptance criteria. |
| T2 | `LegacyExtractor` wraps pypdf + pdfplumber + python-docx; only registered engine for PDF/DOCX in Phase 069 | VERIFIED | `LegacyExtractor` at lines 85–169; `_LEGACY = LegacyExtractor()` singleton at line 172; `get_extractor()` returns `_LEGACY` for PDF/DOCX and `None` otherwise. No DoclingExtractor or PyMuPDFExtractor stubs present. |
| T3 | `documents.py` upload path (L226+) and re-ingest path (L457+) call `get_extractor(mime)` first, fall back to `extract_text()` for non-PDF/DOCX | VERIFIED | Grep confirms two independent `from app.services.extraction_service import get_extractor` imports and two `get_extractor(mime_type)` call sites with `else: text = extract_text(raw, mime_type)` fallback. |
| T4 | Phase 32.5 chunking + embedding pipeline reads `ExtractedDocument.text` unchanged (no schema changes, no new columns) | VERIFIED | `ingest_document` body passes `.text` string into `chunk_text()`; no new migration files; `multimodal_service.py` byte-identical to base. |
| T5 | `extract_and_store_tables(raw, mime_type, document_id, user_id, supabase)` signature preserved; `query_tables` tool behavior unchanged | VERIFIED | Call site at documents.py L711 matches the exact signature. `multimodal_service.py` diff = 0 lines. |
| T6 | Text-extraction failure raises; table/image failures populate `*_extraction_error` and return empty lists | VERIFIED | `LegacyExtractor.extract()` at lines 93–124: text calls `_extract_text()` with no try/except (raises propagate); tables wrapped in `try/except` → `table_error = str(exc)` at line 106; images wrapped symmetrically at lines 112–116. Tests 6, 7, 8 in test suite verify this contract. |
| T7 (binding gate) | Golden-fixture tests prove byte-equivalent output for reference PDF + DOCX | VERIFIED (code/fixtures) | `test_legacy_extractor_pdf_matches_golden` + `test_legacy_extractor_docx_matches_golden` both present. Golden JSON files exist at `backend/tests/fixtures/extraction/reference_pdf_golden.json` + `reference_docx_golden.json` with proper `text/tables/images/table_extraction_error/image_extraction_error` structure. PDF golden: 1 table, 0 images, 734-char text. DOCX golden: 1 table, 0 images, 301-char text. Test suite reports 11/11 green per SUMMARY self-check. Cannot execute tests in this verification environment — see human_verification. |

### Plan 02 Must-Have Truths (3 truths)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| T1 | Q-v2.6-06 closed by D-PRD-07 appendix in DECISIONS.md | VERIFIED | Heading confirmed at line 599; "Closes: Q-v2.6-06" at line 601. |
| T2 | Appendix documents: AGPL-3.0, D-PRD-03 constraint, subprocess fence, dev acceptance, commercial paths (a)+(b) | VERIFIED | All five facts confirmed by direct grep against lines 611, 615, 620, 627, 633–641. |
| T3 | Documentation only — no code, no requirements.txt edits, no subprocess fence implementation | VERIFIED | `git diff ed18332..HEAD -- backend/` limited to `documents.py` + `extraction_service.py` + test/fixture files from Plan 01. `requirements.txt` has `reportlab>=4.0.0` added (fixture-generation dep, not pymupdf). No `pymupdf_extractor.py` file exists. |

---

## Plan 01 Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/extraction_service.py` | PdfExtractor ABC + ExtractedDocument/TableData/ImageData dataclasses + LegacyExtractor + get_extractor dispatcher | VERIFIED | 184 LOC; all symbols present; no top-level heavy imports. |
| `backend/tests/unit/test_extraction_service.py` | Golden-fixture tests + ABC contract tests + error-field semantics tests | VERIFIED | 171 LOC; 11 test functions confirmed by `grep -c`; golden test function names present. |
| `backend/tests/fixtures/extraction/reference.pdf` | Synthetic license-clean reference PDF | VERIFIED | File present (3,277 bytes per SUMMARY; within 1 KB–2 MB acceptance window). |
| `backend/tests/fixtures/extraction/reference.docx` | Synthetic license-clean reference DOCX | VERIFIED | File present (37,464 bytes). |
| `backend/tests/fixtures/extraction/reference_pdf_golden.json` | Canonical normalized LegacyExtractor.extract output for reference.pdf | VERIFIED | Valid JSON; all 5 required keys present (`text`, `tables`, `images`, `table_extraction_error`, `image_extraction_error`). |
| `backend/tests/fixtures/extraction/reference_docx_golden.json` | Canonical normalized LegacyExtractor.extract output for reference.docx | VERIFIED | Valid JSON; same 5 keys. |
| `backend/tests/fixtures/extraction/_generate_fixtures.py` | Reproducibility script for fixture synthesis | VERIFIED | File present. |

### Plan 02 Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/prd-reset/DECISIONS.md` | D-PRD-07 Appendix on PyMuPDF AGPL fallback license posture (closes Q-v2.6-06) | VERIFIED | Appendix at lines 599–661; 50+ non-blank lines (within 30–80 acceptance window); positioned after D-PRD-07 body and before D-PRD-08 at line 664. |

---

## Cross-Plan Wiring (Key Links)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `documents.py:226` | `extraction_service.py:get_extractor` | `from app.services.extraction_service import get_extractor` at L227 + `get_extractor(mime_type)` at L230 | WIRED | Upload path confirmed by grep. |
| `documents.py:457` | `extraction_service.py:get_extractor` | `from app.services.extraction_service import get_extractor` at L457 + `get_extractor(mime_type)` at L461 | WIRED | Re-ingest path confirmed by grep. |
| `extraction_service.py:LegacyExtractor._extract_tables` | `multimodal_service.py:extract_pdf_tables` | Lazy `from app.services.multimodal_service import extract_pdf_tables, extract_docx_tables` at line 143 | WIRED | Confirmed in `extraction_service.py` lines 143–153. |
| `extraction_service.py:LegacyExtractor._extract_images` | `multimodal_service.py:extract_pdf_images` | Lazy `from app.services.multimodal_service import extract_pdf_images, extract_docx_images` at line 159 | WIRED | Confirmed in `extraction_service.py` lines 159–169. |
| `DECISIONS.md:appendix` | `PRD v2.6 §13 Q-v2.6-06` | "Closes: Q-v2.6-06 (PRD v2.6 §13, line 433)" at L601 | WIRED | Reference to Q-v2.6-06 present. |
| `DECISIONS.md:appendix` | `DECISIONS.md:D-PRD-03` | "D-PRD-03 ('closed core + open peripherals')" at L615 | WIRED | D-PRD-03 cited by name in the appendix. |

---

## Deferred / Pre-existing Items

Per `deferred-items.md` — confirmed out-of-scope for Phase 069.

### Pre-existing integration test failures

Two tests in `backend/tests/integration/test_documents.py` were failing on the base commit `ed18332` and continue to fail — both are mock-setup drift independent of Phase 069's seam carve:

1. **`TestFullMarkdown::test_ingest_stores_full_markdown`** — `StopIteration` because the mock `side_effect` list has only 3 entries; `ingest_document` now emits 6+ `ingestion_step` update/execute pairs (added by Phase 056-01, commit `b2ada03`). Phase 069 does not touch `ingest_document`'s body.

2. **`TestUploadDocument::test_upload_with_valid_folder_id_returns_201`** — `KeyError: 'user_id'` because the folder-check mock does not stub `user_id`. Phase 069 does not touch the folder-ownership guard.

The SUMMARY reports 41 passed, 2 deselected (pre-existing failures) across `test_extraction_service.py` + `test_documents.py` + `test_multimodal_extraction.py`. These failures pre-date Phase 069 by at least one phase and are deferred to a test-fixture maintenance pass.

### Latent extraction bugs (pre-existing, not introduced)

- DOCX inline-image extraction broken under python-docx 1.2.0 (`CT_Blip.part` removed) — baseline is 0 images; codified in golden fixture.
- pdfplumber + PIL fail to decode ReportLab-embedded PDF image streams — baseline is 0 images; codified in golden fixture.

Both are deferred to Phase 071 (Docling primary + RAG-MM-LIFT-02).

---

## Human Verification Required

### 1. Real-PDF end-to-end ingest smoke test

**Test:** With the dev stack running (Supabase + backend + Vite), upload a real-world PDF (e.g., the thesis PDF used in prior phases) via the app at http://localhost:5173/ using the test account (fhdmrd@gmail.com). After ingestion completes, check:
- `documents.full_markdown` is non-empty and its text length is reasonable for the document.
- `document_tables` row count is correct (0 for a plain-text PDF; > 0 for a PDF with tables).
- `document_images` row count matches expectation (0 images is the known pre-existing baseline for pdfplumber + PIL on typical PDFs).
- No 422 or 500 error surfaced during ingestion.

**Expected:** Ingestion completes successfully via the new `get_extractor()` path with the same text, table count, and image count as the pre-Phase-069 pipeline produced for the same file.

**Why human:** The golden-fixture gate proves byte-equivalence for the 2-page synthetic `reference.pdf`. A real document exercises larger pypdf page counts, pdfplumber multi-column table detection, and the `extract_and_store_*` call chain inside `ingest_document`. This is the SC#2 binding promise for real-world traffic. Cannot automate without a live running stack.

---

## Requirements Coverage

Phase 069 carries no explicit REQ-IDs. Per the ROADMAP annotation: "(structural prep — directly verified by RAG-DOCLING-01 once Phase 071 lands)". No REQUIREMENTS.md rows are claimed or blocked by this phase. All four ROADMAP Success Criteria are covered by the SC audit above.

---

## Anti-Patterns Found

No blockers found. Items scanned:

| File | Pattern Checked | Finding |
|------|----------------|---------|
| `extraction_service.py` | Top-level heavy imports (`import pypdf`, `from pdfplumber`) | CLEAN — lazy imports only inside method bodies |
| `extraction_service.py` | Stub returns (`return null`, `return {}`, placeholder comments) | CLEAN — all methods fully implemented |
| `extraction_service.py` | TODO/FIXME/PLACEHOLDER comments | CLEAN |
| `documents.py` | `PdfReader`/`DocxDocument` residual top-level imports | CLEAN — both removed after Phase 069 edit (no other callers existed) |
| `documents.py` | `extract_text` PDF/DOCX branches not removed | CLEAN — `extract_text` now has Phase 069 docstring explaining split; PDF and DOCX branches removed; other 7 MIME branches intact |
| `documents.py` | `ingest_document` body (`extract_and_store_*` signatures, badge sequence) | CLEAN — call sites preserved byte-identical; `extracting_tables` / `extracting_images` badge labels present |
| `.planning/prd-reset/DECISIONS.md` | `pymupdf` dependency add, `PyMuPDFExtractor` skeleton | CLEAN — documentation only |

---

## Behavioral Spot-Checks

Spot-checks not executable without the running venv stack. Per plan verification commands:

| Behavior | Command (from plan) | Status |
|----------|---------------------|--------|
| `extraction_service.py` imports cleanly | `python -c "from app.services.extraction_service import PdfExtractor, LegacyExtractor, ..."` | SKIP — no live venv in verifier env; SUMMARY self-check records PASS |
| Golden binding gate — 2 passing | `pytest tests/unit/test_extraction_service.py -k golden -v` | SKIP — no live venv; SUMMARY self-check records 11/11 green including 2 golden tests |
| Full unit suite — 11 passing | `pytest tests/unit/test_extraction_service.py -v` | SKIP — no live venv; SUMMARY records PASS |
| Multimodal tests unchanged | `pytest tests/unit/test_multimodal_extraction.py -v` | SKIP — no live venv; SUMMARY records 7/7 PASS |

The SUMMARY self-check for Plan 01 explicitly records all task commits, all file existence checks, and the test-run output (41 passed, 2 pre-existing deselected). The executor's self-check is evidence but not independent verification. The human smoke test (above) closes this gap for real-world traffic.

---

## Gaps Summary

No must-haves failed. All 7 Plan 01 truths are VERIFIED at the code level. All 3 Plan 02 truths are VERIFIED. The single `human_needed` item is not a gap — it is the SC#2 real-world confirmation that the automated golden-fixture gate cannot substitute for.

The phase goal — "document ingestion flows through a `PdfExtractor` ABC so swapping extractors becomes a 1-line config change, with zero observable behavior change" — is implemented in the codebase. The abstraction exists, is wired, and all key links resolve. The human test is the final confirmation that real-world ingest traffic produces identical behavior.

---

## Verdict

**status: human_needed**

6/7 plan must-haves verified at code level (the 7th — golden test execution — is blocked by the absence of a live venv in the verifier environment; SUMMARY self-check is the available evidence). All 4 ROADMAP Success Criteria verified directly against codebase artifacts. One human test required: real-PDF upload smoke test to confirm zero behavior change on actual ingest traffic.

The phase is complete from a code standpoint. No gaps. No blockers. Awaiting human smoke test sign-off before marking passed.

---

_Verified: 2026-05-13_
_Verifier: Claude (gsd-verifier)_
