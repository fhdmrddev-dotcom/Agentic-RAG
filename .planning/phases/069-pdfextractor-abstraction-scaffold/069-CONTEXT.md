# Phase 069: `PdfExtractor` Abstraction Scaffold - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Carve the current PDF + DOCX extraction pipeline (`pypdf` + `pdfplumber` + `python-docx`) behind a new `PdfExtractor` ABC in `backend/app/services/extraction_service.py`. The pipeline becomes pluggable so Phase 071 can swap in Docling (primary) + PyMuPDF (subprocess-fenced AGPL fallback) + pypdfium2 (last-resort fallback) without touching app code. **This is a pure-refactor seam phase — zero observable behavior change at the wire layer.** Same bytes in, same chunks/tables/images stored in DB, same `documents.full_markdown` text, same `document_tables` / `document_images` rows, same `query_tables` tool behavior (Phase 36).

The phase also closes Q-v2.6-06 by writing a `D-PRD-07` appendix entry in `.planning/prd-reset/DECISIONS.md` documenting the PyMuPDF AGPL posture + subprocess fence requirement, before the phase ships.

**What this phase does NOT do:**
- Add Docling, PyMuPDF, or pypdfium2 as dependencies. Phase 070 spikes httpx resolution; Phase 071 wires the new engines in.
- Touch the multimodal vision-API pipeline (`describe_image`, vision LLM call). The new `extract()` returns raw image dicts; vision description still happens downstream in `extract_and_store_images`.
- Change DB schemas. Migrations 039-044 belong to Phase 071, not here.
- Modify the other 7 formats that flow through `extract_text()` today (PPTX, XLSX, CSV, EPUB, text, markdown, HTML) — they stay in the existing switch.
- Change the `ingestion_step` status badge labels or ordering surfaced to the UI.
- Introduce per-document fallback, telemetry tables, or admin-tunable extractor config. All deferred to Phase 071.

</domain>

<decisions>
## Implementation Decisions

### `ExtractedDocument` shape (D-069-01)

- **D-069-01:** `ExtractedDocument` is a `@dataclass(frozen=True)` carrying today's wire fields verbatim. NOT a Pydantic model — per `CLAUDE.md` "use Pydantic for structured LLM outputs", this is internal plumbing not an LLM/API boundary. Phase 071 adds new fields (bbox, extractor, full_markdown distinction) when it actually needs them; this phase does not future-proof. The dataclass is the contract every future engine must satisfy.

```python
@dataclass(frozen=True)
class ExtractedDocument:
    text: str
    tables: list[TableData]
    images: list[ImageData]
    table_extraction_error: str | None = None
    image_extraction_error: str | None = None

@dataclass(frozen=True)
class TableData:
    page: int | None
    table_index: int
    headers: list[str]
    rows: list[list[str]]

@dataclass(frozen=True)
class ImageData:
    page: int | None
    image_index: int
    b64_png: str
    width: int
    height: int
```

### MIME-type scope (D-069-02)

- **D-069-02:** The `PdfExtractor` ABC seam wraps PDF + DOCX only. The other 7 formats currently handled by `extract_text()` in `backend/app/api/documents.py:45-127` (PPTX, XLSX, CSV, EPUB, text, markdown, HTML) stay in that switch unchanged. Rationale: those formats have no engine-swap planned — PPTX uses python-pptx, XLSX uses openpyxl, EPUB uses ebooklib, the rest are `bytes.decode()`. Wrapping them in an abstraction adds ceremony with zero accuracy benefit. The seam exists to swap engines for the formats where Docling and friends actually move the needle. Roadmap SC#1 names exactly these three libraries (pypdf, python-docx, pdfplumber).

### Default implementation packaging (D-069-03)

