# Agentic RAG — Backend Runbook

Production-friendly setup, run, and operational notes for the FastAPI backend.

For the top-level project narrative + stack details, see [`../README.md`](../README.md)
and [`../CLAUDE.md`](../CLAUDE.md).

---

## Setup

Requires Python 3.11+. The backend MUST run under its own virtual environment
(no system-level packages).

```bash
cd backend
python -m venv venv
source venv/bin/activate            # POSIX
# OR on Windows PowerShell:
# venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

The pin set is regression-guarded by `tests/integration/test_pdf_extractor_docling_compat.py`
(D-070-14). Bumping `supabase==2.29.0`, `httpx>=0.28.0,<0.29.0`, or
`docling>=2.93.0,<3.0.0` past their current caps requires re-running that test.
PyMuPDF (`pymupdf>=1.24`) is AGPL-3.0 and license-fenced behind the subprocess
isolation pattern in `backend/extractors/pymupdf_isolated.py` (D-PRD-07 Appendix);
the parent process MUST NOT `import fitz` directly — enforced by
`tests/integration/test_pymupdf_fence.py::test_fitz_not_imported_by_parent`.

Copy `.env.example` to `.env` and fill in the secrets (Supabase service-role key,
LLM provider keys, etc.). See [`../REDIS-SETUP.md`](../REDIS-SETUP.md) and
[`../supabase/SETUP.md`](../supabase/SETUP.md) for the infrastructure side.

## Run

Single uvicorn worker (D-v2.5-02 — superseded by D-PRD-12 in Phase 079 when
multi-worker readiness lights up):

```bash
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health: `GET http://localhost:8000/healthz` should return `{"status": "ok"}`.

Frontend dev server runs separately on port 5173 — see [`../README.md`](../README.md)
for the full local-dev story (Docker + Supabase + Redis containers).

## Migrations

**NEVER `supabase db push` / `supabase db reset`** — both wipe local dev data.

Migration application discipline (per CLAUDE.md + memory
`feedback_apply_migrations_via_sql_editor.md`):

1. Author a new migration at `../supabase/migrations/<NNN>_name.sql` (digits-only
   prefix — the Supabase CLI silently skips letter-suffixed files like `043b_...`).
2. Open the Supabase SQL editor:
   - **Local:** http://127.0.0.1:54323/project/default/sql/new
   - **Cloud:** the project's dashboard.
3. Paste the migration contents + Run.
4. Confirm zero errors.
5. Regenerate the bootstrap artifact:

   ```bash
   bash ../scripts/regenerate-full-schema.sh
   ```

   Default behavior is no-reset (live-DB dump per memory
   `feedback_regen_full_schema_no_reset.md`). Pass `--reset` only for CI / release
   verification (destructive — wipes local DB).
6. Commit migration + regenerated `../supabase/full-schema.sql` together.

Migration range reserved for v2.6: `039 – 049` (per
`../.planning/prd-reset/MIGRATION-RESERVATIONS.md`).

## Docling Pre-Pull

Docling auto-downloads ~600 MB of model weights to `~/.cache/docling` on the FIRST
`DocumentConverter().convert()` call. First user-facing extract is slow (~1–2 min);
subsequent calls are normal.

On a fresh deploy or fresh dev clone, pre-warm the cache BEFORE accepting user
uploads:

```bash
cd backend && source venv/bin/activate
python -c "from docling.document_converter import DocumentConverter; DocumentConverter().convert('tests/fixtures/extraction/reference.pdf')"
```

The first `convert()` call prints a one-time download progress bar; subsequent
runs are warm and complete in seconds.

**Why this matters:** the first PDF upload after a deploy will otherwise sit in
`status='processing'` for 1–2 minutes with no log output, which often gets killed
as a perceived deadlock. Pre-pull eliminates the issue.

(Pre-warming at FastAPI lifespan startup is deferred to the v3.1 admin shell — see
Phase 071 `deferred-items.md`.)

## Troubleshooting

### First Docling extract takes > 1 min

