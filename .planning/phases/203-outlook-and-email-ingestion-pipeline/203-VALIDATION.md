---
phase: 203
slug: 203-outlook-and-email-ingestion-pipeline
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-24
validated: 2026-08-24
---

# Phase 203 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.x |
| **Config file** | backend/pytest.ini |
| **Quick run command** | `backend\venv\Scripts\python -m pytest backend/tests/unit/test_email_ingestion.py -v` |
| **Full suite command** | `backend\venv\Scripts\python -m pytest backend/tests/unit/ -v` |
| **Estimated runtime** | ~6 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run quick run command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 6 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 203-01-01 | 01 | 1 | EML-01 | — | Parse RFC-822 (.eml) with header metadata extraction | unit | `pytest backend/tests/unit/test_email_ingestion.py -k test_parse_eml` | ✅ | ✅ green |
| 203-01-02 | 01 | 1 | EML-01 | — | Parse Outlook (.msg) with header metadata extraction | unit | `pytest backend/tests/unit/test_email_ingestion.py -k test_parse_msg` | ✅ | ✅ green |
| 203-01-03 | 01 | 1 | EML-02 | — | Strip quoted reply and forwarding trails from body text | unit | `pytest backend/tests/unit/test_email_ingestion.py -k test_strip_quoted_replies` | ✅ | ✅ green |
| 203-01-04 | 01 | 1 | EML-02 | — | Extract attachments and create linked document records | unit | `pytest backend/tests/unit/test_email_ingestion.py -k test_attachment_extraction` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/tests/unit/test_email_ingestion.py` — unit tests for .msg and .eml extraction, metadata, reply stripping, and attachment linking (10 tests, all passing)

---

## Validation Audit 2026-08-24

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Automated unit tests passing | 10 / 10 in `test_email_ingestion.py` (56/56 full suite) |
| Nyquist status | Compliant |

