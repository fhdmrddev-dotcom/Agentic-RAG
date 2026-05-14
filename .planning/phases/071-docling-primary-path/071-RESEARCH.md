## RESEARCH COMPLETE

# Phase 071: Docling Primary Path — Research

**Researched:** 2026-05-14
**Domain:** PDF/DOCX extraction engine swap + AGPL subprocess fence + telemetry schema
**Confidence:** HIGH (Docling API surface verified against installed venv; subprocess + Supabase patterns verified against existing code)

## Summary

Phase 071 is the load-bearing payoff of the Phase 069 `PdfExtractor` ABC seam: it plugs Docling 2.93 (already installed, verified working on the in-tree reference fixture) as the primary engine and PyMuPDF 1.27 (already installed) as an AGPL-fenced opt-in fallback, with 6 migrations (039–044) landing the telemetry table + bbox/extractor lineage columns + a partial unique dedup index + `app_settings` multimodal columns that Phase 072 will fill. All locked decisions in CONTEXT.md (D-071-01 through D-071-16, D-v2.6-01, D-v2.5-01..02, D-PRD-07 Appendix) are inherited verbatim — this research only fills in the implementation surface.

The Docling adapter mapping is direct and verified live in this session against `backend/tests/fixtures/extraction/reference.pdf` — `result.document` exposes `tables[i].data.grid` (list-of-list of `TableCell` objects with `text` + `bbox`), `pictures[i].get_image(doc)` (returns a PIL `Image` when `PdfPipelineOptions.generate_picture_images=True`), `prov[0].page_no + prov[0].bbox` (1-based page, native `BoundingBox` Pydantic model with `model_dump()` → `{l, t, r, b, coord_origin}`), and `export_to_markdown()` (full Markdown string). The PyMuPDF subprocess fence is a stdin-bytes / stdout-JSON spawn-per-extract pattern with images base64-encoded in the JSON payload; `fitz.Document(stream=raw, filetype=mime).find_tables()` + `page.get_images(full=True)` + `doc.extract_image(xref)` give the same TableData/ImageData shape as Docling.

