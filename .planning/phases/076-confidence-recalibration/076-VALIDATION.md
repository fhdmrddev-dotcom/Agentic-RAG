---
phase: 076
slug: confidence-recalibration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 076 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | backend/pytest.ini |
| **Quick run command** | `pytest backend/tests/unit/test_citations_confidence.py -q` |
| **Full suite command** | `pytest backend/tests/unit/test_citations_confidence.py backend/tests/test_knowledge_health.py -q` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest backend/tests/unit/test_citations_confidence.py -q`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled during planning) | | | RAG-RECAL-01 | n/a | n/a | unit + integration | pytest backend/tests/unit/test_citations_confidence.py -q | YES | pending |

---

## UAT Bandwidth (MANDATORY per CLAUDE.md)

Phase 076 touches retrieval confidence scoring — applies to cross-provider × multi-tool scenarios:

| Axis | Required coverage |
|------|-------------------|
| Cross-provider | Calibration script runs against real corpus regardless of provider (embeddings are model-agnostic — text-embedding-3-small) |
| Multi-tool | At least 1 calibration query exercises search_documents in a multi-tool prompt context |
| Parallel-thread | Not applicable (calibration is offline script, not runtime-concurrent) |
| Long-message | At least 1 calibration query from a long conversation context (≥50 messages) if audit_log has one |

---

## Validation Architecture Notes

- Primary validation: calibration script outputs JSON with distribution percentiles + recommended thresholds
- Secondary validation: `test_citations_confidence.py` assertions updated to match new thresholds (if thresholds change)
- Telemetry validation: SQL query confirming `pdf_extraction_runs.engine` populated for post-071.3 uploads
- Schema preservation: grep-verify `messages.confidence_*` columns unchanged in full-schema.sql
