---
phase: 36
slug: multi-modal-query-library-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (existing) |
| **Config file** | `backend/pytest.ini` (or none — tests run via `cd backend && python -m pytest`) |
| **Quick run command** | `cd "C:/Vibe Apps/Agentic RAG/backend" && python -m pytest tests/unit/test_multimodal_query.py -x -q` |
| **Full suite command** | `cd "C:/Vibe Apps/Agentic RAG/backend" && python -m pytest tests/ -x -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd "C:/Vibe Apps/Agentic RAG/backend" && python -m pytest tests/unit/test_multimodal_query.py -x -q`
- **After every plan wave:** Run `cd "C:/Vibe Apps/Agentic RAG/backend" && python -m pytest tests/ -x -q`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 36-01-01 | 01 | 1 | MODAL-03 | — | N/A | unit | `pytest tests/unit/test_multimodal_query.py::test_image_chunk_insertion -x` | ❌ W0 | ⬜ pending |
| 36-01-02 | 01 | 1 | MODAL-03 | — | N/A | unit | `pytest tests/unit/test_multimodal_query.py::test_image_chunk_skips_empty_description -x` | ❌ W0 | ⬜ pending |
| 36-02-01 | 02 | 1 | MODAL-03 | — | N/A | unit | `pytest tests/unit/test_multimodal_query.py::test_query_tables_returns_data -x` | ❌ W0 | ⬜ pending |
| 36-02-02 | 02 | 1 | MODAL-03 | — | N/A | unit | `pytest tests/unit/test_multimodal_query.py::test_query_tables_document_not_found -x` | ❌ W0 | ⬜ pending |
| 36-02-03 | 02 | 1 | MODAL-03 | — | N/A | unit | `pytest tests/unit/test_multimodal_query.py::test_query_tables_column_filter -x` | ❌ W0 | ⬜ pending |
| 36-02-04 | 02 | 1 | MODAL-03 | — | N/A | unit | `pytest tests/unit/test_multimodal_query.py::test_query_tables_row_cap -x` | ❌ W0 | ⬜ pending |
| 36-03-01 | 03 | 2 | MODAL-03 | — | N/A | unit | `pytest tests/unit/test_openai_service.py::test_query_tables_in_general_not_explorer -x` | ❌ W0 | ⬜ pending |
| 36-04-01 | 04 | 2 | MODAL-03 | — | N/A | integration | `pytest tests/integration/test_documents.py::test_list_documents_includes_modal_counts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_multimodal_query.py` — 6 unit tests covering MODAL-03 (query_tables service, image chunk insertion)
- [ ] `backend/tests/integration/test_documents.py` — add 1 test for modal counts in list_documents response
- [ ] `backend/tests/unit/test_openai_service.py` — add 1 test verifying QUERY_TABLES_TOOL presence/absence

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Frontend badges render correctly in DocumentList | MODAL-03 | UI rendering requires browser | Upload a PDF with tables/images; verify "N tables / N imgs" chips appear in filename cell |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
