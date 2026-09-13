---
phase: 246-the-recall-cliff-and-the-screen-that-describes-it
plan: 01
subsystem: backend / retrieval-tuning
tags: [hnsw, ef_search, server_probe, retrieval_tuning, fence, recall-01, recall-02]
requires:
  - "Phase 241 (hnsw knobs in retrieval_tuning.py)"
  - "Phase 242 (Settings screen changedFields save boundary)"
provides:
  - "Dynamic isolated probe `get_probed_server_ef_search` with 60s TTL in `retrieval_tuning.py`"
  - "Byte-identical fencing of `retrieval_service.py` (0 lines touched)"
  - "Unit test coverage for server setting probe and SET LOCAL non-poisoning"
  - "Synced `docs/HOT-FILE-LEDGER.md` entry for `retrieval_tuning.py`"
affects:
  - "backend/app/config.py"
  - "backend/app/models/user_settings.py"
  - "backend/app/services/retrieval_tuning.py"
  - "docs/HOT-FILE-LEDGER.md"
tech-stack:
  added: []
  patterns:
    - "Dynamic SQL probe (`SELECT current_setting('hnsw.ef_search', true)`) outside active transaction"
    - "TTL-cached GUC lookup (60s) to absorb live `ALTER SYSTEM/DATABASE` without app restart"
    - "Byte-level test guard (`test_retrieval_service_is_byte_unchanged`) enforcing G-5 landing fence"
key-files:
  created:
    - backend/tests/unit/test_246_hnsw_server_probe.py
  modified:
    - backend/app/config.py
    - backend/app/models/user_settings.py
    - backend/app/services/retrieval_tuning.py
    - backend/tests/unit/test_241_hnsw_knobs.py
    - docs/HOT-FILE-LEDGER.md
decisions:
  - "D-246-01: `retrieval_service.py` is strictly fenced and byte-untouched (0 lines modified) to avoid a 3rd G-5 landing."
  - "D-246-05 & Finding 2a: Server setting probe runs on a clean connection outside of any active transaction to prevent poisoning from prior `SET LOCAL` commands on pooled connections."
  - "Finding 2b: NULL return from `current_setting` (e.g. pgvector uninstalled or unknown GUC) resolves to `None` and issues no statements (graceful degradation)."
  - "Finding 2c: Probed server default is cached with a 60-second TTL rather than process-lifetime immutability, bounding operator ALTER SYSTEM desync to 60s."
  - "Finding 4: Probed server default replaces the `:155` shortcut check; `:131` and `:154` invalid fallbacks remain fail-safe."
  - "521f4a025: Default `hnsw_ef_search` was initially raised to 200, but reverted back to 40 when Wave 3 ladder measurements proved that `ef_search >= 100` triggers a 1.1s Sequential Scan."
metrics:
  duration: "~45m"
  completed: 2026-09-13
  tasks: 3
  commits: 2
  files_changed: 6
verification_mode: reviewed
reviewer: claude
reviewed_at: 2026-09-13
---

# Phase 246 Plan 01: Backend Defaults, Dynamic Server Setting Probe, and Retrieval Service Fencing — Summary

## 1 · Core Deliverables

1. **Isolated Server Setting Probe (`retrieval_tuning.py`):**
   - Replaced static `_SERVER_DEFAULT_EF_SEARCH = 40` shortcut with `get_probed_server_ef_search(conn)`.
   - The probe runs `SELECT current_setting('hnsw.ef_search', true)` on a clean connection outside of any request transaction (`in_txn == False`), ensuring that previous session-level `SET LOCAL` modifications on pooled asyncpg connections cannot poison the probed default.
   - Cached in-memory with a 60-second TTL (`_SERVER_EF_CACHE_TTL_SECONDS = 60.0`), resolving SEED-268 by ensuring runtime database configuration changes (`ALTER SYSTEM` or `ALTER DATABASE`) take effect without restarting the application.
   - If `current_setting` returns `NULL` or raises an exception (e.g. when pgvector is uninstalled), the probe returns `None`, and `apply_hnsw_session_knobs` issues no statements, falling back gracefully to server-native behavior.

2. **Strict Fencing of `retrieval_service.py`:**
   - Honored `D-246-01`: `retrieval_service.py` was left completely untouched (0 lines added, modified, or deleted).
   - Enforced by automated test `test_retrieval_service_is_byte_unchanged` in `test_246_hnsw_server_probe.py`, comparing the file hash against the phase base commit. This prevented an unwanted 3rd G-5 landing on `retrieval_service.py`.

3. **Backend Configuration & Knobs:**
   - `CODE_DEFAULT_EF_SEARCH = 40` (initially raised to 200, then reverted to 40 in `521f4a025` following the empirical discovery that `ef_search >= 100` causes the Postgres planner to abandon the HNSW index for a 1.1s Sequential Scan).
   - Synced `test_241_hnsw_knobs.py` and added 6 new test cases in `test_246_hnsw_server_probe.py` testing probe isolation, TTL expiration, NULL handling, and SET LOCAL non-poisoning.

4. **Hot-File Ledger Sync:**
   - Updated `docs/HOT-FILE-LEDGER.md` entry for `retrieval_tuning.py` to `4 / 2 / 364 | no (2 phases)`, keeping the ledger synchronized in the same commit.

## 2 · Verification Results

- `pytest backend/tests/unit/test_241_hnsw_knobs.py backend/tests/unit/test_246_hnsw_server_probe.py`: **48/48 passed**.
- `retrieval_service.py` fence: **0 lines modified**, byte-identical.
- `node scripts/check-hot-file-ledger.cjs 246`: **Passed** (0 missing rows).
