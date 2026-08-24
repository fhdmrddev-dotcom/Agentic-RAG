---
phase: 202
slug: 202-table-chunks-retrieval-injection-and-semantic-search
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-24
---

# Phase 202 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.x |
| **Config file** | backend/pytest.ini |
| **Quick run command** | env\\Scripts\\python -m pytest tests/unit/test_table_chunks_injection.py tests/unit/test_multimodal_extraction.py -v |
| **Full suite command** | env\\Scripts\\python -m pytest tests/unit/ -v |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run quick run command
- **Before /gsd:verify-work:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 202-01-01 | 01 | 1 | TAB-02 | — | Format table rows as markdown with header batching | unit | pytest tests/unit/test_table_chunks_injection.py -k test_format_table_chunks | ❌ W0 | ⬜ pending |
| 202-01-02 | 01 | 1 | TAB-02 | — | Ingest tables as chunks with embeddings and correct index offset | unit | pytest tests/unit/test_table_chunks_injection.py -k test_extract_and_store_tables_chunks | ❌ W0 | ⬜ pending |
| 202-01-03 | 01 | 1 | TAB-02 | — | Backfill helper generates table chunks for existing documents | unit | pytest tests/unit/test_table_chunks_injection.py -k test_backfill_table_chunks | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] ackend/tests/unit/test_table_chunks_injection.py — unit tests for table chunk formatting, embedding, insertion, and backfill