- **D-069-03:** One concrete class per engine; MIME dispatch lives inside each engine class. The ABC contract is:
  ```python
  class PdfExtractor(ABC):
      def supports(self, mime: str) -> bool: ...
      def extract(self, raw: bytes, mime: str) -> ExtractedDocument: ...
  ```
  Phase 069 ships exactly one concrete implementation: `LegacyExtractor` (supports PDF + DOCX; PDF route runs `pypdf` for text + `pdfplumber` for tables/images; DOCX route runs `python-docx` for text/tables/images). Phase 071 will add `DoclingExtractor` (PDF + DOCX), `PyMuPDFExtractor` (PDF only, subprocess-fenced), `Pypdfium2Extractor` (PDF only). Caller dispatches by asking each engine's `supports(mime)`; the matching engine runs. This matches how engines actually swap operationally — admins pick an engine, not a per-format mapping.

### Pass model (D-069-04)

- **D-069-04:** Single-pass `extract()` returns the full `ExtractedDocument` with `text + tables + images + per-modality error fields`. The caller (`backend/app/api/documents.py:ingest_document`) keeps owning the `ingestion_step` status-badge updates (`extracting → chunking → embedding → extracting_tables → extracting_images`) and decides what to do per modality (log + continue with empty list on tables/images error, matching today's silent-swallow behavior). Rationale: Docling parses a document once and returns text+tables+images structured; forcing a 2-pass ABC would make Phase 071's Docling integration parse the same PDF twice (wasted CPU + breaks Docling's structured-once model). Today's silent-swallow semantics survive as data on the return value instead of swallowed exceptions inside a separate call. **Text failures still raise** (kills the doc, matches today's behavior where `extract_text()` raising propagates to ingest's `except Exception`). **Tables/images failures populate the `_error` fields and return empty lists** (caller logs + continues, matching `multimodal_service`'s today behavior).

### Q-v2.6-06 AGPL appendix (D-069-05)

- **D-069-05:** Q-v2.6-06 is closed by a dedicated plan task inside Phase 069 that writes a D-PRD-07 appendix entry in `.planning/prd-reset/DECISIONS.md` covering:
  - PyMuPDF (`pymupdf>=1.24`) is AGPL-3.0
  - Per D-PRD-03 (closed core + open peripherals), AGPL cannot link into open peripherals (MCP server, SDKs)
  - Subprocess fence is the mechanism: PyMuPDF runs as a separate OS process, communicates over stdio/IPC. AGPL's network/linking trigger does not fire across a subprocess boundary.
  - In dev/personal-use today, AGPL acceptance is fine (no external network users)
  - Before any commercial redistribution that links PyMuPDF, either (a) keep the subprocess fence intact, or (b) acquire PyMuPDF Pro (commercial license — deferred to first paying customer per D-PRD-07).
  - This is documentation only — no code changes, no dependency adds. The fence implementation lands in Phase 071.

### Test strategy (D-069-06)

- **D-069-06:** "Zero behavior change" is proven by three layers, listed in binding-strength order:
  1. **Golden-output fixtures (binding gate):** One reference PDF + one reference DOCX committed to `backend/tests/fixtures/extraction/` (small, ~1-2 MB each, license-clean). Capture today's `LegacyExtractor.extract(raw, mime)` output as canonical JSON files. Two tests: `test_legacy_extractor_pdf_matches_golden` + `test_legacy_extractor_docx_matches_golden` assert post-refactor output equals golden JSON. Normalize floats (round to 4 decimals) + sorted keys to handle PDF non-determinism. **If golden tests pass, the refactor is byte-equivalent to today's pipeline.**
  2. **ABC contract unit tests:** `supports(mime)` returns true for PDF + DOCX and false for everything else; `extract()` on unsupported MIME raises a clean `ValueError`; empty-doc handling (empty PDF returns empty `ExtractedDocument`); error-field semantics (manually injected pdfplumber failure populates `table_extraction_error` and returns empty `tables` list, doesn't raise).
  3. **Existing integration tests stay green:** `backend/tests/integration/test_documents.py` (especially `test_ingest_stores_full_markdown`, `test_list_documents_includes_modal_counts`) and any `test_multimodal_*` tests run unchanged and pass.
  Manual UAT (uploading the user's reference thesis PDF + DOCX via Chrome MCP) is optional sanity check, not a binding gate.

### Plan ordering (advisory; gsd-planner finalizes)

ROADMAP allocates 2 plans to this phase. Given the scope (ABC + LegacyExtractor + ingest wiring + golden fixtures + AGPL appendix + ABC unit tests), suggested split:

1. **Plan 1 — Service module + ABC + LegacyExtractor + dispatch:** Create `backend/app/services/extraction_service.py` with the ABC, `ExtractedDocument` dataclass, `TableData`/`ImageData` dataclasses, `LegacyExtractor` concrete class (ports today's pypdf + pdfplumber + python-docx logic verbatim into class methods), and a small registry/dispatcher (`get_extractor(mime) -> PdfExtractor`). Rewire `backend/app/api/documents.py:ingest_document` to call the dispatcher for PDF/DOCX MIMEs and keep using `extract_text()` for the other 7 formats. Land all three test layers: golden fixtures (PDF + DOCX), ABC unit tests, existing integration tests stay green. This plan delivers SC#1 + SC#2 + SC#3 from ROADMAP.
2. **Plan 2 — Q-v2.6-06 AGPL appendix + DECISIONS.md update:** Add a "D-PRD-07 Appendix: PyMuPDF AGPL fallback license posture" section to `.planning/prd-reset/DECISIONS.md` per D-069-05. Documentation-only commit. This plan delivers SC#4 from ROADMAP.

### Claude's Discretion

- Exact naming of the dispatcher/registry function (`get_extractor` vs `select_extractor` vs `extractor_for`) — pick whatever reads best. The seam is what matters, not the verb.
- Whether `LegacyExtractor` lives in `extraction_service.py` directly or in a sibling `extraction/legacy.py` — likely one file for Phase 069 (small surface), Phase 071 can split into a subpackage if needed.
- Module-level helpers in `multimodal_service.py` (`extract_pdf_tables`, `extract_pdf_images`, `extract_docx_tables`, `extract_docx_images`) — port verbatim into `LegacyExtractor` private methods OR keep them where they are and have `LegacyExtractor` call them. The latter is smaller-diff; the former is cleaner long-term. Either is fine; pick smaller-diff during execution unless cleanup falls out cleanly.
- Whether `extract_and_store_tables` and `extract_and_store_images` in `multimodal_service.py` get refactored to take `ExtractedDocument` instead of `(raw, mime)` — sane to leave them as-is in Phase 069 (caller pulls tables/images from `ExtractedDocument` and passes them to existing helpers; helpers' signatures unchanged). Phase 071 can tighten.
- Choice of reference golden-fixture files — must be small + license-clean. Possible sources: public-domain sample PDFs (e.g., a short government doc), the existing `backend/tests/fixtures/` directory if it has PDFs/DOCX. If none exist, generate small synthetic ones with `reportlab` + `python-docx`. Files committed to `backend/tests/fixtures/extraction/`.
- Float-rounding precision in golden-fixture normalization — 4 decimals is the default. Tighten if flakiness emerges.
- Exact text of the D-PRD-07 appendix — match the style of existing D-PRD-NN entries in `DECISIONS.md`; ~30-50 lines.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 069's direct upstream artifacts

- `.planning/ROADMAP.md` §Phase 069 (lines 237-247) — Goal + 4 Success Criteria + 2-plan budget + Wave 0 dependency declaration.
- `.planning/PRDs/v2.6.md` §3 Theme A — RAG Quality Lift requirements; §5 Specs dep table (line 150 — `pymupdf>=1.24` AGPL note); §6 row 3 (subprocess fence implication); §12 Phase 069 row.
- `.planning/PRDs/v2.6.md` §13 Q-v2.6-06 (line 433) — closes via DECISIONS.md appendix before Phase 069 ships.
- `.planning/REQUIREMENTS.md` RAG-DOCLING-01 — verified at Phase 071, but Phase 069 is the structural prep.

### Locked decisions (already-decided context)

- `.planning/prd-reset/DECISIONS.md` D-PRD-03 — Closed core + open peripherals; AGPL must not link into open peripherals (informs subprocess-fence requirement).
- `.planning/prd-reset/DECISIONS.md` D-PRD-07 (lines 502-580) — Docling-first + PyMuPDF AGPL fallback behind PdfExtractor abstraction; PyMuPDF Pro deferred. **The Q-v2.6-06 appendix entry (D-069-05) attaches to this ADR.**
- `.planning/PROJECT.md` "Key context" — migration range 039-049 reserved (Phase 069 claims NONE).
- `CLAUDE.md` — "Use Pydantic for structured LLM outputs" (informs D-069-01 dataclass choice); "Python backend must use a venv virtual environment"; "Don't add features, refactor, or introduce abstractions beyond what the task requires" (informs scope discipline).

### Code surfaces touched by this phase

- `backend/app/api/documents.py:45-127` — current `extract_text()`. PDF + DOCX branches refactor to delegate to `LegacyExtractor` via dispatcher; other 7 format branches stay unchanged.
- `backend/app/api/documents.py:231` — `ingest_document` caller of `extract_text()` (upload path). Rewires for PDF/DOCX.
- `backend/app/api/documents.py:454` — `extract_text()` caller in re-ingest path. Rewires for PDF/DOCX.
- `backend/app/api/documents.py:623-718` — `ingest_document()` function body. `ingestion_step` ordering preserved verbatim; tables/images error handling preserved.
- `backend/app/services/multimodal_service.py:40-85` — `extract_pdf_tables` + `extract_docx_tables`. Keep as-is OR port into `LegacyExtractor` (Claude's discretion). If kept, `LegacyExtractor` imports + calls them.
- `backend/app/services/multimodal_service.py:88-126` — `extract_and_store_tables`. Signature unchanged; takes `(raw, mime, document_id, user_id, supabase)`. **Worth considering** a thin adapter that accepts pre-extracted `tables: list[TableData]` to avoid re-extraction; Phase 069 keeps existing call site working, refactor of `extract_and_store_*` deferred.
- `backend/app/services/multimodal_service.py:132-208` — `extract_pdf_images` + `extract_docx_images`. Same pattern as tables.
- `backend/app/services/multimodal_service.py:252-...` — `extract_and_store_images` (vision-LLM description). Unchanged behavior; receives image dicts, sends to vision model.

### New files this phase creates

- `backend/app/services/extraction_service.py` — `PdfExtractor` ABC + `ExtractedDocument` / `TableData` / `ImageData` dataclasses + `LegacyExtractor` concrete + `get_extractor(mime) -> PdfExtractor` dispatcher.
- `backend/tests/fixtures/extraction/` — directory for golden-output reference files.
- `backend/tests/fixtures/extraction/reference.pdf` + `reference.docx` — small license-clean docs.
- `backend/tests/fixtures/extraction/reference_pdf_golden.json` + `reference_docx_golden.json` — captured today's-output reference, normalized.
- `backend/tests/unit/test_extraction_service.py` — golden fixture tests + ABC contract tests (or split into two files; Claude's discretion).

### Files updated (documentation only, by Plan 2)

- `.planning/prd-reset/DECISIONS.md` — appends a "D-PRD-07 Appendix: PyMuPDF AGPL fallback license posture" entry.

### No backend DB changes, no frontend touches

- No new migrations. No `supabase/migrations/NNN_*.sql`.
- No `full-schema.sql` regen needed.
- No frontend files modified.
- No new env vars, no new `app_settings` keys, no new `user_settings` columns.

### Related but explicitly NOT touched this phase

- `backend/scripts/probe_multimodal.py` (probe_pypdf / probe_pdfplumber / probe_docling / probe_pymupdf) — exploratory script from SEED-006 work. Phase 070 (httpx spike) consumes/extends it; Phase 069 does not.
- `backend/app/services/embedding_service.py` (`chunk_text`, `embed_chunks`, `extract_metadata`) — unchanged; consumes the `text` field of `ExtractedDocument` exactly as it consumes `extract_text()` output today.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`extract_text()` PDF + DOCX branches at `backend/app/api/documents.py:45-52`** — these are the lines that move into `LegacyExtractor.extract()` PDF + DOCX routes. Pure logic; no DB calls; no side effects. Verbatim port.
- **`extract_pdf_tables()` / `extract_docx_tables()` at `backend/app/services/multimodal_service.py:40-85`** — pure functions returning `list[dict]`. Either ported into `LegacyExtractor` private methods or kept where they are and called from `LegacyExtractor` (Claude's discretion). Already module-level and patchable from tests — that pattern survives.
- **`extract_pdf_images()` / `extract_docx_images()` at `backend/app/services/multimodal_service.py:132-208`** — same pattern. Pure-function image-dict producers.
- **`_MAX_VISION_CALLS` (line 29) + `_MAX_B64_BYTES` (line 33)** — module-level constants. NOT touched this phase. Phase 072 (RAG-MM-LIFT-01) will move these to `app_settings`; Phase 069 leaves them in place.
- **`extract_and_store_tables` / `extract_and_store_images`** — caller-facing functions in `multimodal_service.py`. Signatures preserved this phase; called from `documents.py:700-703` exactly as today.

### Established Patterns

- **`from __future__ import annotations`** — used throughout `multimodal_service.py`. Apply to `extraction_service.py` too.
- **`TYPE_CHECKING` guard for type-only imports** — pattern in `multimodal_service.py:20-21`. Apply if needed.
- **Lazy-imported heavy deps inside functions** — `import pdfplumber` lives inside `extract_pdf_tables` not at module top (line 42). Apply same pattern in `LegacyExtractor` methods to keep `extraction_service.py` import-cheap.
- **Silent-swallow on tables/images errors** — `extract_and_store_*` wrap everything in `try/except` and `log.warning`. In Phase 069, the silent-swallow shifts location: `LegacyExtractor.extract()` catches per-modality errors, populates `*_error` fields, returns empty lists. Caller (`ingest_document`) sees the error fields and decides to log + continue. Net behavior identical.
- **Module-level patchable helpers** — `multimodal_service.py` tests patch `extract_pdf_tables` directly. Keep this pattern: `LegacyExtractor` methods that delegate to module-level helpers stay test-friendly.
- **Pydantic only at I/O boundaries** — confirmed by `CLAUDE.md` and the existing codebase. Internal `ExtractedDocument` is `@dataclass`.

### Integration Points

- **Dispatcher entry: `get_extractor(mime: str) -> PdfExtractor`** in `extraction_service.py`. Called from `documents.py` in two places (upload + reextract paths). For non-PDF/DOCX MIMEs, returns `None` and caller falls back to `extract_text()` switch.
- **`ingest_document()` orchestration unchanged shape** — text → chunk → embed → tables → images. Just the *source* of text/tables/images changes from "three separate calls" to "one `ExtractedDocument`". Status-badge sequence verbatim.
- **`ExtractedDocument.text` flows into `chunk_text(text)`** — same string the current `extract_text()` returns.
- **`ExtractedDocument.tables` / `.images`** — converted to the dict shape that `extract_and_store_tables` / `extract_and_store_images` expect. Today these functions extract internally from raw bytes; in Phase 069 we either (a) keep calling them with raw bytes (smaller diff — they re-extract, wasteful but identical behavior; the golden-fixture test then asserts the *dispatcher's* output matches today's `extract_pdf_tables` output, and we accept the duplicate extraction inside the multimodal helpers for one phase) OR (b) refactor `extract_and_store_*` to accept pre-extracted lists. **Recommend (a) for diff minimization** and tighten in Phase 071 when Docling makes (b) natural.
- **Existing integration test surface** — `backend/tests/integration/test_documents.py::test_ingest_stores_full_markdown` (line ~397) is the safety-net assertion that the end-to-end ingest path still works. Stays green is binding.

### Phase 32.5 chunking pipeline interaction

- **`chunk_text` / `embed_chunks` / `extract_metadata`** at `backend/app/services/embedding_service.py` — these are pure consumers of the `text` string. Phase 069 produces the exact same `text` string they consume today. Phase 32.5's confidence recalibration + context-embeddings work is upstream of any extractor change — untouched.

</code_context>

<specifics>
## Specific Ideas

- **"Zero behavior change" is the binding promise.** The golden fixtures are the binding gate (D-069-06). If they pass, the refactor is byte-equivalent. If they fail, fix the refactor — do not edit the fixtures unless a normalization issue (float precision, dict ordering) is identified and documented in the test.
- **One concrete extractor in Phase 069.** No `DoclingExtractor`, no `PyMuPDFExtractor` skeletons, no placeholder classes. The ABC + `LegacyExtractor` + dispatcher are sufficient to prove the seam works. Phase 071 fills in the other engines.
- **`get_extractor(mime)` returns `None` for non-PDF/DOCX MIMEs.** The caller checks for `None` and falls back to the existing `extract_text()` switch. Do NOT register a `LegacyTextExtractor` for the other 7 formats — that's the scope-creep version of D-069-02.
- **Q-v2.6-06 is documentation-only.** Plan 2 writes the appendix; no code in Plan 2. No subprocess fence implementation, no PyMuPDF dependency add, no test changes from Plan 2.
- **No LangChain, no LangGraph** — project rule from `CLAUDE.md`. The new `extraction_service.py` uses pypdf / pdfplumber / python-docx directly. (This rule has nothing to enforce here but worth a glance during review.)
- **License-clean fixture sources** — public-domain government docs, a generated synthetic PDF, or an OK-to-redistribute permissively-licensed sample. Don't commit a copyrighted PDF for tests.
- **The dispatcher is the swap point for Phase 071.** When Phase 071 lands, `get_extractor(mime)` becomes the place that consults `EXTRACTOR_PRIMARY` env var / `app_settings` and picks the right engine. Phase 069 just hardcodes `LegacyExtractor`. The shape lets Phase 071 add config-reading without touching app code.

</specifics>

<deferred>
## Deferred Ideas

- **Refactoring `extract_and_store_tables` / `extract_and_store_images` to accept pre-extracted `list[TableData]` / `list[ImageData]`** — would eliminate the duplicate extraction (once inside `LegacyExtractor`, once inside `extract_and_store_*`). Deferred to Phase 071. Re-open trigger: when Docling's structured output makes the refactor natural; Phase 071 plans this anyway.

- **Moving `extract_pdf_tables` / `extract_docx_tables` / `extract_pdf_images` / `extract_docx_images` out of `multimodal_service.py` and into `extraction_service.py`** — cleaner long-term ownership. Deferred to keep Phase 069 diff-minimal. Re-open trigger: Phase 071 file-organization pass, or a separate cleanup phase if `multimodal_service.py` keeps accumulating responsibilities.

- **Wrapping the other 7 MIME types (PPTX/XLSX/CSV/EPUB/text/markdown/HTML) in the new abstraction** — no engine swap planned for any of these. If a future phase decides Docling-for-PPTX is worth it, add `PptxExtractor` then. Re-open trigger: a quality complaint about PPTX/XLSX extraction, or a vertical pack (legal/finance) that needs format-specific extractors.

- **Per-document fallback (`POST /documents/{id}/reextract` with engine override)** — owned by Phase 071 SC#3 (RAG-DOCLING-01). Out of scope for Phase 069.

- **`pdf_extraction_runs` telemetry table + `documents.extractor` column** — migrations 039 + 040, owned by Phase 071. Out of scope for Phase 069. The `LegacyExtractor` would not be writing telemetry here even if the table existed.

- **`EXTRACTOR_PRIMARY` env var + admin settings UI for engine selection** — owned by Phase 071. The dispatcher's seam supports it; Phase 069 hardcodes `LegacyExtractor`.

- **Subprocess fence implementation for PyMuPDF** — owned by Phase 071 (or Phase 070 if the spike chooses option (c) subprocess isolation). Phase 069 only documents the requirement; no code.

- **`pymupdf` or `docling` dependency added to `requirements.txt`** — owned by Phase 070 (httpx spike outcome) and/or Phase 071 (engine wire-in). Phase 069 adds zero new Python deps.

- **Multimodal `_MAX_VISION_CALLS` / `_MAX_B64_BYTES` moving to `app_settings`** — owned by Phase 072 (RAG-MM-LIFT-01). Out of scope for Phase 069.

- **Confidence threshold recalibration** — owned by Phase 076. Out of scope.

</deferred>

---

*Phase: 069-pdfextractor-abstraction-scaffold*
*Context gathered: 2026-05-13*