Expected on the very first call after a fresh `~/.cache/docling`. Run the pre-pull
command from the [Docling Pre-Pull](#docling-pre-pull) section once per machine.
If it persists beyond the first call: re-run the binding test to confirm the
dependency resolver hasn't broken supabase / httpx / docling coexistence:

```bash
cd backend && source venv/bin/activate
pytest tests/integration/test_pdf_extractor_docling_compat.py -x
```

### `pdf_extraction_runs` rows have engine='unknown'

The telemetry writer in `app/api/documents.py::ingest_document` resolves engine
lineage as `extracted_doc.extractor_name or engine_override or EXTRACTOR_PRIMARY
env or 'unknown'`. If you see `'unknown'` rows:
- Check `.env` for the `EXTRACTOR_PRIMARY` value; missing → set it to `docling`.
- Confirm `backend/app/services/extractors/docling.py` is wired (shipped in
  Phase 071 Plan 02).

### `import fitz` fails or the AGPL fence test trips

PyMuPDF (`fitz`) lives ONLY in `backend/extractors/pymupdf_isolated.py` — the
top-level package OUTSIDE `backend/app/`. Anything under `backend/app/` importing
`fitz` violates the AGPL fence per D-PRD-07 Appendix. Run the binding invariant
test:

```bash
cd backend && source venv/bin/activate
pytest tests/integration/test_pymupdf_fence.py::test_fitz_not_imported_by_parent -x
```

If it fails: a parent-side module just added an `import fitz` that needs to move
into the subprocess child entrypoint.

### Re-extracting a single document with an explicit engine override

Phase 071 Plan 04 ships `POST /documents/{id}/reextract` — opt-in per-document
re-extraction with an engine override (Q-v2.6-04 / D-v2.6-04). Body:

```json
{ "engine": "docling" | "pymupdf" | "legacy" }
```

Returns 202; hard-deletes existing chunks/tables/images and queues a fresh
ingestion under the chosen engine. Does NOT bump `version_number` (engine swap is
not a source-bytes change — D-25 contract preserved).

### Migration not applied / schema drift

Re-run the regen + verify:

```bash
bash ../scripts/regenerate-full-schema.sh
grep -c "pdf_extraction_runs" ../supabase/full-schema.sql   # should be ≥ 1
```

If the count is 0: the migration didn't run. Re-paste the SQL into the editor
following the [Migrations](#migrations) protocol.

### Docling timeout fallback to PyMuPDF

Phase 071.1 ships defense-in-depth timeout handling for
`POST /documents/{id}/reextract` when Docling is the engine. If Docling stalls
in native code (TableFormer or layout-prediction model wedge — observed on
large PDFs with complex layouts), the route's wall-clock fail-safe
(`asyncio.wait_for(timeout=EXTRACTOR_DOCLING_TIMEOUT_S + 10)`) fires, the
underlying thread leaks (Python cannot kill threads stuck in C code), and the
route automatically retries the same document via PyMuPDF in the same request
lifecycle.

The user-visible response is 202 (success — the document IS being ingested,
just on PyMuPDF). The audit trail in `pdf_extraction_runs` shows two rows for
that one `/reextract` call:

```sql
SELECT engine, error, duration_ms, table_count, image_count
FROM pdf_extraction_runs
WHERE document_id = '<doc-id>'
ORDER BY started_at DESC
LIMIT 5;
-- Expected on fallback:
-- engine='pymupdf-fallback'  error=NULL  duration_ms=...  table_count=...  image_count=...
-- engine='docling'           error='docling timeout after 130s (Layer 2 wall-clock)'  ...
```

To monitor how often auto-fallback is firing in production:

```sql
SELECT count(*) FROM pdf_extraction_runs WHERE engine = 'pymupdf-fallback';
```

**Operator knobs (env-only; uvicorn restart required to take effect):**

- `EXTRACTOR_DOCLING_TIMEOUT_S` (default `120`): seconds Docling has before the
  wall-clock layer fires (+10s buffer added internally). Lower for faster
  fallback on big PDFs; higher if your typical document needs more time.
- `EXTRACTOR_DOCLING_DISABLE_TABLE_STRUCTURE` (default `false`): set to
  `1`/`true`/`yes` to disable Docling's TableFormer entirely. Falls back to
  text-only table extraction. Useful when TableFormer is the consistent stall
  point.
- `EXTRACTOR_DOCLING_IMAGES_SCALE` (default `2.0`): rendered-image scale for
  figure extraction. Lower (e.g., `1.0` or `0.5`) reduces memory pressure on
  big PDFs.

**Thread-leak operator note:** Python cannot kill a thread stuck in native
code, so each Docling stall leaks ~250-500 MB of process memory until uvicorn
restarts. Under the project's single-worker mode (D-v2.5-02), this means: if
you see worker memory climb after multiple timeouts, restart the uvicorn
process. Phase 077 multi-worker hardening will revisit thread-pool isolation.

---

For deeper architectural context, see `../.planning/PROJECT.md`,
`../.planning/ROADMAP.md`, and per-phase docs under `../.planning/phases/`.
