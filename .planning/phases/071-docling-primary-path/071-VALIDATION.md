---
phase: 071
slug: docling-primary-path
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 071 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Authored from `071-RESEARCH.md` § "Validation Architecture"; the planner fills the Per-Task Verification Map after PLAN.md generation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (existing — `backend/requirements.txt`) |
| **Config file** | `backend/pytest.ini` / `backend/conftest.py` |
| **Quick run command** | `cd backend && source venv/bin/activate && pytest tests/integration/test_docling_extractor.py tests/integration/test_pymupdf_fence.py -x --tb=short` |
| **Full suite command** | `cd backend && source venv/bin/activate && pytest tests/ -x --tb=short` |
| **Estimated runtime** | ~30s quick / ~3–5 min full (Docling first-call cold-start dominates) |

---

## Sampling Rate

- **After every task commit:** Run quick command (per-extractor tests + fence invariant)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green + live UAT on `551f03f9-...` thesis pair captured in `071-VERIFICATION.md`
- **Max feedback latency:** 30 seconds for quick; 5 minutes for full

---

## Per-Task Verification Map

*(Filled by planner during PLAN.md generation. Populated rows follow the schema below.)*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 071-01-01..NN | 01 | 1 | RAG-DOCLING-01 | T-071-01-NN | Migration applied + RLS preserved | manual + grep | `grep -c "CREATE TABLE pdf_extraction_runs" supabase/full-schema.sql` | ❌ W0 | ⬜ pending |
| 071-02-01..NN | 02 | 2 | RAG-DOCLING-01 | T-071-02-NN | Docling adapter produces ExtractedDocument with extractor_name + bbox | unit + integration | `pytest tests/integration/test_docling_extractor.py -x` | ❌ W0 | ⬜ pending |
| 071-03-01..NN | 03 | 2 | RAG-DOCLING-01 | T-071-03-NN | `fitz` not in parent `sys.modules`; child stdin/stdout JSON contract; timeout fail-loud | unit + integration | `pytest tests/integration/test_pymupdf_fence.py -x` | ❌ W0 | ⬜ pending |
| 071-04-01..NN | 04 | 3 | RAG-DOCLING-01 | T-071-04-NN | `/reextract` returns 202 + queues background task; owner-only RLS; engine value required | integration + manual UAT | `pytest tests/integration/test_documents.py::test_reextract -x` + Chrome MCP UAT on 551f03f9 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_docling_extractor.py` — NEW test file (Plan 02). Asserts `DoclingExtractor.extract()` on `academic_synth.pdf` returns `ExtractedDocument` with `text != ""`, `len(tables) >= 5`, `len(images) >= 5`, `extractor_name == 'docling'`, every `TableData.bbox` populated, every `ImageData.bbox` populated.
- [ ] `backend/tests/integration/test_pymupdf_fence.py` — NEW test file (Plan 03). Two test classes:
  1. `TestChildEntrypoint` — invokes `python -m extractors.pymupdf_isolated --mime application/pdf` via `subprocess.run`, asserts non-zero `len(tables)` + `len(images)` + valid JSON stdout shape.
  2. `TestParentWrapperAGPLInvariant` — asserts `'fitz' not in sys.modules` BEFORE and AFTER calling `PyMuPDFExtractor().extract(raw, 'application/pdf')`; mocks `subprocess.run` for fast path; uses real subprocess for invariant test.
- [ ] `backend/tests/integration/test_documents.py` — EXTEND existing file (Plan 04). Add `test_reextract_happy_path`, `test_reextract_invalid_engine_returns_400`, `test_reextract_missing_engine_returns_400`, `test_reextract_owner_only_rls`.
- [ ] `backend/tests/fixtures/extraction/academic_synth.pdf` + `academic_synth.docx` — NEW fixtures (Plan 02). Generated via `reportlab` + `python-docx`, ~5 tables + 5 embedded images, committed to repo (license-clean).
- [ ] `backend/conftest.py` extension — fixture for fresh-state Docling converter (autouse=False, opt-in via marker `@pytest.mark.docling_cold` for cold-start tests) — optional, only if Plan 02 task surfaces flaky shared-singleton tests.

*Pytest framework is already installed; no new framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **SC#1 — 20% table/image count delta on real-world thesis PDF + DOCX siblings** | RAG-DOCLING-01 | Reference doc (`551f03f9-...`) is copyrighted; cannot redistribute as a fixture. Synthetic CI fixture is additive but NOT the binding gate (D-071-15..16). | (1) Open Supabase Studio, locate `551f03f9-...` PDF + sibling DOCX. (2) Drive Chrome MCP to `http://localhost:5173/`, log in as `fhdmrd@gmail.com / 123456`. (3) For each doc, hit `POST /documents/{id}/reextract {"engine":"docling"}` via Studio REST tab or curl. (4) Wait for `status='completed'`. (5) `SELECT count(*) FROM document_tables WHERE document_id = '<pdf>'` and same for DOCX; same for `document_images`. (6) Assert `abs(pdf - docx) / max(pdf, docx) <= 0.2` for both. (7) Record before/after counts in `071-VERIFICATION.md`. |
| **Migration 043 dedup winner sanity** | CQ-DEDUP-01 (bundled) | Dedup DELETE picks oldest `ctid` per group; if the user's dev DB happens to have meaningful duplicates with semantic content in the "newer" row, oldest-wins would lose data silently. | (1) Run the DRY-RUN SELECT in Plan 01 Task 5 BEFORE applying migration 043. (2) Surface duplicate count to user. (3) If count > 0, get user confirmation that oldest-wins is acceptable for their data before applying. |
| **Docling pre-warm runbook line** | RAG-DOCLING-01 (operational) | Pre-pull command must succeed on a fresh deploy clone with empty `~/.cache/docling`. Pure dev-machine check; not automatable in CI without 600 MB cache invalidation. | (1) Delete `~/.cache/docling` locally. (2) Run the runbook one-liner from `backend/README.md` Plan 04 addition. (3) Confirm first subsequent `DoclingExtractor.extract()` call completes in normal latency (~2s warmed) not cold (~60–120s). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner ensures during PLAN.md generation)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the 4 NEW test files + 2 fixtures listed above)
- [ ] No watch-mode flags in any pytest invocation
- [ ] Feedback latency < 30s for quick run
- [ ] `nyquist_compliant: true` set in frontmatter (flip after planner fills Per-Task Verification Map and gsd-plan-checker passes)

**Approval:** pending
