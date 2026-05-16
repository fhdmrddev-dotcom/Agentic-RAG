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

## Extraction pipeline (post-Docling rip)

Phase 071.3 Plan 04 (D-071.3-09) hard-deleted the Docling runtime. Extraction
is now exclusively handled by the per-aspect composer
(`app.services.extraction_service.extract_composable`), which dispatches each
aspect (text / tables / images / equations) through its own independent
registry in `app.services.extractors.aspects`:

  - **text**: `legacy` (default — pypdf/python-docx), `pymupdf` (AGPL-fenced subprocess)
  - **tables**: `camelot` (default — pdfium + PDFMiner whitespace clustering, MIT), `pdfplumber`
  - **images_pdf**: `pdfplumber`, `pymupdf_full` (default — AGPL-fenced subprocess)
  - **images_docx**: `inline_shapes`, `zip_xpath` (default)
  - **equations**: `none` (default — no engine currently extracts equations)

Defaults are sourced from `app_settings.extraction_*` (migrations 045-047).
Per-call overrides via `?engines=text:legacy,tables:pdfplumber` on `/upload`
and `/reextract` (admin-gated via `app_settings.extraction_per_call_hints_enabled`).

## Troubleshooting

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

`POST /documents/{id}/reextract` — opt-in per-document re-extraction with an
engine override (Q-v2.6-04 / D-v2.6-04). Body:

```json
{ "engine": "pymupdf" | "legacy" }
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

## SC#1 latency probe (manual UAT)

Phase 071.2 D-071.2-05 — `/documents/upload` returns 201 within ~1.5s on any
size PDF; extract + chunk + multimodal happen in a BackgroundTask. To verify
against a running uvicorn (TestClient cannot measure async-defer latency —
BackgroundTasks block the response in test mode per Pitfall 1):

```bash
time curl -X POST -F "file=@thesis.pdf" -H "Authorization: Bearer $JWT" http://localhost:8000/documents/upload
# Expect: elapsed < 1.5s on a 4 MB PDF.
```

Concurrent /health probe during an in-flight thesis-PDF upload should also stay
<2s per sample (validates the threadpool sweep didn't leave a sync call behind):

```bash
while true; do time curl -s http://localhost:8000/health > /dev/null; sleep 0.5; done
```

---

For deeper architectural context, see `../.planning/PROJECT.md`,
`../.planning/ROADMAP.md`, and per-phase docs under `../.planning/phases/`.
