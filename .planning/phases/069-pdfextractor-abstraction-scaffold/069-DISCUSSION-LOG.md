# Phase 069: `PdfExtractor` Abstraction Scaffold - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 069-pdfextractor-abstraction-scaffold
**Areas discussed:** ExtractedDocument shape, MIME-type scope, Default implementation packaging, 1-pass vs 2-pass extraction, Q-v2.6-06 AGPL appendix handling, Test strategy

---

## ExtractedDocument shape

| Option | Description | Selected |
|--------|-------------|----------|
| Pydantic model, current fields verbatim | Strict-validated `BaseModel` with `text + tables + images`. Phase 071 edits the model to add bbox/extractor as `Optional[]` fields when migrations land. | |
| Dataclass / TypedDict, current fields verbatim | `@dataclass(frozen=True)` with the same fields. Pydantic reserved for I/O boundaries per project rule (`CLAUDE.md`). | ✓ |
| Pydantic with room for Phase 071 fields | Add `bbox / extractor / full_markdown / page_count` as `None`-defaulted now; Phase 071 just populates them. | |

**User's choice:** Option 2 (dataclass, verbatim).
**Notes:** User initially asked for clarification of all three options + a recommendation framed around "top accuracy + no financial obligations". Re-explained in plain language: the shape decision doesn't affect accuracy (engine choice does, which is Phase 071's job), and all three options cost zero. Recommendation grounded in `CLAUDE.md`'s rule "use Pydantic for structured LLM outputs" — `ExtractedDocument` is internal plumbing, not an LLM/API output. Captured as **D-069-01**.

---

## MIME-type scope of the abstraction

| Option | Description | Selected |
|--------|-------------|----------|
| PDF + DOCX only | Wrap exactly the pipelines roadmap SC#1 names (pypdf + pdfplumber + python-docx). The other 7 formats stay in today's `extract_text()` switch. | ✓ |
| All 9 formats | Move PPTX/XLSX/CSV/EPUB/text/markdown/HTML into the new service file too. Cleaner conceptual shape but bundles unrelated scope. | |
| PDF only | Doesn't match roadmap SC#1 (names python-docx explicitly). | |

**User's choice:** PDF + DOCX only.
**Notes:** User initially asked for clarification — wanted all supported formats to keep working but wasn't sure if all should funnel through this abstraction. Re-explained: formats are unaffected (all 9 stay supported), the abstraction's purpose is engine-swap, and only PDF + DOCX have engine swaps planned (Docling/PyMuPDF/pypdfium2). Wrapping CSV/text/markdown wraps `bytes.decode()` — pure ceremony. Captured as **D-069-02**.

---

## Default implementation packaging

| Option | Description | Selected |
|--------|-------------|----------|
| Engine class, MIME inside | One class per engine (`LegacyExtractor` today; Phase 071 adds `DoclingExtractor` / `PyMuPDFExtractor` / `Pypdfium2Extractor`). Each declares `supports(mime)` + `extract(raw, mime)`. | ✓ |
| One class per format | `LegacyPdfExtractor` + `LegacyDocxExtractor` as separate classes. Phase 071: `DoclingPdfExtractor` + `DoclingDocxExtractor` separate even though Docling handles both. | |
| One class, MIME dispatch inside (no `supports()`) | Same as recommended but without explicit `supports()` method; caller writes branchy mime+engine checks downstream. | |

**User's choice:** Engine class, MIME inside (selected preview).
**Notes:** Captured as **D-069-03**. ABC contract: `class PdfExtractor(ABC): def supports(self, mime) -> bool; def extract(self, raw, mime) -> ExtractedDocument`. Phase 069 ships only `LegacyExtractor`; Phase 071 adds Docling/PyMuPDF/pypdfium2 against the same ABC.

---

## 1-pass vs 2-pass extraction

| Option | Description | Selected |
|--------|-------------|----------|
| 1-pass with error fields | Single `extract()` returns full `ExtractedDocument` with `text + tables + images + table_extraction_error + image_extraction_error`. Caller still owns `ingestion_step` status badges and decides per-modality handling. Matches Docling's structured-once model. | ✓ |
| 2-pass: separate methods | `extract_text()` and `extract_tables_and_images()` as separate ABC methods. Verbatim port of today's structure. Forces Docling to parse the PDF twice in Phase 071. | |
| 1-pass, raise on any failure | Single `extract()` but any modality failure raises. Cleanest contract but changes today's silently-swallow behavior — borked table would fail the doc. Regression risk. | |