**Primary recommendation:** Wire `DoclingExtractor` via a module-level singleton `DocumentConverter` constructed once per worker with `PdfPipelineOptions(generate_picture_images=True, images_scale=2.0)`, marshal `result.document` into the extended `ExtractedDocument` via 8 deterministic field projections (table below), and ship the PyMuPDF child at `backend/extractors/pymupdf_isolated.py` running `subprocess.run(...input=raw_bytes, capture_output=True, timeout=PYMUPDF_TIMEOUT_S, check=False)`. Apply all 6 migrations via Supabase SQL Editor per CLAUDE.md, regen `full-schema.sql` after each, and verify the binding goal via Chrome MCP live UAT on `551f03f9-...` (no synthetic fixture closes SC#1 — D-071-15).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**PyMuPDF subprocess fence (D-071-01..04):**
- IPC = stdin binary + stdout JSON. Parent writes raw PDF bytes to child's stdin (no b64 bloat); child reads `sys.stdin.buffer.read()`; mime via argv (`python -m extractors.pymupdf_isolated --mime application/pdf`). Child writes `ExtractedDocument` JSON on stdout (images b64-encoded inside JSON). Stderr reserved for diagnostic logs. No pickle (RCE), no temp files.
- Spawn-per-extract. `subprocess.run(["python", "-m", "extractors.pymupdf_isolated", "--mime", mime], input=raw_pdf, capture_output=True, timeout=PYMUPDF_TIMEOUT_S, check=False)`. ~50–100 ms fork overhead acceptable (PyMuPDF is opt-in fallback).
- Hard timeout, single attempt, fail loud. `PYMUPDF_TIMEOUT_S` env, default 60. Timeout → SIGKILL → `ExtractionError("pymupdf timed out after Ns")`. Non-zero exit → capture last stderr line → raise. NO retry, NO soft-fail.
- Child entrypoint = `backend/extractors/pymupdf_isolated.py` — top-level package, outside `backend/app/`. Invoked via `python -m extractors.pymupdf_isolated`. The AGPL `import fitz` lives ONLY here.

**Docling in-process (D-071-05..08):**
- Model artifact = lazy on first extract (~600 MB → `~/.cache/docling`); production runbook gets a one-liner pre-pull command.
- `DocumentConverter()` = module-level singleton, lazy-instantiated, thread-safe (double-checked lock).
- Async wrapping = none. `DoclingExtractor.extract()` is plain sync; `ingest_document` runs in `BackgroundTasks` (FastAPI threadpool) so D-v2.5-01 is satisfied.
- `ExtractedDocument` extended with optional `full_markdown: str | None`, `extractor_name: str | None`; `TableData` + `ImageData` extended with optional `bbox: dict | None`. `LegacyExtractor` golden output stays byte-identical (new fields default to `None`).

**`POST /reextract` (D-071-09..12):**
- Separate endpoint `POST /documents/{id}/reextract`. Body `{engine: "docling" | "pymupdf" | "legacy"}` (required; 400 on missing/invalid). Returns 202 + document row. Owner-only RLS.
- Hard delete + replace: DELETE chunks + tables + images; UPDATE documents SET `status='pending'`, `extractor=NULL`, `ingestion_step=NULL`; queue `BackgroundTasks.add_task(ingest_document, ..., engine_override=...)`. New `pdf_extraction_runs` row inserted at end. `documents.version_number` NOT bumped.
- Docling failure → fail loud, no auto-fallback. Existing `try/except` at `documents.py:724-729` catches; user retries via `/reextract engine=pymupdf`.
- `EXTRACTOR_PRIMARY` env, default `'docling'`. `get_extractor(mime, engine_override=None)` reads env once at module top; accepts override from `/reextract`. Valid: `'docling' | 'pymupdf' | 'legacy'`.

**Scope locks (D-071-13..14):** Q-v2.6-04 LOCKED to opt-in re-extraction (no auto-re-extract on deploy). `Pypdfium2Extractor` deferred to a polish phase (re-open trigger: post-launch incident where a PDF class fails both Docling AND PyMuPDF).

**SC#1 verification (D-071-15..16):** Live UAT against `551f03f9-...` reference thesis on user's real Supabase via Chrome MCP is the binding gate. Synthetic CI fixture (`backend/tests/fixtures/extraction/academic_synth.{pdf,docx}`) is additive — regression net, NOT binding gate.

**Inherited project decisions:**
- D-v2.6-01: supabase 2.29.0 / httpx 0.28.x / docling 2.93.0 pins — DO NOT bump.
- D-v2.5-01: no blocking I/O in async handlers (use `run_in_threadpool`).
- D-v2.5-02: single uvicorn worker (still in force at 071; superseded in Phase 079).
- D-PRD-07 Appendix: AGPL subprocess fence contract.

### Claude's Discretion

- Exact `DocumentConverter()` constructor options (e.g., `pipeline_options` for OCR enable/disable) — pick docling 2.x defaults unless the synthetic fixture surfaces obvious gaps.
- Whether `DoclingExtractor` lives in `extraction_service.py` or `extractors/docling.py` subpackage — recommend subpackage once ≥ 3 engines exist.
- Exact `pdf_extraction_runs` write timing — recommend "insert at end with full row" (atomic).
- Exact `bbox` JSON shape (`{x0, y0, x1, y1, page}` vs Docling's native `BoundingBox.model_dump()`) — recommend Docling's native shape.
- Exact text of the `D-v2.6-04` row in PROJECT.md — match existing `D-v2.6-01` row style.
- Whether `PyMuPDFExtractor.supports(mime)` returns True for both PDF and DOCX or only PDF — recommend PDF-only for v2.6.
- Whether `LegacyExtractor` returns `extractor_name='pypdf-legacy'` explicitly or leaves it None — recommend explicit for clarity.
- Whether to add a `--no-docling` env switch for test environments — recommend YES.

### Deferred Ideas (OUT OF SCOPE)

- Persistent PyMuPDF worker pool — re-open trigger: PyMuPDF dominates ingestion p95 or `engine='pymupdf'` row count > N% of all extractions.
- Standalone PyMuPDF venv + `requirements-extractor-subprocess.txt` — re-open trigger: first paying customer (PyMuPDF Pro path per D-PRD-07).
- Graceful retry on PyMuPDF timeout — re-open trigger: UAT/production shows transient timeouts > N% of attempts.
- Pre-warm Docling at FastAPI lifespan startup + readiness probe — owned by v3.1 admin shell.
- Bounded thread-pool for concurrent Docling extracts — owned by v3.4 Automations (SEED-001).
- Soft-replace versioning on `/reextract` — re-open trigger: explicit user request for engine-swap audit trail.
- Auto-fallback (Docling → PyMuPDF) on Docling exception — re-open trigger: telemetry shows N+ failed Docling extracts that PyMuPDF would have handled.
- `app_settings`-driven extractor pick — owned by v3.1 admin shell.
- Idempotency guard on `/reextract` concurrent calls — surface only if observed in UAT.
- `Pypdfium2Extractor` (third-tier fallback) — re-open trigger: post-launch incident where both Docling and PyMuPDF fence fail on same doc.
- Refactor `extract_and_store_tables` / `extract_and_store_images` to consume pre-extracted `list[TableData|ImageData]` — owned by **Phase 072** (RAG-MM-LIFT-01/02). Until then, Docling-path `bbox` columns stay EMPTY on the `LegacyExtractor` path.
- Docling `pipeline_options` (OCR enable, accurate-mode) — re-open trigger: SC#1 UAT delta > 20% with defaults.
- Confidence threshold recalibration for Docling chunk distributions — owned by **Phase 076** (RAG-RECAL-01).
- Multimodal ceiling lift + DOCX `related_parts` walk — owned by **Phase 072**.
- Multi-worker / `--workers N` interaction — owned by **Phase 077**.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RAG-DOCLING-01 | A user-uploaded PDF and the same source's DOCX produce comparable table + image counts (within 20% delta) when re-ingested under the new extractor. Docling primary path used by default; `PdfExtractor` abstraction allows per-document fallback to PyMuPDF without flipping the global default. | **Docling adapter mapping** (§Docling Adapter Mapping) — concrete projection of `ConversionResult.document` → `ExtractedDocument` with verified API surface. **AGPL fence** (§AGPL Subprocess Fence) for `engine=pymupdf` path. **`/reextract` endpoint** (§Threat Model — Plan 04). **Migration 040** (`extractor` column) + **039** (telemetry) for lineage tracking. **SC#1 binding gate** = live UAT on `551f03f9-...` via Chrome MCP. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

CLAUDE.md directives the planner MUST honor (extracted verbatim):

- **venv mandatory:** Backend Python lives in `backend/venv/`. Confirmed present (Docling + PyMuPDF probed live in this session via `backend/venv/Scripts/python.exe`).
- **No LangChain / no LangGraph:** raw SDK calls only — `from docling.document_converter import DocumentConverter` is direct SDK use; passes.
- **Pydantic for structured LLM outputs only:** `ExtractedDocument` is `@dataclass(frozen=True)`, not Pydantic (per Phase 069 D-069-01 — internal plumbing, not LLM/API boundary).
- **RLS on every table:** `pdf_extraction_runs` (migration 039) MUST have `auth.uid() = user_id` SELECT policy keyed via FK; service-role bypasses for writes (matches `runs` table template at `supabase/migrations/035_runs_table.sql:47-53`).
- **Stateless chat completions:** N/A — extraction does not touch chat path.
- **Ingestion is manual file upload only:** No connectors. `/reextract` is the only new ingestion entry-point, gated by document ownership.
- **Schema changes ship as numbered SQL migrations under `supabase/migrations/`** with `<digits>_name.sql` pattern. Apply each via Supabase SQL editor (NEVER `supabase db push` / `db reset`). Then run `bash scripts/regenerate-full-schema.sh` (default no-reset = live DB dump) and commit migration + regenerated `full-schema.sql` together. Verified script behavior at `scripts/regenerate-full-schema.sh:1-127`.
- **Realtime is hint, not source-of-truth:** N/A — extraction does not stream over Realtime.
- **No blocking I/O in async handlers (D-v2.5-01):** `ingest_document` already runs in `BackgroundTasks` (threadpool); Docling sync `.convert()` is correct there. The new `/reextract` route handler itself does owner-check + DELETE + UPDATE via `supabase.table().execute()` — same pattern as `/reingest` at `documents.py:436-491` which is already sync-via-threadpool by FastAPI dependency injection. Wrap nothing extra.
- **Single uvicorn worker (D-v2.5-02):** Docling singleton converter is one-per-process. Phase 077 lifts the worker rule; nothing to do here beyond noting "one converter per worker once multi-worker lands".
- **Settings live in `user_settings` / `app_settings`:** `EXTRACTOR_PRIMARY` + `PYMUPDF_TIMEOUT_S` are env vars (per CONTEXT.md D-071-12), NOT settings — acceptable because these are operator-level infra knobs, not user-tunable behavior. Migration 044 lays the `app_settings` multimodal-limits columns Phase 072 will USE.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Docling model load + invocation | API / Backend (FastAPI worker, sync-in-threadpool) | — | In-process per D-v2.6-01; Phase 070 spike confirmed coexistence with supabase 2.29. |
| PyMuPDF extraction (AGPL fence) | API / Backend → subprocess child (`backend/extractors/pymupdf_isolated.py`) | — | D-PRD-07 Appendix forbids linking AGPL into the FastAPI process. Child is a separate OS process; IPC over stdio. |
| `POST /reextract` endpoint | API / Backend (`backend/app/api/documents.py`) | Database (`documents` UPDATE + cascade DELETEs) | Standard FastAPI route + Supabase RLS; mirrors `/reingest`. |
| `pdf_extraction_runs` writes | API / Backend (`ingest_document`) | Database (Supabase Postgres) | Telemetry inserts run inside the existing threadpool-bound ingest task; no new tier. |
| Migration application | Database (Supabase SQL Editor — manual paste) | — | Per CLAUDE.md rule + `feedback_apply_migrations_via_sql_editor.md` memory; live DB only, no `db push`/`db reset`. |
| `bbox` column writes | Database (`document_images.bbox` / `document_tables.bbox` JSONB) | API / Backend (writer) | JSONB shape decided by Docling's native `BoundingBox.model_dump()` for fidelity; Phase 072 fills from `LegacyExtractor` path. |
| Frontend trigger UI for `/reextract` | OUT OF SCOPE — v3.1 admin shell | — | v2.6 ships API-only (callable via curl / Studio's REST tab). |
| AGPL fence invariant (`fitz` never imported by parent) | API / Backend test (`tests/integration/test_pymupdf_fence.py`) | — | Asserted via `'fitz' not in sys.modules` after `import extraction_service`. Structural separation enforced at file-tree level (`backend/extractors/` outside `backend/app/`). |

## Standard Stack

### Core (already installed, verified live in venv 2026-05-14)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `docling` | 2.93.0 | Primary PDF + DOCX layout-aware extractor | [VERIFIED: `importlib.metadata.version('docling')` returned `2.93.0` in `backend/venv`] D-v2.6-01 pin; Path (a) spike outcome (Phase 070); MIT-licensed (per D-PRD-07 §3); ~600 MB model bundle auto-downloaded to `~/.cache/docling` on first convert. |
| `pymupdf` | 1.27.2.3 | Fallback extractor behind AGPL subprocess fence | [VERIFIED: `importlib.metadata.version('pymupdf')` returned `1.27.2.3`] PRD §5 calls for `pymupdf>=1.24`; installed version exceeds. CONTEXT.md Plan 03 adds the `pymupdf>=1.24` pin line to `requirements.txt` — version IS already in the venv but NOT yet listed as a direct dependency (transitive only). |
| `supabase` | 2.29.0 | RLS-aware Postgres + Storage client | [VERIFIED: `requirements.txt:8`] DO NOT BUMP (D-070-14 regression guardrail). |
| `httpx` | 0.28.x | HTTP transport for both supabase and docling | [VERIFIED: `requirements.txt:27`] DO NOT BUMP past `<0.29.0` (D-070-14 regression guardrail). |
| `Pillow` (PIL) | >=10.0.0 | Image bytes manipulation (PNG encode/decode) | [VERIFIED: `requirements.txt:19`] Docling's `PictureItem.get_image(doc)` returns a `PngImageFile`; `LegacyExtractor` already uses Pillow for `_extract_images`. |

### Supporting (existing)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `reportlab` | >=4.0.0 | Synthetic-fixture generator | [VERIFIED: `requirements.txt:28`] Reused by Plan 02 to author `academic_synth.pdf` (D-071-16). |
| `python-docx` | >=1.0.0 | Synthetic-fixture DOCX generation | [VERIFIED: `requirements.txt:17`] Reused for `academic_synth.docx`; still backs `LegacyExtractor`'s DOCX path. |
| `pdfplumber` / `pypdf` | >=0.11.0 / >=5.0.0 | LegacyExtractor backing (preserved indefinitely) | [VERIFIED: `requirements.txt:16,18`] `LegacyExtractor` stays available as `engine='legacy'` per D-071-12. No removal in v2.6. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-process Docling | Subprocess-isolated Docling (Path (c)) | [CITED: Phase 070 SUMMARY.md] Rejected — Path (a) succeeded; subprocess overhead unjustified. Re-open trigger: future supabase/docling release breaks coexistence. |
| Spawn-per-extract subprocess | Persistent PyMuPDF worker pool | [CITED: CONTEXT.md Deferred Ideas] Deferred — PyMuPDF is opt-in fallback (rare); ~50-100ms fork overhead acceptable. Re-open trigger: PyMuPDF becomes hot path. |
| `subprocess.run(input=raw_bytes)` | Temp-file shuttling | Rejected (D-071-01) — temp files add cleanup hygiene burden + race window. Pure stdin/stdout is hermetic. |
| JSON over stdout | Pickle over stdout | Rejected (D-071-01) — pickle has RCE surface if child output is somehow attacker-controlled. JSON is data-only. |
| Auto-fallback Docling → PyMuPDF on exception | Fail-loud + manual `/reextract` retry | [CITED: D-071-11] Auto-fallback hides quality regressions + makes debugging hard + diverges billing cost. Fail-loud is the signal. |
| `Pypdfium2Extractor` third tier | Two-tier (Docling + PyMuPDF) | [CITED: D-071-14] Deferred — production signal-needed before adding third surface. ROADMAP SC#3 names PyMuPDF only. |
| Soft-replace versioning on `/reextract` | Hard delete + replace | [CITED: D-071-10] Engine swap is not a source-bytes change; preserves D-25 version_number semantics. |

**Installation:**
```bash
# Already installed in backend/venv as of 2026-05-13 (Phase 070 GREEN):
#   docling==2.93.0
#   supabase==2.29.0
#   httpx==0.28.x
#   pymupdf==1.27.2.3 (transitive — Plan 03 adds direct pin)
#
# Plan 03 adds to backend/requirements.txt:
pymupdf>=1.24  # AGPL-3.0 — isolated behind subprocess fence per D-PRD-07 Appendix.
               # See backend/extractors/pymupdf_isolated.py; never imported by app/.
```

**Version verification (run before plan-phase commit):**
```bash
"backend/venv/Scripts/python.exe" -c "import importlib.metadata as m; print('docling', m.version('docling')); print('pymupdf', m.version('pymupdf')); print('supabase', m.version('supabase')); print('httpx', m.version('httpx'))"
# Expected (verified 2026-05-14):
#   docling 2.93.0
#   pymupdf 1.27.2.3
#   supabase 2.29.0
#   httpx 0.28.x
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│  └── PUT /documents (upload) ─┐  ┌─ POST /documents/{id}/reingest  │
│                               │  │      (existing — uses default)  │
│                               │  └─ POST /documents/{id}/reextract │
│                               │      body: {engine: docling|pymupdf│
│                               │              |legacy}              │
└───────────────────────────────┼──┼──────────────────────────────────┘
                                │  │
                  ┌─────────────▼──▼──────────────┐
                  │  FastAPI app (single uvicorn   │
                  │  worker — D-v2.5-02)           │
                  │                                │
                  │  documents.py routes:          │
                  │  • upload          (no eng_ov) │
                  │  • /reingest       (no eng_ov) │
                  │  • /reextract  ← NEW, eng_ov   │
                  │       │                        │
                  │       │ BackgroundTasks.add_   │
                  │       │ task(ingest_document,  │
                  │       │   ..., engine_override=│
                  │       │   chosen)              │
                  │       ▼                        │
                  │  ingest_document (threadpool)  │
                  │   │                            │
                  │   │ get_extractor(             │
                  │   │   mime,                    │
                  │   │   engine_override=...)     │
                  │   │   reads EXTRACTOR_PRIMARY  │
                  │   ▼                            │
                  └──┬──────────────┬──────────────┘
                     │              │
       ┌─────────────▼───┐   ┌──────▼───────┐   ┌────────────────┐
       │ DoclingExtract  │   │ PyMuPDF-     │   │ LegacyExtract  │
       │ (sync, in-proc) │   │ Extractor    │   │ (status quo)   │
       │ ───────────────│   │ (parent      │   │ pypdf + pdf-   │
       │ module-level    │   │  wrapper)    │   │ plumber +      │
       │ singleton:      │   │      │       │   │ python-docx    │
       │ _CONVERTER      │   │      ▼       │   └────────────────┘
       │ + threading.Lock│   │ subprocess.  │
       │      │          │   │ run([python, │
       │      ▼          │   │  "-m",       │
       │ converter.      │   │  "extractors.│
       │ convert(path)   │   │  pymupdf_    │
       │      │          │   │  isolated"], │
       │      ▼          │   │  input=raw,  │
       │ result.document │   │  timeout=60) │
       │  ↓ ADAPTER ↓    │   │      │       │
       │ Extracted-      │   │      ▼       │
       │ Document        │   │  ┌─────────┐ │
       │ (text, tables,  │   │  │ AGPL    │ │
       │  images,        │   │  │ FENCE:  │ │
       │  full_markdown, │   │  │ child   │ │
       │  extractor_name)│   │  │ proc =  │ │
       └─────────────────┘   │  │ outside │ │
                             │  │ FastAPI │ │
                             │  │ process │ │
                             │  └─────────┘ │
                             │  backend/    │
                             │  extractors/ │
                             │  pymupdf_    │
                             │  isolated.py │
                             │  (fitz lives │
                             │   ONLY here) │
                             │  reads stdin,│
                             │  writes JSON │
                             │  on stdout   │
                             │      │       │
                             │      ▼       │
                             │  Extracted-  │
                             │  Document    │
                             │  (b64 images │
                             │   embedded   │
                             │   in JSON)   │
                             └──────┬───────┘
                                    │
                                    ▼
                  ┌─────────────────────────────────┐
                  │  ingest_document continues:     │
                  │  • chunk_text → embed → INSERT  │
                  │     document_chunks             │
                  │  • extract_and_store_tables —   │
                  │    STILL goes through legacy    │
                  │    multimodal_service helpers   │
                  │    (re-extracts from raw bytes; │
                  │    Phase 069 D-069-04 single-   │
                  │    pass; bbox columns left      │
                  │    empty until Phase 072 lifts) │
                  │  • extract_and_store_images —   │
                  │    same                         │
                  │  • UPDATE documents SET         │
                  │     extractor=<chosen>,         │
                  │     full_markdown=...,          │
                  │     status='completed'          │
                  │  • INSERT pdf_extraction_runs   │
                  │    (engine, duration_ms, table_ │
                  │     count, image_count, error)  │
                  └────────────┬────────────────────┘
                               │
                               ▼
                  ┌─────────────────────────────────┐
                  │  Supabase Postgres              │
                  │  • documents (extractor col +   │
                  │    full_markdown + dedup partial│
                  │    unique idx) — migrations 040,│
                  │    043                          │
                  │  • document_chunks (no schema   │
                  │    change)                      │
                  │  • document_tables (bbox +      │
                  │    extractor cols — migration   │
                  │    042)                         │
                  │  • document_images (bbox col —  │
                  │    migration 041)               │
                  │  • pdf_extraction_runs ← NEW    │
                  │    (migration 039) — RLS via FK │
                  │  • app_settings (multimodal_max_│
                  │    vision_calls / b64_bytes_kb  │
                  │    cols — migration 044;        │
                  │    Phase 072 reads them)        │
                  └─────────────────────────────────┘
```

### Recommended Project Structure (additions for Phase 071)

```
backend/
├── app/
│   ├── api/
│   │   └── documents.py          # ADD POST /reextract; ADD engine_override kwarg
│   │                             #   to ingest_document; ADD pdf_extraction_runs
│   │                             #   INSERT at end of extract path
│   └── services/
│       ├── extraction_service.py # EXTEND ExtractedDocument/TableData/ImageData
│       │                         #   with optional new fields; EXTEND
│       │                         #   get_extractor(mime, engine_override=None)
│       └── extractors/           # NEW subpackage (Plan 02)
│           ├── __init__.py
│           ├── docling.py        # DoclingExtractor + singleton converter
│           └── pymupdf.py        # PyMuPDFExtractor parent wrapper (spawns child)
├── extractors/                   # NEW top-level pkg (Plan 03) — outside app/
│   ├── __init__.py               # empty (package marker)
│   └── pymupdf_isolated.py       # AGPL child entrypoint — fitz lives ONLY here
└── tests/
    ├── fixtures/
    │   └── extraction/
    │       ├── reference.{pdf,docx}                # existing (Phase 069)
    │       └── academic_synth.{pdf,docx}           # NEW (Plan 02) — ~5 tables +
    │                                                 5 images for synthetic CI
    ├── unit/
    │   └── test_extraction_service.py              # EXTEND with new field defaults
    └── integration/
        ├── test_pdf_extractor_docling_compat.py    # existing (Phase 070) — STAYS GREEN
        ├── test_docling_extractor.py               # NEW (Plan 02)
        ├── test_pymupdf_fence.py                   # NEW (Plan 03)
        └── test_documents.py                       # EXTEND with /reextract tests
```

### Pattern 1: Docling singleton with double-checked lock

**What:** Single `DocumentConverter()` per worker process; lazy on first extract; thread-safe.
**When to use:** Module-level singletons that wrap heavy resources (model bundles) and may be touched by FastAPI threadpool threads concurrently.
**Example:**
```python
# Source: CONTEXT.md D-071-06 + verified via inspection of docling 2.93 in backend/venv
from __future__ import annotations
import threading

_CONVERTER: "DocumentConverter | None" = None
_CONVERTER_LOCK = threading.Lock()


def _get_converter() -> "DocumentConverter":
    global _CONVERTER
    if _CONVERTER is None:
        with _CONVERTER_LOCK:
            if _CONVERTER is None:
                # Lazy imports to defer the ~600 MB model touch:
                from docling.document_converter import DocumentConverter, PdfFormatOption  # noqa: PLC0415
                from docling.datamodel.base_models import InputFormat  # noqa: PLC0415
                from docling.datamodel.pipeline_options import PdfPipelineOptions  # noqa: PLC0415

                opts = PdfPipelineOptions()
                opts.generate_picture_images = True   # populate PictureItem.image (verified live)
                opts.images_scale = 2.0               # 2x resolution for downstream vision LLM
                _CONVERTER = DocumentConverter(
                    format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
                )
    return _CONVERTER
```

### Pattern 2: Subprocess invocation with raw bytes via stdin

**What:** Parent passes raw PDF bytes to child via stdin; child writes JSON to stdout.
**When to use:** AGPL isolation, RCE-surface minimization, hermetic IPC (no temp files).
**Example:**
```python
# Source: CONTEXT.md D-071-01..03 + Python subprocess docs
import subprocess
import json
import os

def _run_pymupdf_subprocess(raw: bytes, mime: str) -> "ExtractedDocument":
    timeout_s = int(os.getenv("PYMUPDF_TIMEOUT_S", "60"))
    try:
        result = subprocess.run(
            ["python", "-m", "extractors.pymupdf_isolated", "--mime", mime],
            input=raw,                  # raw bytes, NOT b64
            capture_output=True,        # stdout = JSON; stderr = diagnostic logs
            timeout=timeout_s,
            check=False,                # we handle non-zero exit explicitly
        )
    except subprocess.TimeoutExpired as e:
        # subprocess.run already sent SIGKILL before raising on timeout (Py3.3+)
        raise ExtractionError(f"pymupdf timed out after {timeout_s}s") from e

    if result.returncode != 0:
        # Pull last line of stderr — child's structured error line
        last_err = result.stderr.decode("utf-8", errors="replace").strip().splitlines()[-1:]
        raise ExtractionError(f"pymupdf child exited {result.returncode}: {last_err[0] if last_err else 'no stderr'}")

    payload = json.loads(result.stdout.decode("utf-8"))
    return _payload_to_extracted_document(payload)
```

### Pattern 3: Child entrypoint — stdin raw bytes → stdout JSON

**What:** Standalone module invoked as `python -m extractors.pymupdf_isolated --mime <mime>`. Reads stdin, runs `fitz`, writes JSON.
**When to use:** AGPL fence child process.
**Example:**
```python
# backend/extractors/pymupdf_isolated.py
# Source: PyMuPDF 1.27 API verified in venv 2026-05-14; D-071-04
"""PyMuPDF AGPL fence child entrypoint — fitz imports ONLY happen here.

Invoked as: python -m extractors.pymupdf_isolated --mime application/pdf
Reads:      raw PDF/DOCX bytes on stdin
Writes:     ExtractedDocument JSON on stdout (b64 images embedded)
Errors:     non-zero exit code + last stderr line = caller-readable error.
"""
import argparse
import base64
import io
import json
import sys

import fitz  # PyMuPDF — AGPL-3.0; lives ONLY in this file.
from PIL import Image as PILImage


def _extract(raw: bytes, mime: str) -> dict:
    doc = fitz.Document(stream=raw, filetype="pdf" if mime == "application/pdf" else "docx")
    try:
        # Text
        text_parts = [page.get_text() for page in doc]
        text = "\n\n".join(text_parts)

        # Tables (page.find_tables — PyMuPDF 1.23+; we have 1.27.2 in venv)
        tables = []
        for page_num, page in enumerate(doc, start=1):
            try:
                tabs = page.find_tables()
                for ti, t in enumerate(tabs.tables or []):
                    rows_raw = t.extract()  # list[list[str|None]]
                    if not rows_raw or not rows_raw[0]:
                        continue
                    headers = [str(h or "") for h in rows_raw[0]]
                    rows = [[str(c or "") for c in r] for r in rows_raw[1:]]
                    tables.append({
                        "page": page_num,
                        "table_index": ti,
                        "headers": headers,
                        "rows": rows,
                        "bbox": {
                            "x0": t.bbox[0], "y0": t.bbox[1],
                            "x1": t.bbox[2], "y1": t.bbox[3],
                            "page": page_num,
                        },
                    })
            except Exception as e:
                # Per-page table failure does not blow up the whole extract — match
                # LegacyExtractor's silent-swallow contract (D-069-04).
                print(f"pymupdf: table extraction failed on page {page_num}: {e}", file=sys.stderr)

        # Images
        images = []
        global_idx = 0
        for page_num, page in enumerate(doc, start=1):
            for (xref, *_) in page.get_images(full=True):
                try:
                    info = doc.extract_image(xref)
                    raw_img = info["image"]              # bytes
                    img = PILImage.open(io.BytesIO(raw_img)).convert("RGB")
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")
                    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                    images.append({
                        "page": page_num,
                        "image_index": global_idx,
                        "b64_png": b64,
                        "width": info.get("width") or img.width,
                        "height": info.get("height") or img.height,
                        "bbox": None,  # PyMuPDF doesn't expose per-image bbox cheaply via get_images
                    })
                    global_idx += 1
                except Exception as e:
                    print(f"pymupdf: image extraction failed (xref={xref}, page={page_num}): {e}", file=sys.stderr)

        return {
            "text": text,
            "tables": tables,
            "images": images,
            "table_extraction_error": None,
            "image_extraction_error": None,
            "full_markdown": None,           # PyMuPDF doesn't produce structured markdown
            "extractor_name": "pymupdf",
        }
    finally:
        doc.close()


def main() -> None:
    ap = argparse.ArgumentParser(prog="pymupdf_isolated")
    ap.add_argument("--mime", required=True)
    args = ap.parse_args()

    raw = sys.stdin.buffer.read()
    try:
        payload = _extract(raw, args.mime)
    except Exception as e:
        # Caller reads last stderr line
        print(f"pymupdf_isolated: fatal: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(2)

    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
```

### Pattern 4: AGPL-fence invariant test

**What:** Assert `fitz` is NOT in the parent test process's `sys.modules` after importing extraction_service.
**When to use:** Plan 03 binding test for the AGPL fence contract.
**Example:**
```python
# Source: D-PRD-07 Appendix + standard Python sys.modules introspection
import sys
import importlib

def test_fitz_not_imported_by_parent():
    """AGPL fence invariant: 'import fitz' must NEVER appear in the parent FastAPI
    process's transitive imports. PyMuPDFExtractor only invokes the subprocess.

    This test runs in the same process as extraction_service + documents.py +
    pymupdf parent wrapper. If anyone in that import graph accidentally writes
    'import fitz' or 'from fitz import ...', this test catches it.
    """
    # Force-load every parent-side module that could pull in fitz transitively.
    importlib.import_module("app.services.extraction_service")
    importlib.import_module("app.services.extractors.docling")
    importlib.import_module("app.services.extractors.pymupdf")
    importlib.import_module("app.api.documents")

    forbidden = {"fitz", "pymupdf", "PyMuPDF"}
    leaked = forbidden & set(sys.modules)
    assert not leaked, (
        f"AGPL fence violation: {leaked} imported by parent process. "
        f"PyMuPDF must ONLY live in backend/extractors/pymupdf_isolated.py (child process)."
    )
```

### Anti-Patterns to Avoid

- **Importing `fitz` anywhere under `backend/app/`.** Breaks the AGPL fence + invariant test. The whole point of the top-level `backend/extractors/` placement is structural separation (D-071-04).
- **Constructing `DocumentConverter()` per-request.** ~5-15 s overhead per call instead of per-worker. Use the singleton.
- **Wrapping `DoclingExtractor.extract()` with `run_in_threadpool` inside the extractor.** `ingest_document` already runs in threadpool; double-wrapping adds overhead without correctness benefit. D-v2.5-01 applies to async handlers, not sync functions already in threadpool. (D-071-07)
- **Soft-failing on Docling exception (returning empty `ExtractedDocument`).** Silently ingests empty docs as `status='completed'`. Fail loud — let `documents.py:724-729` set `status='failed'`.
- **Pickle / shelve / yaml load of subprocess output.** RCE surface. JSON only.
- **Using `subprocess.Popen` + `.communicate()` instead of `subprocess.run`.** `run` handles cleanup invariants correctly; `Popen` has more footguns.
- **Auto-fallback Docling → PyMuPDF on any exception.** Hides quality regressions, complicates debugging, diverges cost profile (D-071-11).
- **Bumping `version_number` on `/reextract`.** Engine swap is not a source-bytes change. D-25 versioning contract preserved (D-071-10).
- **Adding `EXTRACTOR_DOCLING_ISOLATION=...` to `.env.example`.** Phase 070 explicitly rejected this — would document an unused knob. (Phase 070 D-070-15 + Plan 02 Task 4 skip note.)
- **Writing a `pdf_extraction_runs` row at start of extraction with partial data, then UPDATE at end.** D-071 discretion recommends "insert at end with full row" for atomicity. Half-rows on crash are confusing.
- **Forgetting to regenerate `full-schema.sql` after each migration.** Per CLAUDE.md + `feedback_regen_full_schema_no_reset.md` memory; commits without the regen produce inconsistent deploys.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF layout-aware text + table + image extraction | Custom pdfminer + bbox math + OCR pipeline | `docling.document_converter.DocumentConverter` | Docling 2.x ships layout analysis + OCR (RapidOCR) + table structure + reading-order in one library; ~5 years of IBM Research work behind it. |
| PDF table cell extraction | Hand-rolled grid detection from PDF text positions | Docling: `result.document.tables[i].data.grid` (returns `TableCell` matrix) + `t.export_to_dataframe()`; PyMuPDF: `page.find_tables()` | Both libraries do row-span / col-span / header detection; hand-rolling these is ~weeks of work per pitfall. |
| PDF page image extraction | Manually parse `/XObject` references | Docling: `picture.get_image(doc)` (returns PIL `Image`); PyMuPDF: `doc.extract_image(xref)` (returns dict with bytes + width + height + ext) | XObject parsing has dozens of edge cases (CMYK, masks, JBIG2). Both libraries handle. |
| Subprocess IPC framing | Manual length-prefixed framing or pipes-with-Popen | `subprocess.run(input=raw_bytes, capture_output=True, timeout=N, check=False)` | `run` handles cleanup, SIGKILL on timeout, return-code propagation. No `Popen.communicate()` footguns. |
| AGPL legal isolation enforcement (runtime) | Code-review-only "don't import fitz" rules | Structural file-tree fence (`backend/extractors/` outside `backend/app/`) + `sys.modules` invariant test | Code review fails as the codebase grows; structural + tested invariant catches drift mechanically. |
| Bounding-box JSON shape design | Custom `{x, y, w, h, page}` convention | Docling's native `BoundingBox.model_dump()` → `{l, t, r, b, coord_origin, page}` (page added by caller from `prov[0].page_no`) | Downstream consumers (vector-search highlighting in v3.x) already understand Docling's shape from upstream docs. |
| Partial unique index DDL for dedup race | Application-level locking on (user_id, content_hash, folder_id) | `CREATE UNIQUE INDEX ... WHERE status != 'failed'` (migration 043) | Postgres-level constraint is race-free; app-level locking has TOCTOU window. PRD §6 row 8 mitigation. |
| RLS for `pdf_extraction_runs` | Custom policy DSL | Mirror `runs` table template at `supabase/migrations/035_runs_table.sql:47-53` — `auth.uid() = user_id` SELECT only; service-role bypasses for backend writes | Pattern is project-canonical; copying preserves the audit trail story. |
| First-call model download UX | Build a CLI progress UI for the docling model fetch | `~/.cache/docling` auto-download on first `.convert()` call + pre-warm runbook one-liner | Phase 071 D-071-05 already locks this; production runbook pre-pulls, dev tolerates the slow first call. |

**Key insight:** This phase is almost entirely "wire up libraries the ecosystem already built" — the original sin (the 5/4 vs 50+/0 thesis gap) was the `pypdf` + `pdfplumber` combo's inability to do layout-aware extraction. Docling solves it. Everything else (subprocess fence, telemetry table, /reextract endpoint, migrations) is plumbing.

## Runtime State Inventory

Phase 071 is NOT a rename or refactor phase — it adds new engines and new schema columns. Still, two runtime-state items deserve explicit confirmation because they cross into "data" rather than "code":

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | (1) Existing `documents` rows without `extractor` column — migration 040 backfills `extractor='pypdf-legacy'` once. **No re-extraction triggered** (Q-v2.6-04 LOCKED → opt-in). (2) Existing `document_tables` / `document_images` rows without `bbox` or (for tables) `extractor` columns — migration 041/042 add nullable columns; existing rows have NULL until per-doc `/reextract` runs. (3) Pre-existing duplicate `documents` rows (from the §6 row 8 race) — migration 043 includes a one-time DELETE of duplicates BEFORE the CREATE UNIQUE INDEX (PRD §6 mitigation: `DELETE FROM documents WHERE status != 'failed' AND ctid NOT IN (SELECT MIN(ctid) FROM documents GROUP BY user_id, content_hash, folder_id)`). | Backfill UPDATE is idempotent (only updates NULL → 'pypdf-legacy'). Dedup DELETE is destructive — verify on staging first; the winner is the lowest-`ctid` row (effectively the oldest). |
| **Live service config** | None. Docling models live in `~/.cache/docling` per-machine; not service-side config. No n8n / Datadog / Cloudflare touched. | None — verified by reading PRD §5 + reviewing project stack. |
| **OS-registered state** | First Docling `.convert()` writes ~600 MB to `~/.cache/docling`. This is per-OS-user, not OS-registered (no systemd / Task Scheduler entries). | Production runbook needs the pre-pull one-liner (Plan 04 task — already in CONTEXT.md "Pre-pull / runbook surfaces"). Dev tolerates the slow first call. |
| **Secrets / env vars** | New: `EXTRACTOR_PRIMARY` (`docling` default), `PYMUPDF_TIMEOUT_S` (`60` default). Added to `backend/.env.example`. **Not secrets** — operator-tunable defaults. Existing code that reads them gracefully defaults if unset. | Document in `.env.example` with brief comment per CONTEXT.md "New env vars" section. |
| **Build artifacts / installed packages** | `backend/venv` already has docling==2.93.0 + pymupdf==1.27.2.3 (transitive). Plan 03's `requirements.txt` edit only adds the *direct* `pymupdf>=1.24` pin with AGPL comment block — no re-install needed for dev (transitive already there); fresh-deploy `pip install` resolves the direct pin. | None for existing dev; fresh deploys get the model bundle on first extract (runbook pre-pull). |

**Critical:** The migration 043 dedup DELETE is the only destructive operation in this phase. Plan 01 MUST have a verification step that runs the SELECT first ("are there any duplicates to delete?"), captures the count, and ONLY proceeds with the DELETE + CREATE INDEX after explicit confirmation. If duplicates exist on the user's live DB, the planner should call this out for confirmation before the migration is applied.

## Common Pitfalls

### Pitfall 1: First Docling `.convert()` hangs for 1–2 min in dev — looks like a deadlock

**What goes wrong:** Developer runs an integration test or starts the server, the first PDF upload sits in `status='processing'` for 1–2 minutes with no log output, dev assumes a deadlock and kills the worker.
**Why it happens:** Docling auto-downloads ~600 MB of model weights to `~/.cache/docling` on the first `DocumentConverter().convert()` call. Subsequent calls are fast (~5–15s per PDF).
**How to avoid:** (1) Production runbook line in `backend/README.md`: `python -c "from docling.document_converter import DocumentConverter; DocumentConverter().convert('backend/tests/fixtures/extraction/reference.pdf')"` before going live. (2) Plan 02 Task: add a `# NOTE` comment in `extractors/docling.py` explaining the lazy download. (3) Add a "first run takes ~2 min" log line on the singleton's first instantiation.
**Warning signs:** First upload's `pdf_extraction_runs.duration_ms` > 60_000; subsequent docs are normal.

### Pitfall 2: `result.document.tables[i].data` field name confusion

**What goes wrong:** Code writes `t.rows` or `t.data.rows` expecting a list-of-list of strings; gets a list-of-list of `TableCell` Pydantic objects with `.text` / `.bbox` / `.row_span` / `.col_span` fields.
**Why it happens:** Docling's `TableData` has `grid: list[list[TableCell]]`, `num_rows: int`, `num_cols: int` — no plain `rows` shortcut. `TableItem.export_to_dataframe()` returns a pandas DataFrame (deprecated without `doc` arg in 2.93 — use `t.export_to_dataframe(doc)`).
**How to avoid:** Use the adapter mapping below; project `t.data.grid[i][j].text` into the existing `TableData.rows: list[list[str]]` shape. Handle header detection via the FIRST row of the grid (Docling marks header cells via `TableCell.column_header: bool`).
**Warning signs:** TypeError "TableCell is not subscriptable" or empty rows.

### Pitfall 3: `PictureItem.image` is `None` unless `generate_picture_images=True`

**What goes wrong:** Code calls `p.image.pil_image` and gets `AttributeError: 'NoneType' object has no attribute 'pil_image'`.
**Why it happens:** Default `PdfPipelineOptions.generate_picture_images=False`. PRD wants images persisted; need to opt in.
**How to avoid:** Construct converter with `PdfPipelineOptions(generate_picture_images=True, images_scale=2.0)`. Verified live in the session 2026-05-14 — `p.get_image(doc)` returns a `PngImageFile` after this option flip.
**Warning signs:** `document_images` table has 0 rows for new ingests; `pdf_extraction_runs.image_count = 0` consistently for new uploads.

### Pitfall 4: `extract_and_store_tables` / `extract_and_store_images` re-extract from raw bytes — Docling-path `bbox` columns stay EMPTY

**What goes wrong:** Phase 071 lands the `bbox` JSONB columns (migrations 041/042) but `extract_and_store_*` helpers in `multimodal_service.py:88-208` call `extract_pdf_tables(raw)` / `extract_docx_tables(raw)` directly (pdfplumber / python-docx). The Docling-produced `ExtractedDocument.tables` with rich `bbox` data goes UNUSED for persistence — only `.text` flows downstream into `chunk_text` + `embed_chunks`.
**Why it happens:** Phase 069 D-069-03 + D-069-04 locked the single-pass `extract()` returning `ExtractedDocument`, but the multimodal helpers were left alone (D-069-03 commentary: "could be refactored to accept pre-extracted lists; deferred"). Phase 071 inherits the deferral; Phase 072 lifts it.
**How to avoid:** Plan 02 MUST add a `# TODO Phase 072` comment at the `extract_and_store_tables` / `extract_and_store_images` call sites in `backend/app/api/documents.py:711, 714` documenting:
- The bbox columns added in migrations 041/042 STAY EMPTY for `engine='legacy'` (and currently for all engines, because Phase 071 does not rewire `extract_and_store_*`).
- Phase 072 (RAG-MM-LIFT-01/02) will refactor these helpers to consume `ExtractedDocument.tables` / `.images` directly, at which point bbox flows through.
- The Docling path's `bbox` data in `ExtractedDocument.tables[i].bbox` is STORED on the dataclass but discarded at persistence time — this is the intentional Phase 071 ↔ Phase 072 split.
**Recommended TODO comment shape:**
```python
# TODO Phase 072 (RAG-MM-LIFT-01/02): extract_and_store_tables and
# extract_and_store_images currently re-extract from raw bytes via the
# multimodal_service helpers (Phase 069 D-069-04 single-pass contract).
# This means document_tables.bbox + document_images.bbox columns (migrations
# 041/042) stay NULL for new ingests even when engine='docling' produced rich
# bbox data on ExtractedDocument.tables[i].bbox. Phase 072 will refactor these
# helpers to accept the pre-extracted lists, at which point bbox flows through.
```
**Warning signs:** UAT shows `pdf_extraction_runs` recording Docling extracts with `table_count > 0` and `image_count > 0`, but SELECT bbox FROM document_tables WHERE document_id = '...' returns ALL NULL.

### Pitfall 5: Subprocess timeout doesn't kill orphan child on Windows

**What goes wrong:** Parent times out and raises `subprocess.TimeoutExpired`; on POSIX, Python sends SIGKILL automatically. On Windows under some conditions, the child process can linger as a zombie.
**Why it happens:** `subprocess.run` calls `.kill()` on timeout (Python 3.3+). On Windows, `.kill()` uses `TerminateProcess`, which usually works — but a child blocked on stdin / I/O can occasionally linger. The CPython docs note that on Windows, sometimes a forceful kill races with the I/O system.
**How to avoid:** (1) Use the recommended pattern — `subprocess.run(input=raw, capture_output=True, timeout=N, check=False)` handles 99% of the cleanup correctly. (2) If a Plan 03 UAT shows zombie children on Windows specifically, add `process.kill(); process.wait(timeout=5)` in the TimeoutExpired exception handler. Not needed in baseline implementation.
**Warning signs:** `tasklist` shows orphan `python.exe` processes after a series of forced PyMuPDF timeouts. Mitigation in `deferred-items.md` re-open list.

### Pitfall 6: `bash scripts/regenerate-full-schema.sh` requires Supabase + Docker running

**What goes wrong:** Plan 01 verifier runs `bash scripts/regenerate-full-schema.sh` in a CI / fresh-clone environment where local Supabase isn't started; the script errors out at line 63 (`supabase status` check).
**Why it happens:** Script depends on Docker + `supabase start`; verified at `scripts/regenerate-full-schema.sh:53-66`.
**How to avoid:** Plan 01 task instructions must include "ensure `supabase start` has been run AND Docker Desktop is up" as a precondition. The migration application path is "paste SQL into Supabase Studio editor manually, then run regen, then commit both" — manual paste step gates everything.
**Warning signs:** Verifier errors with "Supabase is not running locally" or "could not locate Supabase Postgres container".

### Pitfall 7: Old `pip install pymupdf` returns `fitz==0.0.1.dev2` (the WRONG package)

**What goes wrong:** A naive `pip install fitz` (or someone confused looking at imports) gets a different, abandoned package called `fitz` on PyPI; the AGPL fence is moot because the actual `import fitz` resolves to a stub package.
**Why it happens:** Historical PyPI naming — the wheel is named `pymupdf` but the import name is `fitz` (legacy). There IS a different `fitz` package on PyPI that's unrelated.
**How to avoid:** Plan 03 pins `pymupdf>=1.24` (the correct package name). The `from fitz import ...` in `pymupdf_isolated.py` is the legacy import path the `pymupdf` wheel registers. Verified in venv 2026-05-14: `importlib.metadata.version('pymupdf')` returns `1.27.2.3`, and `import fitz` works.
**Warning signs:** `pip install fitz` (instead of `pip install pymupdf`) — never do this.

## Docling Adapter Mapping

**This is the load-bearing translation layer for Plan 02 — CONTEXT.md line 286 explicitly delegated to RESEARCH.md.**

Every Docling field below was verified live against `backend/venv` (Docling 2.93.0) running `DocumentConverter().convert('backend/tests/fixtures/extraction/reference.pdf')` on 2026-05-14.

### `result.document` → `ExtractedDocument` (top-level)

| ExtractedDocument field | Docling source | Type | Notes |
|---|---|---|---|
| `text` | `result.document.export_to_text()` | `str` | [VERIFIED] Plain text; reading-order preserved by Docling's layout analyzer. Alternative: `export_to_markdown()` — also a str, includes structural markers. CONTEXT.md D-071-08 puts the markdown in `full_markdown` and a clean text in `text`. Recommendation: use `export_to_text()` here for backwards-compat with `LegacyExtractor` consumers (chunk_text / embed_chunks). |
| `tables` | `tuple(_to_table_data(t, ti) for ti, t in enumerate(result.document.tables))` | `tuple[TableData, ...]` | [VERIFIED] `result.document.tables` is a `list[TableItem]`. |
| `images` | `tuple(_to_image_data(p, pi, result.document) for pi, p in enumerate(result.document.pictures))` | `tuple[ImageData, ...]` | [VERIFIED] `result.document.pictures` is a `list[PictureItem]`. NOTE: field name is `pictures`, not `images`. |
| `table_extraction_error` | `None` on success; `str(exc)` on failure | `str | None` | Wrap `_to_table_data` in try/except per D-069-04 silent-swallow contract. |
| `image_extraction_error` | Same shape | `str | None` | Same contract. |
| `full_markdown` (NEW) | `result.document.export_to_markdown()` | `str | None` | [VERIFIED] Returns a `str` (verified: 877 chars on the 3.3KB reference fixture). For non-Docling extractors (Legacy / PyMuPDF), set to `None`. |
| `extractor_name` (NEW) | Literal `"docling"` | `str | None` | Hardcoded in `DoclingExtractor.extract()`. |

### `TableItem` → `TableData` (per-table)

```python
# Verified live 2026-05-14 on docling 2.93.0:
#   t.data.num_rows: 4 num_cols: 3
#   t.data.grid: list[list[TableCell]]
#   TableCell fields: bbox, row_span, col_span, start_row_offset_idx,
#     end_row_offset_idx, start_col_offset_idx, end_col_offset_idx,
#     text, column_header: bool, row_header: bool, row_section: bool, fillable: bool
#   t.prov[0]: ProvenanceItem(page_no=1, bbox=BoundingBox(...), charspan=(...,...))
#   BoundingBox fields: l, t, r, b, coord_origin (TOPLEFT|BOTTOMLEFT)
```

| TableData field | Docling source | Notes |
|---|---|---|
| `page: int | None` | `t.prov[0].page_no if t.prov else None` | [VERIFIED] 1-based; `prov` is a list — table can span pages but `prov[0]` gives the first. |
| `table_index: int` | enumerate index from `result.document.tables` | Position in the doc's `tables` list, not per-page. Matches `LegacyExtractor` semantics. |
| `headers: list[str]` | `[cell.text for cell in t.data.grid[0]]` (if `t.data.grid` and first row marked header) — see notes | Docling marks header cells via `TableCell.column_header: bool`. **Recommendation:** if `t.data.grid[0]` cells have `column_header=True`, use that row; otherwise pass an empty list. Phase 069 `LegacyExtractor` treats the first row as headers unconditionally — match that for byte-compat with the existing `query_tables` tool consumer. |
| `rows: list[list[str]]` | `[[cell.text for cell in row] for row in t.data.grid[1:]]` | First row consumed as headers; remainder rows go here. Empty cells: `cell.text == ""`. |
| `bbox: dict | None` (NEW) | `{**t.prov[0].bbox.model_dump(), "page": t.prov[0].page_no}` if `t.prov` else `None` | [VERIFIED via `bb.model_dump()`] Returns `{"l": float, "t": float, "r": float, "b": float, "coord_origin": "TOPLEFT" | "BOTTOMLEFT"}`. Add `"page"` for callers that want it in one dict. Coord origin matters for downstream highlighting (TOPLEFT vs BOTTOMLEFT depends on rasterization tool); preserve verbatim. |

**Alternative table-row extraction (simpler, less control):** `t.export_to_dataframe(doc)` returns a pandas DataFrame; cast `.values.tolist()` for `rows`. Verified live: returns `[['Col1','Col2','Col3'], ['a1','b1','c1'], ['a2','b2','c2'], ['a3','b3','c3']]`. **Recommendation:** use this for v1 (simpler, no header-detection logic); switch to grid traversal if downstream consumers need row/col span data. Beware the `Usage of TableItem.export_to_dataframe() without 'doc' argument is deprecated` warning — pass `doc`.

### `PictureItem` → `ImageData` (per-image)

```python
# Verified live 2026-05-14:
#   p.image: ImageRef (when PdfPipelineOptions.generate_picture_images=True)
#   p.image is None if generate_picture_images=False (the default — TRAP)
#   p.get_image(doc): PIL Image (PngImageFile) — size (W, H), mode 'RGB'
#   p.prov[0].page_no: int (1-based)
#   p.prov[0].bbox: BoundingBox
```

| ImageData field | Docling source | Notes |
|---|---|---|
| `page: int | None` | `p.prov[0].page_no if p.prov else None` | [VERIFIED] 1-based. |
| `image_index: int` | enumerate index from `result.document.pictures` | Position in doc's `pictures` list. |
| `b64_png: str` | `base64.b64encode(_pil_to_png_bytes(p.get_image(doc))).decode("ascii")` | [VERIFIED `p.get_image(doc)` returns PngImageFile size=(201,149) mode='RGB'] Encode PIL Image to PNG bytes via `BytesIO` + `img.save(buf, "PNG")`, then b64. Match `LegacyExtractor._extract_images` shape (current pdfplumber path produces b64 PNG already). |
| `width: int` | `img.width` from the PIL Image returned by `p.get_image(doc)` | [VERIFIED] PNG PIL size. |
| `height: int` | `img.height` | Same. |
| `bbox: dict | None` (NEW) | `{**p.prov[0].bbox.model_dump(), "page": p.prov[0].page_no}` if `p.prov` else `None` | Same shape as table bbox. |

**Critical:** `p.get_image(doc)` REQUIRES `PdfPipelineOptions(generate_picture_images=True)` at converter construction time — otherwise `p.image` is `None` and `get_image` returns `None`. Pitfall #3 above. CONTEXT.md D-071-06 example snippet doesn't include this flag; Plan 02 MUST add it. Plus `images_scale=2.0` for downstream vision-LLM quality (matches the multimodal pipeline's 2x rasterization rationale).

### Failure modes per field

| Failure | Behavior |
|---|---|
| `result.document.tables` empty | `ExtractedDocument.tables = ()`; no error. |
| Per-table grid traversal raises | Catch, append nothing for that table, set `table_extraction_error = f"table {ti}: {exc}"`; continue to next table. Matches D-069-04 silent-swallow contract. |
| `p.get_image(doc)` returns None | Skip that picture, do NOT raise; set `image_extraction_error` if EVERY picture failed. |
| `t.prov` empty list | `page = None`, `bbox = None`; still emit the table (text content is valuable even without spatial). |
| `doc.export_to_markdown()` raises | Set `full_markdown = None`, log warning; do NOT raise (text still flows from `export_to_text`). |

## AGPL Subprocess Fence Implementation

### IPC contract (verbatim from D-071-01)

| Direction | Channel | Encoding |
|---|---|---|
| Parent → Child: PDF/DOCX bytes | child's `sys.stdin.buffer` (binary stream) | Raw bytes — NO b64, NO chunking, NO framing. `subprocess.run(input=raw_bytes, ...)` writes everything atomically. |
| Parent → Child: MIME + opts | child's `argv` | `python -m extractors.pymupdf_isolated --mime application/pdf` |
| Child → Parent: ExtractedDocument | child's `sys.stdout` | UTF-8 JSON. Images embedded as base64 PNG inside the JSON payload (PRD line 287 confirmed this shape). |
| Child → Parent: errors / logs | child's `sys.stderr` | UTF-8 text lines. Parent reads last line on non-zero exit. |
| Child → Parent: success/failure | child's exit code | `0` = success, non-zero = failure (parent re-raises with last stderr line). |

### Encoding cost analysis (images via b64 in JSON vs alternative channel)

[VERIFIED via direct calculation] b64 inflates byte length by ~33%. A typical 100KB PNG becomes ~133KB of b64 + ~5 bytes JSON quotes. For a 5-image PDF this is ~700KB of stdout — well under the OS stdout pipe buffer cap (64KB default on Linux, but `subprocess.run`'s `capture_output=True` uses a `BytesIO` buffer in the parent that's effectively unlimited). For pathological cases (50+ images @ 1 MB each = 70+ MB stdout), `subprocess.run` still works but RSS in the parent transiently spikes. Per CONTEXT.md "PyMuPDF is opt-in fallback (rare)" — this is acceptable.

**Alternative considered:** Send images as a separate temp-file channel (child writes to tmpdir, parent reads). Rejected — D-071-01 explicitly says "no temp files (cleanup hygiene)". Embedded b64 it is.

### Child entrypoint behavior (per Pattern 3 above)

See **Pattern 3** in the Architecture Patterns section for the full `pymupdf_isolated.py` reference implementation. Key invariants:
- Single `import fitz` at module top (the ONLY one in the codebase outside of tests).
- `fitz.Document(stream=raw, filetype="pdf"|"docx")` — confirmed working on the reference fixture (verified 2026-05-14).
- `page.find_tables()` available in PyMuPDF 1.23+; we have 1.27.2 (verified).
- `page.get_images(full=True)` returns list of tuples; index 0 is the `xref` for `doc.extract_image(xref)`.
- `doc.extract_image(xref)` returns `dict` with `image: bytes, width: int, height: int, ext: str` (verified).
- Exit code `2` on any unhandled exception (CONTEXT.md D-071-03 implied via "fail loud"); use exit code `0` on success.

### Parent wrapper behavior

See **Pattern 2** above for the `subprocess.run(...)` invocation pattern.

### AGPL invariant test (Pattern 4)

The `test_fitz_not_imported_by_parent` test in **Pattern 4** above is the binding gate. Plan 03 ships this test; running it in CI after the import-cycle test for `extraction_service.py` validates the fence at test time.

### Cross-validation: structural fence + runtime invariant

| Layer | Mechanism | What it catches |
|---|---|---|
| File-tree | `backend/extractors/` lives outside `backend/app/` | A reviewer skimming `backend/app/` sees zero `import fitz`; the only PyMuPDF code is in a sibling directory. |
| Code review | Lint rule (manual): forbid `import fitz` / `from fitz` in `backend/app/**/*.py` | Catches accidental drift in PRs touching `backend/app/`. |
| Runtime | `test_fitz_not_imported_by_parent` (Pattern 4) | Catches transitive imports — even if a third-party dep we add later transitively imports `fitz`, the test trips. |
| Subprocess isolation | The actual `fitz.Document(...)` call runs in a child process | Even if all three above fail, the AGPL linking trigger requires `fitz` to be in the SAME process; the child is structurally a different process. |

This 4-layer defense is what makes the fence robust. Plan 03 implements layers 1-3; layer 4 is the existence of the subprocess itself.

## Migration Verification Matrix

The 6 migrations Phase 071 ships. Each MUST be applied via Supabase SQL editor manually (CLAUDE.md rule); after each, run `bash scripts/regenerate-full-schema.sh` (default no-reset = live DB dump); commit migration + regenerated `full-schema.sql` together.

| # | File | Purpose | Touched objects | Verification grep (after regen) | Destructive? |
|---|---|---|---|---|---|
| 1 | `supabase/migrations/039_pdf_extraction_runs.sql` | NEW telemetry table. Columns per PRD §5 line 136: `id uuid pk`, `document_id uuid fk`, `user_id uuid fk`, `engine text` (`'docling' | 'pymupdf' | 'pypdfium2' | 'legacy'`), `started_at timestamptz`, `completed_at timestamptz`, `duration_ms int`, `table_count int`, `image_count int`, `error text`. RLS = SELECT-only policy keyed on `auth.uid() = user_id`; backend writes via service-role (bypasses RLS). Mirror `runs` table template at `035_runs_table.sql:47-53`. | New table + RLS policy | `grep -c "CREATE TABLE.*pdf_extraction_runs" supabase/full-schema.sql` ≥ 1 ; `grep -c "pdf_extraction_runs.*ENABLE ROW LEVEL SECURITY" supabase/full-schema.sql` ≥ 1 | No |
| 2 | `supabase/migrations/040_documents_extractor_column.sql` | ADD `documents.extractor text` (nullable). One-time backfill: `UPDATE documents SET extractor = 'pypdf-legacy' WHERE extractor IS NULL`. **Idempotent** — re-running only sets NULL rows. Optional: add `CHECK (extractor IN ('docling','pymupdf','pypdf-legacy','legacy'))` constraint for type safety. | `documents` table column + one-time UPDATE | `grep -E "extractor.*text" supabase/full-schema.sql` finds the column in the `documents` CREATE TABLE | No (UPDATE only touches NULL rows; safe to re-run) |
| 3 | `supabase/migrations/041_document_images_bbox.sql` | ADD `document_images.bbox jsonb` (nullable). | `document_images` column | `grep -A 10 "CREATE TABLE.*document_images" supabase/full-schema.sql | grep "bbox.*jsonb"` ≥ 1 hit | No |
| 4 | `supabase/migrations/042_document_tables_bbox_extractor.sql` | ADD `document_tables.bbox jsonb` (nullable) + `document_tables.extractor text` (nullable). | `document_tables` two columns | `grep -A 10 "CREATE TABLE.*document_tables" supabase/full-schema.sql | grep -E "bbox.*jsonb\|extractor.*text"` ≥ 2 hits | No |
| 5 | `supabase/migrations/043_documents_dedup_unique_index.sql` | (a) One-time DELETE of pre-existing duplicates: `DELETE FROM documents WHERE status != 'failed' AND ctid NOT IN (SELECT MIN(ctid) FROM documents WHERE status != 'failed' GROUP BY user_id, content_hash, folder_id)` — keeps the OLDEST row per (user_id, content_hash, folder_id) tuple where status is not failed. (b) `CREATE UNIQUE INDEX documents_dedup_idx ON documents (user_id, content_hash, folder_id) WHERE status != 'failed'`. **CQ-DEDUP-01 closure** (PRD §6 row 8). CONTEXT.md flags this as bundled — track in `071-VERIFICATION.md`. | `documents` rows + new partial unique index | `grep -c "documents_dedup_idx\|CREATE UNIQUE INDEX.*documents.*content_hash" supabase/full-schema.sql` ≥ 1 | **YES — destructive DELETE.** Plan 01 task MUST run a SELECT first capturing the count of duplicate rows ("dry-run") and surface to user before running the DELETE + CREATE INDEX in the SQL editor. |
| 6 | `supabase/migrations/044_app_settings_multimodal_limits.sql` | ADD `app_settings.multimodal_max_vision_calls int DEFAULT 100`, `app_settings.multimodal_max_b64_bytes_kb int DEFAULT 4096`. **Wires `backend/app/models/user_settings.py` reader** to consult these two keys (currently `app_settings` is dead code per CONCERNS.md:520-524 — Phase 071 ends the deadness for these two specific keys; Phase 072 actually USES them in `multimodal_service.py`). | `app_settings` two columns + `user_settings.py` reader hookup | `grep -E "multimodal_max_(vision_calls|b64_bytes_kb)" supabase/full-schema.sql` finds both ; `grep -rn "multimodal_max_vision_calls" backend/app/models/user_settings.py` ≥ 1 | No |

**Order rule:** Apply 039 → 040 → 041 → 042 → 043 → 044. Migrations 041/042 must precede any code that writes `bbox`; Plan 02's telemetry writes need 039 already present. Plans 02/03 should NOT start until Plan 01 lands.

**Audit at end of Plan 01 (verifier task):**
```bash
# Regenerated full-schema.sql contains every new object:
grep -c "pdf_extraction_runs" supabase/full-schema.sql                    # ≥ 1
grep -c "documents_dedup_idx\|UNIQUE INDEX.*content_hash" supabase/full-schema.sql  # ≥ 1
grep -A 30 "CREATE TABLE public.documents " supabase/full-schema.sql | grep -c "extractor"  # ≥ 1
grep -A 12 "CREATE TABLE public.document_images" supabase/full-schema.sql | grep -c "bbox"  # ≥ 1
grep -A 12 "CREATE TABLE public.document_tables" supabase/full-schema.sql | grep -c -E "bbox|extractor"  # ≥ 2
grep -A 20 "CREATE TABLE public.app_settings" supabase/full-schema.sql | grep -c -E "multimodal_max_"  # ≥ 2
# All 6 migrations on disk:
ls supabase/migrations/0{39,40,41,42,43,44}_*.sql | wc -l                  # == 6
```

## Threat Model Surface

For each plan, the planner can copy these `<threat_model>` blocks into PLAN.md.

### Plan 01 — Schema + migrations + telemetry plumbing

| Threat ID | Vector | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| T-071-01-01 | Backfill `UPDATE documents SET extractor='pypdf-legacy' WHERE extractor IS NULL` accidentally re-runs on already-backfilled rows | Tampering | Low | Low (idempotent — NULL filter is the guard) | Use `WHERE extractor IS NULL` predicate. Plan 01 verifier checks pre/post row count for the backfill. |
| T-071-01-02 | Dedup migration 043 DELETE keeps wrong row (e.g., the most recent successful upload gets deleted, oldest dup wins) | Tampering / DoS | Medium | High (user loses data) | Use `ctid NOT IN (SELECT MIN(ctid) GROUP BY ...)` — keeps OLDEST row per dup group. Plan 01 task: run a dry-run SELECT first showing the duplicate count + which rows would be deleted; surface to user before applying. Restore via Supabase point-in-time recovery if a real loss happens. |
| T-071-01-03 | `pdf_extraction_runs` RLS policy too permissive (cross-user reads) | Information disclosure | Low | Medium (telemetry leaks document IDs across users) | Policy keyed on `auth.uid() = user_id` (mirror `runs` table at `035_runs_table.sql:47-53`). Service-role writes bypass RLS by design (backend trusted). Integration test: as user A, INSERT a row for user B's document; SELECT as user A returns 0 rows. |
| T-071-01-04 | Schema drift: `full-schema.sql` not regenerated after a migration; deploys see old schema | Integrity | Medium (process discipline) | High (prod boots with missing column) | CLAUDE.md mandates `bash scripts/regenerate-full-schema.sh` after each migration. Plan 01 verifier MUST grep the regen output for every new object after each migration; commits without the regen are rejected. |
| T-071-01-05 | Migration 044's `app_settings` reader hookup creates a stale-cache window (settings TTL cache at `models/user_settings.py:27` shows old values until restart) | Stale data | Low | Low (cache is per-process; restart on deploy clears) | Document in Phase 072 plan: cache TTL is the existing behavior; setting reload requires worker restart. Acceptable for v2.6. |
| T-071-01-06 | `extractor` column CHECK constraint blocks future engines | Availability | Low | Low (relax via migration) | Plan 01 discretion: ship without CHECK constraint (just `text`), or include enumerated values. Recommend WITHOUT — keeps schema relaxed for future engines like `pypdfium2`. |

### Plan 02 — DoclingExtractor + dispatcher rewire + ExtractedDocument extension + telemetry writes

| Threat ID | Vector | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| T-071-02-01 | Docling singleton race: two threads enter `if _CONVERTER is None` between check and lock acquire; double-init wastes ~600 MB model load | Race | Low | Low (waste, not correctness — second init replaces first, no corruption) | Double-checked lock pattern (re-check inside `with lock`). Pattern in CONTEXT.md D-071-06 + Pattern 1 above. |
| T-071-02-02 | Docling `.convert()` exception propagates past `ingest_document`'s `try/except` and crashes the BackgroundTask | Availability | Medium | Medium (doc stuck in `status='processing'`) | `ingest_document` already has `except Exception` at `documents.py:724-729` that sets `status='failed'`; verified inheritance. Phase 071 changes nothing here. |
| T-071-02-03 | Malicious PDF input crashes Docling with an unbounded resource use (CPU loop, memory bomb) | DoS | Medium | High (worker thread hung; on a single-worker setup that's full system DoS) | Docling 2.x has `PdfPipelineOptions.document_timeout: float | None`. Plan 02 sets `document_timeout=120.0` (matching the 120s run timeout style of Phase 066). Verified field exists in venv: `PdfPipelineOptions fields: ['document_timeout', ...]`. |
| T-071-02-04 | Synthetic fixture committed to repo accidentally infringes copyright | Compliance | Low | Medium | `academic_synth.pdf/docx` is generated programmatically via reportlab + python-docx (matching `_generate_fixtures.py:35-143` pattern). No copyrighted content. |
| T-071-02-05 | `EXTRACTOR_PRIMARY` env var read once at module top is stale after env var changes | Integrity | Low | Low | Documented in CONTEXT.md D-071-12 ("cached after first read"). To change, restart worker — same posture as every other env-driven setting. |
| T-071-02-06 | New optional fields in `ExtractedDocument` break existing Phase 069 golden tests | Regression | High (without care) | Medium (test failures block phase) | All new fields default to `None`/`null`. `LegacyExtractor` returns instances WITHOUT setting the new fields. Plan 02 task: rerun `_generate_fixtures.py write_golden_jsons()` after the dataclass extension to refresh `reference_pdf_golden.json` + `reference_docx_golden.json` with the new keys (defaults). Two valid paths: (a) explicitly set `extractor_name='pypdf-legacy'` (CONTEXT.md discretion recommends explicit) and accept the golden diff; (b) leave default `None` and accept the golden diff with `null` keys added. Both are byte-equivalent semantically; pick (a) for clarity. |
| T-071-02-07 | `pdf_extraction_runs` row INSERT fails mid-write; partial-row visible to dashboard | Integrity | Low | Low (atomic INSERT — either whole row or no row) | Single INSERT statement; Supabase handles transactionally. Insert-at-end pattern (D-071 discretion) avoids partial-row state. |

### Plan 03 — PyMuPDF subprocess fence

| Threat ID | Vector | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| T-071-03-01 | Malicious PDF input triggers RCE in PyMuPDF parser (CVE history exists for MuPDF) | Tampering (code exec) | Low (subprocess child only) | Medium (child compromised but ISOLATED — only sees raw bytes + has no Supabase creds) | Subprocess fence IS the mitigation. Child has no env-var inheritance for `SUPABASE_SERVICE_ROLE_KEY` (Plan 03 task: explicitly clear sensitive env vars before `subprocess.run` — pass `env={"PATH": os.environ["PATH"]}` only). Keep `pymupdf>=1.24` for security fixes (the venv has 1.27.2 — already current). |
| T-071-03-02 | Child process produces malformed JSON on stdout (e.g., from a crash mid-write) | Tampering / Availability | Medium | Low (parser raises `json.JSONDecodeError` → `ExtractionError`) | Parent wraps `json.loads(result.stdout)` in try/except; raise `ExtractionError` with last stderr line on parse failure. Documented in Pattern 2. |
| T-071-03-03 | Child times out, SIGKILL leaves orphan child on Windows | Availability | Low (Windows-specific edge) | Low (orphan eventually exits) | Pitfall 5 mitigation: explicit `process.kill(); process.wait(timeout=5)` if needed. Baseline `subprocess.run` handles 99% of cases. |
| T-071-03-04 | Parent process accidentally imports `fitz` via a transitive dep | Compliance (AGPL) | Low | High (AGPL trigger fires; license violation) | 4-layer defense (Pattern 4 + structural fence). Test `test_fitz_not_imported_by_parent` runs in CI. |
| T-071-03-05 | Child entrypoint located at `backend/extractors/pymupdf_isolated.py` but invoked via `python -m extractors.pymupdf_isolated` — the `extractors` package isn't on `sys.path` | Availability | Medium (configuration error) | High (subprocess fails immediately) | Plan 03 task: invoke with explicit `cwd=Path(__file__).resolve().parent.parent.parent` (= `backend/`) on the subprocess.run call. Or: use `["python", "-c", "import sys; sys.path.insert(0, 'backend'); import extractors.pymupdf_isolated as m; m.main()", "--mime", ...]` — uglier. RECOMMENDATION: set `cwd="backend"` (or equivalent absolute path resolved at module import time of `pymupdf.py`); document in the parent wrapper. |
| T-071-03-06 | Child output too large for stdout pipe → parent deadlock | Availability | Low (subprocess.run uses `capture_output=True` which buffers everything to memory) | Low | `subprocess.run` with `capture_output=True` reads stdout fully into memory before returning. No pipe-buffer deadlock. For pathological 70+MB outputs, memory spike is the cost — acceptable per "rare opt-in fallback" framing. |
| T-071-03-07 | b64-decoded image bytes from child are tampered (e.g., bit-flipped) | Integrity | Low | Low (downstream PIL Image.open raises if malformed) | Parent wraps `base64.b64decode + Image.open` in try/except; skip bad images with a warning. Same as today's pdfplumber error path. |

### Plan 04 — `/reextract` endpoint + UAT + summary

| Threat ID | Vector | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| T-071-04-01 | `/reextract` endpoint allows user A to reextract user B's document (IDOR) | Information disclosure / Tampering | Low (RLS guards) | Critical | Owner-only check at the route: `supabase.table("documents").select("*").eq("id", document_id).eq("user_id", current_user["id"]).maybe_single().execute()`. Same pattern as `/reingest` at `documents.py:436-446`. Plan 04 task: integration test asserting 404 (not 403 — don't leak existence) when user A targets user B's doc. |
| T-071-04-02 | `/reextract` body accepts invalid engine value; downstream `get_extractor(engine_override=...)` raises ValueError | Availability | Medium | Low (400 to caller) | Pydantic model in route signature with `engine: Literal["docling", "pymupdf", "legacy"]`. FastAPI returns 422 automatically on invalid value. Plan 04 test: POST `{engine: "rust"}` → 422. |
| T-071-04-03 | `/reextract` double-click race: user clicks twice; two BackgroundTasks queue; second one runs on a partially-processed doc | Race | Medium (UI doesn't block) | Medium (duplicate chunks possible; status thrash) | CONTEXT.md deferred-items: idempotency guard deferred. Existing `/reingest` has no guard either. Re-open trigger: observed in UAT. Acceptable for v2.6. |
| T-071-04-04 | Hard delete + replace step deletes chunks/tables/images BEFORE the new extraction completes; if the new extraction fails, the doc is now empty in DB | Availability | Medium | High (user sees their doc with 0 chunks if extraction crashes) | `ingest_document`'s existing `except Exception` catches and sets `status='failed'`; the chunks/tables/images stay deleted but the row is flagged. Phase 071 docs note: failed `/reextract` leaves the doc in `status='failed'` with no content; user must retry. This is the intended behavior — no auto-rollback (would require a transaction across BackgroundTask + DB which gets complex). |
| T-071-04-05 | `pdf_extraction_runs` row written even for `/reextract` that fails before the extract returns; row has `error` populated but `duration_ms` = wall-time-up-to-failure | Integrity | Low | Low (matches contract) | Plan 02 telemetry writer wraps the entire extract in `time.perf_counter()` so partial-duration is captured. `error` field gets the exception class + message. |
| T-071-04-06 | Live UAT on `551f03f9-...` PDF/DOCX pair fails the 20% delta gate → SC#1 not closeable | Regression risk | Medium | Phase blocked | CONTEXT.md "Specific Ideas" line 278: "If Plan 04's UAT shows the delta is still > 20% after Docling, the phase is NOT closeable — investigate (PyMuPDF-on-PDF? Docling pipeline_options for higher-accuracy mode?) before declaring done." Plan 04 task: capture before/after counts in `071-VERIFICATION.md`; if delta > 20%, escalate (try `pipeline_options.do_ocr=True`, or test `engine=pymupdf` on the PDF side). |
| T-071-04-07 | Chrome MCP login session expired during UAT; can't reach localhost:5173 | Process | Low | Low (retry login) | Memory `reference_local_dev_app.md`: test creds `fhdmrd@gmail.com / 123456` available for re-login. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >= 8.0 + pytest-asyncio >= 0.24 + pytest-timeout >= 2.4 (verified `requirements.txt:24-26`) |
| Config file | `backend/pyproject.toml` or `backend/pytest.ini` (one of the two — verified by Phase 070 spike running the suite) |
| Quick run command | `"backend/venv/Scripts/python.exe" -m pytest backend/tests/integration/test_pdf_extractor_docling_compat.py backend/tests/unit/test_extraction_service.py backend/tests/integration/test_docling_extractor.py backend/tests/integration/test_pymupdf_fence.py -x` |
| Full suite command | `"backend/venv/Scripts/python.exe" -m pytest backend/tests/ --timeout=60 -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RAG-DOCLING-01 (SC#1 binding) | Re-ingest `551f03f9-...` PDF + DOCX under Docling; assert `abs(pdf - docx) / max(pdf, docx) ≤ 0.2` for both table_count and image_count | live UAT (Chrome MCP — NOT codified in pytest; license-bound) | manual via Chrome MCP per D-071-15; captured in `071-VERIFICATION.md` | N/A (live; no fixture) |
| RAG-DOCLING-01 (SC#1 regression net) | Synthetic `academic_synth.{pdf,docx}` via DoclingExtractor produces ≥ N tables + ≥ M images on each sibling | integration | `pytest backend/tests/integration/test_docling_extractor.py::test_docling_academic_synth_pdf_tables_images -x` | ❌ Wave 0 — Plan 02 creates both fixture + test |
| RAG-DOCLING-01 (SC#2: lineage) | New ingest's `documents.extractor` = `'docling'`; backfill set existing rows to `'pypdf-legacy'`; `document_tables.extractor` populated when engine='docling' (but bbox stays empty — Pitfall 4) | integration | `pytest backend/tests/integration/test_documents.py::test_upload_records_extractor -x` | ❌ Wave 0 — Plan 01/02 extends `test_documents.py` |
| RAG-DOCLING-01 (SC#3: /reextract returns 202) | `POST /documents/{id}/reextract` body `{engine: pymupdf}` → 202 + doc row; BackgroundTask queued; engine_override propagated | integration | `pytest backend/tests/integration/test_documents.py::test_reextract_returns_202 -x` ; `pytest backend/tests/integration/test_documents.py::test_reextract_rejects_invalid_engine -x` ; `pytest backend/tests/integration/test_documents.py::test_reextract_owner_only -x` | ❌ Wave 0 — Plan 04 |
| RAG-DOCLING-01 (SC#4: telemetry) | After successful extract, `pdf_extraction_runs` row exists with engine + duration_ms + table_count + image_count; on failure has `error` populated | integration | `pytest backend/tests/integration/test_documents.py::test_extraction_telemetry_recorded -x` | ❌ Wave 0 — Plan 02 |
| RAG-DOCLING-01 (SC#5: Q-v2.6-04 lock) | `D-v2.6-04` row appended to `.planning/PROJECT.md` | doc | manual grep: `grep "D-v2.6-04" .planning/PROJECT.md` ≥ 1 hit | ❌ Wave 0 — Plan 04 |
| RAG-DOCLING-01 (AGPL fence invariant) | `'fitz' not in sys.modules` after importing parent-side extraction modules | integration | `pytest backend/tests/integration/test_pymupdf_fence.py::test_fitz_not_imported_by_parent -x` | ❌ Wave 0 — Plan 03 |
| RAG-DOCLING-01 (PyMuPDF subprocess happy path) | Child returns valid JSON for the reference fixture; parent decodes to ExtractedDocument | integration | `pytest backend/tests/integration/test_pymupdf_fence.py::test_pymupdf_subprocess_extracts_reference -x` | ❌ Wave 0 — Plan 03 |
| RAG-DOCLING-01 (PyMuPDF timeout) | Parent raises `ExtractionError("pymupdf timed out after Ns")` after `PYMUPDF_TIMEOUT_S` | integration | `pytest backend/tests/integration/test_pymupdf_fence.py::test_pymupdf_timeout_raises -x` (uses `PYMUPDF_TIMEOUT_S=1` + mocked slow child) | ❌ Wave 0 — Plan 03 |
| Phase 070 binding gate (must stay green) | docling + supabase coexistence | integration | `pytest backend/tests/integration/test_pdf_extractor_docling_compat.py -x` | ✅ Exists — verified `backend/tests/integration/test_pdf_extractor_docling_compat.py:1-56` |
| Phase 069 golden tests (must stay green or update) | `LegacyExtractor` output byte-equivalent (with new optional fields = None or explicit pypdf-legacy) | unit | `pytest backend/tests/unit/test_extraction_service.py -x` | ✅ Exists — verified `backend/tests/unit/test_extraction_service.py`. Plan 02 task: re-run `_generate_fixtures.py write_golden_jsons()` after dataclass extension to refresh goldens. |

### Sampling Rate

- **Per task commit:** Quick run command above (extractor + fence tests, ~30s).
- **Per wave merge:** Full suite (`pytest backend/tests/ --timeout=60 -q`, target ≤ 3 min wall-clock). Plan 02's first test run will be slow (Docling first-call download); pre-pull manually before to keep wall-clock down.
- **Phase gate:** Full suite green + Plan 04 live UAT (`551f03f9-...` 20% delta) before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `backend/tests/integration/test_docling_extractor.py` — covers RAG-DOCLING-01 SC#1 regression-net (Plan 02).
- [ ] `backend/tests/integration/test_pymupdf_fence.py` — covers AGPL invariant + subprocess happy/timeout paths (Plan 03).
- [ ] `backend/tests/fixtures/extraction/academic_synth.pdf` + `academic_synth.docx` + sibling generator function in `_generate_fixtures.py` — generated synthetic with ~5 tables + ~5 images (Plan 02).
- [ ] `backend/tests/integration/test_documents.py` extensions for `/reextract` (happy / invalid engine / RLS / telemetry) — Plan 04.
- [ ] No framework install needed (pytest stack already in `requirements.txt`).
- [ ] Pre-pull command for CI: `python -c "from docling.document_converter import DocumentConverter; DocumentConverter().convert('backend/tests/fixtures/extraction/reference.pdf')"` — CI step ahead of pytest invocation to avoid 60-180s test stall on first call.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing FastAPI `get_current_user` dependency (`backend/app/dependencies.py`) — unchanged. `/reextract` inherits the same JWT-bearer flow as `/reingest`. |
| V3 Session Management | no | Server-side stateless; JWT-only. No new session surface in this phase. |
| V4 Access Control | yes | Owner-only RLS on `documents` table preserved; `/reextract` filters `user_id = current_user["id"]`. `pdf_extraction_runs` RLS keyed on `user_id` via FK (SELECT-only policy). |
| V5 Input Validation | yes | `/reextract` body schema = `{engine: Literal["docling", "pymupdf", "legacy"]}` via Pydantic. Invalid value → 422 automatically. Document IDs validated as UUID by FastAPI path-param coercion. Raw PDF bytes are NEVER eval'd or used as code — only passed to Docling (`.convert()`) or PyMuPDF subprocess stdin. |
| V6 Cryptography | no | No new cryptographic primitives. Existing service-role key stays in env var; child subprocess does NOT inherit it (env scrubbed per T-071-03-01 mitigation). |
| V12 File Resources | yes | Raw bytes flow: Storage → in-memory bytes → `extract()` → DB row. NEVER touch the filesystem in the parent for new extractors (Docling temp file via `tempfile.NamedTemporaryFile` is acceptable — `probe_multimodal.py:196-200` reference pattern). Subprocess child consumes stdin only — no temp files (D-071-01). |
| V13 API Security | yes | `/reextract` rate limit: inherits app-level (none yet — owner-only is the gate). v3.1 admin shell adds per-user concurrent-extract caps; out of scope here. |

### Known Threat Patterns for FastAPI + Supabase + Subprocess

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via filename | Tampering | N/A — `/reextract` takes a UUID `document_id`, not a filename. Filename comes from the existing `documents.filename` column (set at upload time, sanitized then). |
| SQL injection via filter on user-supplied document_id | Tampering | Supabase parameterized queries (`.eq("id", document_id)`) — UUID coercion at FastAPI path layer. |
| IDOR (cross-user document access) | Information disclosure | RLS + explicit `user_id = current_user["id"]` filter in route handler. Plan 04 integration test asserts 404 (not 403). |
| Subprocess command injection via mime argv | Tampering / Code execution | `mime` value comes from `documents.mime_type` (DB-stored, validated at upload via `ALLOWED_MIME_TYPES` set at `documents.py:19-31`). Even if compromised, `subprocess.run([list, of, args])` (NOT `shell=True`) prevents shell injection. |
| Resource exhaustion via malicious PDF (CPU loop / memory bomb) | DoS | Docling: `PdfPipelineOptions.document_timeout=120.0` (T-071-02-03). PyMuPDF: `PYMUPDF_TIMEOUT_S=60` (D-071-03). Both kill long-running extractions. |
| Information disclosure via stderr leak (stack traces with file paths) | Information disclosure | Subprocess stderr captured into `result.stderr`; parent surfaces only the LAST line to the user (via `ExtractionError`'s message). Full traceback logged server-side via `log.error` for ops. |
| AGPL licensing trigger (copyleft viral linking) | Compliance | 4-layer defense (file-tree + lint + invariant test + subprocess). D-PRD-07 Appendix locks the contract; Plan 03 implements layers 1-3. |
| Storage-bucket access via document_id enumeration | Information disclosure | RLS on `storage.objects` (Supabase default for `documents` bucket) + path scoping `{user_id}/{document_id}/{filename}` per `documents.py:242`. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | All backend code | ✓ | (assumed — venv exists, Docling 2.93 runs there) | — |
| docling (in-process) | DoclingExtractor | ✓ | 2.93.0 (verified live 2026-05-14) | — |
| pymupdf (subprocess child) | PyMuPDFExtractor | ✓ | 1.27.2.3 (verified) | — |
| Pillow | Image b64 encoding | ✓ | (transitive — verified working in probe) | — |
| supabase-py | DB + Storage | ✓ | 2.29.0 (verified `requirements.txt:8`) | — |
| Docker Desktop + Supabase CLI | Local migration apply + regen | ✓ (assumed per CLAUDE.md project setup) | — | — |
| Chrome DevTools MCP | Live UAT for `551f03f9-...` | ✓ (per memory `feedback_chrome_mcp_testing.md`) | — | Manual upload via the UI at localhost:5173 (test creds `fhdmrd@gmail.com` / `123456`) |
| `~/.cache/docling/` writable | Lazy model download | ✓ on dev machines; ✓ on prod after first call | — | If unwritable, set `DOCLING_ARTIFACTS_PATH` env to a writable location (Docling supports this — verified field `artifacts_path` in `PdfPipelineOptions`). |

**No missing dependencies. No fallbacks needed.**

## Code Examples

### Docling adapter — full reference implementation

```python
# backend/app/services/extractors/docling.py
# Source: Verified live against Docling 2.93.0 + reference.pdf 2026-05-14
"""Docling-backed PdfExtractor (Phase 071 D-071-05..08)."""
from __future__ import annotations

import base64
import io
import logging
import threading
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING

from app.services.extraction_service import (
    DOCX_MIME,
    ExtractedDocument,
    ImageData,
    PdfExtractor,
    PDF_MIME,
    TableData,
)

if TYPE_CHECKING:
    from docling.document_converter import DocumentConverter
    from docling_core.types.doc.document import DoclingDocument, TableItem, PictureItem

log = logging.getLogger(__name__)

_CONVERTER: "DocumentConverter | None" = None
_CONVERTER_LOCK = threading.Lock()


def _get_converter() -> "DocumentConverter":
    """Lazy module-level singleton, double-checked-locked (D-071-06)."""
    global _CONVERTER
    if _CONVERTER is None:
        with _CONVERTER_LOCK:
            if _CONVERTER is None:
                from docling.document_converter import DocumentConverter, PdfFormatOption  # noqa: PLC0415
                from docling.datamodel.base_models import InputFormat  # noqa: PLC0415
                from docling.datamodel.pipeline_options import PdfPipelineOptions  # noqa: PLC0415

                opts = PdfPipelineOptions()
                opts.generate_picture_images = True   # required for p.get_image(doc) — Pitfall 3
                opts.images_scale = 2.0
                opts.document_timeout = 120.0         # T-071-02-03 mitigation
                log.info("DoclingExtractor: lazy-instantiating DocumentConverter (first call downloads ~600MB; subsequent calls are fast).")
                _CONVERTER = DocumentConverter(
                    format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
                )
    return _CONVERTER


def _to_table_data(t: "TableItem", ti: int) -> TableData:
    """Map Docling TableItem → ExtractedDocument.TableData (per adapter mapping)."""
    page = t.prov[0].page_no if t.prov else None
    bbox: dict | None = None
    if t.prov:
        bbox = t.prov[0].bbox.model_dump()
        bbox["page"] = page
        # coord_origin is a CoordOrigin enum — convert to str for JSON serializability
        if "coord_origin" in bbox and hasattr(bbox["coord_origin"], "value"):
            bbox["coord_origin"] = bbox["coord_origin"].value

    # Use grid traversal for explicit header detection; falls back to simpler
    # export_to_dataframe path if grid is empty.
    if t.data and t.data.grid and t.data.grid[0]:
        headers = [cell.text for cell in t.data.grid[0]]
        rows = [[cell.text for cell in row] for row in t.data.grid[1:]]
    else:
        headers, rows = [], []

    return TableData(
        page=page,
        table_index=ti,
        headers=headers,
        rows=rows,
        bbox=bbox,
    )


def _to_image_data(p: "PictureItem", pi: int, doc: "DoclingDocument") -> ImageData | None:
    """Map Docling PictureItem → ExtractedDocument.ImageData. Returns None if image isn't extractable."""
    img = p.get_image(doc)  # PIL Image or None (None if generate_picture_images=False)
    if img is None:
        return None
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    page = p.prov[0].page_no if p.prov else None
    bbox: dict | None = None
    if p.prov:
        bbox = p.prov[0].bbox.model_dump()
        bbox["page"] = page
        if "coord_origin" in bbox and hasattr(bbox["coord_origin"], "value"):
            bbox["coord_origin"] = bbox["coord_origin"].value
    return ImageData(
        page=page,
        image_index=pi,
        b64_png=b64,
        width=img.width,
        height=img.height,
        bbox=bbox,
    )


class DoclingExtractor(PdfExtractor):
    """Layout-aware PDF + DOCX extractor (D-071-05..08)."""

    def supports(self, mime: str) -> bool:
        return mime in (PDF_MIME, DOCX_MIME)

    def extract(self, raw: bytes, mime: str) -> ExtractedDocument:
        if not self.supports(mime):
            raise ValueError(f"DoclingExtractor does not support {mime!r}")

        import tempfile  # noqa: PLC0415
        # Docling 2.x's convert() takes a path; write raw bytes to a temp file.
        # (probe_multimodal.py:196-200 uses the same pattern.)
        suffix = ".pdf" if mime == PDF_MIME else ".docx"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tf:
            tf.write(raw)
            tmp_path = tf.name

        try:
            converter = _get_converter()
            result = converter.convert(tmp_path)
            doc = result.document

            text = doc.export_to_text()
            try:
                full_markdown = doc.export_to_markdown()
            except Exception as exc:  # noqa: BLE001
                log.warning("Docling export_to_markdown failed: %s", exc)
                full_markdown = None

            tables: list[TableData] = []
            table_error: str | None = None
            try:
                tables = [_to_table_data(t, ti) for ti, t in enumerate(doc.tables)]
            except Exception as exc:  # noqa: BLE001
                table_error = str(exc)
                log.warning("Docling table mapping failed: %s", exc)

            images: list[ImageData] = []
            image_error: str | None = None
            try:
                for pi, p in enumerate(doc.pictures):
                    im = _to_image_data(p, pi, doc)
                    if im is not None:
                        images.append(im)
            except Exception as exc:  # noqa: BLE001
                image_error = str(exc)
                log.warning("Docling image mapping failed: %s", exc)

            return ExtractedDocument(
                text=text,
                tables=tuple(tables),
                images=tuple(images),
                table_extraction_error=table_error,
                image_extraction_error=image_error,
                full_markdown=full_markdown,
                extractor_name="docling",
            )
        finally:
            try:
                import os  # noqa: PLC0415
                os.unlink(tmp_path)
            except Exception:
                pass
```

### `pdf_extraction_runs` telemetry write (inside `ingest_document`)

```python
# Source: D-071 discretion + insert-at-end pattern
import time
# (inside ingest_document, after extract returns, before status='completed')
extract_start = time.perf_counter()  # set BEFORE the extractor.extract() call
# ... extractor runs ...
duration_ms = int((time.perf_counter() - extract_start) * 1000)
supabase.table("pdf_extraction_runs").insert({
    "document_id": document_id,
    "user_id": user_id,
    "engine": extracted.extractor_name or "unknown",
    "started_at": started_at_iso,            # captured pre-extract via .now().isoformat()
    "completed_at": "now()",                  # let Postgres set it via default
    "duration_ms": duration_ms,
    "table_count": len(extracted.tables),
    "image_count": len(extracted.images),
    "error": None,
}).execute()

# On failure (inside the existing except Exception):
supabase.table("pdf_extraction_runs").insert({
    "document_id": document_id,
    "user_id": user_id,
    "engine": engine_override or os.getenv("EXTRACTOR_PRIMARY", "docling"),
    "started_at": started_at_iso,
    "completed_at": "now()",
    "duration_ms": int((time.perf_counter() - extract_start) * 1000),
    "table_count": 0,
    "image_count": 0,
    "error": str(e)[:1000],
}).execute()
```

### `/reextract` route (pattern of D-071-09..10)

```python
# Source: D-071-09..10 + sibling pattern from /reingest at documents.py:427-491
from pydantic import BaseModel
from typing import Literal

class ReextractRequest(BaseModel):
    engine: Literal["docling", "pymupdf", "legacy"]


@router.post("/{document_id}/reextract", response_model=DocumentResponse, status_code=202)
async def reextract_document(
    document_id: str,
    body: ReextractRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Re-extract a single document with an explicit engine override (D-071-09..12).

    Distinct from POST /reingest (which re-runs the global default).
    """
    # 1. Owner-only RLS check (T-071-04-01)
    doc = (
        supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .eq("is_latest", True)
        .maybe_single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
    target = doc.data

    # 2. Fetch raw bytes
    try:
        raw = supabase.storage.from_("documents").download(target["file_path"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not retrieve stored file: {e}")

    # 3. Hard delete + replace (D-071-10)
    supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
    supabase.table("document_tables").delete().eq("document_id", document_id).execute()
    supabase.table("document_images").delete().eq("document_id", document_id).execute()

    # 4. Reset doc status (NOTE: extractor=None signals "engine_override determined at ingest")
    result = (
        supabase.table("documents")
        .update({"status": "pending", "extractor": None, "ingestion_step": None, "error_message": None})
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found after update")

    # 5. Extract text up-front (existing /reingest pattern)
    from app.services.extraction_service import get_extractor  # noqa: PLC0415
    try:
        extractor = get_extractor(target["mime_type"], engine_override=body.engine)
        if extractor is not None:
            text = extractor.extract(raw, target["mime_type"]).text
        else:
            text = extract_text(raw, target["mime_type"])
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not extract text: {e}")

    # 6. Schedule background ingestion with explicit engine_override (D-071-10 step 5)
    background_tasks.add_task(
        ingest_document,
        document_id,
        text,
        current_user["id"],
        supabase,
        raw,
        target["mime_type"],
        target["filename"],
        body.engine,           # engine_override kwarg (new in Plan 02)
    )
    return result.data[0]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pypdf + pdfplumber for PDF text/tables/images | Docling (in-process, MIT-licensed, IBM Research) | Docling 2.x stable since 2024-Q4; Phase 070 spike confirmed 2026-05-13 | ~80% of the user-observed 5/4 vs 50+/0 thesis gap closes; layout-aware extraction reads in correct order |
| python-docx + inline_shapes for DOCX | Docling (primary) + python-docx (legacy fallback) | Phase 071 | DOCX reads `related_parts` walk via Docling for floating shapes (Phase 072 finishes the legacy path's parity) |
| AGPL fallback engines linked in-process | AGPL fallback engines in subprocess fence (PyMuPDF) | D-PRD-07 Appendix (Phase 069); fence implemented Phase 071 | License-clean for closed-core distribution path D-PRD-03 |
| Manual `extract_text` switch with try/except per format | `PdfExtractor` ABC with `get_extractor(mime, engine_override)` dispatcher | Phase 069 (ABC); Phase 071 (overrides) | Per-document engine swap without flipping global default; matches admin operational model |
| Module-constant ceilings (`_MAX_VISION_CALLS=20`, `_MAX_B64_BYTES=512K`) | `app_settings`-driven (table contract laid in 044; reader hookup in 071; ceiling lift in Phase 072) | Migration 044 (Phase 071 contract); Phase 072 (actual lift) | Admin-tunable; ends `app_settings` dead-code state for these two keys |

**Deprecated/outdated:**
- pdfplumber `extract_tables()` for layout-aware academic PDFs — produces 5 tables on the reference thesis where Docling finds 50+. Not deprecated as a library, but no longer the *primary* tool.
- `inline_shapes` walk for DOCX image extraction — misses floating shapes + header images. Phase 072 replaces with `doc.part.related_parts` walk.
- pypdf `extract_text()` as primary text extractor — produces serialized-but-out-of-order text on multi-column PDFs. Still valid for simple linear PDFs (`LegacyExtractor` retained as `engine='legacy'`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Migration 043's `ctid NOT IN (SELECT MIN(ctid) ...)` keeps OLDEST row per duplicate group | Migration Verification Matrix #5 | If user prefers most-recent: dedup wins different row; oldest is the safer default (it has dependents like message refs from longer history). [ASSUMED — verify with user during plan-phase if their dev DB has duplicates worth preserving deliberately.] |
| A2 | Setting `PdfPipelineOptions.document_timeout=120.0` actually enforces a hard timeout inside Docling | Threat T-071-02-03 | If not enforced: malicious PDFs could hang a worker thread. [VERIFIED field exists; behavior CITED from upstream docs but not load-tested in this research.] |
| A3 | Recommendation to use `t.export_to_dataframe(doc)` for v1 table rows is simpler than grid traversal | Docling Adapter Mapping (alternative) | If grid traversal is needed for row-span / col-span data, refactor cost is ~1 hour. [ASSUMED — pick based on Plan 02 author's preference; both produce correct output on the reference fixture.] |
| A4 | Child entrypoint `python -m extractors.pymupdf_isolated` requires `cwd="backend"` to find the package | Threat T-071-03-05 | If wrong: subprocess fails with `No module named 'extractors'`. [ASSUMED — Plan 03 must test the actual invocation with the chosen `cwd`.] |
| A5 | `tempfile.NamedTemporaryFile` is safe on Windows + Linux for Docling's path-based API | Docling adapter implementation | Windows has known quirks where the file can't be reopened while the handle is held — uses `delete=False` + manual unlink in finally. [VERIFIED pattern exists in `probe_multimodal.py:196-200`.] |
| A6 | Re-running `_generate_fixtures.py write_golden_jsons()` after the dataclass extension produces a clean diff (only added `null`/`pypdf-legacy` keys) | Threat T-071-02-06 | If `LegacyExtractor` semantics shifted (e.g., new field defaults are eagerly populated): golden diff is larger than expected. [ASSUMED — Plan 02 task verifies via `git diff backend/tests/fixtures/extraction/reference_*_golden.json`.] |
| A7 | `pdf_extraction_runs` "insert at end with full row" is preferable to "insert at start + UPDATE at end" | D-071 discretion captured in code-example | If observability needs visible-while-running rows, UPDATE pattern wins. [ASSUMED — CONTEXT.md explicitly leaves this to Claude's discretion; recommend insert-at-end for atomicity.] |
| A8 | The Phase 070 binding gate test `test_pdf_extractor_docling_compat.py` stays green through Phase 071's changes | Test Framework table | If Phase 071's `requirements.txt` edits (adding `pymupdf>=1.24` direct pin) trigger pip-resolver to re-pick a different httpx: the gate flashes red. [VERIFIED conceptually — direct pin of pymupdf<X doesn't constrain httpx; Plan 03 must run the gate after adding the line.] |

**Eight assumptions total** — most are low-risk parameterizations. A1 (dedup winner heuristic) and A4 (subprocess cwd) are the two that most warrant explicit verification during plan-phase / Plan 01 / Plan 03 respectively.

## Open Questions

1. **A1: Migration 043 dedup winner heuristic — does the user prefer oldest or most-recent row?**
   - What we know: PRD §6 row 8 mitigation says `ctid NOT IN (SELECT MIN(ctid) ...)` → keeps oldest.
   - What's unclear: Whether the user has duplicates in their live DB they'd prefer to keep the *most-recent* version of.
   - Recommendation: Plan 01 task runs a DRY-RUN SELECT first that lists every duplicate group + its winning row; user reviews before applying the DELETE. If user wants newest, swap to `MAX(ctid)`.

2. **Should Plan 02 explicitly set `LegacyExtractor.extract()` to return `extractor_name='pypdf-legacy'` (vs leaving None)?**
   - What we know: CONTEXT.md "Claude's Discretion" recommends explicit for clarity.
   - What's unclear: Whether the goldens get re-captured with the explicit string or with `None`.
   - Recommendation: Explicit. Update the dataclass + re-run `_generate_fixtures.py write_golden_jsons()` once; the JSON diff is one key-value change per fixture. (D-PRD-07 Appendix and downstream telemetry are cleaner with explicit lineage.)

3. **What `engine` value does the telemetry writer record when `/reextract` body says `engine=legacy`?**
   - What we know: D-071-12 says `LegacyExtractor` is registered as `'legacy'`.
   - What's unclear: But the column backfill set existing rows to `'pypdf-legacy'`. Should an explicit `/reextract engine=legacy` write `'legacy'` or `'pypdf-legacy'`?
   - Recommendation: Match the column. `LegacyExtractor.extract()` returns `extractor_name='pypdf-legacy'`. Both the new column write AND the telemetry row use `'pypdf-legacy'`. The `engine` argv-style value `'legacy'` is the public-API shorthand; internally it maps to the canonical string `'pypdf-legacy'`. Plan 02 task: document this mapping in a small constants dict at the top of `extraction_service.py`.

4. **Does Plan 02's synthetic `academic_synth.pdf` fixture (~5 tables + 5 images) need to be checked into git, or generated on first test run?**
   - What we know: `_generate_fixtures.py` is the pattern; existing `reference.{pdf,docx}` ARE committed.
   - What's unclear: License-clean synthetic generation is reproducible, but checking in keeps test runs deterministic across reportlab version drift.
   - Recommendation: Check in. Mirror `reference.{pdf,docx}` precedent. ~50KB each — negligible repo bloat.

5. **Should `EXTRACTOR_PRIMARY` validation in `get_extractor` log a warning AND fall through to `'docling'`, or raise?**
   - What we know: CONTEXT.md D-071-12 says "Invalid env value → log warning + fall through to 'docling'".
   - What's unclear: Whether the warning is logger-level WARNING or ERROR.
   - Recommendation: WARNING. The system still functions (docling default), so ERROR is too noisy. The misconfig is operator-side; an INFO log on every dispatch would be too chatty.

6. **Does Plan 04's Chrome MCP UAT require fresh re-uploads of the PDF + DOCX siblings, or can it `/reextract` the existing `551f03f9-...` rows in place?**
   - What we know: D-071-15 says "Re-ingest both the PDF and DOCX siblings via `POST /reextract` with `engine=docling`."
   - What's unclear: Whether the existing `551f03f9-...` row's content_hash matches the user's current local file (could have drifted), or whether to upload a fresh copy.
   - Recommendation: Use `/reextract engine=docling` on existing rows (D-071-15 verbatim). If counts come out unexpectedly low, fall back to re-upload; capture both counts in `071-VERIFICATION.md`.

## Reported Bugs Cross-Check

CONTEXT.md confirmed; verified directly via `.planning/reported-bugs/` 2026-05-14:

| Bug report | Surface | Affected areas | Touches ingestion? | Routing |
|---|---|---|---|---|
| `anthropic-end-of-cycle-shows-actions-not-summary.md` | Agentic-RAG | backend/agent-loop, backend/system-prompts, frontend/chat-surface, provider/anthropic-native-sdk | NO — agent loop only | LEAVE OPEN; future agent-loop phase |
| `streaming-indicator-top-bottom-desync.md` | Agentic-RAG | frontend/streaming, frontend/typing-indicator, frontend/tool-card-display | NO — frontend streaming only | LEAVE OPEN; future streaming-UX phase |
| `tool-output-download-bloat-intermediate-artifacts.md` | Agentic-RAG | frontend/tool-card-display, frontend/code-execution-output, frontend/chat-surface, UX/cognitive-load | NO — frontend tool cards | LEAVE OPEN; future polish phase |
| `thread-switch-blank-state-load-latency.md` | Agentic-RAG | frontend/chat-surface, frontend/streaming, frontend/navigation, UX/loading-states | NO — already folded into Phase 068 | (closed via 068) |
| `claude-ai-multi-step-code-execution-ux.md` | Claude.ai | (none) | NO — external observation | (external-noted) |

**Phase 071 routing decision: NO BUG REPORTS FOLDED.** All five `surface: Agentic-RAG` reports either touch frontend / agent-loop concerns (not ingestion / RAG / multimodal extraction) or were already folded into Phase 068. Reaffirms CONTEXT.md line 233.

## Sources

### Primary (HIGH confidence)

- **Docling 2.93.0** — installed in `backend/venv` and probed live 2026-05-14 against `backend/tests/fixtures/extraction/reference.pdf`. Verified:
  - `result.document.model_fields = ['schema_name', 'version', 'name', 'origin', 'furniture', 'body', 'groups', 'texts', 'pictures', 'tables', 'key_value_items', 'form_items', 'field_regions', 'field_items', 'pages']`
  - `TableItem` fields and `TableData.grid`/`num_rows`/`num_cols`
  - `PictureItem` requires `generate_picture_images=True` for `.get_image(doc)` to return a PIL Image
  - `prov[0].bbox.model_dump()` shape
  - `export_to_markdown()` and `export_to_text()` both return `str`
- **PyMuPDF 1.27.2.3** — installed in `backend/venv` and probed live 2026-05-14. Verified: `fitz.Document(stream=raw, filetype='pdf')`, `page.find_tables()`, `page.get_images(full=True)`, `doc.extract_image(xref)` returns `{image, width, height, ext}`.
- `.planning/phases/071-docling-primary-path/071-CONTEXT.md` — locked decisions D-071-01..16.
- `.planning/PRDs/v2.6.md` §5 line 136 — `pdf_extraction_runs` schema spec verbatim.
- `.planning/ROADMAP.md` lines 277-287 — Phase 071 SC#1..5.
- `.planning/REQUIREMENTS.md` line 16 — RAG-DOCLING-01 verbatim.
- `.planning/prd-reset/DECISIONS.md` D-PRD-07 + Appendix (lines 599-650) — AGPL fence contract.
- `.planning/phases/070-docling-httpx-spike/070-SUMMARY.md` — Path (a) win; pins locked.
- `.planning/phases/069-pdfextractor-abstraction-scaffold/069-CONTEXT.md` — ABC contract; single-pass `extract()`; D-069-04 silent-swallow.
- `backend/app/services/extraction_service.py:1-188` — actual current code, verified.
- `backend/app/api/documents.py:226-239, 427-491, 634-729` — upload + /reingest + ingest_document, verified.
- `backend/scripts/probe_multimodal.py:184-200, 256-292` — Docling probe reference.
- `backend/tests/integration/test_pdf_extractor_docling_compat.py` — Phase 070 binding gate.
- `backend/tests/fixtures/extraction/_generate_fixtures.py` — fixture generator pattern.
- `backend/requirements.txt:1-31` — current pins verified.
- `scripts/regenerate-full-schema.sh:1-127` — migration regen workflow verified.
- `supabase/migrations/035_runs_table.sql:20-54` — RLS template for `pdf_extraction_runs`.
- `supabase/full-schema.sql:302-353` — current `document_images` / `document_tables` / `documents` schemas (target for migration ADD COLUMN).
- `CLAUDE.md` — project rules verbatim (venv, no LangChain, migration discipline, etc.).
- `.planning/reported-bugs/*.md` — all 5 reports' frontmatter cross-checked.

### Secondary (MEDIUM confidence — official docs cited, not load-tested in this research)

- Docling 2.x official docs (https://github.com/docling-project/docling — README and `docs/usage.md`) — `PdfPipelineOptions` field list including `do_ocr`, `do_table_structure`, `generate_picture_images`, `document_timeout`, `images_scale`.
- PyMuPDF (https://pymupdf.readthedocs.io/) — `page.find_tables()` since 1.23.0; `Table.extract()`, `Table.bbox`.
- Python subprocess documentation (https://docs.python.org/3/library/subprocess.html) — `subprocess.run(input=..., capture_output=True, timeout=..., check=False)` semantics; SIGKILL behavior on timeout (POSIX); Windows `TerminateProcess` quirks.

### Tertiary (LOW confidence — none in this research)

All key claims are HIGH or MEDIUM confidence — the Docling API surface was verified live in the installed venv; the PyMuPDF API was verified live; the project file contents were read directly. No LOW-confidence claims surface here that need user validation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified live in `backend/venv` 2026-05-14.
- Docling adapter mapping: HIGH — every field traced through live `result.document` introspection on the reference fixture.
- Migration verification: HIGH — schema targets verified in `supabase/full-schema.sql`; CLAUDE.md procedure verbatim.
- AGPL subprocess fence: HIGH — PyMuPDF API verified live; subprocess pattern matches Python stdlib docs; 4-layer defense is project-locked.
- Threat model: MEDIUM-HIGH — STRIDE coverage explicit; mitigations cite CONTEXT.md decisions verbatim; A1 (dedup heuristic) and A4 (subprocess cwd) are assumed and need plan-phase confirmation.
- Validation architecture: HIGH — pytest stack already in `requirements.txt`; Wave 0 gaps explicit.
- Open questions: 6 listed; 5 are recommendations the planner can adopt; 1 (Q1: dedup winner) needs user confirmation.

**Research date:** 2026-05-14
**Valid until:** 2026-06-13 (30 days; Docling 2.x is stable, pins are locked under D-v2.6-01 regression guardrail).
