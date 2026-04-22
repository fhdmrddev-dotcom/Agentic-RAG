---
phase: 26
slug: citations-confidence-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (installed in venv) |
| **Config file** | none — pytest auto-discovers `tests/` |
| **Quick run command** | `cd backend && source venv/Scripts/activate && python -m pytest tests/unit/test_retrieval_service.py -v` |
| **Full suite command** | `cd backend && source venv/Scripts/activate && python -m pytest tests/unit/ -v` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && source venv/Scripts/activate && python -m pytest tests/unit/test_retrieval_service.py -v`
- **After every plan wave:** Run `cd backend && source venv/Scripts/activate && python -m pytest tests/unit/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | CITE-02 | unit | `pytest tests/unit/test_retrieval_service.py -k "chunk_index" -v` | ❌ W0 | ⬜ pending |
| 26-01-02 | 01 | 1 | CITE-01/02 | unit | `pytest tests/unit/test_retrieval_service.py -v` | ✅ (fix needed) | ⬜ pending |
| 26-02-01 | 02 | 1 | CITE-01/04/05 | unit | `pytest tests/unit/test_citations_confidence.py -k "citations" -v` | ❌ W0 | ⬜ pending |
| 26-02-02 | 02 | 1 | CONF-01/02/03/04 | unit | `pytest tests/unit/test_citations_confidence.py -k "confidence" -v` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/test_citations_confidence.py` — new test file for citation accumulation, deduplication, SSE event conditions, confidence computation, disclaimer logic (CITE-04, CITE-05, CONF-01–04)
- [ ] Fix `tests/unit/test_retrieval_service.py` — add `"id"` field to mock `rpc_data` entries (6 pre-existing failures); update return-type assertions for new `(list[dict], float)` return signature

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SQL migration applies cleanly to live Supabase | CITE-02 (chunk_index) | Live RPC signature may differ from migration 002 | Run `\df match_document_chunks` in Supabase SQL editor; verify chunk_index in RETURNS TABLE before/after applying migration |
| `citations` SSE event appears in browser DevTools | CITE-01 | Full SSE stream integration requires live backend | Ask a question against a document; open DevTools → Network → EventStream; confirm `citations` event with passage text |
| `confidence` SSE event has correct level for query | CONF-01/02 | Threshold accuracy requires real embeddings | Ask factual question with strong document match; verify `confidence.level == "high"`; ask off-topic question; verify `level == "low"` with disclaimer |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
