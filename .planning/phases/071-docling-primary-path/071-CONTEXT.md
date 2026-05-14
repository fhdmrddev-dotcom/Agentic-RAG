# Phase 071: Docling Primary Path - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Plug **Docling** (in-process per D-v2.6-01 / Phase 070 spike outcome) into the existing `PdfExtractor` ABC seam (Phase 069) as the **primary** PDF + DOCX engine. Ship **PyMuPDF** as the per-document **opt-in fallback**, isolated behind an AGPL subprocess fence per D-PRD-07 + D-PRD-07 Appendix. Land migrations 039–044 (telemetry table + extractor lineage columns + image/table bbox + dedup index + multimodal app_settings keys). Expose `POST /documents/{id}/reextract` so a single problematic document can be re-extracted with an explicit engine override without flipping the global default. Goal anchor: close the user-observed **5/4 vs 50+/0 PDF/DOCX inconsistency** on the reference thesis pair (`551f03f9-...`) within a **20% delta** on table + image counts.

The phase is the load-bearing payoff of the Phase 069 ABC seam — Docling and PyMuPDF plug in via `get_extractor(mime)`; today's `LegacyExtractor` stays available as an escape hatch.

**What this phase does NOT do:**

- Lift `_MAX_VISION_CALLS` / `_MAX_B64_BYTES` ceilings or move them to `app_settings` (RAG-MM-LIFT-01 → **Phase 072**).
- Replace `inline_shapes` with `doc.part.related_parts` walk for DOCX floating shapes / header images (RAG-MM-LIFT-02 → **Phase 072**).
- Recalibrate confidence thresholds for Docling-extracted chunk distributions (RAG-RECAL-01, Q-v2.6-03 → **Phase 076**).
- Auto-re-extract existing documents on deploy (rejected per Q-v2.6-04 — opt-in only via `/reextract`).
- Ship `Pypdfium2Extractor` (PRD §5 last-resort tier — deferred until production telemetry shows the third tier is needed; ROADMAP SC#3 names PyMuPDF, not pypdfium2).
- Build admin UI for engine selection or batch re-extract (v3.1 admin shell territory).
- Touch `documents.version_number` on `/reextract` (engine swap is NOT a source-bytes change — versioning was designed for the latter; D-25 contract preserved).
- Bump `supabase`, `httpx`, or `docling` pins (D-v2.6-01 / D-070-14 regression-guardrail in `requirements.txt` are inherited verbatim — bumping past these tripwires the binding CI test).
- Pre-warm Docling at FastAPI lifespan startup (deferred to v3.1 admin shell + healthcheck gate).
- Build a bounded thread-pool / proper ingestion queue for concurrent Docling extracts (proper queue is v3.4 Automations per SEED-001).
- Implement auto-fallback from Docling → PyMuPDF on Docling exceptions (deferred until production data shows what error classes warrant it; `/reextract` is the opt-in surface).

</domain>

<decisions>
## Implementation Decisions

### PyMuPDF subprocess fence (AGPL isolation per D-PRD-07 Appendix)

- **D-071-01:** **IPC = stdin binary + stdout JSON.** Parent writes raw PDF bytes to child's stdin (no b64 bloat); child reads `sys.stdin.buffer.read()`; mime + opts via argv (e.g., `python -m extractors.pymupdf_isolated --mime application/pdf`). Child writes `ExtractedDocument` as JSON on stdout (images b64-encoded inside the JSON). Stderr reserved for diagnostic logs. No pickle (RCE surface), no temp files (cleanup hygiene).

- **D-071-02:** **Spawn-per-extract.** `subprocess.run(["python", "-m", "extractors.pymupdf_isolated", "--mime", mime], input=raw_pdf, capture_output=True, timeout=PYMUPDF_TIMEOUT_S, check=False)`. ~50–100ms fork overhead per call is acceptable because PyMuPDF is opt-in fallback (rare). No persistent worker pool / no session management. Resurrect persistent pool only if PyMuPDF ever becomes the hot path.

- **D-071-03:** **Hard timeout, single attempt, fail loud.** `PYMUPDF_TIMEOUT_S` env var, default `60`. On timeout: `subprocess.TimeoutExpired` → SIGKILL child → raise `ExtractionError("pymupdf timed out after Ns")`. On non-zero exit: capture last line of stderr → raise. Caller sees the same exception shape as today's pdfplumber errors (`status='failed'`, `error_message` populated). User retries via `/reextract` with `engine=docling` or different file. NO retry-then-fail loop, NO soft-fail returning empty `ExtractedDocument` (would silently ingest empty docs as `status='completed'`).

- **D-071-04:** **Child entrypoint location:** `backend/extractors/pymupdf_isolated.py` — top-level package, NOT under `backend/app/`. Invoked as `python -m extractors.pymupdf_isolated`. Structural separation (the AGPL `import fitz` lives outside the FastAPI app package); makes the legal fence visible at the file-tree level, not just by convention. PyMuPDF Pro upgrade (D-PRD-07 Appendix, post-paying-customer) drops into the same module without touching `app/`.

### Docling invocation inside FastAPI (in-process per D-v2.6-01)

- **D-071-05:** **Model artifact = lazy on first extract.** Docling auto-downloads its ~600 MB model bundle to `~/.cache/docling` on the first `DocumentConverter().convert()` call. First user-facing extract is slow (~1–2 min); subsequent are normal. Production runbook gets a one-line "pre-pull" command (run a tiny convert at deploy time) so first real extract is warm. Zero startup-time tax in dev. (Pre-warm at lifespan startup deferred to v3.1 admin shell + readiness probe.)

- **D-071-06:** **`DocumentConverter()` lifecycle = module-level singleton, lazy-instantiated, thread-safe.** Pattern in `backend/app/services/extractors/docling.py` (or wherever the `DoclingExtractor` class lives):
  ```python
  _CONVERTER: "DocumentConverter | None" = None
  _CONVERTER_LOCK = threading.Lock()

  def _get_converter() -> "DocumentConverter":
      global _CONVERTER
      if _CONVERTER is None:
          with _CONVERTER_LOCK:
              if _CONVERTER is None:
                  from docling.document_converter import DocumentConverter
                  _CONVERTER = DocumentConverter()
      return _CONVERTER
  ```
  One model load per worker process; reused for all subsequent extracts. Docling 2.x documents `DocumentConverter` as thread-safe.

- **D-071-07:** **Async wrapping = none.** `DoclingExtractor.extract()` is plain sync. `ingest_document` already runs in `BackgroundTasks` (FastAPI threadpool, not the async event loop) — calling Docling sync there is correct and matches today's pypdf invocation pattern. CLAUDE.md D-v2.5-01 ("no blocking I/O in async handlers") applies to *async handlers*; sync functions in threadpool are fine. If a future async caller invokes the extractor directly (not via BackgroundTasks), wrap with `anyio.to_thread.run_sync` at the **caller**, not inside the extractor — keeps the ABC contract uniformly synchronous.

- **D-071-08:** **`ExtractedDocument` shape extension.** Add **optional** new fields to the existing dataclass (Phase 069 D-069-01) so `LegacyExtractor` keeps producing byte-identical output and its golden tests stay green:
  ```python
  @dataclass(frozen=True)
  class ExtractedDocument:
      text: str
      tables: tuple[TableData, ...]
      images: tuple[ImageData, ...]
      table_extraction_error: str | None = None
      image_extraction_error: str | None = None
      full_markdown: str | None = None        # NEW — Docling populates; Legacy returns None
      extractor_name: str | None = None       # NEW — 'docling' | 'pymupdf' | 'pypdf-legacy'

  @dataclass(frozen=True)
  class TableData:
      page: int | None
      table_index: int
      headers: list[str]
      rows: list[list[str]]
      bbox: dict | None = None                # NEW — {x0, y0, x1, y1, page} when source provides spatial coords

  @dataclass(frozen=True)
  class ImageData:
      page: int | None
      image_index: int
      b64_png: str
      width: int
      height: int
      bbox: dict | None = None                # NEW
  ```
  - `extractor_name` flows into `documents.extractor` (migration 040) and `pdf_extraction_runs.engine` (migration 039) and `document_tables.extractor` (migration 042).
  - `bbox` flows into `document_images.bbox` (migration 041) and `document_tables.bbox` (migration 042) — JSONB; null when source is `LegacyExtractor`.
  - `full_markdown` flows into `documents.full_markdown` when produced by Docling (today this column is populated by joining `chunks` text; Docling's structured markdown output is higher fidelity).

### `POST /documents/{id}/reextract` API + dispatch + auto-fallback

- **D-071-09:** **Separate endpoint** `POST /documents/{id}/reextract`. Body: `{engine: "docling" | "pymupdf" | "legacy"}` (required; reject `400` on missing/invalid value). Returns **202 Accepted** with the document row. Distinct from existing `POST /documents/{id}/reingest` (which re-runs the global-default extractor — now Docling — without an engine override). Matches PRD §5 line 176 verbatim. Auth: existing RLS — owner-only, like `/reingest`.

- **D-071-10:** **Existing data handling = hard delete + replace.** When `/reextract` runs:
  1. `DELETE FROM document_chunks WHERE document_id = ?`
  2. `DELETE FROM document_tables WHERE document_id = ?`
  3. `DELETE FROM document_images WHERE document_id = ?`
  4. `UPDATE documents SET status='pending', extractor=NULL, ingestion_step=NULL`
  5. Queue `BackgroundTasks.add_task(ingest_document, ...)` with the chosen engine forced via a new `engine_override` kwarg.
  6. New `pdf_extraction_runs` row inserted at the end of extraction with the new engine + counts.
  Vector embeddings get fully regenerated. `documents.version_number` is **NOT** bumped (engine swap is not a source-bytes change; D-25 versioning contract preserved). Soft-replace (with `version_number+1`) was rejected — doubles storage + diverges from D-25 semantics.

- **D-071-11:** **Docling-failure policy = fail loud, no auto-fallback.** If `DoclingExtractor.extract()` raises during the upload path or `/reextract` path: caller (`ingest_document`) catches at its existing `try/except Exception` (`backend/app/api/documents.py:724-729`), sets `status='failed'`, populates `error_message`. Telemetry row inserted into `pdf_extraction_runs` with `error` populated. User sees the failed doc in UI; can hit `/reextract` with `engine=pymupdf` to retry on the fence. Auto-fallback (silent) was rejected:
  - hides quality regressions (user thinks doc ingested cleanly when actually fallback engine was used);
  - debugging harder (which engine produced these bad chunks?);
  - billing cost profile differs (PyMuPDF subprocess fork overhead × auto-trigger frequency).
  Whitelist-based partial auto-fallback (only on `DoclingPDFCorruptError`-class exceptions) deferred until production telemetry shows what error classes warrant it.

- **D-071-12:** **Engine selection = `EXTRACTOR_PRIMARY` env var, default `'docling'`.** `get_extractor(mime, engine_override=None)` reads `os.getenv("EXTRACTOR_PRIMARY", "docling")` at module top (cached after first read), accepts `engine_override` kwarg from `/reextract` callers. Valid values: `'docling' | 'pymupdf' | 'legacy'`. Invalid env value → log warning + fall through to `'docling'`. `LegacyExtractor` stays registered as `'legacy'` indefinitely (pure Python escape hatch — no AGPL, no model download, no httpx surface). `app_settings`-driven extractor pick deferred to v3.1 admin shell.

### Scope locks (must lock before this phase ships)

- **D-071-13:** **Q-v2.6-04 LOCKED → option (b)** — opt-in re-extraction via `POST /documents/{id}/reextract` per-document. NO auto-re-extract on deploy (rejected per PRD §13: "would regenerate all chunk embeddings + vision-LLM calls cost-uncapped"). NO defer-to-v3.1 (rejected: loses per-document fallback story). One-time migration backfills `documents.extractor='pypdf-legacy'` for existing rows but does NOT trigger re-extraction. New uploads default to `EXTRACTOR_PRIMARY='docling'`. **Key Decisions row appended to PROJECT.md as part of Plan 4 Task close** (`D-v2.6-04` row referencing this CONTEXT.md and the `/reextract` endpoint).

- **D-071-14:** **Pypdfium2Extractor deferred** to a follow-up polish phase. ROADMAP SC#3 binding requirement is PyMuPDF as the named fallback engine. PRD §5 lists pypdfium2 as "license-safe last-resort fallback" — needed only if BOTH Docling and PyMuPDF fail on the same doc. Add only when production telemetry shows the third tier is needed. **Re-open trigger:** post-launch incident where a PDF class fails Docling AND PyMuPDF fence both; re-open as a polish phase with the wrapper class + tests (no AGPL fence — pypdfium2 is Apache 2.0).

### SC#1 verification (binding gate for "within 20% delta on reference thesis pair")

- **D-071-15:** **Live UAT against the user's real Supabase** is the binding SC#1 gate. The reference thesis (doc id `551f03f9-...`) lives in the user's local + cloud Supabase from earlier work. Verification protocol (lands as Plan 4 task + `071-VERIFICATION.md`):
  1. Re-ingest both the PDF and DOCX siblings via `POST /reextract` with `engine=docling`.
  2. Query `SELECT count(*) FROM document_tables WHERE document_id = '<pdf>'` and same for DOCX; same for `document_images`.
  3. Assert `abs(pdf_count - docx_count) / max(pdf_count, docx_count) <= 0.2` for both tables and images.
  4. Capture before/after counts in `071-VERIFICATION.md` with the actual numbers (Phase 069 baseline: PDF tables=5/images=4, DOCX tables=50+/images=0).
  Driven via Chrome MCP per memory `feedback_chrome_mcp_testing.md` — drives a real browser to upload + verify counts in the documents list, augmented by direct SQL via Supabase Studio. **No fixture committed** — the thesis is copyrighted; cannot redistribute.

- **D-071-16:** **Synthetic CI fixture is additive, NOT the binding gate.** Generate a multi-column license-clean academic-style PDF + sibling DOCX (reportlab + python-docx, ~5 tables + 5 embedded images) committed to `backend/tests/fixtures/extraction/academic_synth.{pdf,docx}`. New pytest at `backend/tests/integration/test_docling_extractor.py` asserts `DoclingExtractor.extract()` produces ≥ N tables and ≥ M images on each sibling. Provides a regression net + reproducible CI signal but does NOT close SC#1 by itself (synthetic doc may not exercise the real Docling/pdfplumber diff that surfaced on the thesis).

### Plan-budget split (advisory; gsd-planner finalizes)

ROADMAP allocates **4 plans**. Suggested split:

1. **Plan 01 — Schema + migrations + telemetry plumbing.** Migrations `039_pdf_extraction_runs.sql`, `040_documents_extractor_column.sql`, `041_document_images_bbox.sql`, `042_document_tables_bbox_extractor.sql`, `043_documents_dedup_unique_index.sql`, `044_app_settings_multimodal_limits.sql` (the last mostly defines columns + reader hookup; the actual ceiling lift is Phase 072). One-time backfill: `UPDATE documents SET extractor = 'pypdf-legacy' WHERE extractor IS NULL`. RLS for `pdf_extraction_runs` keyed on `user_id` via FK. **Apply each via Supabase SQL editor per CLAUDE.md rule, regen `full-schema.sql` per memory `feedback_regen_full_schema_no_reset.md`, commit both.** Delivers SC#2 partial (column populated for new ingests + backfill done) + SC#4 (pdf_extraction_runs table exists).

2. **Plan 02 — DoclingExtractor + dispatcher rewire + ExtractedDocument extension + telemetry writes.** Add `backend/app/services/extractors/docling.py` (`DoclingExtractor(PdfExtractor)` class with module-level singleton converter per D-071-06). Extend `ExtractedDocument` / `TableData` / `ImageData` per D-071-08. Update `get_extractor(mime, engine_override=None)` to read `EXTRACTOR_PRIMARY` + accept the override. Wire `pdf_extraction_runs` insert into `ingest_document` after extract completes (engine, duration_ms, table_count, image_count, error). Update Phase 069 golden tests' `ExtractedDocument` instantiation to pass `extractor_name='pypdf-legacy'` for backward compat (or default to None if cleaner). Add `backend/tests/integration/test_docling_extractor.py` (synthetic fixture per D-071-16). Delivers SC#1 partial (extractor wired) + SC#2 (extractor column populated + bbox columns populated by Docling output) + SC#4 (telemetry writes).

3. **Plan 03 — PyMuPDF subprocess fence.** Add `backend/extractors/__init__.py` + `backend/extractors/pymupdf_isolated.py` (child entrypoint, reads stdin binary + writes stdout JSON, imports `fitz` at module top). Add `backend/app/services/extractors/pymupdf.py` (`PyMuPDFExtractor(PdfExtractor)` parent wrapper that invokes the child subprocess per D-071-01..03). Add `pymupdf>=1.24` to `backend/requirements.txt` with the AGPL comment block referencing D-PRD-07 Appendix. Add `PYMUPDF_TIMEOUT_S` to `backend/.env.example` with documentation. Add unit tests for both the child entrypoint (run as subprocess in test) and the parent wrapper (mock subprocess.run). Delivers SC#3 partial (PyMuPDF available via `engine=pymupdf`) + AGPL fence verifiable.

4. **Plan 04 — `POST /reextract` endpoint + Q-v2.6-04 lock + Chrome MCP UAT + 071-SUMMARY.** Add `POST /documents/{id}/reextract` route in `backend/app/api/documents.py` (per D-071-09..10 — owner-only RLS, hard delete + replace, returns 202). Add `engine_override` kwarg to `ingest_document`. Append D-v2.6-04 closure row to `.planning/PROJECT.md` Key Decisions table referencing this CONTEXT.md. Run live UAT against `551f03f9-...` per D-071-15; capture counts in `071-VERIFICATION.md`. Author `071-SUMMARY.md`. Delivers SC#1 (binding 20%-delta gate) + SC#3 (`/reextract` returns 202 + queues task) + SC#5 (Q-v2.6-04 locked).

Wave order: Plan 01 first (schema must land before Plans 02/03 write columns); Plans 02 and 03 parallelizable; Plan 04 depends on all three.

### Claude's Discretion

- Exact `DocumentConverter()` constructor options (e.g., `pipeline_options` for OCR enable/disable) — pick docling 2.x defaults unless the synthetic fixture surfaces obvious gaps; surface to user only if non-default settings would visibly help SC#1.
- Whether `DoclingExtractor` lives in `extraction_service.py` or a sibling `extractors/docling.py` subpackage — recommend subpackage (per Plan 02 split above) once ≥ 3 engines exist; one-file is fine if it stays compact.
- Exact `pdf_extraction_runs` write timing — recommend "insert at end with full row" (atomic, no half-rows on crash); alternative is "insert at start with partial row, UPDATE at end" (visible-while-running but adds an UPDATE).
- How `bbox` JSON is shaped exactly (`{x0, y0, x1, y1, page}` vs Docling's native `BoundingBox.export_to_dict()`) — pick what Docling provides natively; downstream consumers (vector-search highlighting in v3.x) will adapt.
- Exact text of the `D-v2.6-04` row in PROJECT.md — match existing `D-v2.6-01` row style (rationale + outcome columns).
- Whether `PyMuPDFExtractor.supports(mime)` returns True for both PDF and DOCX or only PDF — PyMuPDF supports both via different code paths in `fitz`; recommend PDF-only for v2.6 (DOCX path through PyMuPDF is rarely better than python-docx) unless real-world data argues otherwise.
- Whether `LegacyExtractor` gets a `extractor_name='pypdf-legacy'` field set explicitly in its return value (vs leaving it None and inferring at the writer) — recommend explicit for clarity.
- Whether to add a `--no-docling` env switch for test environments where the 600 MB model download is undesirable (Phase 069 test fixtures do NOT need Docling) — recommend YES, treat absent docling import as a graceful "engine unavailable" rather than ImportError.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 071's direct upstream artifacts

- `.planning/ROADMAP.md` §Phase 071 (lines 277-287) — Goal + 5 Success Criteria + 4-plan budget + dependency on Phase 070.
- `.planning/PRDs/v2.6.md` §3 Theme A (RAG Quality lift) + §4 RAG-DOCLING-01 acceptance (line 86) + §5 (deps + migrations 039–044, env vars `EXTRACTOR_PRIMARY` / `EXTRACTOR_DOCLING_ISOLATION`, `POST /reextract` route at line 176) + §6 row 3 (Docling primary path conflict mitigation) + §7 (scalability bounds — Docling CPU-bound at 10x users) + §13 Q-v2.6-04 (re-extraction policy lock at line 434).
- `.planning/REQUIREMENTS.md` RAG-DOCLING-01 (line 16) — owning REQ-ID for SC#1.

### Locked decisions (already-decided context — do NOT re-litigate)

- `.planning/PROJECT.md` Key Decisions table — **D-v2.6-01** (Phase 070 closure: supabase 2.29.0, httpx 0.28.x, docling 2.93.0 pinned; D-070-14 regression-guardrail comment in `requirements.txt` names `test_pdf_extractor_docling_compat.py` as binding gate). **Bumping these pins past their tripwires within Phase 071 is OUT OF SCOPE.**
- `.planning/PROJECT.md` Key Decisions table — D-v2.5-01 (`run_in_threadpool` rule), D-v2.5-02 (single uvicorn worker — still in force at 071), D-v2.5-12 (messages.confidence_* schema preserved).
- `.planning/prd-reset/DECISIONS.md` D-PRD-03 — closed core + open peripherals (informs why subprocess fence is required for AGPL).
- `.planning/prd-reset/DECISIONS.md` D-PRD-07 (Docling-first + PyMuPDF AGPL fallback) + **D-PRD-07 Appendix** (PyMuPDF AGPL subprocess-fence contract — locked in Phase 069 Plan 02). The fence contract this phase implements.
- `.planning/phases/070-docling-httpx-spike/070-SUMMARY.md` — Path (a) win narrative, rejected paths matrix, regression gate.
- `.planning/phases/070-docling-httpx-spike/070-CONTEXT.md` — D-070-01..15 context for spike scope (070 stops at "we can import + invoke `DocumentConverter`"; 071 owns `class DoclingExtractor`).
- `.planning/phases/069-pdfextractor-abstraction-scaffold/069-CONTEXT.md` — D-069-01..06 context for the ABC contract (`ExtractedDocument` shape, single-pass extract, silent-swallow for tables/images, module-level patchable helpers in `multimodal_service.py`).
- `.planning/phases/069-pdfextractor-abstraction-scaffold/deferred-items.md` — latent DOCX `CT_Blip.part` API change + pdfplumber `UnidentifiedImageError` on ReportLab streams. **Both should be organically subsumed by Docling.** If Plan 02's synthetic fixture or Plan 04's live UAT surfaces them as still-broken under Docling, surface to user before closing.
- `CLAUDE.md` — venv mandatory; no LangChain / no LangGraph; D-v2.5-01 (no blocking I/O in async handlers); migration application via Supabase SQL editor (not `db push`/`db reset`); `bash scripts/regenerate-full-schema.sh` after each migration; Realtime is hint not source-of-truth.

### Code surfaces touched by this phase

- `backend/app/services/extraction_service.py` — extend `ExtractedDocument` / `TableData` / `ImageData` per D-071-08; extend `get_extractor(mime, engine_override=None)` to read `EXTRACTOR_PRIMARY` + accept override per D-071-12; register Docling/PyMuPDF/Legacy with the dispatcher.
- `backend/app/services/extractors/docling.py` — **NEW** (Plan 02). `class DoclingExtractor(PdfExtractor)` + module-level converter singleton per D-071-06.
- `backend/app/services/extractors/pymupdf.py` — **NEW** (Plan 03). `class PyMuPDFExtractor(PdfExtractor)` parent wrapper; invokes the subprocess child per D-071-01..03.
- `backend/extractors/__init__.py` + `backend/extractors/pymupdf_isolated.py` — **NEW** (Plan 03). Top-level package outside `app/`. Child entrypoint per D-071-04. `import fitz` lives ONLY here.
- `backend/app/api/documents.py:226-239` (upload extract path) + `backend/app/api/documents.py:456-467` (`/reingest` extract path) — already route through `get_extractor(mime)`; no change needed beyond the dispatcher returning the new engines.
- `backend/app/api/documents.py:634-729` (`ingest_document`) — accept new `engine_override` kwarg; forward to dispatcher; insert `pdf_extraction_runs` row after extract; update `documents.extractor` column.
- `backend/app/api/documents.py:427+` — **NEW route** `POST /documents/{id}/reextract` per D-071-09..10 (sibling of existing `/reingest`).
- `backend/app/services/multimodal_service.py:40-208` — module-level `extract_pdf_tables` / `extract_docx_tables` / `extract_pdf_images` / `extract_docx_images` are still consumed by `LegacyExtractor` per Phase 069 D-069-03. **Not modified by Phase 071** (the multimodal ceiling lift + `related_parts` walk is Phase 072).
- `backend/scripts/probe_multimodal.py:184-200, 256-292` — already has `probe_docling()` with `from docling.document_converter import DocumentConverter`. **Reference implementation** for Plan 02; reuse the import line.
- `backend/requirements.txt` — Plan 03 adds `pymupdf>=1.24` + AGPL comment block referencing D-PRD-07 Appendix. **Do NOT touch the existing supabase/httpx/docling pin lines (D-v2.6-01 / D-070-14 guardrail).**
- `backend/.env.example` — Plan 03 adds `PYMUPDF_TIMEOUT_S=60` + brief comment; Plan 02 adds `EXTRACTOR_PRIMARY=docling` + brief comment; do NOT add `EXTRACTOR_DOCLING_ISOLATION` (path (c) was rejected — env var would document an unused knob, see Phase 070 D-070-15 + Plan 02 Task 4 skip note).

### New migrations (apply via Supabase SQL editor per CLAUDE.md rule, regen full-schema.sql, commit both)

- `supabase/migrations/039_pdf_extraction_runs.sql` — telemetry table; columns per PRD §5 line 136; RLS via FK `documents.user_id`.
- `supabase/migrations/040_documents_extractor_column.sql` — add `extractor text` (nullable, default `'docling'` for new rows); one-time backfill `UPDATE documents SET extractor = 'pypdf-legacy' WHERE extractor IS NULL`.
- `supabase/migrations/041_document_images_bbox.sql` — add `bbox jsonb`.
- `supabase/migrations/042_document_tables_bbox_extractor.sql` — add `bbox jsonb` + `extractor text`.
- `supabase/migrations/043_documents_dedup_unique_index.sql` — partial unique index `(user_id, content_hash, folder_id) WHERE status != 'failed'` per CQ-DEDUP-01. Migration includes one-time DELETE of pre-existing duplicates BEFORE the CREATE INDEX (PRD §6 row 8 mitigation). **NOTE:** CQ-DEDUP-01 is technically a separate v2.6 requirement — bundling with this phase since the migration slot was reserved here. Surface to user if execution surfaces unexpected scope drag.
- `supabase/migrations/044_app_settings_multimodal_limits.sql` — add `multimodal_max_vision_calls int default 100` + `multimodal_max_b64_bytes_kb int default 4096` columns; **wires `models/user_settings.py` reader to consult them** (current `app_settings` table is dead code per CONCERNS.md:520-524). Phase 072 then actually USES these settings to lift the ceiling. Phase 071 lays the table contract; Phase 072 lifts the constants.

### New API routes

- `POST /documents/{id}/reextract` — body `{engine: "docling" | "pymupdf" | "legacy"}`, returns 202 + document row. Owner-only RLS. Per D-071-09..11.

### New env vars

- `EXTRACTOR_PRIMARY` — `docling` | `pymupdf` | `legacy`. Default `docling`.
- `PYMUPDF_TIMEOUT_S` — int seconds. Default `60`.

### Test surfaces

- `backend/tests/integration/test_pdf_extractor_docling_compat.py` — Phase 070 binding CI gate. **Stays green** through this phase (no pin bumps).
- `backend/tests/integration/test_docling_extractor.py` — **NEW** (Plan 02). Synthetic fixture per D-071-16.
- `backend/tests/integration/test_pymupdf_fence.py` — **NEW** (Plan 03). Both child-as-subprocess + parent-with-mocked-subprocess flavors. Asserts AGPL-fence invariant (the test inspects `sys.modules` to verify `fitz` is NOT imported by the parent test process at any point).
- `backend/tests/integration/test_documents.py` — extend with `/reextract` happy-path + invalid-engine 400 + RLS owner-only tests.
- Existing Phase 069 golden tests at `backend/tests/unit/test_extraction_service.py` — `LegacyExtractor` golden output STAYS BIT-IDENTICAL with new optional fields defaulting to None (or with explicit `extractor_name='pypdf-legacy'` if the golden is updated as part of Plan 02 Task 1).
- **Live UAT** — `551f03f9-...` reference thesis pair via Chrome MCP per D-071-15. NOT codified in pytest (license-bound). Captured in `071-VERIFICATION.md`.

### Pre-pull / runbook surfaces

- `REDIS-SETUP.md` + `supabase/SETUP.md` — no changes.
- `backend/README.md` (or wherever runbook lives) — append a one-liner: `python -c "from docling.document_converter import DocumentConverter; DocumentConverter().convert('backend/tests/fixtures/extraction/reference.pdf')"` to pre-warm the model bundle on a fresh deploy. Plan 04 task.

### Reported bugs cross-check (CLAUDE.md MANDATORY rule)

Three open Agentic-RAG bug reports as of 2026-05-14: `anthropic-end-of-cycle-shows-actions-not-summary` (agent loop), `streaming-indicator-top-bottom-desync` (frontend streaming), `tool-output-download-bloat-intermediate-artifacts` (frontend tool cards). **None touch ingestion / RAG / multimodal extraction; none folded into Phase 071.** Routing decision recorded here so future phases don't surface them as "missed".

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`PdfExtractor` ABC + `ExtractedDocument` dataclass + `get_extractor(mime)` dispatcher** at `backend/app/services/extraction_service.py:68-188` — Phase 069 seam. Phase 071 plugs Docling + PyMuPDF in via `class DoclingExtractor(PdfExtractor)` + `class PyMuPDFExtractor(PdfExtractor)`; dispatcher gains the `engine_override` kwarg + env-var read.
- **`LegacyExtractor`** at `extraction_service.py:90-174` — stays available indefinitely as the `'legacy'` engine option per D-071-12. No deletion. Module-level patchable helpers in `multimodal_service.py` continue to back it (Phase 069 D-069-03 contract).
- **`probe_docling()`** at `backend/scripts/probe_multimodal.py:184-200` — exact `from docling.document_converter import DocumentConverter` import pattern + convert-call shape. Plan 02 reuses verbatim.
- **`reference.pdf` + `reference.docx`** at `backend/tests/fixtures/extraction/` — Phase 069 golden fixtures (~3.3 KB synthetic). Reused by Plan 02's synthetic fixture set; the academic-style fixture is additional.
- **`POST /documents/{id}/reingest`** at `backend/app/api/documents.py:427-491` — pattern for fetching `raw` from Storage + scheduling `BackgroundTasks.add_task(ingest_document, ...)`. New `/reextract` follows the same shape with the `engine_override` kwarg added to the task call + the hard-delete-and-replace step before scheduling per D-071-10.
- **`pdf_extraction_runs` schema spec** is fully defined in PRD §5 line 136 — write the migration verbatim from that spec; no design needed.
- **`backend/tests/integration/test_pdf_extractor_docling_compat.py`** (Phase 070 output) — pattern for "import docling + extract a fixture + assert non-empty." Plan 02 unit tests for `DoclingExtractor` follow the same shape but assert against the new `ExtractedDocument` fields (text length > 0, tables/images counts > 0 on the synthetic academic fixture).
- **`extract_and_store_tables` / `extract_and_store_images`** at `backend/app/services/multimodal_service.py:88-...` — currently take `(raw, mime, document_id, user_id, supabase)` and re-extract internally. Phase 069 D-069-03 noted they could be refactored to accept pre-extracted lists; deferred. **Phase 071 keeps the same signatures** — `LegacyExtractor` continues to delegate via the existing module-level helpers; Docling/PyMuPDF results flow through the same `extract_and_store_*` calls (which will re-extract using the `multimodal_service` helpers, NOT the new engines). **This means Docling's structured tables/images are NOT yet what gets persisted to `document_tables` / `document_images`** — that gap is intentional for Phase 071 (matches Phase 069 D-069-04 single-pass semantics) and will be tightened in Phase 072 when the multimodal helpers themselves get upgraded for the ceiling lift. Plan 02 task: add a `# TODO Phase 072` comment at the call site naming this; the `bbox` columns Phase 071 lands STAY EMPTY in the `LegacyExtractor` path (Docling path populates them via the `ExtractedDocument` extension once Phase 072 rewires `extract_and_store_*`). **Surface to user during plan-phase if this seam ambiguity has implementation cost surprises.**

### Established Patterns

- **`from __future__ import annotations`** + lazy heavy imports inside function bodies (per `multimodal_service.py:42` and `probe_multimodal.py:190`) — apply to `extractors/docling.py` (lazy `from docling...` inside `_get_converter()`) and `extractors/pymupdf.py` (no fitz import at all in parent — it's only in the child).
- **`run_in_threadpool` for sync I/O in async handlers** (CLAUDE.md D-v2.5-01) — Docling is sync; called from `ingest_document` which is sync-in-threadpool already; no extra wrapping needed (D-071-07).
- **Single uvicorn worker** (D-v2.5-02 still in force at 071) — module-level singleton converter is one per process, fine. Multi-worker (Phase 077+) will be one converter per worker; no shared state needed since the model files are read-only on disk.
- **Supabase client patterns** — `documents.py` uses `supabase.table(...).update(...).execute()` synchronously inside `ingest_document` (which is in threadpool). `pdf_extraction_runs` insert follows the same pattern.
- **RLS shape** — `pdf_extraction_runs` follows the `document_chunks` RLS template: keyed on `user_id` via FK; user can `SELECT` own rows; service-role can do everything.
- **Migration application discipline** (CLAUDE.md + memory `feedback_apply_migrations_via_sql_editor.md`) — paste each new `supabase/migrations/0NN_*.sql` into the Supabase SQL editor manually. After each, run `bash scripts/regenerate-full-schema.sh` (live-DB dump, no reset per memory `feedback_regen_full_schema_no_reset.md`). Commit migration + regenerated `full-schema.sql` together. **Never `supabase db push` or `db reset`.**
- **Subprocess invocation pattern** — Python's `subprocess.run(input=raw_bytes, capture_output=True, timeout=N, check=False)` is the standard. Don't use `Popen` + manual `.communicate()` — `run` handles the cleanup invariants correctly.

### Integration Points

- **Dispatcher:** `get_extractor(mime, engine_override=None)` in `extraction_service.py`. Called from `documents.py` upload path (line 230) + `/reingest` path (line 461) + new `/reextract` path. `engine_override` is None for the first two (uses env-var default), populated for `/reextract` (forced by API caller).
- **Telemetry write-back:** `ingest_document` becomes the writer of the `pdf_extraction_runs` row at the end of extraction. Receives engine name + duration + counts + error from the extractor (likely via a small `ExtractionResult` wrapper that pairs `ExtractedDocument` with extraction metadata, OR just by capturing `time.perf_counter()` deltas + the ExtractedDocument fields directly — Plan 02 picks).
- **AGPL fence proof:** any test importing `extraction_service.py` (parent) MUST NOT have `fitz` in `sys.modules`. Plan 03 test asserts this.
- **Frontend:** No new frontend work in Phase 071. The existing documents-list UI shows status + filename via Supabase Realtime on `documents.status` / `documents.ingestion_step` — unchanged. The UI surface for **triggering** `/reextract` is v3.1 admin shell; for v2.6 the endpoint is API-only (callable via curl / Studio's REST tab).

### Phase 32.5 chunking pipeline interaction

- **`chunk_text` / `embed_chunks` / `extract_metadata`** at `backend/app/services/embedding_service.py` — pure consumers of `ExtractedDocument.text`. Phase 071 changes the SOURCE of that text (Docling vs pypdf) but the consumer interface is unchanged. Confidence threshold drift from Docling-vs-pypdf score-distribution shift is **Phase 076's** problem (RAG-RECAL-01).
- **Chunk count change is expected:** Docling typically produces fewer + better-structured chunks than pypdf's plain-text extraction. SC#1 doesn't measure chunk count — it measures table + image counts (which is where the user-observed bug was).

</code_context>

<specifics>
## Specific Ideas

- **The "5/4 vs 50+/0" user observation is the binding goal anchor.** SC#1's 20% delta is the falsifiable proof. If Plan 04's UAT shows the delta is still > 20% after Docling, the phase is NOT closeable — investigate (PyMuPDF-on-PDF? Docling pipeline_options for higher-accuracy mode?) before declaring done.
- **D-v2.6-01 is non-negotiable.** Phase 071 inherits the supabase 2.29.0 / httpx 0.28.x / docling 2.93.x pins verbatim. The D-070-14 regression-guardrail comment in `requirements.txt` MUST stay intact. PyMuPDF (Plan 03) is the only NEW pin Phase 071 adds — well below the existing tripwires.
- **Subprocess fence is structural, not by convention.** D-071-04's "top-level `backend/extractors/` outside `app/`" placement makes the AGPL boundary visible at the file-tree level. A reviewer skimming `backend/app/` sees zero `import fitz`; a reviewer needing PyMuPDF code finds it in `backend/extractors/`. Cleanest possible signal.
- **Auto-fallback was deliberately rejected.** When (not if) Docling fails on a PDF class in production, the user wants to know — `status='failed'` + `error_message` is loud. Auto-falling back to PyMuPDF would ingest poor-quality chunks under `extractor='pymupdf-fallback'` and the user might not notice for weeks. Per memory `feedback_dont_hedge_to_no_new_infra.md` — pick the technically-correct option, don't optimize for "no failed docs in UI". Failed docs are the signal.
- **`/reextract` is intentionally engine-required** (no default value in the body schema). The whole purpose of the endpoint is "swap the engine for THIS doc" — silently defaulting would conflate it with `/reingest`. If the operator wants "retry with current default", that's `/reingest`'s job.
- **One-time backfill `extractor='pypdf-legacy'`** is a tag, not a re-extraction. Q-v2.6-04 explicitly rejects auto-re-extract. Existing chunks/tables/images stay byte-identical until the operator opts a doc into `/reextract`.
- **Live UAT against `551f03f9-...` is the binding gate.** Synthetic fixture is a useful regression net but cannot prove SC#1 by itself — the synthetic doc may not exercise the exact PDF class that broke pdfplumber on the thesis.
- **Pypdfium2 punt is intentional.** PRD §5 lists three engines but ROADMAP SC#3 only names PyMuPDF as the verified fallback. Adding pypdfium2 here doubles Plan 03's surface for a tier that has no signal yet.
- **Docling output normalization detail.** Docling's native `ConversionResult.document` exposes `export_to_markdown()` (full markdown), `tables` (list of `Table` objects with `data` + `bbox`), and image references. The adapter in `DoclingExtractor.extract()` translates these to the extended `ExtractedDocument` shape per D-071-08; full Docling-to-`ExtractedDocument` mapping table belongs in `gsd-phase-researcher`'s output (RESEARCH.md).
- **Vibe-coder-friendly summary** (per memory `feedback_vibe_coder_communication.md`): Phase 071 swaps the PDF/DOCX reader from "old basic library" to "Docling, the modern structured parser" for new uploads, and lets you click "re-extract with PyMuPDF" on any single document that comes out badly. Old documents keep their old extracted text until you opt in. PyMuPDF runs in a separate subprocess for legal reasons (its license forbids being linked into the main app process if you ever expose APIs publicly).

</specifics>

<deferred>
## Deferred Ideas

- **Persistent PyMuPDF worker pool** — resurrect if PyMuPDF ever becomes the hot path; today it's opt-in fallback (rare). **Re-open trigger:** production telemetry shows `engine='pymupdf'` row count > N% of all extractions, or PyMuPDF latency dominates ingestion p95.

- **Standalone PyMuPDF venv + `requirements-extractor-subprocess.txt`** — defer until commercial redistribution forces it (D-PRD-07 PyMuPDF Pro path). Subprocess fence is sufficient legal isolation today; venv-fork is rigor for the public-distribution era. **Re-open trigger:** first paying customer / commercial license decision per D-PRD-07.

- **Graceful retry on PyMuPDF timeout** (SIGTERM → wait → SIGKILL → retry once) — re-extract is opt-in; user retries manually. **Re-open trigger:** UAT/production data shows transient timeouts > N% of attempts.

- **Pre-warm Docling at FastAPI lifespan startup + readiness probe** — defer to v3.1 admin shell; Phase 071 ships a runbook line for "pre-pull at deploy". **Re-open trigger:** v3.1 admin shell milestone.

- **Bounded thread-pool for concurrent Docling extracts** — proper ingestion queue is v3.4 Automations (SEED-001). Don't half-build it here. **Re-open trigger:** OOM observed under realistic ingestion concurrency (PRD §7 names this as the bound for 10x users).

- **Soft-replace versioning on `/reextract`** — versioning was designed for source-bytes change (D-25), not engine swap. Hard delete + replace is the chosen semantic. **Re-open trigger:** explicit user request for engine-swap audit trail.

- **Auto-fallback (Docling → PyMuPDF) on Docling exception** — defer until production data shows what error classes warrant retry. **Re-open trigger:** `pdf_extraction_runs` telemetry shows N+ failed Docling extracts that PyMuPDF would have handled.

- **`app_settings`-driven extractor pick** — defer to v3.1 admin shell when admin UI exists. Phase 071 ships env-var only (`EXTRACTOR_PRIMARY`). **Re-open trigger:** v3.1 admin shell milestone.

- **Idempotency guard on `/reextract` concurrent calls** (what happens if user double-clicks?) — surface only if observed in UAT; today's `/reingest` has no such guard either. **Re-open trigger:** observed double-extraction race in UAT.

- **`Pypdfium2Extractor`** (third-tier license-safe fallback per PRD §5) — defer to a polish phase. **Re-open trigger:** post-launch incident where a PDF class fails Docling AND PyMuPDF fence both.

- **Refactor `extract_and_store_tables` / `extract_and_store_images` to accept pre-extracted `list[TableData]` / `list[ImageData]`** — Phase 069 deferred this (D-069-03 commentary); Phase 071 inherits the deferral. The Docling-path `bbox` columns stay empty until this refactor lands. **Re-open trigger:** Phase 072 (RAG-MM-LIFT-01/02) — the multimodal helpers themselves get upgraded then; that's the natural moment to consume `ExtractedDocument` directly instead of re-extracting from raw bytes.

- **Docling `pipeline_options` (OCR enable, accurate-mode, etc.)** — pick docling 2.x defaults unless Plan 02's synthetic fixture shows obvious gaps. **Re-open trigger:** SC#1 UAT delta > 20% on the reference thesis with default options.

- **Confidence threshold recalibration for Docling chunk distributions** — owned by Phase 076 (RAG-RECAL-01, Q-v2.6-03).

- **Multimodal ceiling lift (`_MAX_VISION_CALLS` + `_MAX_B64_BYTES` to `app_settings` defaults raised to 100 / 4 MB)** — owned by Phase 072 (RAG-MM-LIFT-01). Phase 071's migration 044 lays the table-column contract; Phase 072 actually lifts the constants in code.

- **DOCX `related_parts` walk + `wp:anchor` floating-shape detection** — owned by Phase 072 (RAG-MM-LIFT-02). The latent `python-docx 1.2.0 CT_Blip.part` bug captured in Phase 069's `deferred-items.md` lives here.

- **Multi-worker / `--workers N` interaction with Docling singleton** — owned by Phase 077 (D-v2.5-02 supersession). Module-level singleton is fine per-worker (one converter per process).

- **Worker-restart / retry-queue durability for in-flight Docling ingests** — out of scope for v2.6 entirely. SEED-001 §"proper ingestion queue" → v3.4 Automations.

- **Reviewed Todos (not folded)** — None; no relevant todos surfaced by `gsd-sdk query todo.match-phase 071`.

- **Reported bugs reviewed (not folded — surface=Agentic-RAG, none touch ingestion/RAG)** —
  - `anthropic-end-of-cycle-shows-actions-not-summary.md` (agent loop / system prompts)
  - `streaming-indicator-top-bottom-desync.md` (frontend streaming)
  - `tool-output-download-bloat-intermediate-artifacts.md` (frontend tool cards)
  All three remain `status: open` for whichever future phase claims their respective domains.

</deferred>

---

*Phase: 071-docling-primary-path*
*Context gathered: 2026-05-14*
