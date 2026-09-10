---
phase: 232
slug: the-source-contract-google-drive
status: ready_for_execution
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-05
updated: 2026-09-05
---

# Phase 232 — Validation Strategy & Matrix

> Validation contract and verification requirements for The Source Contract + Google Drive (`SRC-01`, `SRC-02`).

---

## 1. Requirement Validation Matrix

| Requirement / Criterion | Behavior / Truth to Prove | Validation Method | Automated Test Suite |
|---|---|---|---|
| **SRC-01 / SC#4** | A source family that exists only in the test suite appears in the product's own source picker and browses exactly like Drive | Conformance Suite & Component Test | `pytest backend/tests/unit/services/sources/test_source_adapter_conformance.py` & `npm run test:unit frontend/src/components/sources/SourceFolderPicker.test.tsx` |
| **SRC-01 / SC#3** | Pulling a single named file in from a connection (`POST /connections/{id}/files/{file_id}/import`) still works identically through `async_mint_document_row` | Unit & Integration Test | `pytest backend/tests/unit/services/sources/test_import_service.py` & `backend/tests/unit/test_connector_file_import.py` |
| **SRC-01 / Boundary** | Zero `provider ==` or `service_id ==` branching exists outside `services/sources/adapters/` for cloud storage operations | Boundary Fence Test | `pytest backend/tests/unit/services/sources/test_boundary_fence.py` |
| **SRC-02 / SC#1** | A person with a connected Google account browses their Drive folder tree inside the product and picks a folder | Component & Unit Tests | `npm run test:unit frontend/src/components/sources/SourceFolderPicker.test.tsx` & `pytest backend/tests/unit/services/sources/test_google_drive_adapter.py` |
| **SRC-02 / SC#2** | Drive browsing includes Shared Drives alongside My Drive, querying `/drives` and applying `supportsAllDrives=true` | Unit Test (Mocked) & Owed Drive | `pytest backend/tests/unit/services/sources/test_google_drive_adapter.py -k test_shared_drives` |
| **G-1 Test Protection** | `cloud_storage.py` deleted without introducing collection errors across existing test files | Re-pointed Test Run | `pytest backend/tests/unit/test_connector_file_import.py backend/tests/integration/test_chat_connectors_e2e.py backend/tests/unit/test_service_tools.py backend/tests/integration/test_connector_import_splice.py backend/tests/unit/test_connector_org_scope_and_refusals.py -v` |
| **G-5 Partial Discharge** | `connectors.py` line count reduced; `connectors.py`, `egress.py`, and `connectors.ts` ledgers updated | Size & Ledger Gate | `node scripts/check-claude-md-size.cjs` |

---

## 2. Mechanical Gate Baselines

| Gate | Command | Baseline / Passing Threshold |
|---|---|---|
| **Frontend Typecheck** | `npx tsc -p frontend/tsconfig.app.json --noEmit` | **66 errors** (exact baseline, zero new) |
| **Backend Unit Gate** | `pytest tests/unit -q --continue-on-collection-errors` | `failed <= 72`, `passed >= 3530`, **`0 collection errors`** |
| **Phase 232 Conformance Suite** | `pytest backend/tests/unit/services/sources/test_source_adapter_conformance.py -v` | 100% pass |
| **Phase 232 Drive Adapter Suite** | `pytest backend/tests/unit/services/sources/test_google_drive_adapter.py -v` | 100% pass |
| **Phase 232 Import Service Suite** | `pytest backend/tests/unit/services/sources/test_import_service.py -v` | 100% pass |
| **Phase 232 Boundary Fence Suite** | `pytest backend/tests/unit/services/sources/test_boundary_fence.py -v` | 100% pass |
| **Deploy Drift Gate** | `bash scripts/check-deploy-drift.sh` | **PASS — 0 drift** |
| **CLAUDE.md Budget Gate** | `node scripts/check-claude-md-size.cjs` | `< 150,000 characters` |
| **Vitest Count Gate** | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | Pinned suites 100% passing (failed <= 2 inherited BUS-114) |

---

## 3. SC#10 Cross-Provider Evaluation

**Determination:** Does NOT fire for Phase 232.
Phase 232 introduces inbound cloud storage source adapters (Google Drive and Mock Source) and refactors cloud file import. It does not touch LLM model routing, embedding provider routing, or multi-provider API gateways.

---

## 4. Owed Drives Register

| Item ID | Target Feature | Description | Status | Re-open Trigger |
|---|---|---|---|---|
| **OD-232-01** | Live Shared Drive Enumeration | Drive `/drives` endpoint and `supportsAllDrives=true` query against a real Google Workspace tenant containing shared drives | **INFERRED (OWED DRIVE)** | Drive before v4.0 closeout when live Google Workspace credentials with shared drives are available in staging |