**User's choice:** 1-pass with error fields (recommended).
**Notes:** Captured as **D-069-04**. Text failures still raise (kills doc, matches today); tables/images failures populate `_error` fields and return empty lists (caller logs + continues, matches today's `extract_and_store_*` swallow-and-warn behavior). Status badges (`extracting → chunking → embedding → extracting_tables → extracting_images`) preserved verbatim.

---

## Q-v2.6-06 AGPL appendix handling

| Option | Description | Selected |
|--------|-------------|----------|
| Plan task inside Phase 069 | One plan task writes the D-PRD-07 appendix in `.planning/prd-reset/DECISIONS.md`. Tracked, verified by `verify-work`, lands with the phase's commit train. | ✓ |
| Side commit before Plan 1 | Standalone commit ahead of phase plans. Code plans stay code-only. Slightly cleaner separation, slightly more ceremony. | |
| Defer to Phase 071 | Violates roadmap SC#4 (names Phase 069 as the gate). Not recommended. | |

**User's choice:** Plan task inside Phase 069 (recommended).
**Notes:** Captured as **D-069-05**. Becomes the second plan in Phase 069's 2-plan budget. Pure documentation; updates D-PRD-07 with PyMuPDF AGPL posture + subprocess fence rationale. No code, no dependency adds.

---

## Test strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Golden fixtures + ABC unit + existing integration | All three layers. Golden fixtures (1 PDF + 1 DOCX) are the binding gate. ABC unit covers contract. Existing `test_documents.py` stays green as safety net. Manual UAT optional. | ✓ |
| Golden fixtures + existing integration only | Skip ABC unit tests. Lighter scope, trades off explicit contract coverage. | |
| Existing integration tests only | Don't add new tests. Cheapest but misses chunk-count / table-row drift. | |
| ABC unit + existing integration only | Skip golden fixtures. Cheapest test-creation path but leaves "zero behavior change" without a binding gate. | |

**User's choice:** Golden fixtures + ABC unit + existing integration (recommended).
**Notes:** Captured as **D-069-06**. Golden fixtures live at `backend/tests/fixtures/extraction/`; small license-clean PDF + DOCX (~1-2 MB each); output normalized (floats rounded to 4 decimals, sorted keys) to handle PDF non-determinism. ABC contract tests cover `supports(mime)`, error-field semantics, empty-doc handling. Existing `backend/tests/integration/test_documents.py` runs unchanged.

---

## Claude's Discretion

The following were intentionally left to gsd-planner / gsd-executor (captured in CONTEXT.md `<decisions>` Claude's Discretion subsection):

- Naming of the dispatcher (`get_extractor` vs `select_extractor` vs `extractor_for`).
- Whether `LegacyExtractor` lives in `extraction_service.py` directly or in a sibling `extraction/legacy.py`.
- Whether to port `extract_pdf_tables` / `extract_docx_tables` / `extract_pdf_images` / `extract_docx_images` into `LegacyExtractor` private methods or keep them as module-level helpers in `multimodal_service.py` and delegate.
- Whether `extract_and_store_*` get refactored to accept pre-extracted `list[TableData]` / `list[ImageData]` (recommended: no — defer to Phase 071).
- Choice of reference golden-fixture files (must be small + license-clean; synthetic-generated via `reportlab` + `python-docx` is acceptable).
- Float-rounding precision in golden fixtures (default 4 decimals; tighten if flakiness emerges).
- Exact wording of the D-PRD-07 AGPL appendix (~30-50 lines, matches existing D-PRD-NN style).

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:

- Refactoring `extract_and_store_*` to accept pre-extracted modality lists (Phase 071).
- Moving `extract_pdf_tables` etc. out of `multimodal_service.py` (Phase 071 or cleanup phase).
- Wrapping the other 7 MIME types in the new abstraction (re-open trigger: format-specific extractor demand).
- Per-document fallback + `POST /documents/{id}/reextract` (Phase 071 SC#3 / RAG-DOCLING-01).
- `pdf_extraction_runs` telemetry + `documents.extractor` column (Phase 071, migrations 039+040).
- `EXTRACTOR_PRIMARY` env var + admin engine-selection UI (Phase 071).
- PyMuPDF subprocess fence implementation (Phase 070 spike outcome / Phase 071).
- `pymupdf` or `docling` dependency adds (Phase 070 / Phase 071).
- Multimodal `_MAX_VISION_CALLS` / `_MAX_B64_BYTES` → `app_settings` (Phase 072 / RAG-MM-LIFT-01).
- Confidence threshold recalibration (Phase 076).
