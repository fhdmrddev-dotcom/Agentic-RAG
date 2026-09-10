---
phase: 229
slug: the-one-ingest-splice
status: ready_for_execution
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-05
updated: 2026-09-05
---

# Phase 229 — Validation Strategy & Matrix

> Validation contract and verification requirements for The One Ingest Splice (`TRUST-01`).

---

## 1. Requirement Validation Matrix

| Requirement / Criterion | Behavior / Truth to Prove | Validation Method | Automated Test Suite |
|---|---|---|---|
| **TRUST-01 / SC#1** | A user pulls a file from a connector and it enters Library without error (resolving `PGRST204` `storage_path` column error) | Integration Test | `pytest backend/tests/integration/test_connector_import_splice.py` |
| **TRUST-01 / SC#2** | File arriving via upload or connector produces identical Library documents (same dedupe outcome, versioning, folder, chunks, metadata) | Integration Test | `pytest backend/tests/integration/test_connector_import_splice.py` |
| **TRUST-01 / SC#3** | Email with 2 attachments puts both into Library or records failure in manifest; one bad attachment never drops the other | Integration Test | `pytest backend/tests/integration/test_email_attachment_cascade_splice.py` |
| **TRUST-01 / SC#4** | Re-uploading an existing file produces identical version numbers and deduplication outcomes with zero observable drift on upload path | Integration Test | `pytest backend/tests/integration/test_connector_import_splice.py` & `pytest backend/tests/unit/test_documents.py` |
| **BUS-106 Inference** | Two distinct emails carrying identical attachment both succeed without `documents_dedup_idx` unique constraint collision | Integration Test | `pytest backend/tests/integration/test_email_attachment_cascade_splice.py` |
| **Splice Core** | `mint_document_row`, `MintResult`, folder validation, and `splice_document` execution contract | Unit Tests | `pytest backend/tests/unit/test_ingest_splice.py` |
| **G-5 Discharge** | `backend/app/api/documents.py` ledger row and `docs/HOT-FILE-LEDGER.md` section updated in same commit | Repo Audit / Git Diff | `git diff --name-only HEAD~1` (checks atomic commit) |

---

## 2. Mechanical Gate Baselines

| Gate | Command | Passing Threshold |
|---|---|---|
| **Backend Unit Gate** | `node scripts/check-backend-unit-baseline.cjs` | `failed <= 71`, `errors == 0` |
| **Phase 229 Unit Suite** | `pytest backend/tests/unit/test_ingest_splice.py -v` | 100% pass |
| **Phase 229 Integration 1** | `pytest backend/tests/integration/test_connector_import_splice.py -v` | 100% pass |
| **Phase 229 Integration 2** | `pytest backend/tests/integration/test_email_attachment_cascade_splice.py -v` | 100% pass |
| **Frontend Typecheck** | `npm run typecheck` or `npx tsc --noEmit` | Exact match (66 errors) |
| **Deploy Drift** | `bash scripts/check-deploy-drift.sh` | 0 drift |
| **CLAUDE.md Size** | `node scripts/check-claude-md-size.cjs` | < 120,000 characters |
