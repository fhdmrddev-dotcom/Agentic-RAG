---
phase: 071
slug: docling-primary-path
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-14
last_updated: 2026-05-14
---

# Phase 071 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Authored from `071-RESEARCH.md` § "Validation Architecture"; the Per-Task Verification Map below is filled in with the actual task IDs from the 4 PLAN.md files.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest >= 8.0 + pytest-asyncio >= 0.24 + pytest-timeout >= 2.4 (existing — `backend/requirements.txt:24-26`) |
| **Config file** | `backend/pyproject.toml` / `backend/pytest.ini` (verified by Phase 070 spike) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/integration/test_pdf_extractor_docling_compat.py tests/integration/test_docling_extractor.py tests/integration/test_pymupdf_fence.py tests/unit/test_extraction_service.py -x --tb=short` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ --timeout=60 -q` |
| **Estimated runtime** | ~30s quick / ~3–5 min full (Docling first-call cold-start dominates) |

---

## Sampling Rate

- **After every task commit:** Run quick command (per-extractor tests + fence invariant)
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green + live UAT on `551f03f9-...` thesis pair captured in `071-VERIFICATION.md`
- **Max feedback latency:** 30 seconds for quick; 5 minutes for full

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 071-01-01 | 01 | 1 | RAG-DOCLING-01 | T-071-01-03/06 | Migration 039 file authored with RLS + no CHECK on engine | grep | `grep -c "CREATE TABLE IF NOT EXISTS public.pdf_extraction_runs\|ENABLE ROW LEVEL SECURITY\|pdf_extraction_runs_select_own" supabase/migrations/039_pdf_extraction_runs.sql` | ✅ task creates | ⬜ pending |
| 071-01-02 | 01 | 1 | RAG-DOCLING-01 | T-071-01-01 | Migrations 040/041/042/044 ADD COLUMN files + idempotent backfill | grep | `ls supabase/migrations/04{0,1,2,4}_*.sql \| wc -l` returns 4 | ✅ task creates | ⬜ pending |
| 071-01-03 | 01 | 1 | RAG-DOCLING-01 | T-071-01-04 | HUMAN — apply 5 migrations via Supabase SQL editor + sanity SELECT | manual | live-DB column-existence SQL returns all 1s | ❌ live DB | ⬜ pending |
| 071-01-04 | 01 | 1 | RAG-DOCLING-01 | T-071-01-04 | Regen full-schema.sql + commit migrations + regen together | grep | `grep -c "pdf_extraction_runs" supabase/full-schema.sql` ≥ 1 | ✅ task regens | ⬜ pending |
| 071-01-05 | 01 | 1 | RAG-DOCLING-01 | T-071-01-02 | DRY-RUN dedup count + author migration 043 | grep | `grep -c "DELETE FROM public.documents\|CREATE UNIQUE INDEX IF NOT EXISTS documents_dedup_idx" supabase/migrations/043_documents_dedup_unique_index.sql` returns 2 | ✅ task creates | ⬜ pending |
| 071-01-06 | 01 | 1 | RAG-DOCLING-01 | T-071-01-02 | HUMAN — review dedup count + apply migration 043 | manual | post-apply re-run dry-run returns 0 dupes | ❌ live DB | ⬜ pending |
| 071-01-07 | 01 | 1 | RAG-DOCLING-01 | T-071-01-05 | Wire app_settings reader hookup in user_settings.py | grep + python | `grep -cE "multimodal_max_(vision_calls\|b64_bytes_kb)" backend/app/models/user_settings.py` ≥ 4 | ✅ task edits | ⬜ pending |
| 071-01-08 | 01 | 1 | RAG-DOCLING-01 | T-071-01-04 | Final regen + 6-migration audit | grep | `ls supabase/migrations/0{39,40,41,42,43,44}_*.sql \| wc -l` returns 6 + `grep -c "documents_dedup_idx" supabase/full-schema.sql` ≥ 1 | ✅ task regens | ⬜ pending |
| 071-02-01 | 02 | 2 | RAG-DOCLING-01 | T-071-02-06 | Extend ExtractedDocument/TableData/ImageData + dispatcher rewire; Phase 069 goldens refresh | pytest | `cd backend && venv/Scripts/python -m pytest tests/unit/test_extraction_service.py -x --tb=short` exits 0 | ✅ task edits | ⬜ pending |
| 071-02-02 | 02 | 2 | RAG-DOCLING-01 | T-071-02-01/03 | DoclingExtractor adapter with singleton + generate_picture_images=True + document_timeout=120.0 | python | `cd backend && venv/Scripts/python -c "from app.services.extractors.docling import DoclingExtractor; e = DoclingExtractor(); assert e.supports('application/pdf'); print('OK')"` exits 0 | ✅ task creates | ⬜ pending |
| 071-02-03 | 02 | 2 | RAG-DOCLING-01 | T-071-02-04 | Synthetic academic_synth.{pdf,docx} fixtures + test_docling_extractor.py (≥5 tables + ≥5 images per sibling) | pytest | `cd backend && venv/Scripts/python -m pytest tests/integration/test_docling_extractor.py -x --tb=short` exits 0 | ✅ task creates | ⬜ pending |
| 071-02-04 | 02 | 2 | RAG-DOCLING-01 | T-071-02-02/05/07 | pdf_extraction_runs telemetry writes (happy + except arms) + engine_override threading + Phase 072 TODO comments | pytest | `cd backend && venv/Scripts/python -m pytest tests/integration/test_pdf_extractor_docling_compat.py tests/integration/test_docling_extractor.py tests/unit/test_extraction_service.py -x --tb=short` exits 0 | ✅ task edits | ⬜ pending |
| 071-03-01 | 03 | 2 | RAG-DOCLING-01 | T-071-03-02 | backend/extractors/pymupdf_isolated.py child entrypoint — the only `import fitz` in the codebase | python subprocess | child reads stdin bytes + writes JSON on stdout; smoke test runs in Task 1 | ✅ task creates | ⬜ pending |
| 071-03-02 | 03 | 2 | RAG-DOCLING-01 | T-071-03-01/04/05 | PyMuPDFExtractor parent wrapper + env scrubbing + cwd resolution; ExtractionError class | python | AGPL fence smoke-check prints `AGPL fence: OK` | ✅ task creates | ⬜ pending |
| 071-03-03 | 03 | 2 | RAG-DOCLING-01 | n/a | pymupdf>=1.24 in requirements.txt + AGPL comment block; PYMUPDF_TIMEOUT_S in .env.example; D-070-14 preserved | pytest | `cd backend && venv/Scripts/python -m pytest tests/integration/test_pdf_extractor_docling_compat.py -x --tb=short` exits 0 (no resolver regression) | ✅ task edits | ⬜ pending |
| 071-03-04 | 03 | 2 | RAG-DOCLING-01 | T-071-03-01/02/03/04 | 4 binding tests in test_pymupdf_fence.py | pytest | `cd backend && venv/Scripts/python -m pytest tests/integration/test_pymupdf_fence.py -x --tb=short` exits 0 (all 5 tests pass) | ✅ task creates | ⬜ pending |
| 071-04-01 | 04 | 3 | RAG-DOCLING-01 | T-071-04-01/02 | POST /reextract route + Pydantic Literal body + owner-only RLS + hard delete + engine_override threading | python import | `cd backend && venv/Scripts/python -c "from app.api.documents import reextract_document, ReextractRequest; print('OK')"` exits 0 | ✅ task edits | ⬜ pending |
| 071-04-02 | 04 | 3 | RAG-DOCLING-01 | T-071-04-01/02/03 | 4 binding tests in TestReextractDocument (happy + 422 invalid + 422 missing + 404 RLS) | pytest | `cd backend && venv/Scripts/python -m pytest tests/integration/test_documents.py::TestReextractDocument -x --tb=short` exits 0 | ✅ task creates | ⬜ pending |
| 071-04-03 | 04 | 3 | RAG-DOCLING-01 | n/a | D-v2.6-04 row in PROJECT.md + backend/README.md with Docling Pre-Pull section | grep | `grep -c "D-v2.6-04" .planning/PROJECT.md` ≥ 1 + `grep -c "Docling Pre-Pull\|DocumentConverter()" backend/README.md` ≥ 2 | ✅ task creates | ⬜ pending |
| 071-04-04 | 04 | 3 | RAG-DOCLING-01 | n/a | Commit Plan 04 pre-UAT work + author 071-VERIFICATION.md skeleton | manual | git log shows the pre-UAT commit + 071-VERIFICATION.md exists with `gate_threshold: 0.20` | ✅ task creates | ⬜ pending |
| 071-04-05 | 04 | 3 | RAG-DOCLING-01 | T-071-04-06/07 | HUMAN — live UAT on 551f03f9-... PDF/DOCX siblings via Chrome MCP + Supabase Studio | manual + SQL | `abs(pdf - docx) / max(pdf, docx) <= 0.20` for both `document_tables` and `document_images` counts; both 'docling' telemetry rows have `error IS NULL` | ❌ live DB | ⬜ pending |
| 071-04-06 | 04 | 3 | RAG-DOCLING-01 | n/a | Author 071-SUMMARY.md + final commit | grep | `grep -c "Plan 0[1-4]\|SC#[1-5]" .planning/phases/071-docling-primary-path/071-SUMMARY.md` ≥ 9 | ✅ task creates | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_docling_extractor.py` — NEW test file (Plan 02 Task 3). Asserts `DoclingExtractor.extract()` on `academic_synth.pdf` returns `ExtractedDocument` with `text != ""`, `len(tables) >= 5`, `len(images) >= 5`, `extractor_name == 'docling'`, every `TableData.bbox` populated, every `ImageData.bbox` populated.
- [ ] `backend/tests/integration/test_pymupdf_fence.py` — NEW test file (Plan 03 Task 4). Two test classes:
  1. Module-level + `TestParentWrapperAGPLInvariant` — `test_fitz_not_imported_by_parent` (RESEARCH.md Pattern 4 verbatim).
  2. `TestChildEntrypoint` — `test_pymupdf_child_extracts_reference`, `test_pymupdf_child_strips_supabase_env`, `test_pymupdf_parent_wrapper_happy_path`, `test_pymupdf_child_timeout_raises_extraction_error`.
- [ ] `backend/tests/integration/test_documents.py` — EXTEND existing file (Plan 04 Task 2). Add `TestReextractDocument` class with 4 binding tests: happy_path / invalid_engine / missing_engine / owner_only_rls.
- [ ] `backend/tests/fixtures/extraction/academic_synth.pdf` + `academic_synth.docx` — NEW fixtures (Plan 02 Task 3). Generated via `reportlab` + `python-docx`, ~5 tables + 5 embedded images each, committed to repo (license-clean).
- [ ] Pre-pull command for first-time machines (committed in `backend/README.md` Docling Pre-Pull section, Plan 04 Task 3): `python -c "from docling.document_converter import DocumentConverter; DocumentConverter().convert('tests/fixtures/extraction/reference.pdf')"`.

*Pytest framework is already installed; no new framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **SC#1 — 20% table/image count delta on real-world thesis PDF + DOCX siblings** | RAG-DOCLING-01 | Reference doc (`551f03f9-...`) is copyrighted; cannot redistribute as a fixture. Synthetic CI fixture is additive but NOT the binding gate (D-071-15..16). | See Plan 04 Task 5 — full UAT protocol + before/after capture in `071-VERIFICATION.md`. |
| **Migration 043 dedup winner sanity** | CQ-DEDUP-01 (bundled) | Dedup DELETE picks oldest `ctid` per group; if the user's dev DB happens to have meaningful duplicates with semantic content in the "newer" row, oldest-wins would lose data silently. | Plan 01 Task 5 runs DRY-RUN SELECT capturing the count; Plan 01 Task 6 is the human checkpoint that surfaces the count + confirms apply (or aborts with `abort:newest-wins`). |
| **Docling pre-warm runbook line** | RAG-DOCLING-01 (operational) | Pre-pull command must succeed on a fresh deploy clone with empty `~/.cache/docling`. Pure dev-machine check; not automatable in CI without 600 MB cache invalidation. | Plan 04 Task 5 step (Prerequisites): delete `~/.cache/docling` locally, run the runbook one-liner from `backend/README.md`, confirm subsequent extract is warm (~2s) not cold (~60-120s). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (planner confirmed during PLAN.md generation)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (manual checkpoints 071-01-03, 071-01-06, 071-04-05 are explicitly bracketed by automated verifies in their neighbors)
- [x] Wave 0 covers all MISSING references (the 4 NEW test files + 2 fixtures listed above)
- [x] No watch-mode flags in any pytest invocation
- [x] Feedback latency < 30s for quick run
- [x] `nyquist_compliant: true` set in frontmatter
- [ ] `wave_0_complete: true` — flip after Wave 0 tasks (Plan 02 Task 3 + Plan 03 Task 4 + Plan 04 Task 2 fixtures + tests) land green

**Approval:** approved for execution (planner sign-off 2026-05-14)
